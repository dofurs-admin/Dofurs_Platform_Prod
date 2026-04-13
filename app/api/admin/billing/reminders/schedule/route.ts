import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';
import {
  ALLOWED_BUCKETS,
  ALLOWED_CHANNELS,
  runBillingReminderAutomation,
  type ReminderChannel,
  type RunBucket,
} from '../_automation';

function safeTokenEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractToken(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const tokenHeader = request.headers.get('x-billing-automation-token');
  if (typeof tokenHeader === 'string' && tokenHeader.trim().length > 0) {
    return tokenHeader.trim();
  }

  return '';
}

async function maybeSendSchedulerFailureAlert(input: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  bucket: RunBucket;
  channel: ReminderChannel;
  dryRun: boolean;
  errorMessage: string;
}) {
  const webhookUrl = process.env.BILLING_AUTOMATION_ALERT_WEBHOOK_URL?.trim() ?? '';
  if (!webhookUrl) {
    return;
  }

  const threshold = Math.max(1, Number(process.env.BILLING_AUTOMATION_ALERT_FAIL_THRESHOLD ?? '3'));
  const { data: rows } = await input.supabase
    .from('billing_automation_runs')
    .select('status')
    .order('finished_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);

  let consecutiveFailures = 0;
  for (const row of rows ?? []) {
    if (row.status === 'failed') {
      consecutiveFailures += 1;
      continue;
    }
    break;
  }

  if (consecutiveFailures < threshold) {
    return;
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'billing_automation.scheduler.failure_threshold_reached',
      severity: 'warning',
      consecutive_failures: consecutiveFailures,
      threshold,
      bucket: input.bucket,
      channel: input.channel,
      dry_run: input.dryRun,
      error_message: input.errorMessage,
      at: getISTTimestamp(),
    }),
  }).catch(() => undefined);
}

export async function GET() {
  const secret = process.env.BILLING_AUTOMATION_SECRET?.trim() ?? '';
  const supabase = getSupabaseAdminClient();

  const { data: latestRun } = await supabase
    .from('billing_automation_runs')
    .select(
      'id, trigger_source, status, run_scope, bucket, channel, dry_run, enforce_cadence, enforce_cooldown, scanned, sent, skipped_cadence, skipped_cooldown, escalated, error_message, started_at, finished_at, created_at',
    )
    .order('finished_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentRunStatuses } = await supabase
    .from('billing_automation_runs')
    .select('status, finished_at, created_at')
    .order('finished_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = recentRunStatuses ?? [];
  const lastSuccessAt = rows.find((row) => row.status === 'success')?.finished_at ?? null;
  const lastFailureAt = rows.find((row) => row.status === 'failed')?.finished_at ?? null;

  let consecutiveFailures = 0;
  for (const row of rows) {
    if (row.status === 'failed') {
      consecutiveFailures += 1;
      continue;
    }
    break;
  }

  return NextResponse.json({
    enabled: secret.length > 0,
    requires_token: true,
    defaults: {
      bucket: 'all',
      channel: 'whatsapp',
      enforceCadence: true,
      enforceCooldown: true,
      dryRun: false,
    },
    supported: {
      buckets: ALLOWED_BUCKETS,
      channels: ALLOWED_CHANNELS,
    },
    last_success_at: lastSuccessAt,
    last_failure_at: lastFailureAt,
    consecutive_failures: consecutiveFailures,
    last_run: latestRun ?? null,
  });
}

export async function POST(request: Request) {
  const secret = process.env.BILLING_AUTOMATION_SECRET?.trim() ?? '';

  if (!secret) {
    return NextResponse.json(
      { error: 'Billing automation secret is not configured on the server.' },
      { status: 503 },
    );
  }

  const token = extractToken(request);
  if (!token || !safeTokenEqual(secret, token)) {
    return NextResponse.json({ error: 'Unauthorized scheduler token.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const bucketCandidate = body?.bucket ?? 'all';
  const channelCandidate = body?.channel ?? 'whatsapp';
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
  const supabase = getSupabaseAdminClient();
  const startedAt = getISTTimestamp();

  try {
    const result = await runBillingReminderAutomation({
      supabase,
      actorId: 'system_scheduler',
      source: 'billing_scheduler_cron',
      bucket,
      channel,
      enforceCadence,
      enforceCooldown,
      dryRun,
    });

    await supabase.from('billing_automation_runs').insert({
      trigger_source: 'scheduler',
      status: 'success',
      run_scope: 'scheduled',
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
        source: 'billing_scheduler_cron',
      },
    });

    return NextResponse.json({
      ...result,
      triggered_by: 'scheduler',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scheduler automation error';
    const status = message.toLowerCase().includes('already running') ? 409 : 500;

    await supabase.from('billing_automation_runs').insert({
      trigger_source: 'scheduler',
      status: 'failed',
      run_scope: 'scheduled',
      bucket,
      channel,
      dry_run: dryRun,
      enforce_cadence: enforceCadence,
      enforce_cooldown: enforceCooldown,
      error_message: message,
      started_at: startedAt,
      finished_at: getISTTimestamp(),
      metadata: {
        source: 'billing_scheduler_cron',
      },
    });

    await maybeSendSchedulerFailureAlert({
      supabase,
      bucket,
      channel,
      dryRun,
      errorMessage: message,
    });

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
