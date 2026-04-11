begin;

create extension if not exists btree_gist;

do $$
begin
  begin
    alter type public.booking_status add value if not exists 'no_show';
  exception
    when undefined_object then
      null;
  end;
end
$$;

alter table public.bookings
  add column if not exists provider_service_id uuid references public.provider_services(id) on delete restrict,
  add column if not exists service_type text,
  add column if not exists booking_date date,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists booking_mode text,
  add column if not exists location_address text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists booking_status text,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_by text,
  add column if not exists price_at_booking numeric,
  add column if not exists admin_price_reference numeric,
  add column if not exists provider_notes text,
  add column if not exists internal_notes text,
  add column if not exists platform_fee numeric,
  add column if not exists provider_payout_status text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.bookings
  alter column payment_mode set default 'direct_to_provider';

update public.bookings b
set
  booking_date = coalesce(b.booking_date, (b.booking_start at time zone 'UTC')::date),
  start_time = coalesce(b.start_time, (b.booking_start at time zone 'UTC')::time),
  end_time = coalesce(b.end_time, (b.booking_end at time zone 'UTC')::time),
  booking_status = coalesce(b.booking_status, b.status::text),
  booking_mode = coalesce(b.booking_mode, 'home_visit'),
  price_at_booking = coalesce(b.price_at_booking, b.amount),
  admin_price_reference = coalesce(b.admin_price_reference, b.amount),
  service_type = coalesce(b.service_type, s.name)
from public.services s
where s.id = b.service_id;

update public.bookings
set
  booking_date = coalesce(booking_date, (booking_start at time zone 'UTC')::date),
  start_time = coalesce(start_time, (booking_start at time zone 'UTC')::time),
  end_time = coalesce(end_time, (booking_end at time zone 'UTC')::time),
  booking_status = coalesce(booking_status, status::text),
  booking_mode = coalesce(booking_mode, 'home_visit'),
  price_at_booking = coalesce(price_at_booking, amount),
  admin_price_reference = coalesce(admin_price_reference, amount);

update public.bookings b
set provider_service_id = candidate.provider_service_id,
    service_type = coalesce(b.service_type, candidate.service_type)
from (
  select distinct on (b2.id)
    b2.id as booking_id,
    ps.id as provider_service_id,
    ps.service_type
  from public.bookings b2
  join public.services s
    on s.id = b2.service_id
  join public.provider_services ps
    on ps.provider_id = s.provider_id
   and lower(ps.service_type) = lower(s.name)
  where b2.provider_service_id is null
  order by b2.id, ps.created_at asc
) candidate
where b.id = candidate.booking_id;

