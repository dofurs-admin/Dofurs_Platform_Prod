import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { POST } from '@/app/api/admin/users/create/route';

function makeAuthContext() {
  return {
    response: null,
    context: {
      user: { id: 'admin-user-id' },
      role: 'admin',
      supabase: {},
    },
  };
}

describe('POST /api/admin/users/create', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for missing required fields', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({} as never);

    const request = new Request('http://localhost/api/admin/users/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Al' }), // name too short, phone missing
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 for an invalid phone number', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({} as never);

    const request = new Request('http://localhost/api/admin/users/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // All letters: passes Zod min(10) length but toIndianE164 extracts 0 digits → returns ''
      body: JSON.stringify({ name: 'Alice Smith', phone: 'abcdefghijk', noEmailInvite: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 409 when phone number is already in use', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    // phoneProbe returns existing user
    const phoneProbeBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-user' }, error: null }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(phoneProbeBuilder),
    } as never);

    const request = new Request('http://localhost/api/admin/users/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Smith', phone: '9876543210', noEmailInvite: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toMatch(/phone/i);
  });

  it('succeeds with a phone-only profile', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const noUserFound = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'role-uuid' }, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(noUserFound),
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-auth-user-id' } },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    } as never);

    const request = new Request('http://localhost/api/admin/users/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Smith', phone: '9876543210', noEmailInvite: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.user.id).toBe('new-auth-user-id');
    expect(json.inviteSent).toBe(false);
  });
});
