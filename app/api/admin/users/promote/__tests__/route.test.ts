import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  getApiAuthContext: vi.fn(),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { getApiAuthContext } from '@/lib/auth/api-auth';
import { POST } from '@/app/api/admin/users/promote/route';

function buildSupabaseMock(options: {
  roleData?: { id: string } | null;
  roleError?: object | null;
  userData?: { id: string; email: string; role_id: string } | null;
  userError?: object | null;
  updateError?: object | null;
}) {
  const {
    roleData = { id: 'role-uuid' },
    roleError = null,
    userData = { id: 'target-user-id', email: 'user@example.com', role_id: 'old-role-uuid' },
    userError = null,
    updateError = null,
  } = options;

  const updateBuilder = {
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  };

  const usersSelectBuilder = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: userData, error: userError }),
    update: vi.fn().mockReturnValue(updateBuilder),
  };

  const rolesSelectBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: roleData, error: roleError }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'roles') return rolesSelectBuilder;
      return usersSelectBuilder;
    }),
  };
}

describe('POST /api/admin/users/promote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for an invalid or missing email', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'admin-user-id' },
      role: 'admin',
      supabase: {} as never,
    } as never);

    const request = new Request('http://localhost/api/admin/users/promote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', role: 'admin' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 for an empty email', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'admin-user-id' },
      role: 'admin',
      supabase: {} as never,
    } as never);

    const request = new Request('http://localhost/api/admin/users/promote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: '', role: 'admin' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('succeeds when user is found and role is updated', async () => {
    const mockSupabase = buildSupabaseMock({
      roleData: { id: 'admin-role-uuid' },
      userData: { id: 'target-user-id', email: 'user@example.com', role_id: 'old-role-uuid' },
    });

    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'admin-user-id' },
      role: 'admin',
      supabase: mockSupabase as never,
    } as never);

    const request = new Request('http://localhost/api/admin/users/promote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', role: 'admin' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.user.id).toBe('target-user-id');
    expect(json.user.role).toBe('admin');
  });

  it('returns 403 when caller is not admin', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'provider-user-id' },
      role: 'provider',
      supabase: {} as never,
    } as never);

    const request = new Request('http://localhost/api/admin/users/promote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', role: 'admin' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });
});
