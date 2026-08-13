import { describe, expect, it } from 'vitest';
import { deriveSessionLifecycleDecision } from './session-lifecycle';

describe('deriveSessionLifecycleDecision', () => {
  it('clears when session is missing', () => {
    const decision = deriveSessionLifecycleDecision('user-1', null);

    expect(decision).toEqual({
      type: 'clear',
      nextPreviousUserId: null,
      shouldClearQuery: true,
    });
  });

  it('clears when token is missing (revoked/invalid session)', () => {
    const decision = deriveSessionLifecycleDecision('user-1', {
      access_token: null,
      user: { id: 'user-1' },
    });

    expect(decision.type).toBe('clear');
    expect(decision.shouldClearQuery).toBe(true);
  });

  it('restores valid session for app restart without clearing query on same user', () => {
    const decision = deriveSessionLifecycleDecision('user-1', {
      access_token: 'token-a',
      user: { id: 'user-1', user_metadata: { role: 'user' } },
    });

    expect(decision).toEqual({
      type: 'set',
      nextPreviousUserId: 'user-1',
      shouldClearQuery: false,
      session: {
        accessToken: 'token-a',
        userId: 'user-1',
        role: 'user',
      },
    });
  });

  it('keeps query cache during token refresh for same user', () => {
    const decision = deriveSessionLifecycleDecision('provider-1', {
      access_token: 'token-refreshed',
      user: { id: 'provider-1', user_metadata: { app_role: 'provider' } },
    });

    expect(decision.type).toBe('set');
    if (decision.type === 'set') {
      expect(decision.shouldClearQuery).toBe(false);
      expect(decision.session.role).toBe('provider');
      expect(decision.session.accessToken).toBe('token-refreshed');
    }
  });

  it('clears query cache when session user changes', () => {
    const decision = deriveSessionLifecycleDecision('user-1', {
      access_token: 'token-b',
      user: { id: 'user-2', user_metadata: { role: 'user' } },
    });

    expect(decision.type).toBe('set');
    if (decision.type === 'set') {
      expect(decision.shouldClearQuery).toBe(true);
      expect(decision.nextPreviousUserId).toBe('user-2');
    }
  });
});
