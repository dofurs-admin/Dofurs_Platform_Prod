import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitKey: vi.fn((prefix: string, userId: string) => `${prefix}:${userId}`),
  isRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { POST } from '@/app/api/bookings/customers/quick-create/route';

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

describe('POST /api/bookings/customers/quick-create', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns an existing customer for duplicate phone matches', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const phoneProbeBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'existing-user-id',
          name: 'Alice Smith',
          email: null,
          phone: '+919876543210',
          roles: { name: 'user' },
        },
        error: null,
      }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(phoneProbeBuilder),
    } as never);

    const request = new Request('http://localhost/api/bookings/customers/quick-create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Smith', phone: '9876543210', noEmailInvite: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.isNewUser).toBe(false);
    expect(json.user.id).toBe('existing-user-id');
  });

  it('creates and returns a new phone-only customer', async () => {
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

    const request = new Request('http://localhost/api/bookings/customers/quick-create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Smith', phone: '9876543210', noEmailInvite: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.isNewUser).toBe(true);
    expect(json.user.id).toBe('new-auth-user-id');
    expect(json.inviteSent).toBe(false);
  });
});