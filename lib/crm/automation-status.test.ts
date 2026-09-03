import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRM_AUTOMATION_JOB_LABELS,
  countConsecutiveFailures,
  criticalAfterMinutes,
  deriveCrmAutomationJobHealth,
  getCrmAutomationStatus,
  resolveAlertFailThreshold,
  resolveExpectedCadenceMinutes,
  resolveHeartbeatAlert,
  staleAfterMinutes,
  type CrmAutomationHeartbeatRow,
} from '@/lib/crm/automation-status';

// ── Pure derivation tests ──────────────────────────────────────────────────────

function heartbeat(overrides: Partial<CrmAutomationHeartbeatRow> = {}): CrmAutomationHeartbeatRow {
  return {
    id: `hb_${Math.random().toString(36).slice(2, 8)}`,
    job: 'meta_sheet_import',
    ok: true,
    http_status: 200,
    error_message: null,
    duration_ms: 3200,
    summary: {},
    created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    ...overrides,
  };
}

describe('crm automation observability — pure derivation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CRM_AUTOMATION_EXPECTED_CADENCE_MINUTES;
    delete process.env.CRM_AUTOMATION_ALERT_FAIL_THRESHOLD;
  });

  it('counts consecutive failures from the newest heartbeat backwards', () => {
    expect(countConsecutiveFailures([{ ok: false }, { ok: false }, { ok: true }])).toBe(2);
    expect(countConsecutiveFailures([{ ok: true }, { ok: false }])).toBe(0);
    expect(countConsecutiveFailures([{ ok: false }])).toBe(1);
    expect(countConsecutiveFailures([])).toBe(0);
  });

  it('derives healthy for a fresh successful heartbeat', () => {
    const health = deriveCrmAutomationJobHealth({
      job: 'meta_sheet_import',
      heartbeats: [heartbeat()],
      cadenceMinutes: 5,
    });

    expect(health.status).toBe('healthy');
    expect(health.severity).toBe('ok');
    expect(health.minutesSinceLastHeartbeat).toBe(2);
    expect(health.detail).toContain('succeeded');
    expect(health.consecutiveFailures).toBe(0);
  });

  it('treats a 409 lock conflict as healthy', () => {
    const health = deriveCrmAutomationJobHealth({
      job: 'meta_sheet_import',
      heartbeats: [heartbeat({ ok: true, http_status: 409 })],
      cadenceMinutes: 5,
    });

    expect(health.status).toBe('healthy');
    expect(health.detail).toContain('another run held the lock');
  });

  it('derives stale (warning) past 2× cadence + 5 min of silence', () => {
    const health = deriveCrmAutomationJobHealth({
      job: 'abandoned_bookings_sweep',
      heartbeats: [heartbeat({ job: 'abandoned_bookings_sweep', created_at: new Date(Date.now() - 20 * 60_000).toISOString() })],
      cadenceMinutes: 5, // stale after 15 min
    });

    expect(health.status).toBe('stale');
    expect(health.severity).toBe('warn');
    expect(health.detail).toContain('20 min ago');
  });

  it('derives critically stale past 6× cadence of silence', () => {
    const health = deriveCrmAutomationJobHealth({
      job: 'abandoned_bookings_sweep',
      heartbeats: [heartbeat({ job: 'abandoned_bookings_sweep', created_at: new Date(Date.now() - 31 * 60_000).toISOString() })],
      cadenceMinutes: 5, // critical after 30 min
    });

    expect(health.status).toBe('stale');
    expect(health.severity).toBe('critical');
    expect(health.detail).toContain('cron looks stopped');
  });

  it('derives failing for a fresh failed heartbeat with error context', () => {
    const failing = heartbeat({ ok: false, http_status: 401, error_message: 'Unauthorized', duration_ms: null });
    const health = deriveCrmAutomationJobHealth({
      job: 'meta_sheet_import',
      heartbeats: [failing, { ...failing, id: 'hb_older' }],
      cadenceMinutes: 5,
    });

    expect(health.status).toBe('failing');
    expect(health.severity).toBe('critical');
    expect(health.detail).toContain('HTTP 401');
    expect(health.detail).toContain('2 consecutive failures');
    expect(health.consecutiveFailures).toBe(2);
    expect(health.lastSuccessAt).toBeNull();
  });

  it('derives not_reporting when no heartbeat exists', () => {
    const health = deriveCrmAutomationJobHealth({ job: 'meta_sheet_import', heartbeats: [], cadenceMinutes: 5 });

    expect(health.status).toBe('not_reporting');
    expect(health.severity).toBe('critical');
    expect(health.minutesSinceLastHeartbeat).toBeNull();
  });

  it('derives misconfigured regardless of heartbeat freshness', () => {
    const health = deriveCrmAutomationJobHealth({
      job: 'meta_sheet_import',
      heartbeats: [heartbeat()],
      misconfigured: true,
      cadenceMinutes: 5,
    });

    expect(health.status).toBe('misconfigured');
    expect(health.severity).toBe('critical');
  });

  it('derives stale thresholds and tunables from the cadence and env', () => {
    expect(staleAfterMinutes(5)).toBe(15);
    expect(criticalAfterMinutes(5)).toBe(30);

    expect(resolveExpectedCadenceMinutes()).toBe(5);
    process.env.CRM_AUTOMATION_EXPECTED_CADENCE_MINUTES = '15';
    expect(resolveExpectedCadenceMinutes()).toBe(15);
    process.env.CRM_AUTOMATION_EXPECTED_CADENCE_MINUTES = '0';
    expect(resolveExpectedCadenceMinutes()).toBe(5);
    process.env.CRM_AUTOMATION_EXPECTED_CADENCE_MINUTES = 'not-a-number';
    expect(resolveExpectedCadenceMinutes()).toBe(5);

    expect(resolveAlertFailThreshold()).toBe(3);
    process.env.CRM_AUTOMATION_ALERT_FAIL_THRESHOLD = '5';
    expect(resolveAlertFailThreshold()).toBe(5);
    process.env.CRM_AUTOMATION_ALERT_FAIL_THRESHOLD = '999';
    expect(resolveAlertFailThreshold()).toBe(3);
  });

  it('raises the failure alert exactly when the threshold is crossed', () => {
    // Below the threshold — no alert (one-off blips are noise).
    expect(resolveHeartbeatAlert({ job: 'meta_sheet_import', ok: false, priorConsecutiveFailures: 0, threshold: 3 })).toBeNull();
    expect(resolveHeartbeatAlert({ job: 'meta_sheet_import', ok: false, priorConsecutiveFailures: 1, threshold: 3 })).toBeNull();

    // Crossing the threshold — one alert.
    const crossing = resolveHeartbeatAlert({ job: 'meta_sheet_import', ok: false, priorConsecutiveFailures: 2, threshold: 3 });
    expect(crossing?.type).toBe('failure_threshold');
    expect(crossing?.level).toBe('error');
    expect(crossing?.title).toBe(`CRM automation failing: ${CRM_AUTOMATION_JOB_LABELS.meta_sheet_import}`);

    // Already past the threshold — no repeat alert.
    expect(resolveHeartbeatAlert({ job: 'meta_sheet_import', ok: false, priorConsecutiveFailures: 3, threshold: 3 })).toBeNull();
  });

  it('raises a recovery alert only after a confirmed outage heals', () => {
    expect(
      resolveHeartbeatAlert({ job: 'abandoned_bookings_sweep', ok: true, priorConsecutiveFailures: 3, threshold: 3 })?.type,
    ).toBe('recovered');
    expect(
      resolveHeartbeatAlert({ job: 'abandoned_bookings_sweep', ok: true, priorConsecutiveFailures: 5, threshold: 3 })?.type,
    ).toBe('recovered');
    // A single prior failure is not a confirmed outage — no recovery alert.
    expect(resolveHeartbeatAlert({ job: 'abandoned_bookings_sweep', ok: true, priorConsecutiveFailures: 1, threshold: 3 })).toBeNull();
    expect(resolveHeartbeatAlert({ job: 'abandoned_bookings_sweep', ok: true, priorConsecutiveFailures: 0, threshold: 3 })).toBeNull();
  });
});

