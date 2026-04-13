import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type BillingInvoiceReminderRow = {
  id: string;
  invoice_number: string;
  user_id: string;
  status: string;
  total_inr: number;
  created_at: string;
  issued_at: string | null;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
};

type ReminderTemplate = 'due_soon' | 'overdue_7' | 'overdue_14';
type ReminderChannel = 'email' | 'whatsapp';

const TEMPLATE_MIN_DAYS: Record<ReminderTemplate, number> = {
  due_soon: 3,
  overdue_7: 7,
  overdue_14: 14,
};

const REMINDER_COOLDOWN_HOURS = 24;

function getDaysSince(referenceIso: string) {
  const diffMs = Date.now() - new Date(referenceIso).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 200), 20), 500);

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, user_id, status, total_inr, created_at, issued_at, paid_at, metadata')
    .eq('status', 'issued')
    .order('issued_at', { ascending: true, nullsFirst: false })
    .limit(limit)
    .returns<BillingInvoiceReminderRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = (data ?? []).map((invoice) => {
    const reference = invoice.issued_at ?? invoice.created_at;
    const daysSinceIssued = getDaysSince(reference);
    const bucket: 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'current' =
      daysSinceIssued >= 30
        ? 'overdue_30'
        : daysSinceIssued >= 14
        ? 'overdue_14'
        : daysSinceIssued >= 7
        ? 'overdue_7'
        : daysSinceIssued >= 3
        ? 'due_soon'
        : 'current';

    const metadata = isRecord(invoice.metadata) ? invoice.metadata : {};
    const reminders = Array.isArray(metadata.reminders) ? metadata.reminders : [];
    const lastReminder = reminders.length > 0 ? reminders[reminders.length - 1] : null;
    const escalation = isRecord(metadata.escalation) ? metadata.escalation : null;
    const escalated = Boolean(escalation?.active === true);

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      user_id: invoice.user_id,
      total_inr: Number(invoice.total_inr ?? 0),
      issued_at: invoice.issued_at,
      days_since_issued: daysSinceIssued,
      bucket,
      last_reminder: lastReminder,
      escalated,
    };
  });

  const summary = {
    total: queue.length,
    due_soon: queue.filter((row) => row.bucket === 'due_soon').length,
    overdue_7: queue.filter((row) => row.bucket === 'overdue_7').length,
    overdue_14: queue.filter((row) => row.bucket === 'overdue_14').length,
    overdue_30: queue.filter((row) => row.bucket === 'overdue_30').length,
    escalated: queue.filter((row) => row.escalated).length,
  };

  return NextResponse.json({
    generated_at: getISTTimestamp(),
    summary,
    queue,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => null);

  const invoiceIds = Array.isArray(body?.invoiceIds)
    ? body.invoiceIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  const templateCandidate = body?.template;
  const channelCandidate = body?.channel;
  const enforceCadence = body?.enforceCadence !== false;

  const allowedTemplates: ReminderTemplate[] = ['due_soon', 'overdue_7', 'overdue_14'];
  const allowedChannels: ReminderChannel[] = ['email', 'whatsapp'];

  if (invoiceIds.length === 0) {
    return NextResponse.json({ error: 'invoiceIds is required.' }, { status: 400 });
  }

  if (!allowedTemplates.includes(templateCandidate as ReminderTemplate)) {
    return NextResponse.json({ error: 'template must be one of: due_soon, overdue_7, overdue_14.' }, { status: 400 });
  }

  if (!allowedChannels.includes(channelCandidate as ReminderChannel)) {
    return NextResponse.json({ error: 'channel must be one of: email, whatsapp.' }, { status: 400 });
  }

  const template = templateCandidate as ReminderTemplate;
  const channel = channelCandidate as ReminderChannel;

  const { data: invoices, error: fetchError } = await supabase
    .from('billing_invoices')
    .select('id, created_at, issued_at, metadata')
    .in('id', invoiceIds)
    .returns<Array<{ id: string; created_at: string; issued_at: string | null; metadata: Record<string, unknown> | null }>>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const nowIso = getISTTimestamp();
  const nowMs = Date.now();
  let sent = 0;
  const skipped: Array<{ invoice_id: string; reason: 'cadence' | 'cooldown' }> = [];

  for (const invoice of invoices ?? []) {
    const referenceIso = invoice.issued_at ?? invoice.created_at;
    const daysSinceIssued = getDaysSince(referenceIso);
    const minDays = TEMPLATE_MIN_DAYS[template];

    if (enforceCadence && daysSinceIssued < minDays) {
      skipped.push({ invoice_id: invoice.id, reason: 'cadence' });
      continue;
    }

    const metadata = isRecord(invoice.metadata) ? invoice.metadata : {};
    const reminders = Array.isArray(metadata.reminders) ? metadata.reminders : [];
    const lastReminder = reminders.length > 0 ? reminders[reminders.length - 1] : null;
    const lastReminderAt =
      isRecord(lastReminder) && typeof lastReminder.sent_at === 'string' ? Date.parse(lastReminder.sent_at) : Number.NaN;

    if (Number.isFinite(lastReminderAt)) {
      const elapsedHours = (nowMs - lastReminderAt) / (60 * 60 * 1000);
      if (elapsedHours < REMINDER_COOLDOWN_HOURS) {
        skipped.push({ invoice_id: invoice.id, reason: 'cooldown' });
        continue;
      }
    }

    reminders.push({
      template,
      channel,
      sent_at: nowIso,
      sent_by: user.id,
      source: 'admin_billing_reminder_panel',
    });

    const { error: updateError } = await supabase
      .from('billing_invoices')
      .update({ metadata: { ...metadata, reminders } })
      .eq('id', invoice.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    sent += 1;
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    template,
    channel,
    enforceCadence,
  });
}
