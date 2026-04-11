begin;

create extension if not exists pgcrypto;

create table if not exists public.platform_discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'flat')),
  discount_value numeric not null check (discount_value > 0),
  max_discount_amount numeric,
  min_booking_amount numeric,
  applies_to_service_type text,
  valid_from timestamptz not null,
  valid_until timestamptz,
  usage_limit_total integer,
  usage_limit_per_user integer,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_discounts_percentage_limit_check
    check (discount_type <> 'percentage' or discount_value <= 100),
  constraint platform_discounts_max_discount_check
    check (max_discount_amount is null or max_discount_amount > 0),
  constraint platform_discounts_min_booking_check
    check (min_booking_amount is null or min_booking_amount >= 0),
  constraint platform_discounts_usage_limit_total_check
    check (usage_limit_total is null or usage_limit_total > 0),
  constraint platform_discounts_usage_limit_per_user_check
    check (usage_limit_per_user is null or usage_limit_per_user > 0),
  constraint platform_discounts_validity_window_check
    check (valid_until is null or valid_until > valid_from)
);

create index if not exists idx_platform_discounts_active_window
  on public.platform_discounts(is_active, valid_from, valid_until);
create index if not exists idx_platform_discounts_code
  on public.platform_discounts(code);
create index if not exists idx_platform_discounts_service_type
  on public.platform_discounts(applies_to_service_type);

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.platform_discounts(id) on delete cascade,
  booking_id bigint references public.bookings(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  discount_amount numeric not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_discount_redemptions_discount_created
  on public.discount_redemptions(discount_id, created_at desc);
create index if not exists idx_discount_redemptions_user_created
  on public.discount_redemptions(user_id, created_at desc);

create index if not exists idx_discount_redemptions_booking
  on public.discount_redemptions(booking_id);

create unique index if not exists uq_discount_redemptions_booking
  on public.discount_redemptions(booking_id)
  where booking_id is not null;

drop trigger if exists trg_platform_discounts_set_updated_at on public.platform_discounts;
create trigger trg_platform_discounts_set_updated_at
before update on public.platform_discounts
for each row
execute function public.set_updated_at();

alter table public.platform_discounts enable row level security;
alter table public.discount_redemptions enable row level security;

drop policy if exists platform_discounts_select_v1 on public.platform_discounts;
create policy platform_discounts_select_v1
on public.platform_discounts
for select
to authenticated
using (public.is_admin());

drop policy if exists platform_discounts_manage_v1 on public.platform_discounts;
create policy platform_discounts_manage_v1
on public.platform_discounts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists discount_redemptions_select_v1 on public.discount_redemptions;
create policy discount_redemptions_select_v1
on public.discount_redemptions
for select
to authenticated
using (public.is_admin());

drop policy if exists discount_redemptions_insert_v1 on public.discount_redemptions;
create policy discount_redemptions_insert_v1
on public.discount_redemptions
for insert
to authenticated
with check (public.is_admin());

commit;
