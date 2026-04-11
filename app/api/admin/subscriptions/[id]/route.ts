import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type SubscriptionDetailRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  payment_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  subscription_plans: {
    id: string;
    name: string | null;
    code: string | null;
    description: string | null;
    duration_days: number | null;
    price_inr: number | null;
  } | null;
};

type UserProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type CreditRow = {
  service_type: string;
  total_credits: number;
  available_credits: number;
  consumed_credits: number;
};

type PlanServiceRow = {
  service_type: string;
  credit_count: number;
};

type PaymentTransactionRow = {
  id: string;
  payment_order_id: string | null;
  provider: string;
  transaction_type: string;
  status: string;
  amount_inr: number;
  currency: string;
  provider_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PaymentOrderRow = {
  id: string;
  provider_order_id: string;
  amount_inr: number;
  currency: string;
  status: string;
  created_at: string;
};

type PaymentEventRow = {
  payload: Record<string, unknown> | null;
};

type BillingInvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_inr: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

function toText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sentenceCase(value: string) {
  const normalized = value.replaceAll('_', ' ').trim();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function extractPaymentMethod(
  eventPayload: Record<string, unknown> | null,
  metadata: Record<string, unknown> | null,
  provider: string,
) {
  const payment = (eventPayload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  const method = toText(payment?.method);
  const vpa = toText(payment?.vpa);

  if (method === 'upi' && vpa) {
    return `UPI (${vpa})`;
  }

  if (method) {
    return sentenceCase(method);
  }

  const metadataMethod = toText(metadata?.payment_method) ?? toText(metadata?.collection_mode);
  if (metadataMethod) {
    return sentenceCase(metadataMethod);
  }

  return sentenceCase(provider);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { id } = await context.params;

  const { data: subscription, error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, plan_id, status, starts_at, ends_at, activated_at, cancelled_at, payment_transaction_id, metadata, created_at, updated_at, subscription_plans(id, name, code, description, duration_days, price_inr)')
    .eq('id', id)
    .maybeSingle<SubscriptionDetailRow>();

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 });
  }

  const [
    userResult,
    creditsResult,
    planServicesResult,
    transactionResult,
    invoiceResult,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('id', subscription.user_id)
      .maybeSingle<UserProfileRow>(),
    supabase
      .from('user_service_credits')
      .select('service_type, total_credits, available_credits, consumed_credits')
      .eq('user_subscription_id', subscription.id)
      .returns<CreditRow[]>(),
    supabase
      .from('subscription_plan_services')
      .select('service_type, credit_count')
      .eq('plan_id', subscription.plan_id)
      .returns<PlanServiceRow[]>(),
    subscription.payment_transaction_id
      ? supabase
          .from('payment_transactions')
          .select('id, payment_order_id, provider, transaction_type, status, amount_inr, currency, provider_payment_id, metadata, created_at')
          .eq('id', subscription.payment_transaction_id)
          .maybeSingle<PaymentTransactionRow>()
      : Promise.resolve({ data: null as PaymentTransactionRow | null, error: null }),
    supabase
      .from('billing_invoices')
      .select('id, invoice_number, status, total_inr, issued_at, paid_at, created_at')
      .eq('user_subscription_id', subscription.id)
      .eq('invoice_type', 'subscription')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<BillingInvoiceRow>(),
  ]);

  const tx = transactionResult.data;

  const [orderResult, eventResult] = await Promise.all([
    tx?.payment_order_id
      ? supabase
          .from('subscription_payment_orders')
          .select('id, provider_order_id, amount_inr, currency, status, created_at')
          .eq('id', tx.payment_order_id)
          .maybeSingle<PaymentOrderRow>()
      : Promise.resolve({ data: null as PaymentOrderRow | null, error: null }),
    tx?.id
      ? supabase
          .from('payment_events')
          .select('payload')
          .eq('transaction_id', tx.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<PaymentEventRow>()
      : Promise.resolve({ data: null as PaymentEventRow | null, error: null }),
  ]);

  const paymentMethod = tx
    ? extractPaymentMethod(eventResult.data?.payload ?? null, tx.metadata ?? null, tx.provider)
    : null;

  return NextResponse.json({
    subscription,
    subscriber: {
      id: subscription.user_id,
      name: userResult.data?.name ?? userResult.data?.email ?? null,
      email: userResult.data?.email ?? null,
      phone: userResult.data?.phone ?? null,
    },
    plan_services: planServicesResult.data ?? [],
    credits: creditsResult.data ?? [],
    credit_summary: {
      total: (creditsResult.data ?? []).reduce((sum, row) => sum + Number(row.total_credits ?? 0), 0),
      available: (creditsResult.data ?? []).reduce((sum, row) => sum + Number(row.available_credits ?? 0), 0),
      consumed: (creditsResult.data ?? []).reduce((sum, row) => sum + Number(row.consumed_credits ?? 0), 0),
    },
    payment: tx
      ? {
          transaction: tx,
          order: orderResult.data ?? null,
          latest_event: eventResult.data ?? null,
          display_method: paymentMethod,
        }
      : null,
    invoice: invoiceResult.data ?? null,
  });
}
