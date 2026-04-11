begin;

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

  if auth.uid() <> p_user_id and not public.is_admin() and not public.is_provider_owner(p_provider_id) then
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