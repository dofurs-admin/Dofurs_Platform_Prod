import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (err) {
          // Log with structured context for monitoring. This most commonly happens
          // during SSR when the response is already streaming (read-only context).
          console.error('[supabase/server-client] Failed to set auth cookies:', err instanceof Error ? err.message : err);
        }
      },
    },
  });
}
