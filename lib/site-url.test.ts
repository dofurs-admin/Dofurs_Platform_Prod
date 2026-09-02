import { afterEach, describe, expect, it } from 'vitest';
import { resolveSiteOrigin } from '@/lib/site-url';

const ORIGINAL_ENV = { ...process.env };

describe('resolveSiteOrigin', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV.NEXT_PUBLIC_APP_URL;
  });

  it('prefers the configured canonical site URL over the request origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://dofurs.in/';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(resolveSiteOrigin({ url: 'https://staging.dofurs.in/api/admin/users/create' })).toBe('https://dofurs.in');
  });

  it('falls back to NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_SITE_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';

    expect(resolveSiteOrigin({ url: 'http://localhost:3000/api/admin/users/create' })).toBe('https://app.example.com');
  });

  it('falls back to the request origin when no site URL is configured', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(resolveSiteOrigin({ url: 'http://localhost:3000/api/admin/users/create' })).toBe('http://localhost:3000');
  });

  it('falls back to the canonical production URL when nothing usable is available', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(resolveSiteOrigin()).toBe('https://dofurs.in');
    expect(resolveSiteOrigin({ url: 'not-a-valid-url' })).toBe('https://dofurs.in');
  });
});