alter table public.bookings
  alter column booking_date set not null,
  alter column start_time set not null,
  alter column end_time set not null,
  alter column booking_status set default 'pending',
  alter column booking_status set not null,
  alter column booking_mode set default 'home_visit',
  alter column booking_mode set not null,
  alter column price_at_booking set default 0,
  alter column price_at_booking set not null,
  alter column admin_price_reference set default 0,
  alter column admin_price_reference set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_booking_mode_check_v2') then
    alter table public.bookings
      add constraint bookings_booking_mode_check_v2
      check (booking_mode in ('home_visit', 'clinic_visit', 'teleconsult'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_booking_status_check_v2') then
    alter table public.bookings
      add constraint bookings_booking_status_check_v2
      check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_cancellation_by_check_v2') then
    alter table public.bookings
      add constraint bookings_cancellation_by_check_v2
      check (cancellation_by is null or cancellation_by in ('user', 'provider', 'admin'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_time_window_check_v2') then
    alter table public.bookings
      add constraint bookings_time_window_check_v2
      check (end_time > start_time);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_mode_requirements_check_v2') then
    alter table public.bookings
      add constraint bookings_mode_requirements_check_v2
      check (
        booking_mode <> 'home_visit'
        or (
          location_address is not null
          and latitude is not null
          and longitude is not null
        )
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_payment_mode_check_v2') then
    alter table public.bookings
      add constraint bookings_payment_mode_check_v2
      check (payment_mode in ('direct_to_provider', 'platform', 'mixed'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_price_non_negative_check_v2') then
    alter table public.bookings
      add constraint bookings_price_non_negative_check_v2
      check (
        price_at_booking >= 0
        and admin_price_reference >= 0
        and (platform_fee is null or platform_fee >= 0)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_provider_payout_status_check_v2') then
    alter table public.bookings
      add constraint bookings_provider_payout_status_check_v2
      check (provider_payout_status is null or provider_payout_status in ('pending', 'paid', 'failed', 'waived'));
  end if;
end
$$;

create index if not exists idx_bookings_provider_date
  on public.bookings(provider_id, booking_date);
create index if not exists idx_bookings_booking_date
  on public.bookings(booking_date);
create index if not exists idx_bookings_booking_status
  on public.bookings(booking_status);
create index if not exists idx_bookings_user_id_v2
  on public.bookings(user_id);
create index if not exists idx_bookings_provider_service_id
  on public.bookings(provider_service_id);

create or replace function public.sync_booking_legacy_and_new_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.booking_status is null and new.status is not null then
    new.booking_status := new.status::text;
  end if;

  if new.status is null and new.booking_status is not null then
    new.status := new.booking_status::public.booking_status;
  end if;

  if new.booking_date is null and new.booking_start is not null then
    new.booking_date := (new.booking_start at time zone 'UTC')::date;
  end if;

  if new.start_time is null and new.booking_start is not null then
    new.start_time := (new.booking_start at time zone 'UTC')::time;
  end if;

  if new.end_time is null and new.booking_end is not null then
    new.end_time := (new.booking_end at time zone 'UTC')::time;
  end if;

  if new.booking_start is null and new.booking_date is not null and new.start_time is not null then
    new.booking_start := (new.booking_date + new.start_time) at time zone 'UTC';
  end if;

  if new.booking_end is null and new.booking_date is not null and new.end_time is not null then
    new.booking_end := (new.booking_date + new.end_time) at time zone 'UTC';
  end if;

  if new.price_at_booking is null and new.amount is not null then
    new.price_at_booking := new.amount;
  end if;

  if new.amount is null and new.price_at_booking is not null then
    new.amount := new.price_at_booking;
  end if;

  if new.admin_price_reference is null and new.price_at_booking is not null then
    new.admin_price_reference := new.price_at_booking;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_sync_booking_legacy_and_new_columns on public.bookings;
create trigger trg_sync_booking_legacy_and_new_columns
before insert or update on public.bookings
for each row
execute function public.sync_booking_legacy_and_new_columns();

create or replace function public.validate_booking_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.booking_status = old.booking_status then
    return new;
  end if;

  if old.booking_status = 'pending' and new.booking_status in ('confirmed', 'cancelled') then
    return new;
  end if;

  if old.booking_status = 'confirmed' and new.booking_status in ('completed', 'cancelled', 'no_show') then
    return new;
  end if;

  raise exception 'Invalid booking status transition: % -> %', old.booking_status, new.booking_status;
end;
$$;

drop trigger if exists trg_validate_booking_status_transition on public.bookings;
create trigger trg_validate_booking_status_transition
before update on public.bookings
for each row
execute function public.validate_booking_status_transition();

create or replace function public.ensure_no_booking_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.booking_status not in ('pending', 'confirmed') then
    return new;
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.provider_id = new.provider_id
      and b.booking_date = new.booking_date
      and b.booking_status in ('pending', 'confirmed')
      and b.id <> coalesce(new.id, -1)
      and b.start_time < new.end_time
      and new.start_time < b.end_time
  ) then
    raise exception 'BOOKING_OVERLAP' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_no_booking_overlap on public.bookings;
create trigger trg_ensure_no_booking_overlap
before insert or update on public.bookings
for each row
execute function public.ensure_no_booking_overlap();

alter table public.provider_availability
  add column if not exists slot_duration_minutes integer not null default 30,
  add column if not exists buffer_time_minutes integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_availability_slot_duration_check_v2') then
    alter table public.provider_availability
      add constraint provider_availability_slot_duration_check_v2
      check (slot_duration_minutes > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'provider_availability_buffer_duration_check_v2') then
    alter table public.provider_availability
      add constraint provider_availability_buffer_duration_check_v2
      check (buffer_time_minutes >= 0);
  end if;
end
$$;

create index if not exists idx_provider_availability_provider_day_active
  on public.provider_availability(provider_id, day_of_week, is_available);

create table if not exists public.provider_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null references public.providers(id) on delete cascade,
  blocked_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (provider_id, blocked_date)
);

create index if not exists idx_provider_blocked_dates_provider_date
  on public.provider_blocked_dates(provider_id, blocked_date);

alter table public.provider_blocked_dates enable row level security;

drop policy if exists provider_blocked_dates_manage_v1 on public.provider_blocked_dates;
create policy provider_blocked_dates_manage_v1
on public.provider_blocked_dates
for all
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

create or replace function public.get_available_slots(
  p_provider_id bigint,
  p_booking_date date,
  p_service_duration_minutes integer default 30
)
returns table (
  start_time time,
  end_time time,
  is_available boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_of_week integer;
  v_row record;
  v_cursor time;
  v_slot_minutes integer;
  v_step_minutes integer;
  v_slot_end time;
begin
  if exists (
    select 1
    from public.provider_blocked_dates pbd
    where pbd.provider_id = p_provider_id
      and pbd.blocked_date = p_booking_date
  ) then
    return;
  end if;

  v_day_of_week := extract(dow from p_booking_date);

  for v_row in
    select
      pa.start_time,
      pa.end_time,
      pa.slot_duration_minutes,
      pa.buffer_time_minutes
    from public.provider_availability pa
    where pa.provider_id = p_provider_id
      and pa.day_of_week = v_day_of_week
      and pa.is_available = true
    order by pa.start_time
  loop
    v_slot_minutes := greatest(coalesce(p_service_duration_minutes, v_row.slot_duration_minutes), v_row.slot_duration_minutes);
    v_step_minutes := v_slot_minutes + v_row.buffer_time_minutes;
    v_cursor := v_row.start_time;

    while (v_cursor + make_interval(mins => v_slot_minutes))::time <= v_row.end_time loop
      v_slot_end := (v_cursor + make_interval(mins => v_slot_minutes))::time;

      if not exists (
        select 1
        from public.bookings b
        where b.provider_id = p_provider_id
          and b.booking_date = p_booking_date
          and b.booking_status in ('pending', 'confirmed')
          and b.start_time < v_slot_end
          and v_cursor < b.end_time
      ) then
        start_time := v_cursor;
        end_time := v_slot_end;
        is_available := true;
        return next;
      end if;

      v_cursor := (v_cursor + make_interval(mins => v_step_minutes))::time;
    end loop;
  end loop;
end;
$$;

grant execute on function public.get_available_slots(bigint, date, integer) to authenticated, service_role;

drop policy if exists bookings_user_view on public.bookings;
drop policy if exists bookings_user_insert on public.bookings;
drop policy if exists bookings_user_cancel_or_admin on public.bookings;
drop policy if exists bookings_admin_delete on public.bookings;

create policy bookings_select_v2
on public.bookings
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_provider_owner(provider_id)
);

create policy bookings_insert_v2
on public.bookings
for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and p.user_id = auth.uid()
    )
  )
);

create policy bookings_update_v2
on public.bookings
for update
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_provider_owner(provider_id)
)
with check (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_provider_owner(provider_id)
);

create policy bookings_delete_admin_v2
on public.bookings
for delete
to authenticated
using (public.is_admin());

create or replace function public.enforce_booking_role_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.user_id is distinct from old.user_id
      or new.pet_id is distinct from old.pet_id
      or new.provider_id is distinct from old.provider_id
      or new.provider_service_id is distinct from old.provider_service_id
      or new.service_id is distinct from old.service_id
      or new.service_type is distinct from old.service_type
      or new.booking_date is distinct from old.booking_date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.booking_mode is distinct from old.booking_mode
      or new.location_address is distinct from old.location_address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.price_at_booking is distinct from old.price_at_booking
      or new.admin_price_reference is distinct from old.admin_price_reference
      or new.provider_notes is distinct from old.provider_notes
      or new.internal_notes is distinct from old.internal_notes
      or new.payment_mode is distinct from old.payment_mode
      or new.platform_fee is distinct from old.platform_fee
      or new.provider_payout_status is distinct from old.provider_payout_status then
      raise exception 'Users cannot modify booking financials or scheduling details';
    end if;

    if new.booking_status <> 'cancelled' then
      raise exception 'Users can only cancel their bookings';
    end if;

    if coalesce(new.cancellation_by, 'user') <> 'user' then
      raise exception 'User cancellation must set cancellation_by=user';
    end if;

    return new;
  end if;

  if public.is_provider_owner(old.provider_id) then
    if new.user_id is distinct from old.user_id
      or new.pet_id is distinct from old.pet_id
      or new.provider_id is distinct from old.provider_id
      or new.provider_service_id is distinct from old.provider_service_id
      or new.service_id is distinct from old.service_id
      or new.service_type is distinct from old.service_type
      or new.booking_date is distinct from old.booking_date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.booking_mode is distinct from old.booking_mode
      or new.location_address is distinct from old.location_address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.price_at_booking is distinct from old.price_at_booking
      or new.admin_price_reference is distinct from old.admin_price_reference
      or new.internal_notes is distinct from old.internal_notes
      or new.payment_mode is distinct from old.payment_mode
      or new.platform_fee is distinct from old.platform_fee
      or new.provider_payout_status is distinct from old.provider_payout_status then
      raise exception 'Providers cannot modify booking identity, financials or schedule';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update booking';
end;
$$;

drop trigger if exists trg_enforce_booking_role_updates on public.bookings;
create trigger trg_enforce_booking_role_updates
before update on public.bookings
for each row
execute function public.enforce_booking_role_updates();

create or replace function public.create_booking_v2(
  p_user_id uuid,
  p_pet_id bigint,
  p_provider_id bigint,
  p_provider_service_id uuid,
  p_booking_date date,
  p_start_time time,
  p_booking_mode text,
  p_location_address text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_provider_notes text default null,
  p_payment_mode text default 'direct_to_provider'
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_duration integer;
  v_end_time time;
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  if auth.uid() <> p_user_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.pets p
    where p.id = p_pet_id
      and p.user_id = p_user_id
  ) then
    raise exception 'PET_OWNERSHIP_INVALID' using errcode = 'P0001';
  end if;

  select
    ps.id,
    ps.provider_id,
    ps.service_type,
    coalesce(ps.service_duration_minutes, 30) as service_duration_minutes,
    ps.base_price
  into v_service
  from public.provider_services ps
  where ps.id = p_provider_service_id
    and ps.provider_id = p_provider_id
    and ps.is_active = true;

  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_booking_mode = 'home_visit' and (p_location_address is null or p_latitude is null or p_longitude is null) then
    raise exception 'HOME_VISIT_LOCATION_REQUIRED' using errcode = 'P0001';
  end if;

  v_duration := greatest(v_service.service_duration_minutes, 1);
  v_end_time := (p_start_time + make_interval(mins => v_duration))::time;

  if not exists (
    select 1
    from public.get_available_slots(v_service.provider_id, p_booking_date, v_duration) s
    where s.start_time = p_start_time
      and s.end_time = v_end_time
  ) then
    raise exception 'BOOKING_OVERLAP' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(v_service.provider_id);

  insert into public.bookings (
    user_id,
    pet_id,
    provider_id,
    provider_service_id,
    service_id,
    service_type,
    booking_date,
    start_time,
    end_time,
    booking_mode,
    location_address,
    latitude,
    longitude,
    booking_status,
    status,
    price_at_booking,
    admin_price_reference,
    amount,
    provider_notes,
    payment_mode
  )
  values (
    p_user_id,
    p_pet_id,
    v_service.provider_id,
    v_service.id,
    null,
    v_service.service_type,
    p_booking_date,
    p_start_time,
    v_end_time,
    p_booking_mode,
    p_location_address,
    p_latitude,
    p_longitude,
    'pending',
    'pending',
    v_service.base_price,
    v_service.base_price,
    v_service.base_price,
    p_provider_notes,
    p_payment_mode
  )
  returning * into v_booking;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'BOOKING_OVERLAP' using errcode = 'P0001';
end;
$$;

grant execute on function public.create_booking_v2(uuid, bigint, bigint, uuid, date, time, text, text, numeric, numeric, text, text)
to authenticated;

commit;