import { afterEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  updateSessionMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: hoisted.updateSessionMock,
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: hoisted.getSupabaseAdminClientMock,
}));

vi.mock('@/lib/supabase/env', () => ({
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseUrl: () => 'https://example.supabase.co',
}));
import { middleware, hasBearerAuthorizationHeader, shouldBypassProtectedApiCookieGate } from './middleware';

function createRequest(pathname: string, authorizationHeader = 'Bearer mobile-token') {
  const url = new URL(pathname, 'https://example.com');
  return {
    method: 'GET',
    nextUrl: {
      pathname,
      clone: () => new URL(url.toString()),
      search: '',
    },
    headers: new Headers({ authorization: authorizationHeader }),
    cookies: {
      getAll: () => [],
    },
  } as any;
}

function createSupabaseAdminForBearer(options: {
  userId?: string;
  roleName?: 'user' | 'provider' | 'admin' | 'staff' | null;
  providerAccountStatus?: 'active' | 'suspended' | 'banned' | null;
  providerAdminApprovalStatus?: 'approved' | 'pending' | 'rejected' | null;
  providerVerificationStatus?: 'approved' | 'pending' | 'rejected' | null;
  hasProviderRecord?: boolean;
}) {
  const {
    userId = 'provider-user',
    roleName = 'provider',
    providerAccountStatus = 'active',
    providerAdminApprovalStatus = 'approved',
    providerVerificationStatus = 'approved',
    hasProviderRecord = true,
  } = options;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: roleName ? { roles: { name: roleName } } : null,
            error: null,
          }),
        };
      }

      if (table === 'providers') {
        const providerRecord = hasProviderRecord
          ? {
              account_status: providerAccountStatus,
              admin_approval_status: providerAdminApprovalStatus,
              verification_status: providerVerificationStatus,
            }
          : null;

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: providerRecord, error: null }),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: providerRecord, error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('middleware bearer helpers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects bearer authorization headers', () => {
    expect(hasBearerAuthorizationHeader(new Headers({ authorization: 'Bearer token-123' }))).toBe(true);
    expect(hasBearerAuthorizationHeader(new Headers({ authorization: 'bearer token-123' }))).toBe(true);
    expect(hasBearerAuthorizationHeader(new Headers({ authorization: 'Token token-123' }))).toBe(false);
    expect(hasBearerAuthorizationHeader(new Headers())).toBe(false);
  });

  it('bypasses cookie gate only for protected api-style paths with bearer token', () => {
    const bearerHeaders = new Headers({ authorization: 'Bearer token-123' });
    const emptyHeaders = new Headers();

    expect(shouldBypassProtectedApiCookieGate('/api/user/pets', bearerHeaders)).toBe(true);
    expect(shouldBypassProtectedApiCookieGate('/dashboard/user', bearerHeaders)).toBe(false);
    expect(shouldBypassProtectedApiCookieGate('/api/user/pets', emptyHeaders)).toBe(false);
  });

  it('returns 403 for suspended provider on bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'provider',
        providerAccountStatus: 'suspended',
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Account suspended' });
  });

  it('returns 403 for banned provider on bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'provider',
        providerAccountStatus: 'banned',
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Account suspended' });
  });

  it('returns 403 for role-mismatched bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'user',
        hasProviderRecord: false,
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('allows active approved provider on bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'provider',
        providerAccountStatus: 'active',
        providerAdminApprovalStatus: 'approved',
        providerVerificationStatus: 'approved',
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(200);
  });

  it('returns 403 for pending provider account on bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'provider',
        providerAccountStatus: 'active',
        providerAdminApprovalStatus: 'pending',
        providerVerificationStatus: 'pending',
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Account suspended' });
  });

  it('returns 403 for rejected provider account on bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'provider',
        providerAccountStatus: 'active',
        providerAdminApprovalStatus: 'rejected',
        providerVerificationStatus: 'rejected',
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Account suspended' });
  });

  it('returns 403 for deleted provider account on bearer-only protected API request', async () => {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });

    hoisted.getSupabaseAdminClientMock.mockReturnValue(
      createSupabaseAdminForBearer({
        roleName: 'provider',
        hasProviderRecord: false,
      }),
    );

    const response = await middleware(createRequest('/api/provider/bookings'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Account suspended' });
  });
});
