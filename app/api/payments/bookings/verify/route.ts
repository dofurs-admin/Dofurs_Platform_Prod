import { NextResponse } from 'next/server';
import { ADMIN_ROLES, forbidden, requireApiRole } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { fetchRazorpayPayment, verifyPaymentSignature } from '@/lib/payments/razorpay';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { createBooking } from '@/lib/bookings/service';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
import { buildServiceInvoiceLineItemsForBooking } from '@/lib/payments/serviceInvoiceItems';
import { createDiscountRedemption } from '@/lib/bookings/discounts';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { deductCredits } from '@/lib/credits/wallet';
import { getISTTimestamp } from '@/lib/utils/date';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
};

type CheckoutMetadata = {
  checkout_context?: string;
  provider_order_id?: string;
  booking_payload?: unknown;
  booking_bundle_payload?: unknown;
  price_breakdown?: {
    discountId?: string | null;
    discountAmount?: number;
    finalAmount?: number;
    baseAmount?: number;
    walletCreditsAppliedInr?: number;
    payableAmount?: number;
    discountCode?: string | null;
  };
  [key: string]: unknown;
};

function normalizeStoredBookingPayload(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const normalized = { ...input } as Record<string, unknown>;

  if (normalized.discountCode === null) {
    delete normalized.discountCode;
  }

  return normalized;
}

function normalizeStoredBookingBundlePayload(input: unknown) {
  if (!Array.isArray(input)) {
    return null;
  }

  return input.map((item) => normalizeStoredBookingPayload(item));
}

function mergeAddOns(
  payloads: Array<{ addOns?: Array<{ id: string; quantity: number }> }>,
) {
  const quantityById = new Map<string, number>();

  for (const payload of payloads) {
    for (const addOn of payload.addOns ?? []) {
      const current = quantityById.get(addOn.id) ?? 0;
      quantityById.set(addOn.id, current + Math.max(1, Number(addOn.quantity ?? 1)));
    }
  }

  return Array.from(quantityById.entries()).map(([id, quantity]) => ({ id, quantity }));
}

function buildBundleSummaryNote(payloads: Array<{ petId: number; providerServiceId: string; startTime: string }>) {
  if (payloads.length <= 1) {
    return null;
  }

  const lines = payloads.map(
    (payload, index) => `${index + 1}. Pet ${payload.petId} | Service ${payload.providerServiceId} | Start ${payload.startTime}`,
  );

  return [`Bundled services (${payloads.length})`, ...lines].join('\n');
}

