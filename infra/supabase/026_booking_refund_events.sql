begin;

create extension if not exists pgcrypto;

create table if not exists public.booking_refund_events (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  refund_amount numeric,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint booking_refund_events_amount_check
    check (refund_amount is null or refund_amount >= 0)
);

create index if not exists idx_booking_refund_events_booking_created
  on public.booking_refund_events(booking_id, created_at desc);
create index if not exists idx_booking_refund_events_actor_created
  on public.booking_refund_events(actor_id, created_at desc);

alter table public.booking_refund_events enable row level security;

drop policy if exists booking_refund_events_select_admin_v1 on public.booking_refund_events;
create policy booking_refund_events_select_admin_v1
on public.booking_refund_events
for select
to authenticated
using (public.is_admin());

drop policy if exists booking_refund_events_insert_admin_v1 on public.booking_refund_events;
create policy booking_refund_events_insert_admin_v1
on public.booking_refund_events
for insert
to authenticated
with check (public.is_admin());

commit;
