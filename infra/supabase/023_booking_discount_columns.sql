begin;

alter table public.bookings
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0;

alter table public.bookings
  drop constraint if exists bookings_discount_amount_non_negative;

alter table public.bookings
  add constraint bookings_discount_amount_non_negative
  check (discount_amount >= 0);

create index if not exists idx_bookings_discount_code
  on public.bookings(discount_code)
  where discount_code is not null;

commit;
