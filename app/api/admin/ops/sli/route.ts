import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getISTTimestamp } from '@/lib/utils/date';

type RateLimitWindowRow = {
  key: string;
  request_count: number;
  updated_at: string;
};

type AutomationRunRow = {
  status: 'success' | 'failed';
  finished_at: string | null;
  created_at: string;
};

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function routeGroupFromRateLimitKey(key: string) {
  const firstToken = (key.split(':')[0] ?? '').trim().toLowerCase();

  if (firstToken === 'bookings') return 'bookings';
  if (firstToken === 'payments') return 'payments';
  if (firstToken === 'admin') return 'admin';
  if (firstToken === 'auth') return 'auth';
  if (firstToken === 'provider') return 'provider';

  return 'other';
}

function calculateConsecutiveFailures(runs: AutomationRunRow[]) {
  let consecutive = 0;
  for (const run of runs) {
    if (run.status === 'failed') {
      consecutive += 1;
      continue;
    }
    break;
  }
  return consecutive;
}

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth.context;

  const nowIso = getISTTimestamp();
  const since5m = minutesAgoIso(5);
  const since15m = minutesAgoIso(15);
  const since60m = minutesAgoIso(60);

  const [rateLimitWindowResult, bookingsCreatedResult, webhookTotalResult, webhookFailedResult, automationFailureCountResult, automationRecentRunsResult] =
    await Promise.all([
      supabase
        .from('api_rate_limit_windows')
        .select('key, request_count, updated_at')
        .gte('updated_at', since5m)
        .order('updated_at', { ascending: false })
        .limit(5000)
        .returns<RateLimitWindowRow[]>(),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since15m),
      supabase
        .from('payment_webhook_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since15m),
      supabase
        .from('payment_webhook_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since15m)
        .eq('processed', false)
        .not('processing_error', 'is', null),
      supabase
        .from('billing_automation_runs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since60m)
        .eq('status', 'failed'),
      supabase
        .from('billing_automation_runs')
        .select('status, finished_at, created_at')
        .order('finished_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20)
        .returns<AutomationRunRow[]>(),
    ]);

  const errors: string[] = [];

  if (rateLimitWindowResult.error) errors.push(`api_rate_limit_windows: ${rateLimitWindowResult.error.message}`);
  if (bookingsCreatedResult.error) errors.push(`bookings: ${bookingsCreatedResult.error.message}`);
  if (webhookTotalResult.error) errors.push(`payment_webhook_events.total: ${webhookTotalResult.error.message}`);
  if (webhookFailedResult.error) errors.push(`payment_webhook_events.failed: ${webhookFailedResult.error.message}`);
  if (automationFailureCountResult.error) {
    errors.push(`billing_automation_runs.failed_count: ${automationFailureCountResult.error.message}`);
  }
  if (automationRecentRunsResult.error) errors.push(`billing_automation_runs.recent: ${automationRecentRunsResult.error.message}`);

  const rateRows = rateLimitWindowResult.data ?? [];
  const requestsByGroup: Record<string, number> = {
    bookings: 0,
    payments: 0,
    admin: 0,
    auth: 0,
    provider: 0,
    other: 0,
  };

  let totalRateLimitedWindowRequests5m = 0;
  let hotKeyCount = 0;

  for (const row of rateRows) {
    const count = Number(row.request_count ?? 0);
    totalRateLimitedWindowRequests5m += count;

    if (count >= 50) {
      hotKeyCount += 1;
    }

    const group = routeGroupFromRateLimitKey(row.key);
    requestsByGroup[group] = (requestsByGroup[group] ?? 0) + count;
  }

  const webhookTotal15m = webhookTotalResult.count ?? 0;
  const webhookFailed15m = webhookFailedResult.count ?? 0;
  const webhookFailureRatio15m = webhookTotal15m > 0 ? webhookFailed15m / webhookTotal15m : 0;

  const automationConsecutiveFailures = calculateConsecutiveFailures(automationRecentRunsResult.data ?? []);

  const warningThresholds = {
    rateLimitHotKeys5m: 1,
    webhookFailed15m: 10,
    automationConsecutiveFailures: 3,
  };

  const alerts = {
    rate_limit_spike_risk: hotKeyCount >= warningThresholds.rateLimitHotKeys5m,
    webhook_failure_risk: webhookFailed15m >= warningThresholds.webhookFailed15m,
    automation_failure_risk: automationConsecutiveFailures >= warningThresholds.automationConsecutiveFailures,
  };

  return NextResponse.json(
    {
      healthy: errors.length === 0,
      generated_at: nowIso,
      windows: {
        rate_limit: '5m',
        bookings: '15m',
        webhooks: '15m',
        automation: '60m',
      },
      route_groups: {
        configured: ['bookings', 'payments', 'admin'],
        rate_limited_requests_5m: requestsByGroup,
      },
      rate_limit: {
        total_window_requests_5m: totalRateLimitedWindowRequests5m,
        hot_key_count_5m: hotKeyCount,
        threshold_hot_key_request_count: 50,
      },
      bookings: {
        created_count_15m: bookingsCreatedResult.count ?? 0,
        note: 'HTTP booking failure rate requires telemetry pipeline (not derivable from DB writes alone).',
      },
      webhooks: {
        total_events_15m: webhookTotal15m,
        unprocessed_failed_15m: webhookFailed15m,
        failure_ratio_15m: webhookFailureRatio15m,
      },
      automation: {
        failed_runs_60m: automationFailureCountResult.count ?? 0,
        consecutive_failures: automationConsecutiveFailures,
      },
      latency_slo: {
        available: false,
        reason: 'p95 and error-budget burn require HTTP duration/error metrics from telemetry platform.',
      },
      alert_risk_flags: alerts,
      thresholds: warningThresholds,
      errors,
    },
    { status: 200 },
  );
}
