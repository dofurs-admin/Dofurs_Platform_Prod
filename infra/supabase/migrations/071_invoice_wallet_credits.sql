-- Migration 071: Track Dofurs wallet credits on invoices
--
-- Adds wallet_credits_applied_inr to billing_invoices so admins can see
-- how much was paid via wallet credits vs. actual cash/online payment.
-- total_inr remains the NET amount charged after credits are deducted.

ALTER TABLE billing_invoices
  ADD COLUMN IF NOT EXISTS wallet_credits_applied_inr INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN billing_invoices.wallet_credits_applied_inr
  IS 'Amount of Dofurs wallet credits deducted from this invoice. total_inr = subtotal_inr - discount_inr - wallet_credits_applied_inr.';

CREATE INDEX IF NOT EXISTS idx_billing_invoices_wallet_credits
  ON billing_invoices(wallet_credits_applied_inr)
  WHERE wallet_credits_applied_inr > 0;
