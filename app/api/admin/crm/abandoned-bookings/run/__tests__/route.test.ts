import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/crm/service', () => ({
  CrmServiceError: class CrmServiceError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.name = 'CrmServiceError';
      this.status = status;
    }
  },
  runAbandonedBookingSweep: vi.fn(),
}));

vi.mock('@/lib/crm/automation-status', () => ({
  recordCrmAutomationHeartbeat: vi.fn().mockResolvedValue({ recorded: true, alert: null }),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { runAbandonedBookingSweep, CrmServiceError } from '@/lib/crm/service';
import { recordCrmAutomationHeartbeat } from '@/lib/crm/automation-status';
import { POST } from '@/app/api/admin/crm/abandoned-bookings/run/route';

function sweepResult(overrides: Record<string, unknown> = {}) {
  return {
    dryRun: false,
    scanned: 5,
    abandonedLeads: 1,
    expiredSessions: 2,
    skippedNoContact: 2,
    ...overrides,
  };
}

function createSweepRequest(body: unknown, token: string | null = 'crm-secret') {
  return new Request('http://localhost/api/admin/crm/abandoned-bookings/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

describe('POST /api/admin/crm/abandoned-bookings/run (route-side heartbeats)', () => {
  beforeEach(() => {
    process.env.CRM_SHEET_IMPORT_SECRET = 'crm-secret';
    vi.clearAllMocks();
    vi.mocked(recordCrmAutomationHeartbeat).mockResolvedValue({ recorded: true, alert: null });
  });

  afterEach(() => {
    delete process.env.CRM_SHEET_IMPORT_SECRET;
    vi.restoreAllMocks();
  });

  it('records an ok heartbeat with sweep counts for a secret-authenticated run', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runAbandonedBookingSweep).mockResolvedValue(sweepResult() as never);

    const response = await POST(createSweepRequest({ dryRun: false }));

    expect(response.status).toBe(200);
    expect(requireApiRole).not.toHaveBeenCalled();
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        job: 'abandoned_bookings_sweep',
        ok: true,
        httpStatus: 200,
        summary: expect.objectContaining({ scanned: 5, abandonedLeads: 1, expiredSessions: 2 }),
      }),
    );
  });

  it('records a failing heartbeat when the sweep run fails', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runAbandonedBookingSweep).mockRejectedValue(new CrmServiceError('sweep exploded', 500));

    const response = await POST(createSweepRequest({ dryRun: false }));

    expect(response.status).toBe(500);
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        job: 'abandoned_bookings_sweep',
        ok: false,
        httpStatus: 500,
        errorMessage: 'sweep exploded',
      }),
    );
  });

  it('treats a 409 lock conflict as an ok heartbeat', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runAbandonedBookingSweep).mockRejectedValue(new CrmServiceError('locked', 409));

    const response = await POST(createSweepRequest({ dryRun: false }));

    expect(response.status).toBe(409);
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        job: 'abandoned_bookings_sweep',
        ok: true,
        httpStatus: 409,
        errorMessage: 'Another sweep run held the lock',
        summary: { acceptedConflict: true },
      }),
    );
  });

  it('does not record a heartbeat for manual admin-panel runs', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: { user: { id: 'admin-1' } },
    } as never);
    vi.mocked(runAbandonedBookingSweep).mockResolvedValue(sweepResult() as never);

    const response = await POST(createSweepRequest({ dryRun: false }, null));

    expect(response.status).toBe(200);
    expect(recordCrmAutomationHeartbeat).not.toHaveBeenCalled();
  });

  it('never fails the main run when heartbeat recording throws', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runAbandonedBookingSweep).mockResolvedValue(sweepResult() as never);
    vi.mocked(recordCrmAutomationHeartbeat).mockRejectedValue(new Error('heartbeat down'));

    const response = await POST(createSweepRequest({ dryRun: false }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true, result: expect.objectContaining({ scanned: 5 }) }),
    );
  });

  it('rejects an invalid secret via the admin session path', async () => {
    vi.mocked(requireApiRole).mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      context: null,
    } as never);

    const response = await POST(createSweepRequest({ dryRun: false }, 'wrong-secret'));

    expect(response.status).toBe(401);
    expect(runAbandonedBookingSweep).not.toHaveBeenCalled();
    expect(recordCrmAutomationHeartbeat).not.toHaveBeenCalled();
  });
});
