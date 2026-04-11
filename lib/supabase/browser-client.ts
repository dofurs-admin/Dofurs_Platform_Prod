'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;
let didRunAuthRecovery = false;

function isInvalidRefreshTokenError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes('invalid refresh token') || normalized.includes('refresh token not found');
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());

    if (!didRunAuthRecovery) {
      didRunAuthRecovery = true;

      void browserClient.auth
        .getSession()
        .then(async ({ error }: { error: { message?: string } | null }) => {
        if (!error || !isInvalidRefreshTokenError(error.message)) {
          return;
        }

        await browserClient?.auth.signOut({ scope: 'local' });
        });
    }
  }

  return browserClient;
}
