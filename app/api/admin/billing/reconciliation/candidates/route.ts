import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_inr: number;
  payment_transaction_id: string | null;
  created_at: string;
  issued_at: string | null;
};

type TxRow = {
  id: string;
  amount_inr: number;
  status: string;
  provider_payment_id: string | null;
  created_at: string;
};

type CandidateRow = {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total_inr: number;
  issued_at: string | null;
  created_at: string;
  candidate_count: number;
  confidence: number;
  recommended_action: 'manual_link' | 'auto_match_possible' | 'manual_review_required';
  candidates: Array<{
    payment_transaction_id: string;
    provider_payment_id: string | null;
    status: string;
    amount_inr: number;
    created_at: string;
    time_delta_hours: number;
  }>;
};

function scoreCandidate(input: { timeDeltaHours: number; candidateCount: number }) {
  const ambiguityPenalty = Math.min(30, Math.max(0, (input.candidateCount - 1) * 8));
  const timePenalty = Math.min(55, Math.max(0, input.timeDeltaHours / 2));
  return Math.max(10, Math.min(99, Math.round(100 - ambiguityPenalty - timePenalty)));
}

function buildCandidateQueue(input: {
  invoices: InvoiceRow[];
  unlinkedTxs: TxRow[];
}) {
  const { invoices, unlinkedTxs } = input;

  return invoices.map((invoice): CandidateRow => {
    const invoiceAmount = Number(invoice.total_inr ?? 0);
    const invoiceReference = invoice.issued_at ?? invoice.created_at;
    const invoiceTime = Date.parse(invoiceReference);
    const safeInvoiceTime = Number.isFinite(invoiceTime) ? invoiceTime : Date.now();

    const amountMatches = unlinkedTxs.filter((tx) => Math.abs(Number(tx.amount_inr ?? 0) - invoiceAmount) <= 0.01);

    const candidates = amountMatches
      .map((tx) => {
        const txTime = Date.parse(tx.created_at);
        const deltaMs = Number.isFinite(txTime) ? Math.abs(safeInvoiceTime - txTime) : Number.MAX_SAFE_INTEGER;
        return {
          payment_transaction_id: tx.id,
          provider_payment_id: tx.provider_payment_id,
          status: tx.status,
          amount_inr: Number(tx.amount_inr ?? 0),
          created_at: tx.created_at,
          time_delta_hours: Number((deltaMs / (60 * 60 * 1000)).toFixed(2)),
        };
      })
      .sort((a, b) => a.time_delta_hours - b.time_delta_hours)
      .slice(0, 3);

    const confidence =
      candidates.length > 0
        ? scoreCandidate({ timeDeltaHours: candidates[0].time_delta_hours, candidateCount: amountMatches.length })
        : 0;

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      total_inr: invoiceAmount,
      issued_at: invoice.issued_at,
      created_at: invoice.created_at,
      candidate_count: amountMatches.length,
      confidence,
      recommended_action:
        candidates.length === 0
          ? 'manual_link'
          : confidence >= 60
          ? 'auto_match_possible'
          : 'manual_review_required',
      candidates,
    };
  });
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 120), 20), 300);

  const [{ data: invoices, error: invoiceError }, { data: linkedInvoices, error: linkedError }, { data: txRows, error: txError }] = await Promise.all([
    supabase
      .from('billing_invoices')
      .select('id, invoice_number, status, total_inr, payment_transaction_id, created_at, issued_at')
      .in('status', ['issued', 'paid'])
      .is('payment_transaction_id', null)
      .order('issued_at', { ascending: true, nullsFirst: false })
      .limit(limit)
      .returns<InvoiceRow[]>(),
    supabase
      .from('billing_invoices')
      .select('payment_transaction_id')
      .not('payment_transaction_id', 'is', null)
      .returns<Array<{ payment_transaction_id: string | null }>>(),
    supabase
      .from('payment_transactions')
      .select('id, amount_inr, status, provider_payment_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1500)
      .returns<TxRow[]>(),
  ]);

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 });
  }

  if (linkedError) {
    return NextResponse.json({ error: linkedError.message }, { status: 500 });
  }

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const linkedTxIds = new Set(
    (linkedInvoices ?? [])
      .map((row) => row.payment_transaction_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  const unlinkedTxs = (txRows ?? []).filter((tx) => !linkedTxIds.has(tx.id));

  const queue = buildCandidateQueue({ invoices: invoices ?? [], unlinkedTxs });

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    totals: {
      invoices_considered: queue.length,
      with_candidates: queue.filter((row) => row.candidate_count > 0).length,
      auto_match_ready: queue.filter((row) => row.confidence >= 60 && row.candidate_count > 0).length,
      manual_review_required: queue.filter((row) => row.candidate_count === 0 || row.confidence < 60).length,
    },
    queue,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));

  const minConfidence = Math.min(Math.max(Number(body?.minConfidence ?? 75), 45), 95);
  const applyLimit = Math.min(Math.max(Number(body?.limit ?? 20), 1), 100);

  const [{ data: invoices, error: invoiceError }, { data: linkedInvoices, error: linkedError }, { data: txRows, error: txError }] =
    await Promise.all([
      supabase
        .from('billing_invoices')
        .select('id, invoice_number, status, total_inr, payment_transaction_id, created_at, issued_at')
        .in('status', ['issued', 'paid'])
        .is('payment_transaction_id', null)
        .order('issued_at', { ascending: true, nullsFirst: false })
        .limit(300)
        .returns<InvoiceRow[]>(),
      supabase
        .from('billing_invoices')
        .select('payment_transaction_id')
        .not('payment_transaction_id', 'is', null)
        .returns<Array<{ payment_transaction_id: string | null }>>(),
      supabase
        .from('payment_transactions')
        .select('id, amount_inr, status, provider_payment_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1500)
        .returns<TxRow[]>(),
    ]);

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 });
  }

  if (linkedError) {
    return NextResponse.json({ error: linkedError.message }, { status: 500 });
  }

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const linkedTxIds = new Set(
    (linkedInvoices ?? [])
      .map((row) => row.payment_transaction_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  const unlinkedTxs = (txRows ?? []).filter((tx) => !linkedTxIds.has(tx.id));
  const queue = buildCandidateQueue({ invoices: invoices ?? [], unlinkedTxs })
    .filter((row) => row.confidence >= minConfidence && row.candidates.length > 0)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.candidates[0].time_delta_hours - b.candidates[0].time_delta_hours;
    })
    .slice(0, applyLimit);

  let matched = 0;
  const skipped: Array<{ invoice_id: string; reason: 'candidate_consumed' | 'update_failed'; detail?: string }> = [];
  const matchedTxIds = new Set<string>();
  const nowIso = new Date().toISOString();

  for (const row of queue) {
    const candidate = row.candidates.find((item) => !linkedTxIds.has(item.payment_transaction_id) && !matchedTxIds.has(item.payment_transaction_id));

    if (!candidate) {
      skipped.push({ invoice_id: row.invoice_id, reason: 'candidate_consumed' });
      continue;
    }

    const { data: invoiceMetaRow, error: invoiceMetaError } = await supabase
      .from('billing_invoices')
      .select('metadata')
      .eq('id', row.invoice_id)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>();

    if (invoiceMetaError) {
      skipped.push({ invoice_id: row.invoice_id, reason: 'update_failed', detail: invoiceMetaError.message });
      continue;
    }

    const metadata = isRecord(invoiceMetaRow?.metadata) ? invoiceMetaRow.metadata : {};
    const reconciliationHistory = Array.isArray(metadata.reconciliation_history) ? metadata.reconciliation_history : [];

    reconciliationHistory.push({
      action: 'bulk_auto_match_high_confidence',
      next_payment_transaction_id: candidate.payment_transaction_id,
      matched_payment_amount_inr: candidate.amount_inr,
      match_confidence: row.confidence,
      candidate_count: row.candidate_count,
      matched_time_delta_hours: candidate.time_delta_hours,
      resolved_at: nowIso,
      resolved_by: user.id,
      source: 'admin_reconciliation_candidate_bulk',
    });

    const { error: updateError } = await supabase
      .from('billing_invoices')
      .update({
        payment_transaction_id: candidate.payment_transaction_id,
        metadata: {
          ...metadata,
          reconciliation_last_auto_match: {
            matched_transaction_id: candidate.payment_transaction_id,
            confidence: row.confidence,
            candidate_count: row.candidate_count,
            matched_at: nowIso,
            matched_by: user.id,
            source: 'admin_reconciliation_candidate_bulk',
          },
          reconciliation_history: reconciliationHistory,
        },
      })
      .eq('id', row.invoice_id)
      .is('payment_transaction_id', null);

    if (updateError) {
      skipped.push({ invoice_id: row.invoice_id, reason: 'update_failed', detail: updateError.message });
      continue;
    }

    matched += 1;
    matchedTxIds.add(candidate.payment_transaction_id);
    linkedTxIds.add(candidate.payment_transaction_id);
  }

  return NextResponse.json({
    success: true,
    minConfidence,
    considered: queue.length,
    matched,
    skipped,
  });
}
