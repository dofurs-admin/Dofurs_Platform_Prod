import type { SupabaseClient } from '@supabase/supabase-js';

export async function getProviderIdByUserId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: number }>();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}
