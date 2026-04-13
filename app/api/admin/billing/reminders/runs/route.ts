import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type BillingAutomationRunRow = {
  id: string;
  trigger_source: 'admin_panel' | 'scheduler';
  status: 'success' | 'failed';
  run_scope: 'manual' | 'scheduled';
  bucket: string;
  channel: string;
  dry_run: boolean;
  enforce_cadence: boolean;
  enforce_cooldown: boolean;
  scanned: number;
  sent: number;
  skipped_cadence: number;
  skipped_cooldown: number;
  escalated: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 20), 1), 100);

  const { data, error } = await supabase
    .from('billing_automation_runs')
    .select(
      'id, trigger_source, status, run_scope, bucket, channel, dry_run, enforce_cadence, enforce_cooldown, scanned, sent, skipped_cadence, skipped_cooldown, escalated, error_message, started_at, finished_at, created_at',
    )
    .order('finished_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<BillingAutomationRunRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    generated_at: getISTTimestamp(),
    limit,
    runs: data ?? [],
  });
}
