import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
}));

vi.mock('@/app/api/admin/billing/reminders/_automation', () => ({
  ALLOWED_BUCKETS: ['due_soon', 'overdue_7', 'overdue_14', 'overdue_30', 'all'],
  ALLOWED_CHANNELS: ['email', 'whatsapp'],
  runBillingReminderAutomation: vi.fn(),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { runBillingReminderAutomation } from '@/app/api/admin/billing/reminders/_automation';
import { GET as getSchedule } from '@/app/api/admin/billing/reminders/schedule/route';
import { POST as postSchedule } from '@/app/api/admin/billing/reminders/schedule/route';
import { GET as getRuns } from '@/app/api/admin/billing/reminders/runs/route';
import { POST as postRun } from '@/app/api/admin/billing/reminders/run/route';

function createLatestRunBuilder(latestRun: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: latestRun, error: null }),
    }),
  };
}

function createRecentStatusesBuilder(statusRows: Array<{ status: 'success' | 'failed'; finished_at: string | null; created_at: string }>) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: statusRows, error: null }),
  };
}

describe('admin billing reminders schedule GET', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BILLING_AUTOMATION_SECRET;
  });

  it('returns last_run and scheduler health summary fields', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'test-secret';

    const latestRun = {
      id: 'run_1',
      trigger_source: 'scheduler',
      status: 'success',
      run_scope: 'scheduled',
      bucket: 'all',
      channel: 'whatsapp',
      dry_run: false,
      enforce_cadence: true,
      enforce_cooldown: true,
      scanned: 10,
      sent: 7,
      skipped_cadence: 2,
      skipped_cooldown: 1,
      escalated: 1,
      error_message: null,
      started_at: '2026-03-10T12:00:00.000Z',
      finished_at: '2026-03-10T12:01:00.000Z',
      created_at: '2026-03-10T12:01:00.000Z',
    };

    const recentStatuses = [
      { status: 'failed' as const, finished_at: '2026-03-10T12:10:00.000Z', created_at: '2026-03-10T12:10:00.000Z' },
      { status: 'failed' as const, finished_at: '2026-03-10T12:08:00.000Z', created_at: '2026-03-10T12:08:00.000Z' },
      { status: 'success' as const, finished_at: '2026-03-10T12:06:00.000Z', created_at: '2026-03-10T12:06:00.000Z' },
      { status: 'failed' as const, finished_at: '2026-03-10T12:04:00.000Z', created_at: '2026-03-10T12:04:00.000Z' },
    ];

    const latestRunBuilder = createLatestRunBuilder(latestRun);
    const recentStatusesBuilder = createRecentStatusesBuilder(recentStatuses);

    const fromMock = vi
      .fn()
      .mockReturnValueOnce(latestRunBuilder)
      .mockReturnValueOnce(recentStatusesBuilder);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as never);

    const response = await getSchedule();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.enabled).toBe(true);
    expect(json.requires_token).toBe(true);
    expect(json.last_run?.id).toBe('run_1');
    expect(json.last_success_at).toBe('2026-03-10T12:06:00.000Z');
    expect(json.last_failure_at).toBe('2026-03-10T12:10:00.000Z');
    expect(json.consecutive_failures).toBe(2);
    expect(Array.isArray(json.supported?.buckets)).toBe(true);
    expect(Array.isArray(json.supported?.channels)).toBe(true);
  });
});

function createRunsBuilder(data: Array<Record<string, unknown>>) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('admin billing reminders runs GET', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clamps limit and returns run history payload', async () => {
    const runs = [
      {
        id: 'run_live',
        trigger_source: 'scheduler',
        status: 'success',
        run_scope: 'scheduled',
        bucket: 'all',
        channel: 'whatsapp',
        dry_run: false,
        enforce_cadence: true,
        enforce_cooldown: true,
        scanned: 4,
        sent: 3,
        skipped_cadence: 0,
        skipped_cooldown: 1,
        escalated: 0,
        error_message: null,
        started_at: '2026-03-10T13:00:00.000Z',
        finished_at: '2026-03-10T13:01:00.000Z',
        created_at: '2026-03-10T13:01:00.000Z',
      },
    ];

    const runsBuilder = createRunsBuilder(runs);
    const fromMock = vi.fn().mockReturnValue(runsBuilder);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        supabase: { from: fromMock },
      },
    } as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as never);

    const request = new Request('http://localhost/api/admin/billing/reminders/runs?limit=999');
    const response = await getRuns(request);

    expect(response.status).toBe(200);
    expect(runsBuilder.limit).toHaveBeenCalledWith(100);

    const json = await response.json();
    expect(json.limit).toBe(100);
    expect(Array.isArray(json.runs)).toBe(true);
    expect(json.runs[0]?.id).toBe('run_live');
  });
});

function createInsertBuilder(insertSpy: ReturnType<typeof vi.fn>) {
  return {
    insert: insertSpy,
  };
}

