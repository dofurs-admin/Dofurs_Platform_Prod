-- Migration 070: Referral abuse-prevention rules
--
-- Rule 1: Referrer only receives ₹500 when the referee completes their FIRST
--         booking (not at sign-up time).  The redemption row now starts life
--         as `pending_first_booking` and moves to `credited` once triggered.
--
-- Rule 2: A referrer can accept at most 5 new referrals per calendar month.
--         Checked at code-use time in the service layer.

-- ─── 1. Add `pending_first_booking` to the status enum ─────────────────────

ALTER TABLE referral_redemptions
  DROP CONSTRAINT IF EXISTS referral_redemptions_status_check;

ALTER TABLE referral_redemptions
  ADD CONSTRAINT referral_redemptions_status_check
  CHECK (status IN ('pending', 'pending_first_booking', 'credited', 'failed'));

-- ─── 2. Track which booking triggered the referrer reward ──────────────────

ALTER TABLE referral_redemptions
  ADD COLUMN IF NOT EXISTS completed_booking_id bigint REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_pending
  ON referral_redemptions(referee_user_id)
  WHERE status = 'pending_first_booking';
