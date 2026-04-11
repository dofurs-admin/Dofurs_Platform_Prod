begin;

create extension if not exists pgcrypto;

create table if not exists public.booking_status_transition_events (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  from_status text not null,
  to_status text not null,
  cancellation_by text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_status_transition_events_booking_created
  on public.booking_status_transition_events(booking_id, created_at desc);

create index if not exists idx_booking_status_transition_events_actor_created
  on public.booking_status_transition_events(actor_id, created_at desc);

create index if not exists idx_booking_status_transition_events_to_status_created
  on public.booking_status_transition_events(to_status, created_at desc);

alter table public.booking_status_transition_events enable row level security;

drop policy if exists booking_status_transition_events_select_admin_v1 on public.booking_status_transition_events;
create policy booking_status_transition_events_select_admin_v1
on public.booking_status_transition_events
for select
to authenticated
using (public.is_admin());

drop policy if exists booking_status_transition_events_insert_authenticated_v1 on public.booking_status_transition_events;
create policy booking_status_transition_events_insert_authenticated_v1
on public.booking_status_transition_events
for insert
to authenticated
with check (
  actor_id is null
  or actor_id = auth.uid()
  or public.is_admin()
);

commit;
