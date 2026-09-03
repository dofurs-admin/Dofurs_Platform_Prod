import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

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
  } as unknown as NextRequest;
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

describe('middleware automation token routes (billing + CRM crons)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function createAutomationRequest(pathname: string, headers: Record<string, string>) {
    const url = new URL(pathname, 'https://example.com');
    return {
      method: 'POST',
      nextUrl: {
        pathname,
        clone: () => new URL(url.toString()),
        search: '',
      },
      headers: new Headers(headers),
      cookies: {
        getAll: () => [],
      },
    } as unknown as NextRequest;
  }

  /** Simulates Supabase rejecting a token — what happens when the middleware
   *  wrongly tries to validate a CRM automation secret as a user JWT. */
  function createSupabaseAdminRejectingTokens() {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'invalid claim: kid parsing failed' },
        }),
      },
    };
  }

  function mockUpdateSessionPassThrough() {
    hoisted.updateSessionMock.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      user: null,
    });
    hoisted.getSupabaseAdminClientMock.mockReturnValue(createSupabaseAdminRejectingTokens());
  }

  it('passes through the CRM Meta sheet import cron request (automation secret as bearer token)', async () => {
    mockUpdateSessionPassThrough();

    const response = await middleware(
      createAutomationRequest('/api/admin/crm/imports/meta-sheet', {
        authorization: 'Bearer crm-sheet-import-secret',
        'content-type': 'application/json',
      }),
    );

    // Regression: previously the middleware rejected the cron with 401 by
    // validating the automation secret as a Supabase user JWT.
    expect(response.status).toBe(200);
    expect(hoisted.getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('passes through the CRM abandoned-booking sweep cron request (automation secret as bearer token)', async () => {
    mockUpdateSessionPassThrough();

    const response = await middleware(
      createAutomationRequest('/api/admin/crm/abandoned-bookings/run', {
        authorization: 'Bearer crm-sheet-import-secret',
        'content-type': 'application/json',
      }),
    );

    expect(response.status).toBe(200);
    expect(hoisted.getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('passes through CRM automation requests using the x-crm-import-token header', async () => {
    mockUpdateSessionPassThrough();

    const response = await middleware(
      createAutomationRequest('/api/admin/crm/imports/meta-sheet', {
        'x-crm-import-token': 'crm-sheet-import-secret',
        'content-type': 'application/json',
      }),
    );

    // Regression: with no bearer header and no session cookie the middleware
    // used to reject these requests at the cookie gate before this mode could
    // reach the route handler's dual auth.
    expect(response.status).toBe(200);
    expect(hoisted.getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('still passes through the billing reminder scheduler cron request', async () => {
    mockUpdateSessionPassThrough();

    const response = await middleware(
      createAutomationRequest('/api/admin/billing/reminders/schedule', {
        authorization: 'Bearer billing-automation-secret',
        'content-type': 'application/json',
      }),
    );

    expect(response.status).toBe(200);
    expect(hoisted.getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('still rejects non-automation admin CRM routes carrying a non-Supabase bearer token', async () => {
    mockUpdateSessionPassThrough();

    const response = await middleware(
      createAutomationRequest('/api/admin/crm/leads', {
        authorization: 'Bearer not-a-supabase-jwt',
      }),
    );

    // The whitelist is scoped: only the dual-auth automation routes bypass
    // middleware validation; every other /api/admin route still requires a
    // valid Supabase session or user bearer token.
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(hoisted.getSupabaseAdminClientMock).toHaveBeenCalledTimes(1);
  });
});
