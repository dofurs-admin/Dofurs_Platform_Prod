import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

type BillingInvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: 'service' | 'subscription';
  status: 'draft' | 'issued' | 'paid' | 'void';
  subtotal_inr: number;
  discount_inr: number;
  tax_inr: number;
  wallet_credits_applied_inr?: number;
  total_inr: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  booking_id: number | null;
  user_subscription_id: string | null;
  payment_transaction_id: string | null;
};

type PaymentTransactionRow = {
  id: string;
  provider: string;
  status: string;
  provider_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PaymentEventRow = {
  transaction_id: string;
  payload: Record<string, unknown> | null;
};

type CollectionRow = {
  booking_id: number;
  collection_mode: string;
  marked_paid_at: string | null;
};

function toText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sentenceCase(value: string) {
  const normalized = value.replaceAll('_', ' ').trim();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function extractEventMethod(payload: Record<string, unknown> | null) {
  const payment = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  if (!payment) return null;

  const method = toText(payment.method);
  const vpa = toText(payment.vpa);
  if (!method) return null;

  if (method === 'upi' && vpa) {
    return `UPI (${vpa})`;
  }

  return sentenceCase(method);
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 20), 1), 100);

  const { data: invoices, error } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, invoice_type, status, subtotal_inr, discount_inr, tax_inr, wallet_credits_applied_inr, total_inr, issued_at, paid_at, created_at, booking_id, user_subscription_id, payment_transaction_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<BillingInvoiceRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invoiceRows = invoices ?? [];
  const transactionIds = Array.from(new Set(invoiceRows.map((invoice) => invoice.payment_transaction_id).filter((value): value is string => Boolean(value))));
  const bookingIds = Array.from(new Set(invoiceRows.map((invoice) => invoice.booking_id).filter((value): value is number => value != null)));

  let transactionMap = new Map<string, PaymentTransactionRow>();
  if (transactionIds.length > 0) {
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select('id, provider, status, provider_payment_id, metadata, created_at')
      .in('id', transactionIds)
      .eq('user_id', user.id)
      .returns<PaymentTransactionRow[]>();

    transactionMap = new Map((transactions ?? []).map((row) => [row.id, row]));
  }

  let eventMap = new Map<string, PaymentEventRow>();
  if (transactionIds.length > 0) {
    const { data: events } = await supabase
      .from('payment_events')
      .select('transaction_id, payload')
      .in('transaction_id', transactionIds)
      .order('created_at', { ascending: false })
      .returns<PaymentEventRow[]>();

    eventMap = new Map();
    for (const event of events ?? []) {
      if (!eventMap.has(event.transaction_id)) {
        eventMap.set(event.transaction_id, event);
      }
    }
  }

  let collectionMap = new Map<number, CollectionRow>();
  if (bookingIds.length > 0) {
    const { data: collections } = await supabase
      .from('booking_payment_collections')
      .select('booking_id, collection_mode, marked_paid_at')
      .in('booking_id', bookingIds)
      .eq('user_id', user.id)
      .returns<CollectionRow[]>();

    collectionMap = new Map((collections ?? []).map((collection) => [collection.booking_id, collection]));
  }

  const enhanced = invoiceRows.map((invoice) => {
    const tx = invoice.payment_transaction_id ? transactionMap.get(invoice.payment_transaction_id) ?? null : null;
    const event = tx ? eventMap.get(tx.id) ?? null : null;
    const collection = invoice.booking_id != null ? collectionMap.get(invoice.booking_id) ?? null : null;

    const metadata = tx?.metadata ?? null;
    const metadataMethod = toText(metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).collection_mode : null)
      ?? toText(metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).payment_method : null);
    const eventMethod = extractEventMethod(event?.payload ?? null);

    const paymentSummary = tx
      ? {
          method: eventMethod ?? (metadataMethod ? sentenceCase(metadataMethod) : sentenceCase(tx.provider)),
          provider: tx.provider,
          reference: tx.provider_payment_id,
          status: tx.status,
          paid_at: invoice.paid_at ?? tx.created_at,
        }
      : collection
        ? {
            method: sentenceCase(collection.collection_mode),
            provider: 'manual',
            reference: null,
            status: 'paid_manual',
            paid_at: collection.marked_paid_at ?? invoice.paid_at,
          }
        : null;

    return {
      ...invoice,
      payment_summary: paymentSummary,
    };
  });

  return NextResponse.json({ invoices: enhanced });
}
