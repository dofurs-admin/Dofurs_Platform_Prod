-- 060_cash_collection_rls_and_payment_transaction_write.sql
-- Purpose:
--   1. Add provider-read RLS on booking_payment_collections so providers can check
--      collection status for their own bookings via session-client queries.
--   2. Add service-role-only INSERT/UPDATE policies on booking_payment_collections and
--      payment_transactions (all writes go through server-side admin client - these
--      policies document intent and provide a safety net).
--   3. No functional change to existing owner policies.

begin;

-- ============================================================
-- booking_payment_collections
-- ============================================================

-- Providers may SELECT collection records for bookings they own.
drop policy if exists booking_payment_collections_provider_read on public.booking_payment_collections;
create policy booking_payment_collections_provider_read
  on public.booking_payment_collections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.providers p on p.id = b.provider_id
      where b.id = booking_payment_collections.booking_id
        and p.user_id = auth.uid()
    )
  );

-- Only service-role (admin client) may insert collection records.
-- This prevents session-client tampering while keeping server-side ops clean.
drop policy if exists booking_payment_collections_service_write on public.booking_payment_collections;
create policy booking_payment_collections_service_write
  on public.booking_payment_collections
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- payment_transactions
-- ============================================================

-- Only service-role may insert/update payment_transactions.
-- (Reads remain owner-restricted via existing policy.)
drop policy if exists payment_transactions_service_write on public.payment_transactions;
create policy payment_transactions_service_write
  on public.payment_transactions
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- billing_invoices / billing_invoice_items (same pattern)
-- ============================================================

drop policy if exists billing_invoices_service_write on public.billing_invoices;
create policy billing_invoices_service_write
  on public.billing_invoices
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists billing_invoice_items_service_write on public.billing_invoice_items;
create policy billing_invoice_items_service_write
  on public.billing_invoice_items
  for all
  to service_role
  using (true)
  with check (true);

commit;
