import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/crm/ops-alert', () => ({
  sendCrmOpsAlert: vi.fn().mockResolvedValue({ sent: true }),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { sendCrmOpsAlert } from '@/lib/crm/ops-alert';
import { POST } from '@/app/api/crm/automation/heartbeat/route';

function priorHeartbeat(ok: boolean, index: number) {
  return {
    id: `hb_prior_${index}`,
    job: 'meta_sheet_import',
    ok,
    http_status: ok ? 200 : 401,
    error_message: ok ? null : 'Unauthorized',
    duration_ms: 1000,
    summary: {},
    created_at: new Date(Date.now() - (index + 1) * 5 * 60_000).toISOString(),
  };
}

function createHeartbeatSupabase(priorRows: Array<ReturnType<typeof priorHeartbeat>> = []) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: priorRows, error: null }),
    insert,
  };

  return {
    from: vi.fn(() => builder),
    insert,
  };
}

function createHeartbeatRequest(body: unknown, ip: string, token: string | null = 'crm-secret') {
  return new Request('http://localhost/api/crm/automation/heartbeat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/crm/automation/heartbeat', () => {
  beforeEach(() => {
    process.env.CRM_SHEET_IMPORT_SECRET = 'crm-secret';
    delete process.env.CRM_AUTOMATION_ALERT_FAIL_THRESHOLD;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CRM_SHEET_IMPORT_SECRET;
    vi.restoreAllMocks();
  });

  it('records a successful heartbeat with the automation secret', async () => {
    const supabase = createHeartbeatSupabase([]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(
      createHeartbeatRequest(
        { job: 'meta_sheet_import', ok: true, httpStatus: 200, durationMs: 1500, summary: { imported: 2 } },
        '10.0.0.1',
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, alert: null });
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'meta_sheet_import', ok: true, http_status: 200, duration_ms: 1500 }),
    );
    expect(sendCrmOpsAlert).not.toHaveBeenCalled();
  });

  it('rejects an invalid secret with 401 and never writes', async () => {
    const supabase = createHeartbeatSupabase([]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(
      createHeartbeatRequest({ job: 'meta_sheet_import', ok: true }, '10.0.0.2', 'wrong-secret'),
    );

    expect(response.status).toBe(401);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('rejects requests when the secret is not configured', async () => {
    delete process.env.CRM_SHEET_IMPORT_SECRET;
    const supabase = createHeartbeatSupabase([]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(createHeartbeatRequest({ job: 'meta_sheet_import', ok: true }, '10.0.0.3'));

    expect(response.status).toBe(401);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid payload with 400', async () => {
    const supabase = createHeartbeatSupabase([]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(createHeartbeatRequest({ job: 'unexpected_job', ok: true }, '10.0.0.4'));

    expect(response.status).toBe(400);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('sends one failure alert when the consecutive-failure threshold is crossed', async () => {
    // Two prior failures + this failure = 3 (the default threshold).
    const supabase = createHeartbeatSupabase([priorHeartbeat(false, 0), priorHeartbeat(false, 1)]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(
      createHeartbeatRequest(
        { job: 'meta_sheet_import', ok: false, httpStatus: 401, errorMessage: 'Unauthorized' },
        '10.0.0.5',
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, alert: 'failure_threshold' });
    expect(sendCrmOpsAlert).toHaveBeenCalledTimes(1);
    expect(sendCrmOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        title: 'CRM automation failing: Meta sheet import',
      }),
    );
  });

  it('does not repeat the failure alert past the threshold', async () => {
    // Already 3+ prior failures — the alert fired once before; stay quiet.
    const supabase = createHeartbeatSupabase([
      priorHeartbeat(false, 0),
      priorHeartbeat(false, 1),
      priorHeartbeat(false, 2),
    ]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(
      createHeartbeatRequest({ job: 'meta_sheet_import', ok: false, httpStatus: 401 }, '10.0.0.6'),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, alert: null });
    expect(sendCrmOpsAlert).not.toHaveBeenCalled();
  });

  it('sends a recovery alert when a confirmed outage heals', async () => {
    const supabase = createHeartbeatSupabase([
      priorHeartbeat(false, 0),
      priorHeartbeat(false, 1),
      priorHeartbeat(false, 2),
    ]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const response = await POST(
      createHeartbeatRequest({ job: 'meta_sheet_import', ok: true, httpStatus: 200 }, '10.0.0.7'),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, alert: 'recovered' });
    expect(sendCrmOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        title: 'CRM automation recovered: Meta sheet import',
      }),
    );
  });

  it('rate limits excessive heartbeat posts from one IP', async () => {
    const supabase = createHeartbeatSupabase([]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    // The distributed limiter RPC is unavailable on the stub → local limiter
    // (30/min) applies. The 31st request from the same IP is rejected.
    let lastResponse: Response | null = null;
    for (let i = 0; i < 31; i += 1) {
      lastResponse = await POST(createHeartbeatRequest({ job: 'meta_sheet_import', ok: true }, '10.0.0.8'));
    }

    expect(lastResponse?.status).toBe(429);
  });
});
