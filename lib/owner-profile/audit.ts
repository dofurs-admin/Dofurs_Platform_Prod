import type { SupabaseClient } from '@supabase/supabase-js';
type OwnerProfileSupabaseClient = SupabaseClient;

type OwnerProfileAuditRpcClient = {
  rpc: (
    fn: 'log_owner_profile_audit_event',
    args: {
      p_user_id: string;
      p_action: string;
      p_metadata: Record<string, unknown>;
    },
  ) => Promise<{ error: { message: string } | null }>;
};

export async function logOwnerProfileAudit(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const rpcSupabase = supabase as unknown as OwnerProfileAuditRpcClient;

  const { error } = await rpcSupabase.rpc('log_owner_profile_audit_event', {
    p_user_id: userId,
    p_action: action,
    p_metadata: metadata,
  });

  if (error) {
    throw error;
  }
}
