import { queryClient } from '../lib/query-client';
import { useAuthStore } from '../store/auth-store';
import { useBookingDraftStore } from '../store/booking-draft-store';
import { getSupabaseClient } from './supabase';
export {
  isCustomerAppRole,
  isProviderAppRole,
  normalizeAppRole,
  requiresProfileSetupFromError,
  resolveProviderAppRoute,
} from './role-policy';
export type { SessionLifecycleDecision, SessionLike } from './session-lifecycle';
export { deriveSessionLifecycleDecision as deriveAuthSessionLifecycleDecision } from './session-lifecycle';

export async function signOutAndResetClientState() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut().catch(() => null);
  queryClient.clear();
  useBookingDraftStore.getState().clearDraft();
  useAuthStore.getState().clearSession();
}
