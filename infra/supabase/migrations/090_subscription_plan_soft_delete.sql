begin;

alter table if exists public.subscription_plans
  add column if not exists deleted_at timestamptz;

alter table if exists public.subscription_plans
  drop constraint if exists subscription_plans_code_key;

drop index if exists public.subscription_plans_code_key;

create unique index if not exists idx_subscription_plans_code_not_deleted
  on public.subscription_plans (code)
  where deleted_at is null;

create index if not exists idx_subscription_plans_visible_price
  on public.subscription_plans (price_inr)
  where deleted_at is null;

commit;