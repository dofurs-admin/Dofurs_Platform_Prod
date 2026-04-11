import type { SupabaseClient } from '@supabase/supabase-js';

export async function acquireDistributedLock(
  supabase: SupabaseClient,
  input: {
    lockKey: string;
    holder: string;
    ttlSeconds?: number;
  },
): Promise<boolean> {
  const { data, error } = await supabase.rpc('try_acquire_automation_lock', {
    p_lock_key: input.lockKey,
    p_holder: input.holder,
    p_ttl_seconds: input.ttlSeconds ?? 600,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function releaseDistributedLock(
  supabase: SupabaseClient,
  input: {
    lockKey: string;
    holder: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc('release_automation_lock', {
    p_lock_key: input.lockKey,
    p_holder: input.holder,
  });

  if (error) {
    throw error;
  }
}
