import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';
import {
  ALLOWED_BUCKETS,
  ALLOWED_CHANNELS,
  runBillingReminderAutomation,
  type ReminderChannel,
  type RunBucket,
} from '../_automation';

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => null);

  const bucketCandidate = body?.bucket;
  const channelCandidate = body?.channel;
  const enforceCadence = body?.enforceCadence !== false;
  const enforceCooldown = body?.enforceCooldown !== false;
  const dryRun = body?.dryRun === true;

  if (!ALLOWED_BUCKETS.includes(bucketCandidate as RunBucket)) {
    return NextResponse.json({ error: 'bucket must be one of: due_soon, overdue_7, overdue_14, overdue_30, all.' }, { status: 400 });
  }

  if (!ALLOWED_CHANNELS.includes(channelCandidate as ReminderChannel)) {
    return NextResponse.json({ error: 'channel must be one of: email, whatsapp.' }, { status: 400 });
  }

  const bucket = bucketCandidate as RunBucket;
  const channel = channelCandidate as ReminderChannel;
  const startedAt = getISTTimestamp();

  try {
    const result = await runBillingReminderAutomation({
      supabase,
      actorId: user.id,
      source: 'admin_billing_auto_run',
      bucket,
      channel,
      enforceCadence,
      enforceCooldown,
      dryRun,
    });

    await supabase.from('billing_automation_runs').insert({
      trigger_source: 'admin_panel',
      status: 'success',
      run_scope: 'manual',
      bucket,
      channel,
      dry_run: dryRun,
      enforce_cadence: enforceCadence,
      enforce_cooldown: enforceCooldown,
      scanned: result.scanned,
      sent: result.sent,
      skipped_cadence: result.skippedCadence,
      skipped_cooldown: result.skippedCooldown,
      escalated: result.escalated,
      started_at: startedAt,
      finished_at: getISTTimestamp(),
      metadata: {
        source: 'admin_billing_auto_run',
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown admin panel automation error';
    const status = message.toLowerCase().includes('already running') ? 409 : 500;

    await supabase.from('billing_automation_runs').insert({
      trigger_source: 'admin_panel',
      status: 'failed',
      run_scope: 'manual',
      bucket,
      channel,
      dry_run: dryRun,
      enforce_cadence: enforceCadence,
      enforce_cooldown: enforceCooldown,
      error_message: message,
      started_at: startedAt,
      finished_at: getISTTimestamp(),
      metadata: {
        source: 'admin_billing_auto_run',
      },
    });

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
