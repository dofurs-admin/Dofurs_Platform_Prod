import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole, forbidden } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { createRazorpayOrder, getRazorpayPublicConfig } from '@/lib/payments/razorpay';
import { calculateBookingPrice } from '@/lib/service-catalog';
import { evaluateDiscountForBooking } from '@/lib/bookings/discounts';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getCreditBalance } from '@/lib/credits/wallet';
import { getISTTimestamp } from '@/lib/utils/date';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 12,
};

const BOOKING_ORDER_IDEMPOTENCY_ENDPOINT = 'payments/bookings/order';

const bookingBundleOrderSchema = z.object({
  entries: z.array(bookingCreateSchema).min(1).max(12),
});

type BookingOrderEntry = z.infer<typeof bookingCreateSchema>;

type NormalizedOrderRequest = {
  entries: BookingOrderEntry[];
  isBundle: boolean;
};

function normalizeOrderRequest(body: unknown): NormalizedOrderRequest | null {
  const parsedBundle = bookingBundleOrderSchema.safeParse(body);
  if (parsedBundle.success) {
    return {
      entries: parsedBundle.data.entries,
      isBundle: true,
    };
  }

  const parsedSingle = bookingCreateSchema.safeParse(body);
  if (parsedSingle.success) {
    return {
      entries: [parsedSingle.data],
      isBundle: false,
    };
  }

  return null;
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

  const rate = await isRateLimited(supabase, getRateLimitKey('payments:bookings:order', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? '';
  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 120)) {
    return NextResponse.json(
      { error: 'x-idempotency-key must be between 8 and 120 characters when provided' },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();

  if (idempotencyKey) {
    const { data: existingResponse, error: idempotencyReadError } = await admin
      .from('admin_idempotency_keys')
      .select('status_code, response_body')
      .eq('endpoint', `${BOOKING_ORDER_IDEMPOTENCY_ENDPOINT}:${user.id}`)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (idempotencyReadError) {
      return NextResponse.json({ error: 'Unable to verify idempotency key.' }, { status: 500 });
    }

    if (existingResponse) {
      return NextResponse.json(existingResponse.response_body, { status: existingResponse.status_code });
    }
  }

  const body = await request.json().catch(() => null);
  const normalizedRequest = normalizeOrderRequest(body);

  if (!normalizedRequest) {
    return NextResponse.json({ error: 'Invalid booking payload' }, { status: 400 });
  }

  const entries = normalizedRequest.entries;
  const isBundle = normalizedRequest.isBundle || entries.length > 1;

  if (entries.some((entry) => entry.useSubscriptionCredit)) {
    return NextResponse.json(
      { error: 'Subscription credit booking does not require online checkout.' },
      { status: 400 },
    );
  }

  const targetUserId = entries[0].bookingUserId ?? user.id;
  if (entries.some((entry) => (entry.bookingUserId ?? user.id) !== targetUserId)) {
    return NextResponse.json(
      { error: 'All bundled entries must target the same booking user.' },
      { status: 400 },
    );
  }

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch (err) {
    console.error(err);
    return forbidden();
  }

  if (role === 'provider' && targetUserId !== user.id) {
    return forbidden();
  }

  const providerIdSet = new Set(entries.map((entry) => entry.providerId));
  if (providerIdSet.size > 1) {
    return NextResponse.json(
      { error: 'Bundled online checkout currently supports a single provider per order.' },
      { status: 400 },
    );
  }

  const userEmail = targetUserId === user.id ? user.email ?? null : null;

  let aggregatedBaseAmount = 0;
  let aggregatedFinalBeforeWallet = 0;
  let discountPreview: Awaited<ReturnType<typeof evaluateDiscountForBooking>>['preview'] = null;
  const bundleServiceTypes = new Set<string>();
  let bundleDiscountCode: string | null = null;

  for (const [entryIndex, entry] of entries.entries()) {
    const hasPetAccess = await hasPetAccessForUser(admin, targetUserId, userEmail, entry.petId);
    if (!hasPetAccess) {
      return NextResponse.json({ error: 'Pet does not belong to this user.' }, { status: 403 });
    }

    const { data: providerService, error: providerServiceError } = await admin
      .from('provider_services')
      .select('id, provider_id, service_type, is_active')
      .eq('id', entry.providerServiceId)
      .eq('provider_id', entry.providerId)
      .eq('is_active', true)
      .maybeSingle<{ id: string; provider_id: number; service_type: string; is_active: boolean }>();

    if (providerServiceError || !providerService) {
      return NextResponse.json({ error: 'Selected service is unavailable.' }, { status: 404 });
    }

    bundleServiceTypes.add(providerService.service_type);

    const pricing = await calculateBookingPrice({
      bookingType: 'service',
      serviceId: entry.providerServiceId,
      providerId: entry.providerId,
      addOns: entry.addOns,
    });

    const boardingNights =
      entry.boardingEndDate && entry.bookingDate
        ? Math.max(
            1,
            Math.round(
              (new Date(`${entry.boardingEndDate}T00:00:00`).getTime() -
                new Date(`${entry.bookingDate}T00:00:00`).getTime()) /
                86400000,
            ),
          )
        : 1;

    const baseAmount = Number(pricing.final_total ?? 0) * boardingNights;
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return NextResponse.json({ error: 'Unable to determine booking amount.' }, { status: 400 });
    }

    aggregatedBaseAmount += baseAmount;

    let entryFinalAmount = baseAmount;
    if (isBundle) {
      if (entry.discountCode?.trim()) {
        const normalizedCode = entry.discountCode.trim().toUpperCase();
        if (!bundleDiscountCode) {
          bundleDiscountCode = normalizedCode;
        } else if (bundleDiscountCode !== normalizedCode) {
          return NextResponse.json(
            { error: 'Use a single discount code for bundled online checkout.' },
            { status: 400 },
          );
        }
      }
    } else if (entry.discountCode?.trim()) {
      const evaluation = await evaluateDiscountForBooking(admin, {
        discountCode: entry.discountCode,
        userId: targetUserId,
        serviceType: providerService.service_type,
        baseAmount,
      });

      if (!evaluation.preview) {
        return NextResponse.json({ error: evaluation.reason ?? 'Discount is not applicable.' }, { status: 400 });
      }

      if (entryIndex === 0) {
        discountPreview = evaluation.preview;
      }

      entryFinalAmount = Number(evaluation.preview.finalAmount);
    }

    aggregatedFinalBeforeWallet += entryFinalAmount;
  }

  if (isBundle && bundleDiscountCode) {
    const bundleEvaluation = await evaluateDiscountForBooking(admin, {
      discountCode: bundleDiscountCode,
      userId: targetUserId,
      serviceTypes: Array.from(bundleServiceTypes),
      baseAmount: aggregatedBaseAmount,
    });

    if (!bundleEvaluation.preview) {
      return NextResponse.json(
        { error: bundleEvaluation.reason ?? 'Discount is not applicable.' },
        { status: 400 },
      );
    }

    discountPreview = bundleEvaluation.preview;
    aggregatedFinalBeforeWallet = Number(bundleEvaluation.preview.finalAmount);
  }

  const requestedWalletCredits = entries.reduce(
    (sum, entry) => sum + Math.max(0, Math.round(entry.walletCreditsAppliedInr ?? 0)),
    0,
  );

  let walletCreditsToApply = 0;
  if (requestedWalletCredits > 0) {
    const balance = await getCreditBalance(admin, targetUserId);
    const availableCredits = Math.max(0, Math.round(Number(balance.available_inr ?? 0)));

    if (availableCredits <= 0) {
      return NextResponse.json({ error: 'No Dofurs Credits available in your wallet.' }, { status: 400 });
    }

    if (requestedWalletCredits > availableCredits) {
      return NextResponse.json(
        { error: 'Requested credits exceed available wallet balance. Please refresh and try again.' },
        { status: 400 },
      );
    }

    walletCreditsToApply = Math.min(requestedWalletCredits, Math.round(aggregatedFinalBeforeWallet));
  }

  const payableAmount = Math.max(0, aggregatedFinalBeforeWallet - walletCreditsToApply);
  const amountInPaise = Math.round(payableAmount * 100);

  if (!Number.isFinite(amountInPaise) || amountInPaise < 0) {
    return NextResponse.json({ error: 'Invalid payable amount.' }, { status: 400 });
  }

  if (amountInPaise === 0) {
    return NextResponse.json({ error: 'No online payment required after applying credits. Please confirm booking directly.' }, { status: 400 });
  }

  const receipt = `svc_${targetUserId.slice(0, 8)}_${Date.now()}`;
  const providerId = entries[0].providerId;
  const providerServiceId = entries[0].providerServiceId;

  let order: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    order = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: targetUserId,
        bookingMode: entries[0].bookingMode,
        providerServiceId,
        providerId: String(providerId),
        bundleCount: String(entries.length),
      },
    });
  } catch (razorpayError) {
    console.error('[bookings/order] Razorpay order creation failed:', razorpayError);
    return NextResponse.json(
      { error: 'Payment gateway is temporarily unavailable. Please try again in a moment.' },
      { status: 503 },
    );
  }

  const bundleProviderServiceIds = isBundle
    ? Array.from(new Set(entries.map((entry) => entry.providerServiceId)))
    : undefined;

  const normalizedEntries = entries.map((entry, index) => ({
    petId: entry.petId,
    providerId: entry.providerId,
    providerServiceId: entry.providerServiceId,
    bookingDate: entry.bookingDate,
    startTime: entry.startTime,
    bookingMode: entry.bookingMode,
    locationAddress: entry.locationAddress ?? null,
    latitude: entry.latitude ?? null,
    longitude: entry.longitude ?? null,
    providerNotes: entry.providerNotes ?? null,
    discountCode: isBundle
      ? (index === 0 ? bundleDiscountCode ?? undefined : undefined)
      : entry.discountCode ?? undefined,
    walletCreditsAppliedInr: index === 0 && walletCreditsToApply > 0 ? walletCreditsToApply : undefined,
    addOns: entry.addOns ?? [],
    useSubscriptionCredit: false,
    pincode: entry.pincode,
    boardingEndDate: entry.boardingEndDate,
    bundleProviderServiceIds,
    bundleEstimatedTotalInr: isBundle && index === 0 ? Math.round(aggregatedBaseAmount) : undefined,
  }));

  const metadata = {
    checkout_context: 'booking_prepaid',
    provider_order_id: order.id,
    receipt,
    booking_payload: isBundle ? undefined : normalizedEntries[0],
    booking_bundle_payload: isBundle ? normalizedEntries : undefined,
    price_breakdown: {
      baseAmount: aggregatedBaseAmount,
      finalAmount: payableAmount,
      walletCreditsAppliedInr: walletCreditsToApply,
      payableAmount,
      discountCode: discountPreview?.code ?? null,
      discountId: discountPreview?.discountId ?? null,
      discountAmount: discountPreview?.discountAmount ?? 0,
    },
  };

  const { data: transaction, error: transactionError } = await admin
    .from('payment_transactions')
    .insert({
      user_id: targetUserId,
      provider: 'razorpay',
      transaction_type: 'service_collection',
      status: 'initiated',
      amount_inr: payableAmount,
      currency: order.currency,
      metadata,
    })
    .select('id, amount_inr, currency, status')
    .single();

  if (transactionError || !transaction) {
    return NextResponse.json({ error: transactionError?.message ?? 'Unable to start payment.' }, { status: 500 });
  }

  const successBody = {
    transaction,
    razorpay: {
      keyId: getRazorpayPublicConfig().keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      name: 'Dofurs',
      description: isBundle ? 'Pet Service Bundle Booking' : 'Pet Service Booking',
      prefill: {
        email: user.email,
      },
      notes: {
        providerServiceId,
        providerId: String(providerId),
        bundleCount: String(entries.length),
      },
    },
  };

  if (idempotencyKey) {
    await admin.from('admin_idempotency_keys').upsert(
      {
        endpoint: `${BOOKING_ORDER_IDEMPOTENCY_ENDPOINT}:${user.id}`,
        idempotency_key: idempotencyKey,
        status_code: 200,
        response_body: successBody,
      },
      { onConflict: 'endpoint,idempotency_key' },
    );
  }

  return NextResponse.json(successBody);
}
