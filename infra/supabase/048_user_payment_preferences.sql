-- 048_user_payment_preferences.sql
-- Extends user_preferences with payment method defaults used by account settings.

begin;

alter table public.user_preferences
  add column if not exists preferred_payment_method text,
  add column if not exists preferred_upi_vpa text,
  add column if not exists billing_email text;

alter table public.user_preferences
  drop constraint if exists user_preferences_preferred_payment_method_check;

alter table public.user_preferences
  add constraint user_preferences_preferred_payment_method_check check (
    preferred_payment_method is null
    or preferred_payment_method in ('razorpay', 'upi', 'card', 'netbanking', 'wallet', 'cash')
  );

commit;
