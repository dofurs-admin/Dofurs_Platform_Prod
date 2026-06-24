import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readMobileEnv } from '../constants/env';
import { createSecureStoreAdapter } from './secure-store';

type SupabaseGlobal = {
  __dofursSupabaseClient?: SupabaseClient;
};

export function getSupabaseClient() {
  const globalStore = globalThis as SupabaseGlobal;

  if (globalStore.__dofursSupabaseClient) {
    return globalStore.__dofursSupabaseClient;
  }

  const env = readMobileEnv();

  const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      storage: createSecureStoreAdapter('dofurs.mobile.auth'),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  globalStore.__dofursSupabaseClient = client;
  return client;
}
