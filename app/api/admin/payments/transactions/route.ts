import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type PaymentTransactionRow = {
  id: string;
  user_id: string;
  booking_id: number | null;
  payment_order_id?: string | null;
  transaction_type: string;
  status: string;
  amount_inr: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type PaidInvoiceRow = {
  id: string;
  user_id: string;
  booking_id: number | null;
  total_inr: number;
  payment_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type BookingRow = {
  id: number;
  service_type: string | null;
  booking_mode: string | null;
  location_address: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function extractPincodeFromAddress(value: string | null) {
  if (!value) return null;
  const match = value.match(/\b\d{6}\b/);
  return match ? match[0] : null;
}

function isBookingPayload(value: unknown): value is {
  serviceType?: unknown;
  bookingMode?: unknown;
  locationAddress?: unknown;
} {
  return isRecord(value);
}

function toIsoTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 30), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  const transactionLimit = Math.max(limit + offset, 300);
  const invoiceFallbackLimit = Math.max(limit + offset, 300);

  const [{ data: transactionRows, error: txError }, { data: paidInvoiceRows, error: invoiceError }] = await Promise.all([
    supabase
      .from('payment_transactions')
      .select('id, user_id, booking_id, payment_order_id, transaction_type, status, amount_inr, currency, provider, provider_payment_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(transactionLimit)
      .returns<PaymentTransactionRow[]>(),
    supabase
      .from('billing_invoices')
      .select('id, user_id, booking_id, total_inr, payment_transaction_id, paid_at, created_at')
      .eq('status', 'paid')
      .in('invoice_type', ['service', 'subscription'])
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(invoiceFallbackLimit)
      .returns<PaidInvoiceRow[]>(),
  ]);

  if (txError && invoiceError) {
    return NextResponse.json(
      {
        error: `Unable to read payments ledger sources: transactions=${txError.message}; invoices=${invoiceError.message}`,
      },
      { status: 500 },
    );
  }

  const transactions = txError ? [] : (transactionRows ?? []);
  const txIdSet = new Set(transactions.map((row) => row.id));

  // Paid invoices without a valid linked transaction are surfaced as inferred ledger rows.
  const inferredInvoiceTransactions: PaymentTransactionRow[] = (invoiceError ? [] : (paidInvoiceRows ?? []))
    .filter((invoice) => {
      if (!invoice.payment_transaction_id) return true;
      return !txIdSet.has(invoice.payment_transaction_id);
    })
    .map((invoice) => {
      const timestamp =
        toIsoTimestamp(invoice.paid_at) ??
        toIsoTimestamp(invoice.created_at) ??
        new Date(0).toISOString();

      return {
        id: `invoice:${invoice.id}`,
        user_id: invoice.user_id,
        booking_id: invoice.booking_id,
        payment_order_id: null,
        transaction_type: 'invoice_paid_fallback',
        status: 'paid',
        amount_inr: Number(invoice.total_inr ?? 0),
        currency: 'INR',
        provider: 'billing_invoice',
        provider_payment_id: invoice.payment_transaction_id,
        metadata: {
          source: 'paid_invoice_fallback',
          invoice_id: invoice.id,
        },
        created_at: timestamp,
      };
    });

  const combined = [...transactions, ...inferredInvoiceTransactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const paged = combined.slice(offset, offset + limit);
  const total = combined.length;

  const userIds = Array.from(new Set(paged.map((row) => row.user_id).filter((id) => typeof id === 'string' && id.length > 0)));
  const bookingIds = Array.from(new Set(paged.map((row) => row.booking_id).filter((id): id is number => typeof id === 'number' && Number.isFinite(id))));

  const [usersResult, bookingsResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from('users').select('id, name, email, phone').in('id', userIds).returns<UserRow[]>()
      : Promise.resolve({ data: [] as UserRow[], error: null }),
    bookingIds.length > 0
      ? supabase.from('bookings').select('id, service_type, booking_mode, location_address').in('id', bookingIds).returns<BookingRow[]>()
      : Promise.resolve({ data: [] as BookingRow[], error: null }),
  ]);

  const usersById = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
  const bookingsById = new Map((bookingsResult.data ?? []).map((row) => [row.id, row]));

  const enriched = paged.map((tx) => {
    const user = usersById.get(tx.user_id);
    const booking = tx.booking_id != null ? bookingsById.get(tx.booking_id) : undefined;
    const metadata = isRecord(tx.metadata) ? tx.metadata : {};
    const bookingPayload = isBookingPayload(metadata.booking_payload) ? metadata.booking_payload : null;
    const checkoutContext = readString(metadata.checkout_context);
    const collectionMode = readString(metadata.collection_mode);

    const payloadServiceType = readString(bookingPayload?.serviceType);
    const payloadBookingMode = readString(bookingPayload?.bookingMode);
    const payloadLocationAddress = readString(bookingPayload?.locationAddress);

    const derivedServiceType =
      booking?.service_type ??
      payloadServiceType ??
      (tx.transaction_type === 'subscription_purchase' ? 'subscription' : tx.transaction_type === 'service_collection' ? 'service' : null);

    const derivedBookingMode = booking?.booking_mode ?? payloadBookingMode ?? null;
    const derivedLocationAddress = booking?.location_address ?? payloadLocationAddress ?? null;
    const derivedPincode = extractPincodeFromAddress(derivedLocationAddress);

    const paymentMethod =
      collectionMode ??
      (tx.provider === 'razorpay' ? 'online_razorpay' : tx.provider === 'manual' ? 'manual_collection' : tx.provider);

    const paymentReference =
      tx.provider_payment_id ??
      readString(metadata.provider_order_id) ??
      (readString(metadata.invoice_id) ? `invoice:${readString(metadata.invoice_id)}` : null);

    return {
      ...tx,
      customer_name: user?.name ?? null,
      customer_email: user?.email ?? null,
      customer_phone: user?.phone ?? null,
      service_type: derivedServiceType,
      booking_mode: derivedBookingMode,
      service_address: derivedLocationAddress,
      service_pincode: derivedPincode,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      checkout_context: checkoutContext,
      inferred: tx.transaction_type === 'invoice_paid_fallback' || tx.provider === 'billing_invoice',
    };
  });

  return NextResponse.json({
    transactions: enriched,
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
    inferredRows: inferredInvoiceTransactions.length,
    warnings: [txError?.message, invoiceError?.message].filter((value): value is string => Boolean(value)),
    enrichmentWarnings: [usersResult.error?.message, bookingsResult.error?.message].filter((value): value is string => Boolean(value)),
  });
}
