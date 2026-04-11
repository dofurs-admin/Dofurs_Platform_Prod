-- Migration 069: Atomic credit operations + referral counter + RLS hardening
-- Replaces read-modify-write patterns with single-statement SQL to prevent
-- race conditions (TOCTOU overdraft, lost credits, double-counted referrals).

-- ─── 1. Fix RLS enumeration vulnerability on referral_codes ────────────────
--   Migration 068 created a `referral_codes_select_any` policy with USING (true),
--   allowing any authenticated user to enumerate all code rows.
--   We drop it and rely on the service_role policy for server-side validation.
--   Users can only read their OWN row through RLS; the validate API route runs
--   under the admin (service_role) client which bypasses RLS entirely.

DROP POLICY IF EXISTS "referral_codes_select_any" ON referral_codes;

-- Users can still read their own code row (for the Refer & Earn page)
CREATE POLICY "referral_codes_select_own"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);


-- ─── 2. Extend transaction_type check to include new atomic types ───────────
--   The existing CHECK on credit_wallet_transactions.transaction_type must
--   include the types used by the RPCs below.  We add missing values.

ALTER TABLE credit_wallet_transactions
  DROP CONSTRAINT IF EXISTS credit_wallet_transactions_transaction_type_check;

ALTER TABLE credit_wallet_transactions
  ADD CONSTRAINT credit_wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'referral_reward_referrer',
    'referral_reward_referee',
    'booking_applied',
    'booking_refunded',
    'admin_grant',
    'admin_deduct',
    'expired'
  ));


-- ─── 3. Atomic grant_user_credits RPC ──────────────────────────────────────

CREATE OR REPLACE FUNCTION grant_user_credits(
  p_user_id          uuid,
  p_amount_inr       integer,
  p_transaction_type text,
  p_reference_id     uuid    DEFAULT NULL,
  p_notes            text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_available integer;
BEGIN
  IF p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'grant amount must be positive, got %', p_amount_inr;
  END IF;

  -- Atomically upsert balance: insert or add to existing row
  INSERT INTO user_credit_balance
    (user_id, available_inr, lifetime_earned_inr, lifetime_used_inr, updated_at)
  VALUES
    (p_user_id, p_amount_inr, p_amount_inr, 0, now())
  ON CONFLICT (user_id) DO UPDATE
    SET available_inr       = user_credit_balance.available_inr + p_amount_inr,
        lifetime_earned_inr = user_credit_balance.lifetime_earned_inr + p_amount_inr,
        updated_at          = now()
  RETURNING available_inr INTO v_new_available;

  -- Immutable transaction record
  INSERT INTO credit_wallet_transactions
    (user_id, amount_inr, transaction_type, reference_id, notes, balance_after, created_at)
  VALUES
    (p_user_id, p_amount_inr, p_transaction_type, p_reference_id, p_notes, v_new_available, now());
END;
$$;


-- ─── 4. Atomic deduct_user_credits RPC ─────────────────────────────────────
--   Single UPDATE with inline balance guard; returns (success, new_balance).
--   If balance is insufficient the UPDATE finds no row and success=false is
--   returned — the caller must treat this as an error.

CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id    uuid,
  p_amount_inr integer,
  p_booking_id bigint,
  p_notes      text DEFAULT NULL
)
RETURNS TABLE(success boolean, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_available integer;
BEGIN
  IF p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'deduct amount must be positive, got %', p_amount_inr;
  END IF;

  UPDATE user_credit_balance
  SET    available_inr     = available_inr - p_amount_inr,
         lifetime_used_inr = lifetime_used_inr + p_amount_inr,
         updated_at        = now()
  WHERE  user_id           = p_user_id
    AND  available_inr    >= p_amount_inr
  RETURNING available_inr INTO v_new_available;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT false,
             COALESCE(
               (SELECT available_inr FROM user_credit_balance WHERE user_id = p_user_id),
               0
             );
    RETURN;
  END IF;

  INSERT INTO credit_wallet_transactions
    (user_id, amount_inr, transaction_type, reference_id, notes, balance_after, created_at)
  VALUES
    (p_user_id, -p_amount_inr, 'booking_applied',
     NULL,
     COALESCE(p_notes, 'Applied to booking #' || p_booking_id::text),
     v_new_available, now());

  RETURN QUERY SELECT true, v_new_available;
END;
$$;


-- ─── 5. Atomic restore_user_credits RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION restore_user_credits(
  p_user_id    uuid,
  p_amount_inr integer,
  p_booking_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_available integer;
BEGIN
  IF p_amount_inr <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO user_credit_balance
    (user_id, available_inr, lifetime_earned_inr, lifetime_used_inr, updated_at)
  VALUES
    (p_user_id, p_amount_inr, 0, 0, now())
  ON CONFLICT (user_id) DO UPDATE
    SET available_inr     = user_credit_balance.available_inr + p_amount_inr,
        lifetime_used_inr = GREATEST(0, user_credit_balance.lifetime_used_inr - p_amount_inr),
        updated_at        = now()
  RETURNING available_inr INTO v_new_available;

  INSERT INTO credit_wallet_transactions
    (user_id, amount_inr, transaction_type, reference_id, notes, balance_after, created_at)
  VALUES
    (p_user_id, p_amount_inr, 'booking_refunded',
     NULL,
     'Credits restored — booking #' || p_booking_id::text || ' cancelled',
     v_new_available, now());
END;
$$;


-- ─── 6. Atomic increment_referral_count RPC ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_referral_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
  SET    total_referrals = total_referrals + 1
  WHERE  user_id = p_user_id;
END;
$$;


-- ─── 7. Grant execute to service_role ──────────────────────────────────────
GRANT EXECUTE ON FUNCTION grant_user_credits(uuid, integer, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_user_credits(uuid, integer, bigint, text)     TO service_role;
GRANT EXECUTE ON FUNCTION restore_user_credits(uuid, integer, bigint)          TO service_role;
GRANT EXECUTE ON FUNCTION increment_referral_count(uuid)                       TO service_role;
