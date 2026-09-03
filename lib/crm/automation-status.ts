import type { SupabaseClient } from '@supabase/supabase-js';
import { isMetaSheetImportConfigured } from '@/lib/crm/sources/meta-sheet';
import { sendCrmOpsAlert } from '@/lib/crm/ops-alert';

// ── CRM automation observability (heartbeats + health) ─────────────────────────
//
// The 2026-09-03 incident: every cron run was 401-rejected by the middleware
// BEFORE the CRM route handlers could run, so no import-run rows were written
// and no failure alerts fired — the automation was dead for days with zero
// signal inside the CRM. This module fixes the visibility gap:
//
//   1. Cron runners report a heartbeat after EVERY attempt to the public
//      /api/crm/automation/heartbeat endpoint (outside the middleware's
//      protected-route list), so out-of-band failures still land in the DB.
//   2. recordCrmAutomationHeartbeat raises a Discord alert when a job fails
//      N consecutive times (and once more when it recovers).
//   3. getCrmAutomationStatus derives a health snapshot (staleness vs the
//      expected cron cadence, consecutive failures, config checks) for the
//      admin "Automation health" panel.
//
// Heartbeats are observability only — a heartbeat write failure must never
// take down the main import/sweep run.

export const CRM_AUTOMATION_JOBS = ['meta_sheet_import', 'abandoned_bookings_sweep'] as const;
export type CrmAutomationJob = (typeof CRM_AUTOMATION_JOBS)[number];

export const CRM_AUTOMATION_JOB_LABELS: Record<CrmAutomationJob, string> = {
  meta_sheet_import: 'Meta sheet import',
  abandoned_bookings_sweep: 'Abandoned-booking sweep',
};

export type CrmAutomationHeartbeatRow = {
  id: string;
  job: CrmAutomationJob;
  ok: boolean;
  http_status: number | null;
  error_message: string | null;
  duration_ms: number | null;
  summary: Record<string, unknown>;
  created_at: string;
};

export type CrmAutomationHealthStatus = 'healthy' | 'stale' | 'failing' | 'not_reporting' | 'misconfigured';
export type CrmAutomationSeverity = 'ok' | 'warn' | 'critical';

export type CrmAutomationJobHealth = {
  job: CrmAutomationJob;
  status: CrmAutomationHealthStatus;
  severity: CrmAutomationSeverity;
  detail: string;
  lastHeartbeatAt: string | null;
  minutesSinceLastHeartbeat: number | null;
  lastHeartbeatOk: boolean | null;
  lastHeartbeatHttpStatus: number | null;
  lastHeartbeatError: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  recentHeartbeats: CrmAutomationHeartbeatRow[];
};

