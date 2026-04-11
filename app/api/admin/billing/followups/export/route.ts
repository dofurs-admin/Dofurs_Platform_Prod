import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type FollowupInvoiceRow = {
  invoice_number: string;
  user_id: string;
  total_inr: number;
  created_at: string;
  issued_at: string | null;
  metadata: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getDaysSince(referenceIso: string) {
  const diffMs = Date.now() - new Date(referenceIso).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

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

  const bucket = (searchParams.get('bucket') ?? 'all').toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 5000), 200), 10000);

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('invoice_number, user_id, total_inr, created_at, issued_at, metadata')
    .eq('status', 'issued')
    .order('issued_at', { ascending: true, nullsFirst: false })
    .limit(limit)
    .returns<FollowupInvoiceRow[]>();

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = (data ?? [])
    .map((invoice) => {
      const reference = invoice.issued_at ?? invoice.created_at;
      const daysSinceIssued = getDaysSince(reference);
      const followupBucket: 'current' | 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' =
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
      const lastReminderAt =
        isRecord(lastReminder) && typeof lastReminder.sent_at === 'string' ? lastReminder.sent_at : null;
      const escalation = isRecord(metadata.escalation) ? metadata.escalation : null;
      const escalated = Boolean(escalation?.active === true);

      return {
        invoice_number: invoice.invoice_number,
        user_id: invoice.user_id,
        total_inr: Number(invoice.total_inr ?? 0),
        issued_at: invoice.issued_at,
        days_since_issued: daysSinceIssued,
        bucket: followupBucket,
        escalated,
        last_reminder_at: lastReminderAt,
        recommended_action:
          followupBucket === 'overdue_30'
            ? 'escalate_or_resolve'
            : followupBucket === 'overdue_14'
            ? 'send_overdue_14'
            : followupBucket === 'overdue_7'
            ? 'send_overdue_7'
            : followupBucket === 'due_soon'
            ? 'send_due_soon'
            : 'monitor',
      };
    })
    .filter((row) => {
      if (bucket === 'all') {
        return row.bucket !== 'current';
      }
      return row.bucket === bucket;
    });

  const csvRows = [
    [
      'Invoice Number',
      'User ID',
      'Total INR',
      'Issued At',
      'Days Since Issued',
      'Bucket',
      'Escalated',
      'Last Reminder At',
      'Recommended Action',
    ],
    ...rows.map((row) => [
      row.invoice_number,
      row.user_id,
      row.total_inr.toFixed(2),
      row.issued_at ? new Date(row.issued_at).toISOString() : '',
      row.days_since_issued,
      row.bucket,
      row.escalated ? 'yes' : 'no',
      row.last_reminder_at ? new Date(row.last_reminder_at).toISOString() : '',
      row.recommended_action,
    ]),
  ];

  const csv = csvRows.map((row) => row.map((value) => csvCell(value)).join(',')).join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="billing-followups-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
