export type AppRole = 'user' | 'provider' | 'admin' | 'staff';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'signed-out';

export type SessionSnapshot = {
  accessToken: string | null;
  userId: string | null;
  role: AppRole | null;
  status: AuthStatus;
};
