import { afterEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSupabaseServerClientMock: vi.fn(),
  resolveBearerAuthUserMock: vi.fn(),
  getSupabaseBearerClientMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server-client', () => ({
  getSupabaseServerClient: hoisted.getSupabaseServerClientMock,
}));

vi.mock('@/lib/auth/bearer-auth', () => ({
  resolveBearerAuthUser: hoisted.resolveBearerAuthUserMock,
}));

vi.mock('@/lib/supabase/bearer-client', () => ({
  getSupabaseBearerClient: hoisted.getSupabaseBearerClientMock,
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: hoisted.getSupabaseAdminClientMock,
}));

import { getApiAuthContext, requireApiRole } from './api-auth';

function createRoleResolutionSupabase(roleName: 'user' | 'provider' | 'admin' | 'staff' | null, hasProviderRecord = false) {
  const usersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: roleName ? { roles: { name: roleName } } : null,
      error: null,
    }),
  };

  const providersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: hasProviderRecord ? { id: 'provider-row' } : null,
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return usersQuery;
      }

      if (table === 'providers') {
        return providersQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createSupabaseForContext(
  userId: string | null,
  roleName: 'user' | 'provider' | 'admin' | 'staff' | null,
  hasProviderRecord = false,
) {
  const roleResolution = createRoleResolutionSupabase(roleName, hasProviderRecord);

  return {
    ...roleResolution,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
  };
}

describe('api auth context', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses cookie auth context first when cookie user exists', async () => {
    const cookieSupabase = createSupabaseForContext('cookie-user', 'user', false);
    hoisted.getSupabaseServerClientMock.mockResolvedValue(cookieSupabase);

    const context = await getApiAuthContext();

    expect(context.user?.id).toBe('cookie-user');
    expect(context.role).toBe('user');
    expect(context.supabase).toBe(cookieSupabase);
    expect(hoisted.resolveBearerAuthUserMock).not.toHaveBeenCalled();
  });

  it('falls back to bearer auth context and preserves provider precedence', async () => {
    const cookieSupabase = createSupabaseForContext(null, null, false);
    const adminSupabase = createRoleResolutionSupabase('user', true);
    const bearerSupabase = { from: vi.fn() };

    hoisted.getSupabaseServerClientMock.mockResolvedValue(cookieSupabase);
    hoisted.resolveBearerAuthUserMock.mockResolvedValue({
      accessToken: 'mobile-token',
      user: { id: 'bearer-user' },
    });
    hoisted.getSupabaseAdminClientMock.mockReturnValue(adminSupabase);
    hoisted.getSupabaseBearerClientMock.mockReturnValue(bearerSupabase);

    const context = await getApiAuthContext({ authorizationHeader: 'Bearer mobile-token' });

    expect(hoisted.resolveBearerAuthUserMock).toHaveBeenCalledWith('Bearer mobile-token');
    expect(hoisted.getSupabaseBearerClientMock).toHaveBeenCalledWith('mobile-token');
    expect(context.user?.id).toBe('bearer-user');
    expect(context.role).toBe('provider');
    expect(context.supabase).toBe(bearerSupabase);
  });

  it('returns unauthorized context when no cookie or bearer auth is available', async () => {
    const cookieSupabase = createSupabaseForContext(null, null, false);
    hoisted.getSupabaseServerClientMock.mockResolvedValue(cookieSupabase);
    hoisted.resolveBearerAuthUserMock.mockResolvedValue({
      accessToken: null,
      user: null,
    });

    const context = await getApiAuthContext();

    expect(context.user).toBeNull();
    expect(context.role).toBeNull();
    expect(context.supabase).toBe(cookieSupabase);

    const auth = await requireApiRole(['user']);
    expect(auth.context).toBeNull();
    expect(auth.response.status).toBe(401);
  });
});
