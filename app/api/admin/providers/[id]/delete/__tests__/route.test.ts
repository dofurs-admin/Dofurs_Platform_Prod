import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/provider-management/service', () => ({
  deleteProvider: vi.fn(),
  logProviderAdminAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  logSecurityEvent: vi.fn(),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { deleteProvider } from '@/lib/provider-management/service';
import { DELETE } from '@/app/api/admin/providers/[id]/delete/route';

describe('DELETE /api/admin/providers/[id]/delete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    const request = new Request('http://localhost/api/admin/providers/abc/delete', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'abc' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/invalid provider id/i);
  });

  it('succeeds when provider exists and has no linked user', async () => {
    const mockProvider = { id: 10, name: 'Solo Provider', user_id: null };

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    vi.mocked(deleteProvider).mockResolvedValue(mockProvider as never);

    // No linked user so getSupabaseAdminClient should not be called for auth deletion
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: { admin: { deleteUser: vi.fn() } },
      from: vi.fn(),
    } as never);

    const request = new Request('http://localhost/api/admin/providers/10/delete', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '10' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.provider.id).toBe(10);
    expect(deleteProvider).toHaveBeenCalledWith(expect.anything(), 10);
  });

  it('succeeds when provider exists and has a linked user — deletes auth user', async () => {
    const linkedUserId = 'linked-user-uuid';
    const mockProvider = { id: 20, name: 'Linked Provider', user_id: linkedUserId };

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    vi.mocked(deleteProvider).mockResolvedValue(mockProvider as never);

    const deleteUserSpy = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: { admin: { deleteUser: deleteUserSpy } },
      from: vi.fn(),
    } as never);

    const request = new Request('http://localhost/api/admin/providers/20/delete', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '20' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(deleteUserSpy).toHaveBeenCalledWith(linkedUserId);
  });

  it('returns auth response when requireApiRole denies access', async () => {
    const deniedResponse = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: deniedResponse,
      context: null,
    } as never);

    const request = new Request('http://localhost/api/admin/providers/10/delete', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '10' }) });

    expect(response.status).toBe(403);
  });
});
