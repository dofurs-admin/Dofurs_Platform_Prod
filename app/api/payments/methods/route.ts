import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';

type PaymentMethodCode = 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 50,
};

const allowedMethodCodes: PaymentMethodCode[] = ['razorpay', 'upi', 'card', 'netbanking', 'wallet', 'cash'];

const paymentMethodPreferenceSchema = z.object({
  preferred_payment_method: z.enum(allowedMethodCodes).optional(),
  preferred_upi_vpa: z.string().trim().max(120).nullable().optional(),
  billing_email: z.string().trim().email().max(320).nullable().optional(),
});

function toMethodCode(value: unknown): PaymentMethodCode | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes('upi')) {
    return 'upi';
  }

  if (normalized.includes('card')) {
    return 'card';
  }

  if (normalized.includes('netbank')) {
    return 'netbanking';
  }

  if (normalized.includes('wallet')) {
    return 'wallet';
  }

  if (normalized.includes('cash')) {
    return 'cash';
  }

  if (normalized.includes('razorpay') || normalized.includes('checkout')) {
    return 'razorpay';
  }

  return null;
}

function methodLabel(code: PaymentMethodCode) {
  switch (code) {
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    case 'netbanking':
      return 'Netbanking';
    case 'wallet':
      return 'Wallet';
    case 'cash':
      return 'Cash (Pay After Service)';
    default:
      return 'Razorpay Checkout';
  }
}

export async function GET() {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { user, supabase } = auth.context;

  const rate = await isRateLimited(supabase, getRateLimitKey('payments:methods:get', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const [preferenceResult, transactionsResult] = await Promise.all([
    supabase
      .from('user_preferences')
      .select('preferred_payment_method, preferred_upi_vpa, billing_email')
      .eq('user_id', user.id)
      .maybeSingle<{
        preferred_payment_method: PaymentMethodCode | null;
        preferred_upi_vpa: string | null;
        billing_email: string | null;
      }>(),
    supabase
      .from('payment_transactions')
      .select('created_at, transaction_type, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)
      .returns<Array<{ created_at: string; transaction_type: string; metadata: Record<string, unknown> | null }>>(),
  ]);

  if (preferenceResult.error) {
    return NextResponse.json({ error: preferenceResult.error.message }, { status: 500 });
  }

  if (transactionsResult.error) {
    return NextResponse.json({ error: transactionsResult.error.message }, { status: 500 });
  }

  const methodMap = new Map<PaymentMethodCode, { lastUsedAt: string | null; source: 'transactions' | 'preference' }>();

  const preferredCode = preferenceResult.data?.preferred_payment_method ?? null;
  if (preferredCode && allowedMethodCodes.includes(preferredCode)) {
    methodMap.set(preferredCode, {
      lastUsedAt: null,
      source: 'preference',
    });
  }

  for (const tx of transactionsResult.data ?? []) {
    const metadata = tx.metadata ?? {};

    const candidate =
      toMethodCode(metadata.payment_method) ??
      toMethodCode(metadata.method) ??
      toMethodCode(metadata.collection_mode) ??
      toMethodCode(metadata.channel) ??
      (tx.transaction_type === 'service_collection' ? 'cash' : null);

    if (!candidate) {
      continue;
    }

    if (!methodMap.has(candidate)) {
      methodMap.set(candidate, {
        lastUsedAt: tx.created_at,
        source: 'transactions',
      });
    }
  }

  const detectedMethods = Array.from(methodMap.entries()).map(([code, details]) => ({
    code,
    label: methodLabel(code),
    lastUsedAt: details.lastUsedAt,
    source: details.source,
  }));

  return NextResponse.json({
    preference: {
      preferred_payment_method: preferredCode ?? 'razorpay',
      preferred_upi_vpa: preferenceResult.data?.preferred_upi_vpa ?? null,
      billing_email: preferenceResult.data?.billing_email ?? user.email ?? null,
    },
    detectedMethods,
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { user, supabase } = auth.context;

  const rate = await isRateLimited(supabase, getRateLimitKey('payments:methods:put', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = paymentMethodPreferenceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedPayload = {
    preferred_payment_method: parsed.data.preferred_payment_method ?? 'razorpay',
    preferred_upi_vpa: parsed.data.preferred_upi_vpa?.trim() || null,
    billing_email: parsed.data.billing_email?.trim() || null,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(normalizedPayload, { onConflict: 'user_id' })
    .select('preferred_payment_method, preferred_upi_vpa, billing_email')
    .single<{
      preferred_payment_method: PaymentMethodCode | null;
      preferred_upi_vpa: string | null;
      billing_email: string | null;
    }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to save payment preferences.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, preference: data });
}
