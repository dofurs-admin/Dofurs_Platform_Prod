import Constants from 'expo-constants';
import { z } from 'zod';

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
  EXPO_PUBLIC_RAZORPAY_KEY_ID: z.string().min(1),
  EXPO_PUBLIC_GOOGLE_MAPS_KEY: z.string().min(1),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function readProcessEnv() {
  const candidate = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return candidate?.env ?? {};
}

export function readMobileEnv(): MobileEnv {
  const source = {
    ...Constants.expoConfig?.extra,
    ...readProcessEnv(),
  };

  const parsed = mobileEnvSchema.safeParse(source);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid mobile environment configuration: ${message}`);
  }

  return {
    ...parsed.data,
    EXPO_PUBLIC_API_BASE_URL: normalizeBaseUrl(parsed.data.EXPO_PUBLIC_API_BASE_URL),
  };
}
