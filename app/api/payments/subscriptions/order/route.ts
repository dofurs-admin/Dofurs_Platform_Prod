import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { createRazorpayOrder, getRazorpayPublicConfig } from '@/lib/payments/razorpay';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 12,
};

const SUBSCRIPTION_ORDER_IDEMPOTENCY_ENDPOINT = 'payments/subscriptions/order';

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const adminSupabase = getSupabaseAdminClient();

  const rate = await isRateLimited(supabase, getRateLimitKey('payments:subscriptions:order', user.id), RATE_LIMIT);
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

  const body = await request.json().catch(() => null);
  const planId = typeof body?.planId === 'string' ? body.planId : '';

  if (!planId) {
    return NextResponse.json({ error: 'planId is required.' }, { status: 400 });
  }

  if (idempotencyKey) {
    const { data: existingIdempotentResponse, error: idempotencyReadError } = await adminSupabase
      .from('admin_idempotency_keys')
      .select('status_code, response_body')
      .eq('endpoint', `${SUBSCRIPTION_ORDER_IDEMPOTENCY_ENDPOINT}:${user.id}`)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (idempotencyReadError) {
      return NextResponse.json({ error: 'Unable to verify idempotency key.' }, { status: 500 });
    }

    if (existingIdempotentResponse) {
      return NextResponse.json(existingIdempotentResponse.response_body, {
        status: existingIdempotentResponse.status_code,
      });
    }
  }

  // Guard: block new purchase when user already has an active subscription.
  const { data: activeSub } = await adminSupabase
    .from('user_subscriptions')
    .select('id, ends_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (activeSub) {
    return NextResponse.json(
      { error: 'You already have an active subscription. It must expire or be cancelled before purchasing a new plan.' },
      { status: 409 },
    );
  }

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id, name, price_inr, is_active')
    .eq('id', planId)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: 'Subscription plan not found.' }, { status: 404 });
  }

  const amountInPaise = Math.round(Number(plan.price_inr) * 100);
  if (amountInPaise <= 0) {
    return NextResponse.json({ error: 'Invalid plan amount.' }, { status: 400 });
  }

  const receipt = `sub_${user.id.slice(0, 8)}_${Date.now()}`;

  let order: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    order = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: user.id,
        planId,
      },
    });
  } catch (razorpayError) {
    console.error('[subscriptions/order] Razorpay order creation failed:', razorpayError);
    return NextResponse.json(
      { error: 'Payment gateway is temporarily unavailable. Please try again in a moment.' },
      { status: 503 },
    );
  }

  const { data: dbOrder, error: dbOrderError } = await supabase
    .from('subscription_payment_orders')
    .insert({
      user_id: user.id,
      plan_id: planId,
      provider: 'razorpay',
      provider_order_id: order.id,
      amount_inr: Number(plan.price_inr),
      currency: order.currency,
      status: 'created',
      receipt,
      metadata: {
        plan_name: plan.name,
      },
    })
    .select('id, provider_order_id, amount_inr, currency, status')
    .single();

  if (dbOrderError || !dbOrder) {
    return NextResponse.json({ error: dbOrderError?.message ?? 'Unable to create payment order.' }, { status: 500 });
  }

  const responseBody = {
    order: dbOrder,
    razorpay: {
      keyId: getRazorpayPublicConfig().keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      name: 'Dofurs',
      description: `${plan.name} Subscription`,
      prefill: {
        email: user.email,
      },
      notes: {
        planId,
      },
    },
  };

  if (idempotencyKey) {
    await adminSupabase.from('admin_idempotency_keys').upsert(
      {
        endpoint: `${SUBSCRIPTION_ORDER_IDEMPOTENCY_ENDPOINT}:${user.id}`,
        idempotency_key: idempotencyKey,
        actor_user_id: user.id,
        request_payload: { planId },
        status_code: 200,
        response_body: responseBody,
      },
      { onConflict: 'endpoint,idempotency_key' },
    );
  }

  return NextResponse.json(responseBody);
}
