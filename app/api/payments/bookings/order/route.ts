import { NextResponse } from 'next/server';
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
  const parsed = bookingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid booking payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.useSubscriptionCredit) {
    return NextResponse.json(
      { error: 'Subscription credit booking does not require online checkout.' },
      { status: 400 },
    );
  }

  const requestedWalletCredits = Math.max(0, Math.round(parsed.data.walletCreditsAppliedInr ?? 0));

  const targetUserId = parsed.data.bookingUserId ?? user.id;

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch (err) { console.error(err);
    return forbidden();
  }

  if (role === 'provider') {
    // Providers can book services from any provider as a customer.
    // Only restrict when a provider tries to book on behalf of another user.
    if (parsed.data.bookingUserId && parsed.data.bookingUserId !== user.id) {
      return forbidden();
    }
  }

  // Check pet ownership: owned directly OR shared with the user (active share)
  const { data: petOwnership, error: petOwnershipError } = await admin
    .from('pets')
    .select('id')
    .eq('id', parsed.data.petId)
    .eq('user_id', targetUserId)
    .maybeSingle<{ id: number }>();

  let hasPetAccess = !petOwnershipError && Boolean(petOwnership);

  if (!hasPetAccess) {
    const { data: sharedAccess, error: sharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', parsed.data.petId)
      .eq('shared_with_user_id', targetUserId)
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

  if (!hasPetAccess && targetUserId === user.id && user.email) {
    const { data: emailSharedAccess, error: emailSharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', parsed.data.petId)
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
            shared_with_user_id: targetUserId,
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

  const { data: providerService, error: providerServiceError } = await admin
    .from('provider_services')
    .select('id, provider_id, service_type, is_active')
    .eq('id', parsed.data.providerServiceId)
    .eq('provider_id', parsed.data.providerId)
    .eq('is_active', true)
    .maybeSingle<{ id: string; provider_id: number; service_type: string; is_active: boolean }>();

  if (providerServiceError || !providerService) {
    return NextResponse.json({ error: 'Selected service is unavailable.' }, { status: 404 });
  }

  const pricing = await calculateBookingPrice({
    bookingType: 'service',
    serviceId: parsed.data.providerServiceId,
    providerId: parsed.data.providerId,
    addOns: parsed.data.addOns,
  });

  // For boarding services, multiply by number of nights
  const boardingNights =
    parsed.data.boardingEndDate && parsed.data.bookingDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${parsed.data.boardingEndDate}T00:00:00`).getTime() -
              new Date(`${parsed.data.bookingDate}T00:00:00`).getTime()) /
              86400000,
          ),
        )
      : 1;
  const baseAmount = Number(pricing.final_total ?? 0) * boardingNights;
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return NextResponse.json({ error: 'Unable to determine booking amount.' }, { status: 400 });
  }

  let finalAmount = baseAmount;
  let discountPreview: Awaited<ReturnType<typeof evaluateDiscountForBooking>>['preview'] = null;

  if (parsed.data.discountCode?.trim()) {
    const evaluation = await evaluateDiscountForBooking(supabase, {
      discountCode: parsed.data.discountCode,
      userId: targetUserId,
      serviceType: providerService.service_type,
      baseAmount,
    });

    if (!evaluation.preview) {
      return NextResponse.json({ error: evaluation.reason ?? 'Discount is not applicable.' }, { status: 400 });
    }

    discountPreview = evaluation.preview;
    finalAmount = Number(evaluation.preview.finalAmount);
  }

  let walletCreditsToApply = 0;
  if (requestedWalletCredits > 0) {
    const balance = await getCreditBalance(admin, targetUserId);
    const availableCredits = Math.max(0, Math.round(Number(balance.available_inr ?? 0)));

    if (availableCredits <= 0) {
      return NextResponse.json({ error: 'No Dofurs Credits available in your wallet.' }, { status: 400 });
    }

    if (requestedWalletCredits > availableCredits) {
      return NextResponse.json({ error: 'Requested credits exceed available wallet balance. Please refresh and try again.' }, { status: 400 });
    }

    walletCreditsToApply = Math.min(requestedWalletCredits, Math.round(finalAmount));
  }

  finalAmount = Math.max(0, finalAmount - walletCreditsToApply);

  const amountInPaise = Math.round(finalAmount * 100);
  if (!Number.isFinite(amountInPaise) || amountInPaise < 0) {
    return NextResponse.json({ error: 'Invalid payable amount.' }, { status: 400 });
  }

  if (amountInPaise === 0) {
    return NextResponse.json({ error: 'No online payment required after applying credits. Please confirm booking directly.' }, { status: 400 });
  }

  const receipt = `svc_${targetUserId.slice(0, 8)}_${Date.now()}`;
  let order: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    order = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: targetUserId,
        bookingMode: parsed.data.bookingMode,
        providerServiceId: parsed.data.providerServiceId,
        providerId: String(parsed.data.providerId),
      },
    });
  } catch (razorpayError) {
    console.error('[bookings/order] Razorpay order creation failed:', razorpayError);
    return NextResponse.json(
      { error: 'Payment gateway is temporarily unavailable. Please try again in a moment.' },
      { status: 503 },
    );
  }

  const metadata = {
    checkout_context: 'booking_prepaid',
    provider_order_id: order.id,
    receipt,
    booking_payload: {
      petId: parsed.data.petId,
      providerId: parsed.data.providerId,
      providerServiceId: parsed.data.providerServiceId,
      bookingDate: parsed.data.bookingDate,
      startTime: parsed.data.startTime,
      bookingMode: parsed.data.bookingMode,
      locationAddress: parsed.data.locationAddress ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      providerNotes: parsed.data.providerNotes ?? null,
      // Keep optional fields omitted instead of null so later schema validation passes.
      discountCode: parsed.data.discountCode ?? undefined,
      walletCreditsAppliedInr: walletCreditsToApply > 0 ? walletCreditsToApply : undefined,
      addOns: parsed.data.addOns ?? [],
      useSubscriptionCredit: false,
    },
    price_breakdown: {
      baseAmount,
      finalAmount,
      walletCreditsAppliedInr: walletCreditsToApply,
      payableAmount: finalAmount,
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
      amount_inr: finalAmount,
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
      description: 'Pet Service Booking',
      prefill: {
        email: user.email,
      },
      notes: {
        providerServiceId: parsed.data.providerServiceId,
        providerId: String(parsed.data.providerId),
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
