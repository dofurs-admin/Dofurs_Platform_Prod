import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ApiClientConfig } from '../types/api';
import { getSupabaseClient } from '../auth/supabase';
import { readMobileEnv } from '../constants/env';
import { createApiClient } from './client';

type MobileApiClient = ReturnType<typeof createApiClient>;

let singletonClient: MobileApiClient | null = null;

function getPlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

function getAppVersion() {
  const fallback = 'dev';
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.trim().length > 0 ? version : fallback;
}

async function getSessionAccessToken(forceRefresh = false) {
  const supabase = getSupabaseClient();

  if (forceRefresh) {
    await supabase.auth.refreshSession().catch(() => null);
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return data.session?.access_token ?? null;
}

export function getMobileApiClient() {
  if (singletonClient) {
    return singletonClient;
  }

  const env = readMobileEnv();

  const config: ApiClientConfig = {
    baseUrl: env.EXPO_PUBLIC_API_BASE_URL,
    platform: getPlatform(),
    appVersion: getAppVersion(),
    getAccessToken: async (options) => getSessionAccessToken(Boolean(options?.forceRefresh)),
  };

  singletonClient = createApiClient(config);
  return singletonClient;
}
