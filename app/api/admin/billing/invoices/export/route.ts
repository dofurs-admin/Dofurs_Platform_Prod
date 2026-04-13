import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type InvoiceExportRow = {
  invoice_number: string;
  invoice_type: string;
  status: string;
  user_id: string;
  subtotal_inr: number | null;
  wallet_credits_applied_inr: number | null;
  total_inr: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const invoiceType = searchParams.get('invoiceType');
  const search = searchParams.get('q')?.trim() ?? '';
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 1000), 100), 5000);

  let query = supabase
    .from('billing_invoices')
    .select('invoice_number, invoice_type, status, user_id, subtotal_inr, wallet_credits_applied_inr, total_inr, issued_at, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  if (invoiceType) {
    query = query.eq('invoice_type', invoiceType);
  }

  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,user_id.ilike.%${search}%`);
  }

  if (fromDate) {
    const parsedFromDate = new Date(fromDate);
    if (!Number.isNaN(parsedFromDate.getTime())) {
      query = query.gte('created_at', parsedFromDate.toISOString());
    }
  }

  if (toDate) {
    const parsedToDate = new Date(toDate);
    if (!Number.isNaN(parsedToDate.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        parsedToDate.setUTCHours(23, 59, 59, 999);
      }
      query = query.lte('created_at', parsedToDate.toISOString());
    }
  }

  const { data, error } = await query.returns<InvoiceExportRow[]>();

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = [
    ['Invoice Number', 'Invoice Type', 'Status', 'User ID', 'Subtotal INR', 'Credits Applied INR', 'Net Total INR', 'Issued At', 'Paid At', 'Created At'],
    ...(data ?? []).map((invoice) => [
      invoice.invoice_number,
      invoice.invoice_type,
      invoice.status,
      invoice.user_id,
      Number(invoice.subtotal_inr ?? 0).toFixed(2),
      Number(invoice.wallet_credits_applied_inr ?? 0).toFixed(2),
      Number(invoice.total_inr ?? 0).toFixed(2),
      invoice.issued_at ? new Date(invoice.issued_at).toISOString() : '',
      invoice.paid_at ? new Date(invoice.paid_at).toISOString() : '',
      new Date(invoice.created_at).toISOString(),
    ]),
  ];

  const csv = rows.map((row) => row.map((value) => csvCell(value)).join(',')).join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="billing-invoices-${getISTTimestamp().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
