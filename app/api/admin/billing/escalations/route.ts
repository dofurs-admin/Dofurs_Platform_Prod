import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import type { Json } from '@/lib/supabase/database.types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type BillingEscalationInvoiceRow = {
  id: string;
  invoice_number: string;
  user_id: string;
  status: string;
  total_inr: number;
  created_at: string;
  issued_at: string | null;
  metadata: Record<string, unknown> | null;
};

type EscalationAction = 'escalate' | 'resolve' | 'snooze_48h' | 'clear';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getDaysSince(referenceIso: string) {
  const diffMs = Date.now() - new Date(referenceIso).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function getEscalationState(metadata: Record<string, unknown>) {
  const escalation = isRecord(metadata.escalation) ? metadata.escalation : null;
  const active = Boolean(escalation?.active === true);
  const snoozeUntil = typeof escalation?.snooze_until === 'string' ? escalation.snooze_until : null;
  const resolvedAt = typeof escalation?.resolved_at === 'string' ? escalation.resolved_at : null;
  const reason = typeof escalation?.reason === 'string' ? escalation.reason : null;
  const escalatedAt = typeof escalation?.escalated_at === 'string' ? escalation.escalated_at : null;

  return {
    active,
    snoozeUntil,
    resolvedAt,
    reason,
    escalatedAt,
  };
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 400), 50), 2000);
  const state = (searchParams.get('state') ?? 'active').toLowerCase();

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, user_id, status, total_inr, created_at, issued_at, metadata')
    .eq('status', 'issued')
    .order('issued_at', { ascending: true, nullsFirst: false })
    .limit(limit)
    .returns<BillingEscalationInvoiceRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nowIso = getISTTimestamp();
  const rows = (data ?? [])
    .map((invoice) => {
      const metadata = isRecord(invoice.metadata) ? invoice.metadata : {};
      const reference = invoice.issued_at ?? invoice.created_at;
      const daysSinceIssued = getDaysSince(reference);
      const escalationState = getEscalationState(metadata);
      const reminders = Array.isArray(metadata.reminders) ? metadata.reminders : [];
      const lastReminder = reminders.length > 0 ? reminders[reminders.length - 1] : null;
      const lastReminderAt =
        isRecord(lastReminder) && typeof lastReminder.sent_at === 'string' ? lastReminder.sent_at : null;

      const needsEscalation = daysSinceIssued >= 30;
      const snoozed = Boolean(
        escalationState.snoozeUntil && Date.parse(escalationState.snoozeUntil) > Date.parse(nowIso),
      );

      return {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        user_id: invoice.user_id,
        total_inr: Number(invoice.total_inr ?? 0),
        issued_at: invoice.issued_at,
        days_since_issued: daysSinceIssued,
        escalated: escalationState.active,
        snoozed,
        snooze_until: escalationState.snoozeUntil,
        resolved_at: escalationState.resolvedAt,
        escalated_at: escalationState.escalatedAt,
        reason: escalationState.reason,
        needs_escalation: needsEscalation,
        last_reminder_at: lastReminderAt,
      };
    })
    .filter((row) => {
      if (state === 'all') {
        return row.escalated || row.needs_escalation || Boolean(row.resolved_at);
      }
      if (state === 'resolved') {
        return Boolean(row.resolved_at) && !row.escalated;
      }
      if (state === 'candidates') {
        return row.needs_escalation;
      }
      return row.escalated || row.needs_escalation;
    });

  const summary = {
    total: rows.length,
    active: rows.filter((row) => row.escalated).length,
    candidates: rows.filter((row) => row.needs_escalation).length,
    snoozed: rows.filter((row) => row.snoozed).length,
    resolved: rows.filter((row) => Boolean(row.resolved_at) && !row.escalated).length,
  };

  return NextResponse.json({
    generated_at: nowIso,
    state,
    summary,
    queue: rows,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => null);

  const MAX_BULK_ESCALATION_SIZE = 100;

  const invoiceIds = Array.isArray(body?.invoiceIds)
    ? body.invoiceIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  const action = body?.action as EscalationAction;
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '';

  const allowedActions: EscalationAction[] = ['escalate', 'resolve', 'snooze_48h', 'clear'];

  if (invoiceIds.length === 0) {
    return NextResponse.json({ error: 'invoiceIds is required.' }, { status: 400 });
  }

  if (invoiceIds.length > MAX_BULK_ESCALATION_SIZE) {
    return NextResponse.json(
      { error: `Bulk escalation action is limited to ${MAX_BULK_ESCALATION_SIZE} invoices per request.` },
      { status: 400 },
    );
  }

  if (!allowedActions.includes(action)) {
    return NextResponse.json({ error: 'Unsupported escalation action.' }, { status: 400 });
  }

  const { data: invoices, error: fetchError } = await supabase
    .from('billing_invoices')
    .select('id, metadata')
    .in('id', invoiceIds)
    .returns<Array<{ id: string; metadata: Record<string, unknown> | null }>>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const nowIso = getISTTimestamp();
  let updated = 0;

  for (const invoice of invoices ?? []) {
    const metadata = isRecord(invoice.metadata) ? invoice.metadata : {};
    const history = Array.isArray(metadata.escalation_history) ? metadata.escalation_history : [];
    const existingEscalation = isRecord(metadata.escalation) ? metadata.escalation : {};

    let nextEscalation: Record<string, unknown>;

    if (action === 'escalate') {
      nextEscalation = {
        ...existingEscalation,
        active: true,
        level: 'collections',
        reason: note || '30+ day collections escalation',
        escalated_at: nowIso,
        escalated_by: user.id,
        resolved_at: null,
        resolved_by: null,
      };
    } else if (action === 'resolve') {
      nextEscalation = {
        ...existingEscalation,
        active: false,
        resolution_note: note || 'Escalation resolved by admin',
        resolved_at: nowIso,
        resolved_by: user.id,
        snooze_until: null,
      };
    } else if (action === 'snooze_48h') {
      const snoozeUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      nextEscalation = {
        ...existingEscalation,
        active: true,
        snooze_until: snoozeUntil,
        snoozed_at: nowIso,
        snoozed_by: user.id,
        snooze_note: note || 'Snoozed for 48 hours',
      };
    } else {
      nextEscalation = {
        ...existingEscalation,
        active: false,
        reason: null,
        resolved_at: nowIso,
        resolved_by: user.id,
        snooze_until: null,
      };
    }

    history.push({
      action,
      at: nowIso,
      by: user.id,
      note: note || null,
      source: 'admin_billing_escalation_panel',
    });

    const { error: updateError } = await supabase
      .from('billing_invoices')
      .update({
        metadata: {
          ...metadata,
          escalation: nextEscalation,
          escalation_history: history,
        } as Json,
      })
      .eq('id', invoice.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    updated += 1;
  }

  return NextResponse.json({
    success: true,
    action,
    updated,
    note: note || null,
  });
}
