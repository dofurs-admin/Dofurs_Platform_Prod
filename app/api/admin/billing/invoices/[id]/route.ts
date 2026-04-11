import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { id: invoiceId } = await context.params;

  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice id is required.' }, { status: 400 });
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .select(
      'id, user_id, invoice_number, invoice_type, status, booking_id, user_subscription_id, payment_transaction_id, subtotal_inr, discount_inr, tax_inr, wallet_credits_applied_inr, total_inr, issued_at, paid_at, created_at, metadata',
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 });
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from('billing_invoice_items')
    .select('id, item_type, description, quantity, unit_amount_inr, line_total_inr, metadata, created_at')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    invoice,
    items: items ?? [],
  });
}
