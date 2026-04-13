import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_inr: number;
  payment_transaction_id: string | null;
  created_at: string;
};

type TransactionRow = {
  id: string;
  status: string;
  amount_inr: number;
  provider_payment_id: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 300), 50), 1000);

  const [{ data: invoices, error: invoicesError }, { data: transactions, error: txError }] = await Promise.all([
    supabase
      .from('billing_invoices')
      .select('id, invoice_number, status, total_inr, payment_transaction_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('payment_transactions')
      .select('id, status, amount_inr, provider_payment_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 });
  }

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const invoiceRows = (invoices ?? []) as InvoiceRow[];
  const txRows = (transactions ?? []) as TransactionRow[];

  const txById = new Map(txRows.map((tx) => [tx.id, tx]));
  const linkedInvoiceTxIds = new Set<string>();

  const paidInvoicesMissingPaymentRef = invoiceRows.filter(
    (invoice) => invoice.status === 'paid' && !invoice.payment_transaction_id,
  );

  const mismatches: Array<{
    invoice_id: string;
    invoice_number: string;
    reason: 'missing_transaction' | 'amount_mismatch';
    invoice_total_inr: number;
    payment_transaction_id: string | null;
    payment_amount_inr: number | null;
  }> = [];

  let matched = 0;
  let amountMismatches = 0;

  for (const invoice of invoiceRows) {
    if (!invoice.payment_transaction_id) {
      continue;
    }

    linkedInvoiceTxIds.add(invoice.payment_transaction_id);

    const linkedTx = txById.get(invoice.payment_transaction_id);
    if (!linkedTx) {
      mismatches.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        reason: 'missing_transaction',
        invoice_total_inr: Number(invoice.total_inr ?? 0),
        payment_transaction_id: invoice.payment_transaction_id,
        payment_amount_inr: null,
      });
      continue;
    }

    const invoiceTotal = Number(invoice.total_inr ?? 0);
    const txAmount = Number(linkedTx.amount_inr ?? 0);
    const amountDelta = Math.abs(invoiceTotal - txAmount);

    if (amountDelta > 0.01) {
      amountMismatches += 1;
      mismatches.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        reason: 'amount_mismatch',
        invoice_total_inr: invoiceTotal,
        payment_transaction_id: linkedTx.id,
        payment_amount_inr: txAmount,
      });
      continue;
    }

    matched += 1;
  }

  const unlinkedTransactions = txRows.filter((tx) => !linkedInvoiceTxIds.has(tx.id));

  return NextResponse.json({
    checked_at: getISTTimestamp(),
    totals: {
      invoices: invoiceRows.length,
      transactions: txRows.length,
      matched,
      mismatched: mismatches.length,
      unlinkedTransactions: unlinkedTransactions.length,
      paidInvoicesMissingPaymentRef: paidInvoicesMissingPaymentRef.length,
      amountMismatches,
    },
    mismatches: mismatches.slice(0, 30),
    paidInvoicesMissingPaymentRef: paidInvoicesMissingPaymentRef.slice(0, 30).map((invoice) => ({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_inr: Number(invoice.total_inr ?? 0),
      created_at: invoice.created_at,
    })),
    unlinkedTransactions: unlinkedTransactions.slice(0, 30).map((tx) => ({
      payment_transaction_id: tx.id,
      status: tx.status,
      amount_inr: Number(tx.amount_inr ?? 0),
      provider_payment_id: tx.provider_payment_id,
      created_at: tx.created_at,
    })),
  });
}
