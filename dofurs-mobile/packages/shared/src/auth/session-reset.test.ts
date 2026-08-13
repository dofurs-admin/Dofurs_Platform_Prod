import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '../lib/query-client';
import { useAuthStore } from '../store/auth-store';

const hoisted = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      signOut: hoisted.signOutMock,
    },
  }),
}));

import { signOutAndResetClientState } from './session';

describe('signOutAndResetClientState', () => {
  beforeEach(() => {
    hoisted.signOutMock.mockReset();

    useAuthStore.setState({
      accessToken: 'token-x',
      userId: 'user-x',
      role: 'user',
      status: 'authenticated',
      requiresProfileSetup: true,
      signupDraft: {
        name: 'Draft User',
        email: 'draft@example.com',
        phone: '+911234567890',
        referralCode: 'DRAFT',
      },
    });

    queryClient.setQueryData(['user', 'profile'], { id: 'user-x' });
  });

  it('clears query cache and auth store when sign-out succeeds', async () => {
    hoisted.signOutMock.mockResolvedValue({ error: null });

    await signOutAndResetClientState();

    expect(hoisted.signOutMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['user', 'profile'])).toBeUndefined();

    const snapshot = useAuthStore.getState();
    expect(snapshot.status).toBe('signed-out');
    expect(snapshot.accessToken).toBeNull();
    expect(snapshot.userId).toBeNull();
    expect(snapshot.role).toBeNull();
    expect(snapshot.signupDraft).toBeNull();
    expect(snapshot.requiresProfileSetup).toBe(false);
  });

  it('still clears query cache and auth store when sign-out fails', async () => {
    hoisted.signOutMock.mockRejectedValue(new Error('network unavailable'));

    await signOutAndResetClientState();

    expect(hoisted.signOutMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['user', 'profile'])).toBeUndefined();

    const snapshot = useAuthStore.getState();
    expect(snapshot.status).toBe('signed-out');
    expect(snapshot.accessToken).toBeNull();
    expect(snapshot.userId).toBeNull();
    expect(snapshot.role).toBeNull();
  });
});
