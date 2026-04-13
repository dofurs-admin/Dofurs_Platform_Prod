import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { grantCredits } from '@/lib/credits/wallet';
import { getISTTimestamp } from '@/lib/utils/date';

export const REFERRAL_REWARD_INR = 500;
export const MONTHLY_REFERRAL_LIMIT = 5;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Returns the referral code row for a user, or null. */
export async function getReferralCode(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('code, total_referrals, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as { code: string; total_referrals: number; created_at: string } | null;
}

/**
 * Resolves a code string to the referrer's user_id.
 * Returns null when the code doesn't exist.
 */
export async function resolveReferralCode(supabase: SupabaseClient, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const { data, error } = await supabase
    .from('referral_codes')
    .select('user_id, code')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data as { user_id: string; code: string } | null;
}

/** Returns referral stats for a referrer user, including pending and monthly usage. */
export async function getReferralStats(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('referral_redemptions')
    .select('id, status, referee_user_id, referrer_credited_at, created_at')
    .eq('referrer_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const credited = rows.filter((r) => r.status === 'credited');
  const pendingFirstBooking = rows.filter((r) => r.status === 'pending_first_booking');

  // Monthly cap tracking — calendar month in UTC
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthlyUsed = rows.filter(
    (r) => r.created_at >= monthStart && r.status !== 'failed',
  ).length;

  return {
    total: rows.length,
    credited: credited.length,
    pendingFirstBooking: pendingFirstBooking.length,
    creditsEarned: credited.length * REFERRAL_REWARD_INR,
    monthlyUsed,
    monthlyRemaining: Math.max(0, MONTHLY_REFERRAL_LIMIT - monthlyUsed),
    redemptions: rows,
  };
}

/** Returns true if the user has already used a referral code. */
export async function hasRedeemedReferral(supabase: SupabaseClient, refereeUserId: string) {
  const { data, error } = await supabase
    .from('referral_redemptions')
    .select('id')
    .eq('referee_user_id', refereeUserId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

// ---------------------------------------------------------------------------
// Redemption at sign-up (server-side only — uses admin client)
// ---------------------------------------------------------------------------

/**
 * Processes a referral code at sign-up:
 *  1. Validates code and blocks self-referral
 *  2. Ensures referee hasn't already redeemed
 *  3. Enforces monthly cap (max 5 new referrals per referrer per month)
 *  4. Creates referral_redemptions row with status `pending_first_booking`
 *  5. Grants ₹500 to referee immediately (welcome credit)
 *  6. Increments referrer's total_referrals count
 *  7. Notifies referee
 *
 * Referrer receives ₹500 only after the referee completes their FIRST booking
 * (triggered via processReferrerRewardOnFirstBooking, called from the booking
 * completion flow).
 *
 * Returns { success, message }.
 * Must be called with a try/catch — a failed redemption must NOT block sign-up.
 */
export async function redeemReferralCode(
  refereeUserId: string,
  rawCode: string,
): Promise<{ success: boolean; message: string }> {
  const admin = getSupabaseAdminClient();
  const code = rawCode.trim().toUpperCase();

  // 1. Resolve code → referrer
  const codeRow = await resolveReferralCode(admin, code);
  if (!codeRow) {
    return { success: false, message: 'Invalid referral code.' };
  }

  const referrerUserId = codeRow.user_id;

  // 2. Block self-referral
  if (referrerUserId === refereeUserId) {
    return { success: false, message: 'You cannot use your own referral code.' };
  }

  // 3. Check the referee hasn't already redeemed
  const alreadyRedeemed = await hasRedeemedReferral(admin, refereeUserId);
  if (alreadyRedeemed) {
    return { success: false, message: 'Referral code already used.' };
  }

  // 4. Monthly cap: referrer can gain at most 5 new referrals per calendar month
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count: monthlyCount, error: countError } = await admin
    .from('referral_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referrerUserId)
    .gte('created_at', monthStart)
    .neq('status', 'failed');
  if (countError) throw countError;

  if ((monthlyCount ?? 0) >= MONTHLY_REFERRAL_LIMIT) {
    return {
      success: false,
      message: 'This referral code has reached its monthly limit. Please try again next month.',
    };
  }

  // 5. Create redemption record — starts as `pending_first_booking`
  //    Referrer reward is deferred until the referee completes their first booking.
  const { data: redemption, error: redemptionError } = await admin
    .from('referral_redemptions')
    .insert({
      referral_code: code,
      referrer_user_id: referrerUserId,
      referee_user_id: refereeUserId,
      status: 'pending_first_booking',
      referee_credited_at: getISTTimestamp(),
    })
    .select('id')
    .single<{ id: string }>();
  if (redemptionError) throw redemptionError;

  // 6. Grant ₹500 to referee immediately as a welcome credit
  await grantCredits(
    refereeUserId,
    REFERRAL_REWARD_INR,
    'referral_reward_referee',
    redemption.id,
    `Welcome credit from referral code ${code}`,
  );

  // 7. Atomically increment referrer's total_referrals (tracks code uses, not payouts)
  await admin.rpc('increment_referral_count', { p_user_id: referrerUserId });

  // 8. Notify referee (fire-and-forget)
  void (async () => {
    try {
      await admin.from('notifications').insert({
        user_id: refereeUserId,
        type: 'referral_welcome_credit',
        title: '₹500 Dofurs Credits Added!',
        body: `Welcome to Dofurs! ₹500 credits have been added to your wallet. Use them on any pet care booking.`,
        data: { amount_inr: REFERRAL_REWARD_INR },
      });
    } catch (err) {
      console.error('[referrals] referee notification failed (non-fatal):', err);
    }
  })();

  return { success: true, message: 'Referral redeemed successfully.' };
}

// ---------------------------------------------------------------------------
// Referrer reward — triggered on first booking completion
// ---------------------------------------------------------------------------

/**
 * Grants ₹500 to a referrer when the referee completes their first booking.
 *
 * Uses an atomic UPDATE (WHERE status = 'pending_first_booking') so that only
 * one concurrent call wins — preventing double-credit if two bookings complete
 * simultaneously for the same referee.
 *
 * Safe to call on every booking completion; no-ops if:
 *   - the referee never used a referral code
 *   - the referrer was already credited for a previous booking
 */
export async function processReferrerRewardOnFirstBooking(
  refereeUserId: string,
  bookingId: number,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  // Atomic claim: only the first completion wins the UPDATE
  const { data: redemption, error } = await admin
    .from('referral_redemptions')
    .update({
      status: 'credited',
      referrer_credited_at: getISTTimestamp(),
      completed_booking_id: bookingId,
    })
    .eq('referee_user_id', refereeUserId)
    .eq('status', 'pending_first_booking')
    .select('id, referrer_user_id, referral_code')
    .maybeSingle<{ id: string; referrer_user_id: string; referral_code: string }>();

  if (error) throw error;
  if (!redemption) return; // No pending redemption — nothing to do

  // Grant ₹500 to referrer
  await grantCredits(
    redemption.referrer_user_id,
    REFERRAL_REWARD_INR,
    'referral_reward_referrer',
    redemption.id,
    `Referral reward — your friend completed their first Dofurs booking`,
  );

  // Notify referrer (fire-and-forget)
  void (async () => {
    try {
      await admin.from('notifications').insert({
        user_id: redemption.referrer_user_id,
        type: 'referral_reward_credited',
        title: '₹500 Referral Reward Earned!',
        body: `Your referral just completed their first Dofurs booking! ₹500 credits have been added to your wallet.`,
        data: { amount_inr: REFERRAL_REWARD_INR, referral_code: redemption.referral_code },
      });
    } catch (err) {
      console.error('[referrals] referrer reward notification failed (non-fatal):', err);
    }
  })();
}
