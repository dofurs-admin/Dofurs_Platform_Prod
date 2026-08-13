import { beforeEach, describe, expect, it, vi } from 'vitest';

const expoConfigStub = {
  extra: {
    EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_API_BASE_URL: 'https://dofurs.in',
    EXPO_PUBLIC_RAZORPAY_KEY_ID: undefined,
    EXPO_PUBLIC_GOOGLE_MAPS_KEY: undefined,
  },
};

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: expoConfigStub,
  },
}));

const baseEnv = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  EXPO_PUBLIC_API_BASE_URL: 'https://dofurs.in',
};

describe('readMobileEnv URL policy', () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.EXPO_PUBLIC_SUPABASE_URL = baseEnv.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = baseEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    process.env.EXPO_PUBLIC_API_BASE_URL = baseEnv.EXPO_PUBLIC_API_BASE_URL;

    delete process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
    delete process.env.EXPO_PUBLIC_APP_ENV;
  });

  it('allows local/private http API URLs in development', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:3000';

    const { readMobileEnv } = await import('./env');
    const env = readMobileEnv();

    expect(env.EXPO_PUBLIC_API_BASE_URL).toBe('http://10.0.2.2:3000');
  });

  it('rejects localhost/private hosts in preview and production', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3000';

    const { readMobileEnv } = await import('./env');

    expect(() => readMobileEnv()).toThrow(
      'Invalid EXPO_PUBLIC_API_BASE_URL for preview: only HTTPS endpoints are allowed outside development.',
    );
  });

  it('rejects non-https endpoints in production', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://dofurs.in';

    const { readMobileEnv } = await import('./env');

    expect(() => readMobileEnv()).toThrow(
      'Invalid EXPO_PUBLIC_API_BASE_URL for production: only HTTPS endpoints are allowed outside development.',
    );
  });
});