async function hasPetAccessForUser(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  targetUserId: string,
  userEmail: string | null,
  petId: number,
) {
  const { data: petOwnership, error: petOwnershipError } = await admin
    .from('pets')
    .select('id')
    .eq('id', petId)
    .eq('user_id', targetUserId)
    .maybeSingle<{ id: number }>();

  let hasPetAccess = !petOwnershipError && Boolean(petOwnership);

  if (!hasPetAccess) {
    const { data: sharedAccess, error: sharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', petId)
      .eq('shared_with_user_id', targetUserId)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{
        id: string;
        role: string | null;
        status: string;
        accepted_at: string | null;
        revoked_at: string | null;
      }>();

    if (!sharedAccessError && sharedAccess) {
      hasPetAccess =
        (sharedAccess.status === 'active' ||
          sharedAccess.status === 'accepted' ||
          Boolean(sharedAccess.accepted_at)) &&
        sharedAccess.role === 'manager';
    }
  }

  if (!hasPetAccess && userEmail) {
    const { data: emailSharedAccess, error: emailSharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', petId)
      .ilike('invited_email', userEmail)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{
        id: string;
        role: string | null;
        status: string;
        accepted_at: string | null;
        revoked_at: string | null;
      }>();

    if (!emailSharedAccessError && emailSharedAccess) {
      hasPetAccess =
        (emailSharedAccess.status === 'active' ||
          emailSharedAccess.status === 'accepted' ||
          Boolean(emailSharedAccess.accepted_at)) &&
        emailSharedAccess.role === 'manager';

      if (hasPetAccess) {
        await admin
          .from('pet_shares')
          .update({
            shared_with_user_id: targetUserId,
            status: 'active',
            accepted_at: emailSharedAccess.accepted_at ?? getISTTimestamp(),
            revoked_at: null,
          })
          .eq('id', emailSharedAccess.id);
      }
    }
  }

  return hasPetAccess;
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user, role } = auth.context;
  const admin = getSupabaseAdminClient();
  const isAdminRole = role !== null && ADMIN_ROLES.includes(role);

  const rate = await isRateLimited(supabase, getRateLimitKey('payments:bookings:verify', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const providerOrderId = typeof body?.providerOrderId === 'string' ? body.providerOrderId : '';
  const providerPaymentId = typeof body?.providerPaymentId === 'string' ? body.providerPaymentId : '';
  const providerSignature = typeof body?.providerSignature === 'string' ? body.providerSignature : '';

  if (!providerOrderId || !providerPaymentId || !providerSignature) {
    return NextResponse.json({ error: 'Missing payment verification fields.' }, { status: 400 });
  }

  const signatureValid = verifyPaymentSignature({
    providerOrderId,
    providerPaymentId,
    providerSignature,
  });

  if (!signatureValid) {
    return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
  }

  const { data: existingPayment } = await admin
    .from('payment_transactions')
    .select('id, booking_id, user_id')
    .eq('provider', 'razorpay')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle<{ id: string; booking_id: number | null; user_id: string }>();

  if (existingPayment && existingPayment.user_id !== user.id && !isAdminRole) {
    return forbidden();
  }

  if (existingPayment?.booking_id) {
    return NextResponse.json({
      success: true,
      booking: { id: existingPayment.booking_id },
      message: 'Payment already verified.',
    });
  }

  const { data: txCandidates, error: txCandidatesError } = await admin
    .from('payment_transactions')
    .select('id, user_id, amount_inr, currency, status, metadata, booking_id')
    .eq('provider', 'razorpay')
    .eq('transaction_type', 'service_collection')
    .is('booking_id', null)
    .filter('metadata->>provider_order_id', 'eq', providerOrderId)
    .filter('metadata->>checkout_context', 'eq', 'booking_prepaid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (txCandidatesError) {
    return NextResponse.json({ error: 'Unable to validate payment transaction.' }, { status: 500 });
  }

  const transaction = txCandidates ?? null;

  if (transaction && transaction.user_id !== user.id && !isAdminRole) {
    return forbidden();
  }

  if (!transaction) {
    return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
  }

  if (transaction.status === 'failed') {
    return NextResponse.json(
      { error: 'Payment failed in Razorpay. Please try another payment method.' },
      { status: 409 },
    );
  }

  if (transaction.status === 'captured') {
    return NextResponse.json(
      { error: 'Payment has already been finalized. Please refresh your booking history.' },
      { status: 409 },
    );
  }

  if (!['initiated', 'authorized'].includes(transaction.status)) {
    return NextResponse.json(
      { error: `Payment transaction is in invalid state (${transaction.status}).` },
      { status: 409 },
    );
  }

  let razorpayPayment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
  try {
    razorpayPayment = await fetchRazorpayPayment(providerPaymentId);
  } catch (paymentFetchError) {
    console.error('[booking-verify] failed to fetch Razorpay payment status:', paymentFetchError);
    return NextResponse.json(
      { error: 'Unable to confirm payment status with Razorpay. Please try again shortly.' },
      { status: 503 },
    );
  }

  if (razorpayPayment.order_id !== providerOrderId) {
    return NextResponse.json(
      { error: 'Payment does not belong to this order. Please try another payment method.' },
      { status: 409 },
    );
  }

  if (razorpayPayment.status !== 'captured') {
    const failedLikeStatus = razorpayPayment.status === 'failed' || razorpayPayment.status === 'cancelled';

    if (failedLikeStatus) {
      await admin
        .from('payment_transactions')
        .update({
          status: 'failed',
          provider_payment_id: providerPaymentId,
          provider_signature: providerSignature,
          metadata: {
            ...(transaction.metadata ?? {}),
            provider_order_id: providerOrderId,
            verification_failed_at: getISTTimestamp(),
            verification_error: `razorpay_status_${razorpayPayment.status ?? 'unknown'}`,
          },
        })
        .eq('id', transaction.id)
        .is('booking_id', null);

      return NextResponse.json(
        { error: 'Payment failed in Razorpay. Please try another payment method.' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: 'Payment is not captured yet. Please wait a moment and retry verification.' },
      { status: 409 },
    );
  }

  const metadata = (transaction.metadata ?? {}) as CheckoutMetadata;
  const parsedBundlePayload = normalizeStoredBookingBundlePayload(metadata.booking_bundle_payload ?? null);

  let bookingPayloads: Array<ReturnType<typeof bookingCreateSchema.parse>> = [];

  if (parsedBundlePayload && parsedBundlePayload.length > 0) {
    const parsedEntries = parsedBundlePayload.map((entry) => bookingCreateSchema.safeParse(entry));
    const firstError = parsedEntries.find((parsed) => !parsed.success);
    if (firstError && !firstError.success) {
      return NextResponse.json({ error: 'Stored bundled booking payload is invalid.' }, { status: 400 });
    }

    bookingPayloads = parsedEntries
      .filter((parsed): parsed is { success: true; data: ReturnType<typeof bookingCreateSchema.parse> } => parsed.success)
      .map((parsed) => parsed.data);
  } else {
    const parsedBookingPayload = bookingCreateSchema.safeParse(
      normalizeStoredBookingPayload(metadata.booking_payload ?? null),
    );

    if (!parsedBookingPayload.success) {
      return NextResponse.json({ error: 'Stored booking payload is invalid.' }, { status: 400 });
    }

    bookingPayloads = [parsedBookingPayload.data];
  }

  const petIds = Array.from(new Set(bookingPayloads.map((payload) => payload.petId)));
  const userEmail = transaction.user_id === user.id ? user.email ?? null : null;

  for (const petId of petIds) {
    const hasPetAccess = await hasPetAccessForUser(admin, transaction.user_id, userEmail, petId);
    if (!hasPetAccess) {
      return NextResponse.json({ error: 'Pet does not belong to this user.' }, { status: 403 });
    }
  }

  const createdBookingIds: number[] = [];
  let primaryBookingId: number | null = null;
  let invoiceBookingSnapshot: Parameters<typeof buildServiceInvoiceLineItemsForBooking>[1] | null = null;
  const isBundleBooking = bookingPayloads.length > 1;

  try {
    const primaryPayload = bookingPayloads[0];
    const mergedAddOns = isBundleBooking ? mergeAddOns(bookingPayloads) : (primaryPayload.addOns ?? []);
    const bundleSummaryNote = isBundleBooking ? buildBundleSummaryNote(bookingPayloads) : null;
    const mergedProviderNotes = [bundleSummaryNote, primaryPayload.providerNotes ?? null]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n\n');

    const createdBooking = await createBooking(
      admin,
      transaction.user_id,
      {
        petId: primaryPayload.petId,
        providerId: primaryPayload.providerId,
        providerServiceId: primaryPayload.providerServiceId,
        bookingDate: primaryPayload.bookingDate,
        startTime: primaryPayload.startTime,
        bookingMode: primaryPayload.bookingMode,
        locationAddress: primaryPayload.locationAddress,
        latitude: primaryPayload.latitude,
        longitude: primaryPayload.longitude,
        providerNotes: mergedProviderNotes || null,
        discountCode: primaryPayload.discountCode,
        addOns: mergedAddOns,
        useSubscriptionCredit: false,
        paymentMode: 'platform',
      },
      supabase,
    );

    createdBookingIds.push(createdBooking.id);
    primaryBookingId = createdBooking.id;

    const baseAmount = Math.max(0, Number(metadata.price_breakdown?.baseAmount ?? createdBooking.price_at_booking ?? transaction.amount_inr));
    const discountAmount = Math.max(0, Number(metadata.price_breakdown?.discountAmount ?? 0));
    const walletCreditsAppliedInr = Math.max(0, Number(metadata.price_breakdown?.walletCreditsAppliedInr ?? 0));
    const payableAmount = Math.max(0, Number(metadata.price_breakdown?.payableAmount ?? metadata.price_breakdown?.finalAmount ?? transaction.amount_inr));

    await admin
      .from('bookings')
      .update({
        price_at_booking: baseAmount,
        admin_price_reference: baseAmount,
        discount_amount: discountAmount,
        final_price: Math.max(0, baseAmount - discountAmount),
        amount: payableAmount,
        provider_notes: mergedProviderNotes || null,
        internal_notes: bundleSummaryNote ?? null,
        wallet_credits_applied_inr: walletCreditsAppliedInr > 0 ? walletCreditsAppliedInr : null,
      })
      .eq('id', createdBooking.id);

    invoiceBookingSnapshot = {
      service_type: createdBooking.service_type,
      provider_service_id: primaryPayload.providerServiceId ?? createdBooking.provider_service_id,
      included_services: null,
      provider_notes: mergedProviderNotes || null,
      internal_notes: bundleSummaryNote ?? null,
      admin_price_reference: baseAmount,
      price_at_booking: baseAmount,
    };
  } catch (error) {
    if (createdBookingIds.length > 0) {
      for (const bookingId of createdBookingIds) {
        await admin
          .from('bookings')
          .update({ booking_status: 'cancelled', cancellation_reason: 'Bundled payment verification failed — automatic rollback' })
          .eq('id', bookingId);
      }
    }

    await admin
      .from('payment_transactions')
      .update({
        status: 'failed',
        provider_payment_id: providerPaymentId,
        provider_signature: providerSignature,
        metadata: {
          ...(metadata ?? {}),
          provider_order_id: providerOrderId,
          verification_failed_at: getISTTimestamp(),
          verification_error: error instanceof Error ? error.message : 'booking_create_failed',
          partial_booking_ids: createdBookingIds,
        },
      })
      .eq('id', transaction.id)
      .is('booking_id', null);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to schedule booking after payment verification.' },
      { status: 409 },
    );
  }

  if (!primaryBookingId) {
    return NextResponse.json({ error: 'Unable to create booking after payment verification.' }, { status: 500 });
  }

  const updatedMetadata: CheckoutMetadata = {
    ...metadata,
    provider_order_id: providerOrderId,
    verified_at: getISTTimestamp(),
  };

  const { data: updatedTx, error: updateError } = await admin
    .from('payment_transactions')
    .update({
      status: 'captured',
      provider_payment_id: providerPaymentId,
      provider_signature: providerSignature,
      booking_id: primaryBookingId,
      metadata: {
        ...updatedMetadata,
        booking_ids: createdBookingIds,
      },
    })
    .eq('id', transaction.id)
    .is('booking_id', null)
    .select('id')
    .single();

  if (updateError || !updatedTx) {
    const { data: raceCheck } = await admin
      .from('payment_transactions')
      .select('booking_id')
      .eq('id', transaction.id)
      .maybeSingle<{ booking_id: number | null }>();

    if (raceCheck?.booking_id) {
      for (const bookingId of createdBookingIds) {
        if (bookingId === raceCheck.booking_id) {
          continue;
        }

        await admin
          .from('bookings')
          .update({ booking_status: 'cancelled', cancellation_reason: 'Duplicate booking from verify race — auto-cancelled' })
          .eq('id', bookingId);
      }

      return NextResponse.json({
        success: true,
        booking: { id: raceCheck.booking_id },
        message: 'Payment already verified.',
      });
    }

    return NextResponse.json({ error: updateError?.message ?? 'Unable to finalize payment transaction.' }, { status: 500 });
  }

  await admin.from('payment_events').insert({
    transaction_id: transaction.id,
    event_type: 'checkout.payment.verified',
    event_status: 'captured',
    provider: 'razorpay',
    provider_event_id: providerPaymentId,
    payload: {
      providerOrderId,
      providerPaymentId,
      verifiedAt: getISTTimestamp(),
      bookingId: primaryBookingId,
      bookingIds: createdBookingIds,
    },
  });

  const requestedWalletCredits = Math.max(
    0,
    Math.round(
      Number(
        bookingPayloads[0]?.walletCreditsAppliedInr ??
          metadata.price_breakdown?.walletCreditsAppliedInr ??
          0,
      ),
    ),
  );

  if (requestedWalletCredits > 0) {
    try {
      await deductCredits(transaction.user_id, requestedWalletCredits, primaryBookingId);
      await admin
        .from('bookings')
        .update({ wallet_credits_applied_inr: requestedWalletCredits })
        .eq('id', primaryBookingId);
    } catch (creditError) {
      console.error('[booking-verify] wallet credit deduction failed:', creditError);

      for (const bookingId of createdBookingIds) {
        await admin
          .from('bookings')
          .update({ booking_status: 'cancelled', cancellation_reason: 'Wallet credit deduction failed after payment verification' })
          .eq('id', bookingId);
      }

      await admin
        .from('payment_transactions')
        .update({
          metadata: {
            ...(updatedMetadata ?? {}),
            credit_deduction_failed_at: getISTTimestamp(),
            credit_deduction_error: creditError instanceof Error ? creditError.message : 'wallet_credit_deduction_failed',
          },
        })
        .eq('id', transaction.id);

      return NextResponse.json(
        { error: 'Payment was captured, but wallet credits could not be applied. Our team has been notified.' },
        { status: 409 },
      );
    }
  }

  const primaryPayload = bookingPayloads[0];

  try {
    const serviceType = primaryPayload.bookingMode.replace(/_/g, ' ');
    const priceBreakdown = metadata.price_breakdown;
    const discountInr = Math.max(0, Number(priceBreakdown?.discountAmount ?? 0));
    const walletCreditsInr = Math.max(0, Number(priceBreakdown?.walletCreditsAppliedInr ?? requestedWalletCredits));
    const subtotalInr = Math.max(
      0,
      Number(priceBreakdown?.baseAmount ?? Number(transaction.amount_inr) + walletCreditsInr + discountInr),
    );
    const serviceLineItems = invoiceBookingSnapshot
      ? await buildServiceInvoiceLineItemsForBooking(admin, invoiceBookingSnapshot, subtotalInr)
      : undefined;

    await createServiceInvoice(admin, {
      userId: transaction.user_id,
      bookingId: primaryBookingId,
      paymentTransactionId: updatedTx.id,
      description: `${serviceType} service booking — Razorpay`,
      amountInr: subtotalInr,
      discountInr,
      walletCreditsAppliedInr: walletCreditsInr,
      serviceLineItems,
      status: 'paid',
    });
  } catch (invoiceError) {
    console.error('[booking-verify] Invoice creation failed (non-blocking, requires admin reconciliation):', invoiceError);
    await admin
      .from('bookings')
      .update({ admin_notes: `INVOICE_MISSING: Invoice creation failed at ${getISTTimestamp()}` })
      .eq('id', primaryBookingId);
  }

  const priceBreakdown = metadata.price_breakdown;
  const redemptionDiscountAmount = Math.max(0, Number(priceBreakdown?.discountAmount ?? 0));
  if (priceBreakdown?.discountId && redemptionDiscountAmount > 0) {
    try {
      await createDiscountRedemption(admin, {
        discountId: priceBreakdown.discountId,
        bookingId: primaryBookingId,
        userId: transaction.user_id,
        discountAmount: redemptionDiscountAmount,
      });
    } catch (redemptionError) {
      console.error(
        '[booking-verify] CRITICAL: Discount redemption creation failed — usage limit may be bypassed. BookingId:',
        primaryBookingId,
        'DiscountId:',
        priceBreakdown.discountId,
        redemptionError,
      );
    }
  }

  console.info('[booking-verify] Payment verified and booking created:', {
    userId: transaction.user_id,
    bookingId: primaryBookingId,
    bookingIds: createdBookingIds,
    txId: updatedTx.id,
    amountInr: transaction.amount_inr,
  });

  return NextResponse.json({
    success: true,
    booking: { id: primaryBookingId },
    bookingIds: createdBookingIds,
    message: isBundleBooking
      ? 'Payment verified and bundled services were scheduled in a single booking.'
      : 'Payment verified and booking scheduled.',
  });
}