export type CrmAutomationConfigCheck = {
  key: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export type CrmAutomationStatus = {
  overall: {
    status: CrmAutomationHealthStatus;
    severity: CrmAutomationSeverity;
    detail: string;
  };
  expectedCadenceMinutes: number;
  staleAfterMinutes: number;
  criticalAfterMinutes: number;
  generatedAt: string;
  config: CrmAutomationConfigCheck[];
  jobs: CrmAutomationJobHealth[];
};

const HEARTBEAT_FETCH_LIMIT = 10;
const RECENT_HEARTBEATS_IN_SNAPSHOT = 5;

// ── Pure derivation (unit-tested) ──────────────────────────────────────────────

/** Counts consecutive failures from the newest heartbeat backwards. */
export function countConsecutiveFailures(heartbeats: ReadonlyArray<{ ok: boolean }>): number {
  let count = 0;
  for (const heartbeat of heartbeats) {
    if (!heartbeat.ok) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

export function deriveCrmAutomationJobHealth(input: {
  job: CrmAutomationJob;
  /** Newest-first heartbeat rows for this job. */
  heartbeats: CrmAutomationHeartbeatRow[];
  misconfigured?: boolean;
  cadenceMinutes: number;
  now?: Date;
}): CrmAutomationJobHealth {
  const { job, heartbeats, misconfigured = false, cadenceMinutes, now = new Date() } = input;
  const recent = heartbeats.slice(0, HEARTBEAT_FETCH_LIMIT);
  const last = recent[0] ?? null;
  const consecutiveFailures = countConsecutiveFailures(recent);

  const minutesSinceLastHeartbeat = last
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(last.created_at)) / 60_000))
    : null;

  const staleAfter = staleAfterMinutes(cadenceMinutes);
  const criticalAfter = criticalAfterMinutes(cadenceMinutes);
  const lastSuccess = recent.find((heartbeat) => heartbeat.ok) ?? null;

  let status: CrmAutomationHealthStatus;
  let severity: CrmAutomationSeverity;
  let detail: string;

  if (misconfigured) {
    status = 'misconfigured';
    severity = 'critical';
    detail = 'Required configuration is missing on this environment — the cron cannot run correctly.';
  } else if (!last) {
    status = 'not_reporting';
    severity = 'critical';
    detail = 'No heartbeat recorded yet — the cron has never reported. Check that the Render cron service exists and is active.';
  } else if (minutesSinceLastHeartbeat !== null && minutesSinceLastHeartbeat > criticalAfter) {
    status = 'stale';
    severity = 'critical';
    detail = `Last report ${minutesSinceLastHeartbeat} min ago (expected every ${cadenceMinutes} min) — the cron looks stopped.`;
  } else if (minutesSinceLastHeartbeat !== null && minutesSinceLastHeartbeat > staleAfter) {
    status = 'stale';
    severity = 'warn';
    detail = `Last report ${minutesSinceLastHeartbeat} min ago (expected every ${cadenceMinutes} min).`;
  } else if (!last.ok) {
    status = 'failing';
    severity = 'critical';
    const httpNote = last.http_status ? ` (HTTP ${last.http_status})` : '';
    const errorNote = last.error_message ? `: ${last.error_message}` : '';
    detail = `Last run failed${httpNote}${errorNote}${consecutiveFailures > 1 ? ` — ${consecutiveFailures} consecutive failures` : ''}`;
  } else {
    status = 'healthy';
    severity = 'ok';
    const seconds = last.duration_ms != null ? ` in ${(last.duration_ms / 1000).toFixed(1)}s` : '';
    const conflictNote = last.http_status === 409 ? ' (another run held the lock)' : '';
    detail = `Last run succeeded${seconds}${conflictNote}.`;
  }

  return {
    job,
    status,
    severity,
    detail,
    lastHeartbeatAt: last?.created_at ?? null,
    minutesSinceLastHeartbeat,
    lastHeartbeatOk: last ? last.ok : null,
    lastHeartbeatHttpStatus: last?.http_status ?? null,
    lastHeartbeatError: last?.error_message ?? null,
    lastSuccessAt: lastSuccess?.created_at ?? null,
    consecutiveFailures,
    recentHeartbeats: recent.slice(0, RECENT_HEARTBEATS_IN_SNAPSHOT),
  };
}

/**
 * Decides whether a heartbeat should raise a Discord alert.
 * - failure_threshold: raised ONCE when consecutive failures reach the
 *   threshold (a confirmed outage, not a one-off blip).
 * - recovered: raised when the job succeeds again after a confirmed outage.
 */
export function resolveHeartbeatAlert(input: {
  job: CrmAutomationJob;
  ok: boolean;
  /** Consecutive failures among the heartbeats BEFORE this one (newest-first). */
  priorConsecutiveFailures: number;
  threshold: number;
}): { type: 'failure_threshold' | 'recovered'; title: string; message: string; level: 'error' | 'warning' } | null {
  const { job, ok, priorConsecutiveFailures, threshold } = input;
  const label = CRM_AUTOMATION_JOB_LABELS[job];

  if (!ok && priorConsecutiveFailures + 1 === threshold) {
    return {
      type: 'failure_threshold',
      level: 'error',
      title: `CRM automation failing: ${label}`,
      message: `${threshold} consecutive failures — the cron runs but the job keeps failing. Check the CRM "Automation health" panel and the Render cron logs.`,
    };
  }

  if (ok && priorConsecutiveFailures >= threshold) {
    return {
      type: 'recovered',
      level: 'warning',
      title: `CRM automation recovered: ${label}`,
      message: `The job succeeded again after ${priorConsecutiveFailures} consecutive failures.`,
    };
  }

  return null;
}

