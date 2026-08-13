import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';

describe('auth store session lifecycle', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      userId: null,
      role: null,
      status: 'idle',
      requiresProfileSetup: false,
      signupDraft: null,
    });
  });

  it('sets authenticated session snapshot', () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-1',
      userId: 'user-1',
      role: 'user',
    });

    const snapshot = useAuthStore.getState();

    expect(snapshot.accessToken).toBe('token-1');
    expect(snapshot.userId).toBe('user-1');
    expect(snapshot.role).toBe('user');
    expect(snapshot.status).toBe('authenticated');
  });

  it('clears session and resets profile/setup draft state', () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-2',
      userId: 'user-2',
      role: 'provider',
    });
    useAuthStore.getState().setRequiresProfileSetup(true);
    useAuthStore.getState().setSignupDraft({
      name: 'Aarav',
      email: 'aarav@example.com',
      phone: '+911234567890',
      referralCode: 'REF100',
    });

    useAuthStore.getState().clearSession();

    const snapshot = useAuthStore.getState();

    expect(snapshot.accessToken).toBeNull();
    expect(snapshot.userId).toBeNull();
    expect(snapshot.role).toBeNull();
    expect(snapshot.status).toBe('signed-out');
    expect(snapshot.requiresProfileSetup).toBe(false);
    expect(snapshot.signupDraft).toBeNull();
  });

  it('supports loading to signed-out transition', () => {
    useAuthStore.getState().setStatus('loading');
    expect(useAuthStore.getState().status).toBe('loading');

    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().status).toBe('signed-out');
  });
});
