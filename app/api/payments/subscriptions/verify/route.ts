import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { verifyPaymentSignature } from '@/lib/payments/razorpay';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { createOrActivateSubscriptionFromPayment } from '@/lib/subscriptions/subscriptionService';
import { createSubscriptionInvoice } from '@/lib/payments/invoiceService';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
};

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const adminSupabase = getSupabaseAdminClient();
  const rate = await isRateLimited(supabase, getRateLimitKey('payments:subscriptions:verify', user.id), RATE_LIMIT);
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

  const { data: order, error: orderError } = await adminSupabase
    .from('subscription_payment_orders')
    .select('id, user_id, plan_id, amount_inr, currency, status')
    .eq('provider', 'razorpay')
    .eq('provider_order_id', providerOrderId)
    .single();

  if (orderError || !order || order.user_id !== user.id) {
    return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 });
  }

  const { data: tx, error: txError } = await adminSupabase
    .from('payment_transactions')
    .upsert(
      {
        user_id: user.id,
        payment_order_id: order.id,
        provider: 'razorpay',
        transaction_type: 'subscription_purchase',
        status: 'captured',
        amount_inr: Number(order.amount_inr),
        currency: order.currency,
        provider_payment_id: providerPaymentId,
        provider_signature: providerSignature,
        metadata: {
          verification_source: 'checkout_callback',
        },
      },
      { onConflict: 'provider,provider_payment_id' },
    )
    .select('id, status')
    .single();

  if (txError || !tx) {
    return NextResponse.json({ error: txError?.message ?? 'Unable to save payment verification.' }, { status: 500 });
  }

  await adminSupabase.from('payment_events').insert({
    transaction_id: tx.id,
    event_type: 'checkout.payment.verified',
    event_status: tx.status,
    provider: 'razorpay',
    provider_event_id: providerPaymentId,
    payload: {
      providerOrderId,
      providerPaymentId,
      verifiedAt: getISTTimestamp(),
    },
  });

  await adminSupabase
    .from('subscription_payment_orders')
    .update({ status: 'paid' })
    .eq('id', order.id);

  // Activate the subscription immediately so the user doesn't wait for the webhook.
  // The webhook handler will no-op if the subscription is already active.
  try {
    const subscription = await createOrActivateSubscriptionFromPayment(
      adminSupabase,
      user.id,
      order.plan_id as string,
      tx.id,
    );

    const { data: plan } = await adminSupabase
      .from('subscription_plans')
      .select('name')
      .eq('id', order.plan_id)
      .maybeSingle<{ name: string }>();

    try {
      await createSubscriptionInvoice(adminSupabase, {
        userId: user.id,
        userSubscriptionId: subscription.id,
        paymentTransactionId: tx.id,
        planName: plan?.name ?? 'Subscription Plan',
        amountInr: Number(order.amount_inr),
      });
    } catch (invoiceError) {
      console.error('[subscriptions/verify] Invoice creation failed (non-fatal):', invoiceError);
    }

    console.info('[subscriptions/verify] Payment verified and subscription activated:', {
      userId: user.id,
      planId: order.plan_id,
      txId: tx.id,
      subscriptionId: subscription.id,
      amountInr: order.amount_inr,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified and subscription activated.',
    });
  } catch (activationError) {
    console.error('[subscriptions/verify] Subscription activation failed — webhook will retry:', activationError);
    return NextResponse.json(
      {
        success: false,
        error: 'Payment verified but subscription activation failed. It will be activated shortly.',
      },
      { status: 502 },
    );
  }
}
