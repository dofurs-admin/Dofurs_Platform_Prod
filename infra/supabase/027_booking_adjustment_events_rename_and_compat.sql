begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.booking_adjustment_events') is null then
    if to_regclass('public.booking_refund_events') is not null then
      alter table public.booking_refund_events rename to booking_adjustment_events;
    else
      create table public.booking_adjustment_events (
        id uuid primary key default gen_random_uuid(),
        booking_id bigint not null references public.bookings(id) on delete cascade,
        actor_id uuid references auth.users(id) on delete set null,
        adjustment_amount numeric,
        reason text,
        metadata jsonb not null default '{}'::jsonb,
        adjustment_type text not null default 'cancellation_adjustment',
        created_at timestamptz not null default now(),
        constraint booking_adjustment_events_amount_check
          check (adjustment_amount is null or adjustment_amount >= 0)
      );
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_adjustment_events'
      and column_name = 'refund_amount'
  ) then
    execute 'alter table public.booking_adjustment_events add column if not exists adjustment_amount numeric';
    execute 'update public.booking_adjustment_events set adjustment_amount = coalesce(adjustment_amount, refund_amount)';
    execute 'alter table public.booking_adjustment_events drop column refund_amount';
  end if;
end $$;

alter table public.booking_adjustment_events
  add column if not exists adjustment_amount numeric,
  add column if not exists adjustment_type text not null default 'cancellation_adjustment';

alter table public.booking_adjustment_events
  drop constraint if exists booking_adjustment_events_amount_check;

alter table public.booking_adjustment_events
  add constraint booking_adjustment_events_amount_check
  check (adjustment_amount is null or adjustment_amount >= 0);

create index if not exists idx_booking_adjustment_events_booking_created
  on public.booking_adjustment_events(booking_id, created_at desc);
create index if not exists idx_booking_adjustment_events_actor_created
  on public.booking_adjustment_events(actor_id, created_at desc);
create index if not exists idx_booking_adjustment_events_type_created
  on public.booking_adjustment_events(adjustment_type, created_at desc);

alter table public.booking_adjustment_events enable row level security;

drop policy if exists booking_adjustment_events_select_admin_v1 on public.booking_adjustment_events;
create policy booking_adjustment_events_select_admin_v1
on public.booking_adjustment_events
for select
to authenticated
using (public.is_admin());

drop policy if exists booking_adjustment_events_insert_admin_v1 on public.booking_adjustment_events;
create policy booking_adjustment_events_insert_admin_v1
on public.booking_adjustment_events
for insert
to authenticated
with check (public.is_admin());

create or replace view public.booking_refund_events as
select
  id,
  booking_id,
  actor_id,
  adjustment_amount as refund_amount,
  reason,
  metadata,
  created_at
from public.booking_adjustment_events;

create or replace function public.booking_refund_events_compat_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.booking_adjustment_events (
    booking_id,
    actor_id,
    adjustment_amount,
    reason,
    metadata,
    adjustment_type,
    created_at
  )
  values (
    new.booking_id,
    new.actor_id,
    new.refund_amount,
    new.reason,
    coalesce(new.metadata, '{}'::jsonb),
    'legacy_refund_compat',
    coalesce(new.created_at, now())
  )
  returning id into v_id;

  new.id := v_id;
  return new;
end;
$$;

drop trigger if exists trg_booking_refund_events_compat_insert on public.booking_refund_events;
create trigger trg_booking_refund_events_compat_insert
instead of insert on public.booking_refund_events
for each row
execute function public.booking_refund_events_compat_insert();

commit;
