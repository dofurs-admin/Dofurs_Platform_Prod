import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
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
  runMetaSheetImport: vi.fn(),
}));

vi.mock('@/lib/crm/automation-status', () => ({
  recordCrmAutomationHeartbeat: vi.fn().mockResolvedValue({ recorded: true, alert: null }),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { runMetaSheetImport, CrmServiceError } from '@/lib/crm/service';
import { recordCrmAutomationHeartbeat } from '@/lib/crm/automation-status';
import { POST } from '@/app/api/admin/crm/imports/meta-sheet/route';

function importResult(overrides: Record<string, unknown> = {}) {
  return {
    dryRun: false,
    spreadsheetId: 'sheet-1',
    range: 'A1:Z500',
    tabsScanned: 2,
    tabTitles: ['After July 10', 'Main Sheet'],
    rowsScanned: 404,
    candidatesFound: 400,
    imported: 3,
    skippedExisting: 397,
    invalid: 3,
    invalidReasons: [],
    emptyRows: 4,
    newCustomers: 3,
    warnings: [],
    preview: [],
    ...overrides,
  };
}

function createImportRequest(body: unknown, token: string | null = 'crm-secret') {
  return new Request('http://localhost/api/admin/crm/imports/meta-sheet', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

describe('POST /api/admin/crm/imports/meta-sheet (route-side heartbeats)', () => {
  beforeEach(() => {
    process.env.CRM_SHEET_IMPORT_SECRET = 'crm-secret';
    vi.clearAllMocks();
    vi.mocked(recordCrmAutomationHeartbeat).mockResolvedValue({ recorded: true, alert: null });
  });

  afterEach(() => {
    delete process.env.CRM_SHEET_IMPORT_SECRET;
    vi.restoreAllMocks();
  });

  it('records an ok heartbeat for a secret-authenticated run', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runMetaSheetImport).mockResolvedValue(importResult() as never);

    const response = await POST(createImportRequest({ dryRun: false }));

    expect(response.status).toBe(200);
    expect(requireApiRole).not.toHaveBeenCalled();
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledTimes(1);
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        job: 'meta_sheet_import',
        ok: true,
        httpStatus: 200,
        summary: expect.objectContaining({ imported: 3, skipped: 397, scanned: 404 }),
      }),
    );
  });

  it('records a failing heartbeat when the import run fails', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runMetaSheetImport).mockRejectedValue(new CrmServiceError('sheet exploded', 500));

    const response = await POST(createImportRequest({ dryRun: false }));

    expect(response.status).toBe(500);
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        job: 'meta_sheet_import',
        ok: false,
        httpStatus: 500,
        errorMessage: 'sheet exploded',
      }),
    );
  });

  it('treats a 409 lock conflict as an ok heartbeat', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runMetaSheetImport).mockRejectedValue(new CrmServiceError('locked', 409));

    const response = await POST(createImportRequest({ dryRun: false }));

    expect(response.status).toBe(409);
    expect(recordCrmAutomationHeartbeat).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        job: 'meta_sheet_import',
        ok: true,
        httpStatus: 409,
        errorMessage: 'Another import run held the lock',
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
    vi.mocked(runMetaSheetImport).mockResolvedValue(importResult({ imported: 5 }) as never);

    const response = await POST(createImportRequest({ dryRun: false }, null));

    expect(response.status).toBe(200);
    expect(recordCrmAutomationHeartbeat).not.toHaveBeenCalled();
  });

  it('never fails the main run when heartbeat recording throws', async () => {
    const supabase = { from: vi.fn() };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(runMetaSheetImport).mockResolvedValue(importResult() as never);
    vi.mocked(recordCrmAutomationHeartbeat).mockRejectedValue(new Error('heartbeat down'));

    const response = await POST(createImportRequest({ dryRun: false }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true, result: expect.objectContaining({ imported: 3 }) }),
    );
  });

  it('rejects an invalid secret via the admin session path', async () => {
    vi.mocked(requireApiRole).mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      context: null,
    } as never);

    const response = await POST(createImportRequest({ dryRun: false }, 'wrong-secret'));

    expect(response.status).toBe(401);
    expect(runMetaSheetImport).not.toHaveBeenCalled();
    expect(recordCrmAutomationHeartbeat).not.toHaveBeenCalled();
  });
});
