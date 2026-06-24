import { afterEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const getSupabaseAdminClientMock = vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  }));
  const headersMock = vi.fn(async () => new Headers());

  return {
    getUserMock,
    getSupabaseAdminClientMock,
    headersMock,
  };
});

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: hoisted.getSupabaseAdminClientMock,
}));

vi.mock('next/headers', () => ({
  headers: hoisted.headersMock,
}));

import { extractBearerAccessToken, resolveBearerAuthUser } from './bearer-auth';

describe('bearer auth utilities', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('extracts bearer token from authorization header', () => {
    expect(extractBearerAccessToken('Bearer abc.123')).toBe('abc.123');
    expect(extractBearerAccessToken('bearer   xyz')).toBe('xyz');
    expect(extractBearerAccessToken('Token xyz')).toBeNull();
    expect(extractBearerAccessToken('Bearer   ')).toBeNull();
    expect(extractBearerAccessToken(null)).toBeNull();
  });

  it('resolves bearer user when explicit authorization header is provided', async () => {
    const resolvedUser = { id: 'user-1', email: 'user@example.com' };
    hoisted.getUserMock.mockResolvedValue({
      data: { user: resolvedUser },
      error: null,
    });

    const result = await resolveBearerAuthUser('Bearer mobile-token');

    expect(hoisted.getSupabaseAdminClientMock).toHaveBeenCalledTimes(1);
    expect(hoisted.getUserMock).toHaveBeenCalledWith('mobile-token');
    expect(result).toEqual({
      accessToken: 'mobile-token',
      user: resolvedUser,
    });
  });

  it('reads authorization header from next headers store when no candidate is passed', async () => {
    const resolvedUser = { id: 'user-2' };
    hoisted.headersMock.mockResolvedValue(new Headers({ authorization: 'Bearer header-token' }));
    hoisted.getUserMock.mockResolvedValue({
      data: { user: resolvedUser },
      error: null,
    });

    const result = await resolveBearerAuthUser();

    expect(hoisted.headersMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      accessToken: 'header-token',
      user: resolvedUser,
    });
  });

  it('returns null auth result when bearer token is missing or invalid', async () => {
    const noToken = await resolveBearerAuthUser('Token nope');

    expect(noToken).toEqual({
      accessToken: null,
      user: null,
    });
    expect(hoisted.getUserMock).not.toHaveBeenCalled();

    hoisted.getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid token'),
    });

    const invalidToken = await resolveBearerAuthUser('Bearer invalid-token');

    expect(invalidToken).toEqual({
      accessToken: null,
      user: null,
    });
  });
});