// ── Tunables (safe defaults; no environment changes required) ──────────────────

/** How often each cron is expected to run (minutes). Matches the every-5-minutes Render cron schedule. */
export function resolveExpectedCadenceMinutes(): number {
  const raw = Number(process.env.CRM_AUTOMATION_EXPECTED_CADENCE_MINUTES);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 60) {
    return Math.floor(raw);
  }
  return 5;
}

/** Consecutive failed heartbeats before a Discord alert is raised (default 3). */
export function resolveAlertFailThreshold(): number {
  const raw = Number(process.env.CRM_AUTOMATION_ALERT_FAIL_THRESHOLD);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 20) {
    return Math.floor(raw);
  }
  return 3;
}

/** A job is "stale" (warning) after 2× cadence + 5 min of silence. */
export function staleAfterMinutes(cadenceMinutes: number): number {
  return cadenceMinutes * 2 + 5;
}

/** A job is critically stale after 6× cadence of silence (cron looks stopped). */
export function criticalAfterMinutes(cadenceMinutes: number): number {
  return cadenceMinutes * 6;
}

// ── Heartbeat recording (called by the public heartbeat route) ────────────────

export async function recordCrmAutomationHeartbeat(
  supabase: SupabaseClient,
  input: {
    job: CrmAutomationJob;
    ok: boolean;
    httpStatus?: number | null;
    errorMessage?: string | null;
    durationMs?: number | null;
    summary?: Record<string, unknown>;
  },
): Promise<{ recorded: boolean; alert: 'failure_threshold' | 'recovered' | null }> {
  // Read the recent history FIRST so alert decisions compare against the rows
  // that existed before this heartbeat.
  const { data: priorRows, error: fetchError } = await supabase
    .from('crm_automation_heartbeats')
    .select('id, job, ok, http_status, error_message, duration_ms, summary, created_at')
    .eq('job', input.job)
    .order('created_at', { ascending: false })
    .limit(HEARTBEAT_FETCH_LIMIT);

  const priorConsecutiveFailures = fetchError
    ? 0
    : countConsecutiveFailures((priorRows ?? []) as CrmAutomationHeartbeatRow[]);

  const { error: insertError } = await supabase.from('crm_automation_heartbeats').insert({
    job: input.job,
    ok: input.ok,
    http_status: input.httpStatus ?? null,
    error_message: input.errorMessage?.slice(0, 500) ?? null,
    duration_ms: input.durationMs ?? null,
    summary: input.summary ?? {},
  });

  if (insertError) {
    console.error('[crm-automation] Failed to record heartbeat:', insertError.message);
    return { recorded: false, alert: null };
  }

  const alert = resolveHeartbeatAlert({
    job: input.job,
    ok: input.ok,
    priorConsecutiveFailures,
    threshold: resolveAlertFailThreshold(),
  });

  if (alert) {
    // Alerting must never take the heartbeat path down with it.
    await sendCrmOpsAlert({ level: alert.level, title: alert.title, message: alert.message }).catch(() => undefined);
  }

  return { recorded: true, alert: alert?.type ?? null };
}

// ── Health snapshot (called by the admin status route) ─────────────────────────

function resolveDiscordAlertConfig(): CrmAutomationConfigCheck {
  if ((process.env.DISCORD_CRM_ALERTS_ENABLED ?? 'true').trim().toLowerCase() === 'false') {
    return { key: 'discord_alerts', label: 'Discord alerts', ok: false, hint: 'disabled by env' };
  }

  const crmWebhook = (process.env.DISCORD_CRM_WEBHOOK_URL ?? '').trim();
  if (crmWebhook) {
    return { key: 'discord_alerts', label: 'Discord alerts', ok: true };
  }

  const bookingWebhook = (process.env.DISCORD_BOOKING_WEBHOOK_URL ?? '').trim();
  if (bookingWebhook) {
    return { key: 'discord_alerts', label: 'Discord alerts', ok: true, hint: 'falls back to the booking channel' };
  }

  return { key: 'discord_alerts', label: 'Discord alerts', ok: false, hint: 'no webhook configured' };
}

