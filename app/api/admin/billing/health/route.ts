import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type BookingRow = {
  id: number;
  booking_status: string | null;
  status: string | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  booking_id: number | null;
  invoice_type: string;
  status: string;
  payment_transaction_id: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  booking_id: number | null;
  transaction_type: string;
  status: string;
  created_at: string;
};

function asIsoOrNull(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function effectiveBookingStatus(row: BookingRow) {
  return row.booking_status ?? row.status ?? 'pending';
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);

  const lookbackDays = Math.min(Math.max(Number(searchParams.get('lookbackDays') ?? 30), 1), 365);
  const sampleSize = Math.min(Math.max(Number(searchParams.get('sampleSize') ?? 25), 1), 100);
  const maxRows = Math.min(Math.max(Number(searchParams.get('maxRows') ?? 5000), 500), 20000);

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const [bookingsResult, invoicesResult, paymentsResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_status, status, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(maxRows)
      .returns<BookingRow[]>(),
    supabase
      .from('billing_invoices')
      .select('id, booking_id, invoice_type, status, payment_transaction_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(maxRows)
      .returns<InvoiceRow[]>(),
    supabase
      .from('payment_transactions')
      .select('id, booking_id, transaction_type, status, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(maxRows)
      .returns<PaymentRow[]>(),
  ]);

  if (bookingsResult.error) {
    return NextResponse.json({ error: bookingsResult.error.message }, { status: 500 });
  }

  if (invoicesResult.error) {
    return NextResponse.json({ error: invoicesResult.error.message }, { status: 500 });
  }

  if (paymentsResult.error) {
    return NextResponse.json({ error: paymentsResult.error.message }, { status: 500 });
  }

  const bookings = bookingsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const completedBookings = bookings.filter((row) => effectiveBookingStatus(row) === 'completed');
  const serviceInvoices = invoices.filter((row) => row.invoice_type === 'service');
  const paidServiceInvoices = serviceInvoices.filter((row) => row.status === 'paid');
  const bookingPayments = payments.filter((row) => row.booking_id !== null);

  const invoiceBookingIds = new Set(
    serviceInvoices
      .map((row) => row.booking_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  );

  const paymentBookingIds = new Set(
    bookingPayments
      .map((row) => row.booking_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  );

  const completedWithoutInvoice = completedBookings
    .filter((row) => !invoiceBookingIds.has(row.id))
    .slice(0, sampleSize)
    .map((row) => ({
      booking_id: row.id,
      created_at: asIsoOrNull(row.created_at),
      status: effectiveBookingStatus(row),
    }));

  const completedWithoutPayment = completedBookings
    .filter((row) => !paymentBookingIds.has(row.id))
    .slice(0, sampleSize)
    .map((row) => ({
      booking_id: row.id,
      created_at: asIsoOrNull(row.created_at),
      status: effectiveBookingStatus(row),
    }));

  const paidInvoicesMissingPaymentRef = paidServiceInvoices
    .filter((row) => !row.payment_transaction_id)
    .slice(0, sampleSize)
    .map((row) => ({
      invoice_id: row.id,
      booking_id: row.booking_id,
      created_at: asIsoOrNull(row.created_at),
    }));

  const paidStatusSet = new Set(['captured', 'paid', 'paid_manual']);
  const serviceCollectionSet = new Set(['service_collection']);
  const orphanPaymentTransactions = bookingPayments
    .filter((row) => serviceCollectionSet.has(row.transaction_type))
    .filter((row) => paidStatusSet.has(row.status))
    .filter((row) => {
      if (row.booking_id === null) return false;
      return !invoiceBookingIds.has(row.booking_id);
    })
    .slice(0, sampleSize)
    .map((row) => ({
      payment_transaction_id: row.id,
      booking_id: row.booking_id,
      status: row.status,
      created_at: asIsoOrNull(row.created_at),
    }));

  const mismatchCount =
    completedWithoutInvoice.length +
    completedWithoutPayment.length +
    paidInvoicesMissingPaymentRef.length +
    orphanPaymentTransactions.length;

  const severity =
    mismatchCount === 0
      ? 'healthy'
      : mismatchCount <= 10
      ? 'warning'
      : 'critical';

  return NextResponse.json({
    generated_at: getISTTimestamp(),
    window: {
      lookback_days: lookbackDays,
      since,
      max_rows_scanned_per_table: maxRows,
    },
    totals: {
      bookings_scanned: bookings.length,
      completed_bookings: completedBookings.length,
      invoices_scanned: invoices.length,
      service_invoices: serviceInvoices.length,
      paid_service_invoices: paidServiceInvoices.length,
      payment_transactions_scanned: payments.length,
      booking_payment_transactions: bookingPayments.length,
    },
    integrity: {
      severity,
      mismatch_count: mismatchCount,
      issues: {
        completed_without_invoice: completedWithoutInvoice.length,
        completed_without_payment_transaction: completedWithoutPayment.length,
        paid_invoices_missing_payment_reference: paidInvoicesMissingPaymentRef.length,
        paid_service_transactions_without_service_invoice: orphanPaymentTransactions.length,
      },
    },
    samples: {
      completed_without_invoice: completedWithoutInvoice,
      completed_without_payment_transaction: completedWithoutPayment,
      paid_invoices_missing_payment_reference: paidInvoicesMissingPaymentRef,
      paid_service_transactions_without_service_invoice: orphanPaymentTransactions,
    },
  });
}
