import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { logAdminAction } from '@/lib/admin/audit';
import type { Json } from '@/lib/supabase/database.types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type InvoiceStatus = 'draft' | 'issued' | 'paid';

function buildInvoiceNumber(prefix: 'INV-MAN' | 'INV-SVC' | 'INV-SUB' = 'INV-MAN') {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const t = String(now.getUTCHours()).padStart(2, '0') + String(now.getUTCMinutes()).padStart(2, '0') + String(now.getUTCSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${y}${m}${d}-${t}-${rand}`;
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
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 30), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  // Build count query
  let countQuery = supabase.from('billing_invoices').select('*', { count: 'exact', head: true });
  if (status) countQuery = countQuery.eq('status', status);
  if (invoiceType) countQuery = countQuery.eq('invoice_type', invoiceType);
  if (search) countQuery = countQuery.or(`invoice_number.ilike.%${search}%,user_id.ilike.%${search}%`);
  if (fromDate) {
    const parsedFrom = new Date(fromDate);
    if (!Number.isNaN(parsedFrom.getTime())) countQuery = countQuery.gte('created_at', parsedFrom.toISOString());
  }
  if (toDate) {
    const parsedTo = new Date(toDate);
    if (!Number.isNaN(parsedTo.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) parsedTo.setUTCHours(23, 59, 59, 999);
      countQuery = countQuery.lte('created_at', parsedTo.toISOString());
    }
  }

  // Build data query
  let dataQuery = supabase
    .from('billing_invoices')
    .select('id, user_id, invoice_number, invoice_type, status, booking_id, user_subscription_id, total_inr, wallet_credits_applied_inr, issued_at, paid_at, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) dataQuery = dataQuery.eq('status', status);
  if (invoiceType) dataQuery = dataQuery.eq('invoice_type', invoiceType);
  if (search) dataQuery = dataQuery.or(`invoice_number.ilike.%${search}%,user_id.ilike.%${search}%`);
  if (fromDate) {
    const parsedFrom = new Date(fromDate);
    if (!Number.isNaN(parsedFrom.getTime())) dataQuery = dataQuery.gte('created_at', parsedFrom.toISOString());
  }
  if (toDate) {
    const parsedTo = new Date(toDate);
    if (!Number.isNaN(parsedTo.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) parsedTo.setUTCHours(23, 59, 59, 999);
      dataQuery = dataQuery.lte('created_at', parsedTo.toISOString());
    }
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    invoices: data ?? [],
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const patchRequest = request;
  const body = await request.json().catch(() => null);

  const MAX_BULK_INVOICE_SIZE = 100;

  const invoiceIds = Array.isArray(body?.invoiceIds)
    ? body.invoiceIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  const status = body?.status;
  const allowedStatuses: InvoiceStatus[] = ['draft', 'issued', 'paid'];

  if (invoiceIds.length === 0) {
    return NextResponse.json({ error: 'invoiceIds is required.' }, { status: 400 });
  }

  if (invoiceIds.length > MAX_BULK_INVOICE_SIZE) {
    return NextResponse.json(
      { error: `Bulk invoice update is limited to ${MAX_BULK_INVOICE_SIZE} invoices per request.` },
      { status: 400 },
    );
  }

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'status must be one of: draft, issued, paid.' }, { status: 400 });
  }

  const { data: invoices, error: fetchError } = await supabase
    .from('billing_invoices')
    .select('id, status, issued_at, paid_at, metadata')
    .in('id', invoiceIds)
    .returns<Array<{
      id: string;
      status: string;
      issued_at: string | null;
      paid_at: string | null;
      metadata: Record<string, unknown> | null;
    }>>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  for (const invoice of invoices ?? []) {
    const metadata =
      invoice.metadata && typeof invoice.metadata === 'object' && !Array.isArray(invoice.metadata)
        ? invoice.metadata
        : {};
    const statusHistory = Array.isArray(metadata.status_history) ? metadata.status_history : [];
    statusHistory.push({
      from: invoice.status,
      to: status,
      changed_at: nowIso,
      changed_by: user.id,
      source: 'admin_bulk_status_update',
    });

    const updatePayload: {
      status: InvoiceStatus;
      issued_at: string | null;
      paid_at: string | null;
      metadata: Json;
    } = {
      status,
      issued_at: status === 'draft' ? null : invoice.issued_at ?? nowIso,
      paid_at: status === 'paid' ? nowIso : null,
      metadata: {
        ...metadata,
        status_history: statusHistory,
      },
    };

    const { error: updateError } = await supabase.from('billing_invoices').update(updatePayload).eq('id', invoice.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('id, user_id, invoice_number, invoice_type, status, booking_id, user_subscription_id, total_inr, wallet_credits_applied_inr, issued_at, paid_at, created_at')
    .in('id', invoiceIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void logAdminAction({ adminUserId: user.id, action: 'invoice.bulk_status_update', entityType: 'billing_invoice', entityId: invoiceIds.join(','), newValue: { status }, metadata: { count: invoiceIds.length }, request: patchRequest });

  return NextResponse.json({
    success: true,
    updated: data?.length ?? 0,
    invoices: data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user: postUser } = auth.context;
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => null);

  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const invoiceType = body?.invoiceType === 'subscription' ? 'subscription' : 'service';
  const status = body?.status === 'paid' ? 'paid' : body?.status === 'draft' ? 'draft' : 'issued';
  const subtotalInr = Number(body?.subtotalInr ?? 0);
  const discountInr = Number(body?.discountInr ?? 0);
  const taxInr = Number(body?.taxInr ?? 0);
  const cgstInr = Number(body?.cgstInr ?? 0);
  const sgstInr = Number(body?.sgstInr ?? 0);
  const igstInr = Number(body?.igstInr ?? 0);
  const gstin = typeof body?.gstin === 'string' ? body.gstin.trim() : null;
  const hsnSacCode = typeof body?.hsnSacCode === 'string' ? body.hsnSacCode.trim() : null;
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const bookingIdRaw = body?.bookingId;
  const userSubscriptionIdRaw = body?.userSubscriptionId;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json({ error: 'description is required.' }, { status: 400 });
  }

  if (!Number.isFinite(subtotalInr) || subtotalInr < 0) {
    return NextResponse.json({ error: 'subtotalInr must be a number >= 0.' }, { status: 400 });
  }

  if (!Number.isFinite(discountInr) || discountInr < 0 || !Number.isFinite(taxInr) || taxInr < 0) {
    return NextResponse.json({ error: 'discountInr and taxInr must be numbers >= 0.' }, { status: 400 });
  }

  const totalInr = Math.max(0, subtotalInr - discountInr + taxInr);
  const nowIso = new Date().toISOString();
  const bookingId = typeof bookingIdRaw === 'number' && Number.isFinite(bookingIdRaw) ? bookingIdRaw : null;
  const userSubscriptionId = typeof userSubscriptionIdRaw === 'string' && userSubscriptionIdRaw.trim() ? userSubscriptionIdRaw.trim() : null;

  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .insert({
      user_id: userId,
      invoice_number: buildInvoiceNumber('INV-MAN'),
      invoice_type: invoiceType,
      status,
      booking_id: bookingId,
      user_subscription_id: userSubscriptionId,
      subtotal_inr: subtotalInr,
      discount_inr: discountInr,
      tax_inr: taxInr,
      cgst_inr: cgstInr,
      sgst_inr: sgstInr,
      igst_inr: igstInr,
      gstin: gstin || null,
      hsn_sac_code: hsnSacCode || null,
      total_inr: totalInr,
      issued_at: status === 'draft' ? null : nowIso,
      paid_at: status === 'paid' ? nowIso : null,
      metadata: {
        source: 'admin_manual_create',
      },
    })
    .select('id, user_id, invoice_number, invoice_type, status, booking_id, user_subscription_id, total_inr, wallet_credits_applied_inr, issued_at, paid_at, created_at')
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: invoiceError?.message ?? 'Unable to create invoice.' }, { status: 500 });
  }

  const { error: itemError } = await supabase
    .from('billing_invoice_items')
    .insert({
      invoice_id: invoice.id,
      item_type: invoiceType,
      description,
      quantity: 1,
      unit_amount_inr: subtotalInr,
      line_total_inr: subtotalInr,
      metadata: {
        source: 'admin_manual_create',
      },
    });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  void logAdminAction({ adminUserId: postUser.id, action: 'invoice.created', entityType: 'billing_invoice', entityId: invoice.id, newValue: { invoiceNumber: invoice.invoice_number, status, totalInr }, request });

  return NextResponse.json({ success: true, invoice });
}