export async function getCrmAutomationStatus(
  supabase: SupabaseClient,
  options: { now?: Date } = {},
): Promise<CrmAutomationStatus> {
  const now = options.now ?? new Date();
  const cadenceMinutes = resolveExpectedCadenceMinutes();

  const [heartbeatsResult, importRunsResult] = await Promise.all([
    supabase
      .from('crm_automation_heartbeats')
      .select('id, job, ok, http_status, error_message, duration_ms, summary, created_at')
      .in('job', [...CRM_AUTOMATION_JOBS])
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('crm_sheet_import_runs')
      .select('id, status, dry_run, rows_imported, rows_skipped, rows_invalid, error_message, created_at')
      .eq('trigger_source', 'cron')
      .eq('dry_run', false)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const heartbeatTableOk = !heartbeatsResult.error;
  if (heartbeatsResult.error) {
    console.error('[crm-automation] Unable to load heartbeats:', heartbeatsResult.error.message);
  }
  if (importRunsResult.error) {
    // Import-run history is supplementary (heartbeats carry the cron signal);
    // degrade silently rather than failing the status endpoint.
    console.warn('[crm-automation] Unable to load cron import runs:', importRunsResult.error.message);
  }

  const heartbeatRows = ((heartbeatsResult.data ?? []) as CrmAutomationHeartbeatRow[]).filter(
    (row) => (CRM_AUTOMATION_JOBS as readonly string[]).includes(row.job),
  );

  const sheetConfigured = isMetaSheetImportConfigured();
  const automationSecretSet = Boolean((process.env.CRM_SHEET_IMPORT_SECRET ?? '').trim());

  const jobs = CRM_AUTOMATION_JOBS.map((job) =>
    deriveCrmAutomationJobHealth({
      job,
      heartbeats: heartbeatRows.filter((row) => row.job === job),
      misconfigured: job === 'meta_sheet_import' ? !sheetConfigured || !automationSecretSet : !automationSecretSet,
      cadenceMinutes,
      now,
    }),
  );

  // Enrich the import job with the last cron-triggered server-side run (the
  // authoritative import history, which also covers admin-panel runs).
  const lastCronImportRun = (importRunsResult.data ?? [])[0] ?? null;
  if (lastCronImportRun && jobs[0]?.status === 'healthy') {
    jobs[0] = {
      ...jobs[0],
      detail: `${jobs[0].detail} Last server-side import: ${
        lastCronImportRun.status === 'success'
          ? `${lastCronImportRun.rows_imported} imported, ${lastCronImportRun.rows_skipped} skipped`
          : `failed — ${lastCronImportRun.error_message ?? 'unknown error'}`
      }.`,
    };
  }

  const severityRank: Record<CrmAutomationSeverity, number> = { ok: 0, warn: 1, critical: 2 };
  const worstJob = jobs.reduce(
    (worst, job) => (severityRank[job.severity] > severityRank[worst.severity] ? job : worst),
    jobs[0],
  );

  const overall = {
    status: worstJob?.status ?? 'not_reporting',
    severity: worstJob?.severity ?? 'critical',
    detail: jobs.every((job) => job.severity === 'ok')
      ? 'Both cron jobs are reporting and succeeding.'
      : (worstJob?.detail ?? 'No automation health data available.'),
  };

  const config: CrmAutomationConfigCheck[] = [
    {
      key: 'heartbeat_table',
      label: 'Heartbeat table',
      ok: heartbeatTableOk,
      hint: heartbeatTableOk ? undefined : 'apply migration 100',
    },
    { key: 'google_sheets', label: 'Google Sheets credentials', ok: sheetConfigured },
    { key: 'automation_secret', label: 'Automation secret', ok: automationSecretSet },
    resolveDiscordAlertConfig(),
  ];

  return {
    overall,
    expectedCadenceMinutes: cadenceMinutes,
    staleAfterMinutes: staleAfterMinutes(cadenceMinutes),
    criticalAfterMinutes: criticalAfterMinutes(cadenceMinutes),
    generatedAt: now.toISOString(),
    config,
    jobs,
  };
}
