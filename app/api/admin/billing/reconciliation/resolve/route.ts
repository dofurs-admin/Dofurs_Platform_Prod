import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type ResolveAction =
  | 'link_payment_reference'
  | 'clear_payment_reference'
  | 'sync_invoice_total_to_payment'
  | 'auto_match_missing_reference';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => null);

  const action = body?.action as ResolveAction;
  const invoiceId = typeof body?.invoiceId === 'string' ? body.invoiceId.trim() : '';
  const paymentTransactionId = typeof body?.paymentTransactionId === 'string' ? body.paymentTransactionId.trim().slice(0, 200) : '';

  const allowedActions: ResolveAction[] = [
    'link_payment_reference',
    'clear_payment_reference',
    'sync_invoice_total_to_payment',
    'auto_match_missing_reference',
  ];

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required.' }, { status: 400 });
  }

  if (!allowedActions.includes(action)) {
    return NextResponse.json({ error: 'Unsupported reconciliation action.' }, { status: 400 });
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .select('id, payment_transaction_id, subtotal_inr, total_inr, issued_at, created_at, metadata')
    .eq('id', invoiceId)
    .maybeSingle<{
      id: string;
      payment_transaction_id: string | null;
      subtotal_inr: number;
      total_inr: number;
      issued_at: string | null;
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>();

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 });
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const metadata = isRecord(invoice.metadata) ? invoice.metadata : {};
  const reconciliationHistory = Array.isArray(metadata.reconciliation_history) ? metadata.reconciliation_history : [];

  if (action === 'clear_payment_reference') {
    reconciliationHistory.push({
      action,
      previous_payment_transaction_id: invoice.payment_transaction_id,
      resolved_at: nowIso,
      resolved_by: user.id,
      source: 'admin_reconciliation_panel',
    });

    const { error: updateError } = await supabase
      .from('billing_invoices')
      .update({
        payment_transaction_id: null,
        metadata: {
          ...metadata,
          reconciliation_history: reconciliationHistory,
        },
      })
      .eq('id', invoice.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action, invoiceId });
  }

  if (action === 'auto_match_missing_reference') {
    const { data: linkedInvoices, error: linkedInvoicesError } = await supabase
      .from('billing_invoices')
      .select('payment_transaction_id')
      .not('payment_transaction_id', 'is', null)
      .returns<Array<{ payment_transaction_id: string | null }>>();

    if (linkedInvoicesError) {
      return NextResponse.json({ error: linkedInvoicesError.message }, { status: 500 });
    }

    const linkedTxIds = new Set(
      (linkedInvoices ?? [])
        .map((row) => row.payment_transaction_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );

    const { data: candidateTxRows, error: candidateTxError } = await supabase
      .from('payment_transactions')
      .select('id, amount_inr, created_at, provider_payment_id')
      .order('created_at', { ascending: false })
      .limit(1200)
      .returns<Array<{ id: string; amount_inr: number; created_at: string; provider_payment_id: string | null }>>();

    if (candidateTxError) {
      return NextResponse.json({ error: candidateTxError.message }, { status: 500 });
    }

    const invoiceAmount = Number(invoice.total_inr ?? 0);
    const invoiceReferenceIso = invoice.issued_at ?? invoice.created_at;
    const invoiceTime = Date.parse(invoiceReferenceIso);
    const safeInvoiceTime = Number.isFinite(invoiceTime) ? invoiceTime : Date.now();

    const candidates = (candidateTxRows ?? [])
      .filter((tx) => !linkedTxIds.has(tx.id))
      .filter((tx) => Math.abs(Number(tx.amount_inr ?? 0) - invoiceAmount) <= 0.01)
      .map((tx) => {
        const txTime = Date.parse(tx.created_at);
        const timeDeltaMs = Number.isFinite(txTime) ? Math.abs(safeInvoiceTime - txTime) : Number.MAX_SAFE_INTEGER;
        const timeDeltaHours = timeDeltaMs / (60 * 60 * 1000);
        return {
          ...tx,
          timeDeltaMs,
          timeDeltaHours,
        };
      })
      .sort((a, b) => a.timeDeltaMs - b.timeDeltaMs);

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No unlinked transaction candidate found for auto-match.' }, { status: 404 });
    }

    const match = candidates[0];
    const ambiguityPenalty = Math.min(30, Math.max(0, (candidates.length - 1) * 8));
    const timePenalty = Math.min(55, Math.max(0, match.timeDeltaHours / 2));
    const confidence = Math.max(10, Math.min(99, Math.round(100 - ambiguityPenalty - timePenalty)));

    if (confidence < 45) {
      return NextResponse.json(
        {
          error: 'Auto-match confidence is too low; manual review required.',
          confidence,
          candidateCount: candidates.length,
        },
        { status: 409 },
      );
    }

    reconciliationHistory.push({
      action,
      previous_payment_transaction_id: invoice.payment_transaction_id,
      next_payment_transaction_id: match.id,
      invoice_amount_inr: invoiceAmount,
      matched_payment_amount_inr: Number(match.amount_inr ?? 0),
      match_confidence: confidence,
      candidate_count: candidates.length,
      matched_time_delta_hours: Number(match.timeDeltaHours.toFixed(2)),
      resolved_at: nowIso,
      resolved_by: user.id,
      source: 'admin_reconciliation_panel',
    });

    const { error: updateError } = await supabase
      .from('billing_invoices')
      .update({
        payment_transaction_id: match.id,
        metadata: {
          ...metadata,
          reconciliation_last_auto_match: {
            matched_transaction_id: match.id,
            confidence,
            candidate_count: candidates.length,
            matched_at: nowIso,
            matched_by: user.id,
            source: 'admin_reconciliation_panel',
          },
          reconciliation_history: reconciliationHistory,
        },
      })
      .eq('id', invoice.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      invoiceId,
      paymentTransactionId: match.id,
      confidence,
      candidateCount: candidates.length,
    });
  }

  if (!paymentTransactionId) {
    return NextResponse.json({ error: 'paymentTransactionId is required for this action.' }, { status: 400 });
  }

  const { data: transaction, error: txError } = await supabase
    .from('payment_transactions')
    .select('id, amount_inr')
    .eq('id', paymentTransactionId)
    .maybeSingle<{ id: string; amount_inr: number }>();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  if (!transaction) {
    return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
  }

  if (action === 'link_payment_reference') {
    reconciliationHistory.push({
      action,
      previous_payment_transaction_id: invoice.payment_transaction_id,
      next_payment_transaction_id: transaction.id,
      resolved_at: nowIso,
      resolved_by: user.id,
      source: 'admin_reconciliation_panel',
    });

    const { error: updateError } = await supabase
      .from('billing_invoices')
      .update({
        payment_transaction_id: transaction.id,
        metadata: {
          ...metadata,
          reconciliation_history: reconciliationHistory,
        },
      })
      .eq('id', invoice.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action, invoiceId, paymentTransactionId: transaction.id });
  }

  reconciliationHistory.push({
    action,
    previous_total_inr: Number(invoice.total_inr ?? 0),
    synced_payment_transaction_id: transaction.id,
    synced_payment_amount_inr: Number(transaction.amount_inr ?? 0),
    resolved_at: nowIso,
    resolved_by: user.id,
    source: 'admin_reconciliation_panel',
  });

  const txAmount = Number(transaction.amount_inr ?? 0);

  const { error: syncError } = await supabase
    .from('billing_invoices')
    .update({
      payment_transaction_id: transaction.id,
      subtotal_inr: txAmount,
      total_inr: txAmount,
      metadata: {
        ...metadata,
        reconciliation_history: reconciliationHistory,
      },
    })
    .eq('id', invoice.id);

  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    action,
    invoiceId,
    paymentTransactionId: transaction.id,
    syncedTotalInr: txAmount,
  });
}
