import type { SupabaseClient } from '@supabase/supabase-js';

const localBuckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetAt: number;
};

function checkLocalRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const current = localBuckets.get(key);

  if (!current || now >= current.resetAt) {
    localBuckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  current.count += 1;
  localBuckets.set(key, current);

  const remaining = Math.max(0, config.maxRequests - current.count);
  return {
    limited: current.count > config.maxRequests,
    remaining,
    resetAt: current.resetAt,
  };
}

export function isRateLimited(key: string, config: RateLimitConfig): RateLimitResult;
export function isRateLimited(
  supabase: SupabaseClient,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult>;
export function isRateLimited(
  supabaseOrKey: SupabaseClient | string,
  keyOrConfig: string | RateLimitConfig,
  maybeConfig?: RateLimitConfig,
): RateLimitResult | Promise<RateLimitResult> {
  if (typeof supabaseOrKey === 'string') {
    return checkLocalRateLimit(supabaseOrKey, keyOrConfig as RateLimitConfig);
  }

  return checkDistributedRateLimit(supabaseOrKey, keyOrConfig as string, maybeConfig as RateLimitConfig);
}

async function checkDistributedRateLimit(
  supabase: SupabaseClient,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const windowSeconds = Math.max(1, Math.floor(config.windowMs / 1000));
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max_requests: config.maxRequests,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
      return checkLocalRateLimit(key, config);
    }

    const row = data[0] as { limited?: boolean; remaining?: number; reset_at?: string };
    const resetAt = row.reset_at ? Date.parse(row.reset_at) : Date.now() + config.windowMs;

    return {
      limited: Boolean(row.limited),
      remaining: Number.isFinite(row.remaining) ? Number(row.remaining) : 0,
      resetAt,
    };
  } catch (err) { console.error(err);
    // Fail-open to local process limiter if DB RPC is unavailable.
    return checkLocalRateLimit(key, config);
  }
}

export function getRateLimitKey(scope: string, userId: string) {
  return `${scope}:${userId}`;
}
