begin;

alter table public.platform_discounts
  add column if not exists first_booking_only boolean not null default false;

create index if not exists idx_platform_discounts_first_booking_only
  on public.platform_discounts(first_booking_only, is_active);

commit;
