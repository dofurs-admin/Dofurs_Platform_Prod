import Constants from 'expo-constants';
import { z } from 'zod';

const optionalPublicKeySchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).optional(),
);

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).optional(),
  EXPO_PUBLIC_RAZORPAY_KEY_ID: optionalPublicKeySchema,
  EXPO_PUBLIC_GOOGLE_MAPS_KEY: optionalPublicKeySchema,
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

type MobileFeature = 'razorpay' | 'google_maps';

const featureKeyMap: Record<MobileFeature, keyof MobileEnv> = {
  razorpay: 'EXPO_PUBLIC_RAZORPAY_KEY_ID',
  google_maps: 'EXPO_PUBLIC_GOOGLE_MAPS_KEY',
};

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a = -1, b = -1] = parts;

  if (a === 10) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  return false;
}

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function getAppEnvironment() {
  const appEnv = readProcessEnv().EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
  return appEnv === 'production' || appEnv === 'preview' || appEnv === 'development' ? appEnv : 'development';
}

function validateApiBaseUrl(urlString: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.');
  }

  const env = getAppEnvironment();
  const hostname = parsedUrl.hostname.trim().toLowerCase();
  const protocol = parsedUrl.protocol.toLowerCase();

  if (env !== 'development' && protocol !== 'https:') {
    throw new Error(
      `Invalid EXPO_PUBLIC_API_BASE_URL for ${env}: only HTTPS endpoints are allowed outside development.`,
    );
  }

  if (env !== 'development' && (isLocalHost(hostname) || isPrivateIpv4(hostname))) {
    throw new Error(
      `Invalid EXPO_PUBLIC_API_BASE_URL for ${env}: localhost and private/LAN hosts are only allowed in development.`,
    );
  }

  return urlString;
}

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
    EXPO_PUBLIC_API_BASE_URL: normalizeBaseUrl(validateApiBaseUrl(parsed.data.EXPO_PUBLIC_API_BASE_URL)),
  };
}

export function requireMobileFeatureEnv(feature: MobileFeature): string {
  const env = readMobileEnv();
  const key = featureKeyMap[feature];
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable for ${feature}: ${key}`);
  }

  return value;
}
