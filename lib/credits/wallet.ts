import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type CreditBalanceRow = {
  available_inr: number;
  lifetime_earned_inr: number;
  lifetime_used_inr: number;
  updated_at: string | null;
};

type CreditTransactionRow = {
  id: string;
  amount_inr: number;
  transaction_type: string;
  reference_id: string | null;
  notes: string | null;
  balance_after: number;
  created_at: string;
};

/** Returns the current credit balance for a user. Never throws — returns zeros on missing row. */
export async function getCreditBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditBalanceRow> {
  const { data, error } = await supabase
    .from('user_credit_balance')
    .select('available_inr, lifetime_earned_inr, lifetime_used_inr, updated_at')
    .eq('user_id', userId)
    .maybeSingle<CreditBalanceRow>();
  if (error) throw error;
  return data ?? { available_inr: 0, lifetime_earned_inr: 0, lifetime_used_inr: 0, updated_at: null };
}

/** Returns the last N credit wallet transactions for a user. */
export async function getCreditHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<CreditTransactionRow[]> {
  const { data, error } = await supabase
    .from('credit_wallet_transactions')
    .select('id, amount_inr, transaction_type, reference_id, notes, balance_after, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CreditTransactionRow[];
}

/**
 * Atomically grants credits to a user via a SECURITY DEFINER RPC.
 * Must only be called from server-side code.
 */
export async function grantCredits(
  userId: string,
  amountInr: number,
  transactionType: string,
  referenceId: string | null,
  notes: string,
): Promise<void> {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new Error(`grantCredits: amountInr must be a positive number (got ${amountInr})`);
  }
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc('grant_user_credits', {
    p_user_id: userId,
    p_amount_inr: amountInr,
    p_transaction_type: transactionType,
    p_reference_id: referenceId,
    p_notes: notes,
  });
  if (error) throw error;
}

/**
 * Atomically deducts credits from a user's wallet for a booking.
 * Throws if the user has insufficient balance.
 * Must only be called from server-side code.
 */
export async function deductCredits(
  userId: string,
  amountInr: number,
  bookingId: number,
): Promise<void> {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new Error(`deductCredits: amountInr must be a positive number (got ${amountInr})`);
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc('deduct_user_credits', {
    p_user_id: userId,
    p_amount_inr: amountInr,
    p_booking_id: bookingId,
    p_notes: null,
  });
  if (error) throw error;

  // The RPC returns a single row with (success, new_balance)
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) {
    const balance = result?.new_balance ?? 0;
    throw new Error(
      `Insufficient credit balance. Available: ₹${balance}, required: ₹${amountInr}.`,
    );
  }
}

/**
 * Atomically restores credits to a user's wallet when a booking is cancelled.
 * No-ops if amountInr is 0. Must only be called from server-side code.
 */
export async function restoreCredits(
  userId: string,
  amountInr: number,
  bookingId: number,
): Promise<void> {
  if (amountInr <= 0) return;
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc('restore_user_credits', {
    p_user_id: userId,
    p_amount_inr: amountInr,
    p_booking_id: bookingId,
  });
  if (error) throw error;
}
