import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/payments/razorpay', async () => {
  return {
    verifyPaymentSignature: vi.fn((input: { providerOrderId: string; providerPaymentId: string; providerSignature: string }) => {
      const secret = process.env.RAZORPAY_KEY_SECRET ?? 'test_key_secret';
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${input.providerOrderId}|${input.providerPaymentId}`)
        .digest('hex');
      return expected === input.providerSignature;
    }),
    verifyWebhookSignature: vi.fn(async (rawBody: string, signature: string) => {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'test_webhook_secret';
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      return expected === signature;
    }),
    createRazorpayOrder: vi.fn(),
    getRazorpayPublicConfig: vi.fn(),
  };
});

import { requireApiRole } from '@/lib/auth/api-auth';
import { createRazorpayOrder, getRazorpayPublicConfig } from '@/lib/payments/razorpay';
import { POST as postOrder } from '@/app/api/payments/subscriptions/order/route';
import { POST as postVerify } from '@/app/api/payments/subscriptions/verify/route';
import { POST as postWebhook } from '@/app/api/payments/webhook/route';

type CreatedContext = {
  userId: string;
  userEmail: string;
  planId: string;
  providerOrderId: string;
  providerPaymentId: string;
};

const ctx: Partial<CreatedContext> = {};
const runSmoke = process.env.RUN_PAYMENTS_SMOKE === '1';

function hmacHex(secret: string, payload: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe.skipIf(!runSmoke)('payments API smoke', () => {
  let admin: ReturnType<typeof getSupabaseAdminClient>;

  beforeAll(async () => {
    admin = getSupabaseAdminClient();

    const ts = Date.now();
    const email = `smoke.payments.${ts}@example.com`;

    const createdUser = await admin.auth.admin.createUser({
      email,
      password: `Temp#${ts}Aa!`,
      email_confirm: true,
      user_metadata: { smoke: true },
    });

    if (createdUser.error || !createdUser.data.user) {
      throw new Error(createdUser.error?.message ?? 'Unable to create smoke user');
    }

    ctx.userId = createdUser.data.user.id;
    ctx.userEmail = createdUser.data.user.email ?? email;

    const planCode = `SMOKE_${ts}`;
    const planInsert = await admin
      .from('subscription_plans')
      .insert({
        code: planCode,
        name: `Smoke Plan ${ts}`,
        description: 'Temporary smoke plan',
        price_inr: 199,
        duration_days: 30,
        is_active: true,
      })
      .select('id')
      .single();

    if (planInsert.error || !planInsert.data) {
      throw new Error(planInsert.error?.message ?? 'Unable to create smoke plan');
    }

    ctx.planId = planInsert.data.id;
    ctx.providerOrderId = `order_smoke_${ts}`;
    ctx.providerPaymentId = `pay_smoke_${ts}`;

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        supabase: admin,
        user: { id: ctx.userId, email: ctx.userEmail },
        role: 'user',
      },
    } as never);

    vi.mocked(getRazorpayPublicConfig).mockReturnValue({ keyId: process.env.RAZORPAY_KEY_ID ?? 'rzp_test_key' });
    vi.mocked(createRazorpayOrder).mockResolvedValue({
      id: ctx.providerOrderId,
      entity: 'order',
      amount: 19900,
      amount_paid: 0,
      amount_due: 19900,
      currency: 'INR',
      receipt: `sub_${ctx.userId!.slice(0, 8)}_${ts}`,
      status: 'created',
    });
  });

  afterAll(async () => {
    if (!ctx.userId) return;

    await admin.from('payment_webhook_events').delete().eq('provider_event_id', ctx.providerPaymentId ?? '');
    await admin.from('payment_transactions').delete().eq('user_id', ctx.userId);
    await admin.from('subscription_payment_orders').delete().eq('user_id', ctx.userId);
    await admin.from('billing_invoices').delete().eq('user_id', ctx.userId);
    await admin.from('user_subscriptions').delete().eq('user_id', ctx.userId);

    if (ctx.planId) {
      await admin.from('subscription_plan_services').delete().eq('plan_id', ctx.planId);
      await admin.from('subscription_plans').delete().eq('id', ctx.planId);
    }

    await admin.auth.admin.deleteUser(ctx.userId);
  });

  it('processes order -> verify -> webhook capture flow', async () => {
    const orderReq = new Request('http://localhost/api/payments/subscriptions/order', {
      method: 'POST',
      body: JSON.stringify({ planId: ctx.planId }),
      headers: { 'content-type': 'application/json' },
    });

    const orderRes = await postOrder(orderReq);
    expect(orderRes.status).toBe(200);

    const orderJson = await orderRes.json();
    expect(orderJson?.order?.provider_order_id).toBe(ctx.providerOrderId);
    expect(orderJson?.order?.status).toBe('created');

    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? 'test_key_secret';

    const checkoutSignature = hmacHex(keySecret!, `${ctx.providerOrderId}|${ctx.providerPaymentId}`);

    const verifyReq = new Request('http://localhost/api/payments/subscriptions/verify', {
      method: 'POST',
      body: JSON.stringify({
        providerOrderId: ctx.providerOrderId,
        providerPaymentId: ctx.providerPaymentId,
        providerSignature: checkoutSignature,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const verifyRes = await postVerify(verifyReq);
    expect(verifyRes.status).toBe(200);

    const verifyJson = await verifyRes.json();
    expect(verifyJson?.success).toBe(true);

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'test_webhook_secret';

    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: ctx.providerPaymentId,
            order_id: ctx.providerOrderId,
            status: 'captured',
            amount: 19900,
            currency: 'INR',
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const webhookSignature = hmacHex(webhookSecret!, rawBody);

    const webhookReq = new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': webhookSignature,
      },
    });

    const webhookRes = await postWebhook(webhookReq);
    expect(webhookRes.status).toBe(200);

    const webhookJson = await webhookRes.json();
    expect(webhookJson?.accepted).toBe(true);

    const tx = await admin
      .from('payment_transactions')
      .select('status, provider_payment_id')
      .eq('user_id', ctx.userId!)
      .eq('provider_payment_id', ctx.providerPaymentId!)
      .single();

    expect(tx.error).toBeNull();
    expect(tx.data?.status).toBe('captured');

    const subscription = await admin
      .from('user_subscriptions')
      .select('status, user_id, plan_id')
      .eq('user_id', ctx.userId!)
      .eq('plan_id', ctx.planId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(subscription.error).toBeNull();
    expect(subscription.data?.status).toBe('active');

    const invoice = await admin
      .from('billing_invoices')
      .select('status, invoice_type, user_id, user_subscription_id')
      .eq('user_id', ctx.userId!)
      .eq('invoice_type', 'subscription')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(invoice.error).toBeNull();
    expect(invoice.data?.status).toBe('paid');
    expect(invoice.data?.user_subscription_id).toBeTruthy();
  });
});