// ── Snapshot tests (stubbed supabase) ──────────────────────────────────────────

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function createStatusSupabase(options: {
  heartbeatRows?: Array<Record<string, unknown>>;
  heartbeatError?: { message: string } | null;
  importRuns?: Array<Record<string, unknown>>;
}) {
  const heartbeatBuilder = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: options.heartbeatRows ?? [], error: options.heartbeatError ?? null }),
  };
  const importRunsBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: options.importRuns ?? [], error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'crm_automation_heartbeats') return heartbeatBuilder;
      if (table === 'crm_sheet_import_runs') return importRunsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as never;
}

describe('crm automation observability — status snapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CRM_SHEET_IMPORT_SECRET;
    delete process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    delete process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID;
    delete process.env.DISCORD_CRM_WEBHOOK_URL;
    delete process.env.DISCORD_BOOKING_WEBHOOK_URL;
  });

  it('builds a healthy snapshot with per-job detail and config checks', async () => {
    process.env.CRM_SHEET_IMPORT_SECRET = 'secret';
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL = 'svc@example.iam.gserviceaccount.com';
    process.env.GOOGLE_SHEETS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID = 'sheet-id';

    const supabase = createStatusSupabase({
      heartbeatRows: [
        { id: 'hb1', job: 'meta_sheet_import', ok: true, http_status: 200, error_message: null, duration_ms: 4200, summary: { imported: 2 }, created_at: minutesAgoIso(2) },
        { id: 'hb2', job: 'abandoned_bookings_sweep', ok: true, http_status: 200, error_message: null, duration_ms: 800, summary: { scanned: 4, abandonedLeads: 1 }, created_at: minutesAgoIso(3) },
      ],
      importRuns: [
        { id: 'run1', status: 'success', dry_run: false, rows_imported: 5, rows_skipped: 380, rows_invalid: 0, error_message: null, created_at: minutesAgoIso(2) },
      ],
    });

    const status = await getCrmAutomationStatus(supabase);

    expect(status.overall.severity).toBe('ok');
    expect(status.overall.status).toBe('healthy');
    expect(status.overall.detail).toBe('Both cron jobs are reporting and succeeding.');
    expect(status.expectedCadenceMinutes).toBe(5);

    const importJob = status.jobs.find((job) => job.job === 'meta_sheet_import');
    const sweepJob = status.jobs.find((job) => job.job === 'abandoned_bookings_sweep');
    expect(importJob?.status).toBe('healthy');
    expect(importJob?.detail).toContain('Last server-side import: 5 imported, 380 skipped');
    expect(sweepJob?.status).toBe('healthy');

    const configByKey = Object.fromEntries(status.config.map((check) => [check.key, check]));
    expect(configByKey.heartbeat_table.ok).toBe(true);
    expect(configByKey.google_sheets.ok).toBe(true);
    expect(configByKey.automation_secret.ok).toBe(true);
    // No webhook configured in this test environment — surfaced, not hidden.
    expect(configByKey.discord_alerts.ok).toBe(false);
    expect(configByKey.discord_alerts.hint).toBe('no webhook configured');
  });

  it('degrades to not_reporting with a config hint when the heartbeat table is missing', async () => {
    process.env.CRM_SHEET_IMPORT_SECRET = 'secret';

    const supabase = createStatusSupabase({ heartbeatError: { message: 'relation "crm_automation_heartbeats" does not exist' } });

    const status = await getCrmAutomationStatus(supabase);

    expect(status.overall.severity).toBe('critical');
    // Sheet creds are unset here → the import job is misconfigured; the sweep
    // job has its config but no heartbeats → not_reporting.
    const importJob = status.jobs.find((job) => job.job === 'meta_sheet_import');
    const sweepJob = status.jobs.find((job) => job.job === 'abandoned_bookings_sweep');
    expect(importJob?.status).toBe('misconfigured');
    expect(sweepJob?.status).toBe('not_reporting');
    const configByKey = Object.fromEntries(status.config.map((check) => [check.key, check]));
    expect(configByKey.heartbeat_table.ok).toBe(false);
    expect(configByKey.heartbeat_table.hint).toBe('apply migration 100');
  });
});