describe('admin billing reminders run POST', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records success telemetry for dry run', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        supabase: { from: vi.fn() },
        user: { id: 'admin_1' },
      },
    } as never);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createInsertBuilder(insertSpy)),
    } as never);

    vi.mocked(runBillingReminderAutomation).mockResolvedValue({
      success: true,
      run_at: '2026-03-10T10:00:00.000Z',
      bucket: 'all',
      channel: 'whatsapp',
      enforceCadence: true,
      enforceCooldown: true,
      dry_run: true,
      scanned: 8,
      sent: 5,
      skippedCadence: 2,
      skippedCooldown: 1,
      escalated: 1,
    });

    const response = await postRun(
      new Request('http://localhost/api/admin/billing/reminders/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'all',
          channel: 'whatsapp',
          dryRun: true,
          enforceCadence: true,
          enforceCooldown: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(runBillingReminderAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin_1',
        source: 'admin_billing_auto_run',
        dryRun: true,
      }),
    );
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_source: 'admin_panel',
        status: 'success',
        dry_run: true,
        scanned: 8,
        sent: 5,
      }),
    );
  });

  it('records failed telemetry when automation throws', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        supabase: { from: vi.fn() },
        user: { id: 'admin_2' },
      },
    } as never);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createInsertBuilder(insertSpy)),
    } as never);

    vi.mocked(runBillingReminderAutomation).mockRejectedValue(new Error('automation failed'));

    const response = await postRun(
      new Request('http://localhost/api/admin/billing/reminders/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bucket: 'all', channel: 'whatsapp' }),
      }),
    );

    expect(response.status).toBe(500);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_source: 'admin_panel',
        status: 'failed',
        error_message: 'automation failed',
      }),
    );
  });
});

describe('admin billing reminders schedule POST', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BILLING_AUTOMATION_SECRET;
    delete process.env.BILLING_AUTOMATION_ALERT_WEBHOOK_URL;
    delete process.env.BILLING_AUTOMATION_ALERT_FAIL_THRESHOLD;
  });

  it('rejects unauthorized scheduler token', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';

    const response = await postSchedule(
      new Request('http://localhost/api/admin/billing/reminders/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bucket: 'all', channel: 'whatsapp' }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('records scheduler success telemetry', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';
    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createInsertBuilder(insertSpy)),
    } as never);

    vi.mocked(runBillingReminderAutomation).mockResolvedValue({
      success: true,
      run_at: '2026-03-10T10:00:00.000Z',
      bucket: 'all',
      channel: 'whatsapp',
      enforceCadence: true,
      enforceCooldown: true,
      dry_run: false,
      scanned: 4,
      sent: 3,
      skippedCadence: 1,
      skippedCooldown: 0,
      escalated: 0,
    });

    const response = await postSchedule(
      new Request('http://localhost/api/admin/billing/reminders/schedule', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer scheduler-secret',
        },
        body: JSON.stringify({ bucket: 'all', channel: 'whatsapp' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(runBillingReminderAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'system_scheduler',
        source: 'billing_scheduler_cron',
      }),
    );
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_source: 'scheduler',
        status: 'success',
        dry_run: false,
      }),
    );
  });

  it('records scheduler failure telemetry when automation throws', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';
    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createInsertBuilder(insertSpy)),
    } as never);

    vi.mocked(runBillingReminderAutomation).mockRejectedValue(new Error('scheduler automation failure'));

    const response = await postSchedule(
      new Request('http://localhost/api/admin/billing/reminders/schedule', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer scheduler-secret',
        },
        body: JSON.stringify({ bucket: 'all', channel: 'whatsapp', dryRun: true }),
      }),
    );

    expect(response.status).toBe(500);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_source: 'scheduler',
        status: 'failed',
        dry_run: true,
        error_message: 'scheduler automation failure',
      }),
    );
  });

  it('sends alert webhook when failure threshold is reached', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';
    process.env.BILLING_AUTOMATION_ALERT_WEBHOOK_URL = 'https://alerts.example.test/hook';
    process.env.BILLING_AUTOMATION_ALERT_FAIL_THRESHOLD = '3';

    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const statusesBuilder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { status: 'failed' },
          { status: 'failed' },
          { status: 'failed' },
          { status: 'success' },
        ],
        error: null,
      }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValueOnce(createInsertBuilder(insertSpy)).mockReturnValueOnce(statusesBuilder),
    } as never);

    vi.mocked(runBillingReminderAutomation).mockRejectedValue(new Error('scheduler automation failure'));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const response = await postSchedule(
      new Request('http://localhost/api/admin/billing/reminders/schedule', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer scheduler-secret',
        },
        body: JSON.stringify({ bucket: 'all', channel: 'whatsapp' }),
      }),
    );

    expect(response.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://alerts.example.test/hook',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
