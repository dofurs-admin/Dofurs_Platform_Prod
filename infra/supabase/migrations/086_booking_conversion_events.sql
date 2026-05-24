begin;

create table if not exists public.booking_conversion_events (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  event_name text not null,
  conversion_label text not null,
  transaction_id text not null,
  status text not null default 'claimed',
  attempt_count integer not null default 0,
  value_inr numeric not null default 0,
  currency text not null default 'INR',
  metadata jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  fired_at timestamptz,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_conversion_events_provider_check check (length(trim(provider)) > 0),
  constraint booking_conversion_events_event_name_check check (length(trim(event_name)) > 0),
  constraint booking_conversion_events_conversion_label_check check (length(trim(conversion_label)) > 0),
  constraint booking_conversion_events_transaction_id_check check (length(trim(transaction_id)) > 0),
  constraint booking_conversion_events_status_check check (status in ('claimed', 'fired', 'skipped', 'failed')),
  constraint booking_conversion_events_attempt_count_check check (attempt_count >= 0),
  constraint booking_conversion_events_value_check check (value_inr >= 0),
  constraint booking_conversion_events_currency_check check (currency = 'INR'),
  constraint booking_conversion_events_unique unique (provider, event_name, booking_id, conversion_label)
);

create index if not exists idx_booking_conversion_events_booking
  on public.booking_conversion_events(booking_id, created_at desc);

create index if not exists idx_booking_conversion_events_user
  on public.booking_conversion_events(user_id, created_at desc);

create index if not exists idx_booking_conversion_events_status
  on public.booking_conversion_events(status, last_attempt_at desc);

create or replace function public.touch_booking_conversion_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_booking_conversion_events_updated_at on public.booking_conversion_events;
create trigger trg_booking_conversion_events_updated_at
before update on public.booking_conversion_events
for each row
execute function public.touch_booking_conversion_events_updated_at();

alter table public.booking_conversion_events enable row level security;

drop policy if exists booking_conversion_events_select_v1 on public.booking_conversion_events;
create policy booking_conversion_events_select_v1
on public.booking_conversion_events
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists booking_conversion_events_admin_manage_v1 on public.booking_conversion_events;
create policy booking_conversion_events_admin_manage_v1
on public.booking_conversion_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

commit;