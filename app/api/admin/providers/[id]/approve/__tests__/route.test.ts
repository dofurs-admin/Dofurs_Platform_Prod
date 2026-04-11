import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/provider-management/service', () => ({
  approveProvider: vi.fn(),
  logProviderAdminAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  logSecurityEvent: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { approveProvider } from '@/lib/provider-management/service';
import { POST } from '@/app/api/admin/providers/[id]/approve/route';

describe('POST /api/admin/providers/[id]/approve', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds for a valid provider id', async () => {
    const mockProvider = { id: 42, name: 'Great Groomer', status: 'approved' };

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    vi.mocked(approveProvider).mockResolvedValue(mockProvider as never);

    const request = new Request('http://localhost/api/admin/providers/42/approve', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: '42' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.provider.id).toBe(42);
    expect(approveProvider).toHaveBeenCalledWith(expect.anything(), 42);
  });

  it('returns 400 for a non-numeric provider id', async () => {
    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/providers/not-a-number/approve', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'not-a-number' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/invalid provider id/i);
  });

  it('returns auth response when requireApiRole denies access', async () => {
    const deniedResponse = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: deniedResponse,
      context: null,
    } as never);

    const request = new Request('http://localhost/api/admin/providers/42/approve', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: '42' }) });

    expect(response.status).toBe(403);
  });
});
