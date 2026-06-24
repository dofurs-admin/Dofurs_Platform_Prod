import { describe, expect, it } from 'vitest';
import { hasBearerAuthorizationHeader, shouldBypassProtectedApiCookieGate } from './middleware';

describe('middleware bearer helpers', () => {
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
});
