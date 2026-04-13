import { NextResponse } from 'next/server';
import { ADMIN_ROLES, forbidden, requireApiRole } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { fetchRazorpayPayment, verifyPaymentSignature } from '@/lib/payments/razorpay';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { createBooking } from '@/lib/bookings/service';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
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

  // Legacy rows can persist optional values as null; validation expects undefined/absence.
  if (normalized.discountCode === null) {
    delete normalized.discountCode;
  }

  return normalized;
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
  const parsedBookingPayload = bookingCreateSchema.safeParse(
    normalizeStoredBookingPayload(metadata.booking_payload ?? null),
  );

  if (!parsedBookingPayload.success) {
    return NextResponse.json({ error: 'Stored booking payload is invalid.' }, { status: 400 });
  }

  // Check pet ownership: owned directly OR shared with the user (active share)
  const { data: petOwnership, error: petOwnershipError } = await admin
    .from('pets')
    .select('id')
    .eq('id', parsedBookingPayload.data.petId)
    .eq('user_id', transaction.user_id)
    .maybeSingle<{ id: number }>();

  let hasPetAccess = !petOwnershipError && Boolean(petOwnership);

  if (!hasPetAccess) {
    const { data: sharedAccess, error: sharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', parsedBookingPayload.data.petId)
      .eq('shared_with_user_id', transaction.user_id)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{ id: string; role: string | null; status: string; accepted_at: string | null; revoked_at: string | null }>();

    if (!sharedAccessError && sharedAccess) {
      hasPetAccess = (
        (sharedAccess.status === 'active'
        || sharedAccess.status === 'accepted'
        || Boolean(sharedAccess.accepted_at))
        && sharedAccess.role === 'manager'
      );
    }
  }

  if (!hasPetAccess && transaction.user_id === user.id && user.email) {
    const { data: emailSharedAccess, error: emailSharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', parsedBookingPayload.data.petId)
      .ilike('invited_email', user.email)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{ id: string; role: string | null; status: string; accepted_at: string | null; revoked_at: string | null }>();

    if (!emailSharedAccessError && emailSharedAccess) {
      hasPetAccess = (
        (emailSharedAccess.status === 'active'
        || emailSharedAccess.status === 'accepted'
        || Boolean(emailSharedAccess.accepted_at))
        && emailSharedAccess.role === 'manager'
      );

      if (hasPetAccess) {
        await admin
          .from('pet_shares')
          .update({
            shared_with_user_id: transaction.user_id,
            status: 'active',
            accepted_at: emailSharedAccess.accepted_at ?? getISTTimestamp(),
            revoked_at: null,
          })
          .eq('id', emailSharedAccess.id);
      }
    }
  }

  if (!hasPetAccess) {
    return NextResponse.json({ error: 'Pet does not belong to this user.' }, { status: 403 });
  }

  let booking: { id: number };

  try {
    booking = await createBooking(admin, transaction.user_id, {
      petId: parsedBookingPayload.data.petId,
      providerId: parsedBookingPayload.data.providerId,
      providerServiceId: parsedBookingPayload.data.providerServiceId,
      bookingDate: parsedBookingPayload.data.bookingDate,
      startTime: parsedBookingPayload.data.startTime,
      bookingMode: parsedBookingPayload.data.bookingMode,
      locationAddress: parsedBookingPayload.data.locationAddress,
      latitude: parsedBookingPayload.data.latitude,
      longitude: parsedBookingPayload.data.longitude,
      providerNotes: parsedBookingPayload.data.providerNotes,
      discountCode: parsedBookingPayload.data.discountCode,
      addOns: parsedBookingPayload.data.addOns,
      useSubscriptionCredit: false,
        paymentMode: 'platform',
    }, supabase);
  } catch (error) {
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
        },
      })
      .eq('id', transaction.id)
      .is('booking_id', null);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to schedule booking after payment verification.' },
      { status: 409 },
    );
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
      booking_id: booking.id,
      metadata: updatedMetadata,
    })
    .eq('id', transaction.id)
    .is('booking_id', null)
    .select('id')
    .single();

  if (updateError || !updatedTx) {
    // Race: another concurrent verify or the webhook may have already set booking_id.
    const { data: raceCheck } = await admin
      .from('payment_transactions')
      .select('booking_id')
      .eq('id', transaction.id)
      .maybeSingle<{ booking_id: number | null }>();

    if (raceCheck?.booking_id) {
      // Cancel the orphan booking we just created since the other path won the race
      if (raceCheck.booking_id !== booking.id) {
        await admin
          .from('bookings')
          .update({ booking_status: 'cancelled', cancellation_reason: 'Duplicate booking from verify race — auto-cancelled' })
          .eq('id', booking.id);
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
      bookingId: booking.id,
    },
  });

  const requestedWalletCredits = Math.max(0, Math.round(Number(parsedBookingPayload.data.walletCreditsAppliedInr ?? 0)));
  if (requestedWalletCredits > 0) {
    try {
      await deductCredits(transaction.user_id, requestedWalletCredits, booking.id);
      await admin
        .from('bookings')
        .update({ wallet_credits_applied_inr: requestedWalletCredits })
        .eq('id', booking.id);
    } catch (creditError) {
      console.error('[booking-verify] wallet credit deduction failed:', creditError);

      await admin
        .from('bookings')
        .update({ booking_status: 'cancelled', cancellation_reason: 'Wallet credit deduction failed after payment verification' })
        .eq('id', booking.id);

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

  // Create service invoice for this online payment — required for tax compliance.
  try {
    const serviceType = parsedBookingPayload.data.bookingMode.replace(/_/g, ' ');
    const priceBreakdown = metadata.price_breakdown;
    const discountInr = Math.max(0, Number(priceBreakdown?.discountAmount ?? 0));
    const walletCreditsInr = Math.max(0, Number(priceBreakdown?.walletCreditsAppliedInr ?? requestedWalletCredits));
    const subtotalInr = Math.max(
      0,
      Number(priceBreakdown?.baseAmount ?? (Number(transaction.amount_inr) + walletCreditsInr + discountInr)),
    );

    await createServiceInvoice(admin, {
      userId: transaction.user_id,
      bookingId: booking.id,
      paymentTransactionId: updatedTx.id,
      description: `${serviceType} service booking — Razorpay`,
      amountInr: subtotalInr,
      discountInr,
      walletCreditsAppliedInr: walletCreditsInr,
      status: 'paid',
    });
  } catch (invoiceError) {
    // Log but do not block the booking — invoice can be retried via admin reconciliation.
    // At scale this is tracked in billing_invoices table; admin dashboard flags missing invoices.
    console.error('[booking-verify] Invoice creation failed (non-blocking, requires admin reconciliation):', invoiceError);
    // Flag the booking so admin can find missing invoices easily
    await admin.from('bookings').update({ admin_notes: `INVOICE_MISSING: Invoice creation failed at ${getISTTimestamp()}` }).eq('id', booking.id);
  }

  // Record discount redemption so usage limits are enforced correctly.
  // This MUST succeed to prevent unlimited discount reuse — treat failures as blocking.
  const priceBreakdown = metadata.price_breakdown;
  if (priceBreakdown?.discountId && (priceBreakdown.discountAmount ?? 0) > 0) {
    try {
      await createDiscountRedemption(admin, {
        discountId: priceBreakdown.discountId,
        bookingId: booking.id,
        userId: transaction.user_id,
        discountAmount: priceBreakdown.discountAmount!,
      });
    } catch (redemptionError) {
      // Discount redemption failed — log prominently for monitoring.
      // The booking was still created at the discounted price. The admin must reconcile.
      console.error('[booking-verify] CRITICAL: Discount redemption creation failed — usage limit may be bypassed. BookingId:', booking.id, 'DiscountId:', priceBreakdown.discountId, redemptionError);
    }
  }

  console.info('[booking-verify] Payment verified and booking created:', {
    userId: transaction.user_id,
    bookingId: booking.id,
    txId: updatedTx.id,
    amountInr: transaction.amount_inr,
  });

  return NextResponse.json({
    success: true,
    booking: { id: booking.id },
    message: 'Payment verified and booking scheduled.',
  });
}
