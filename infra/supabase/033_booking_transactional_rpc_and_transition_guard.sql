begin;

create or replace function public.booking_can_transition(
  p_current_status text,
  p_next_status text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_current_status = p_next_status then true
    when p_current_status = 'pending' and p_next_status in ('confirmed', 'cancelled') then true
    when p_current_status = 'confirmed' and p_next_status in ('completed', 'cancelled', 'no_show') then true
    else false
  end;
$$;

create or replace function public.validate_booking_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if public.booking_can_transition(old.booking_status, new.booking_status) then
    return new;
  end if;

  raise exception 'INVALID_BOOKING_TRANSITION:%->%', old.booking_status, new.booking_status using errcode = 'P0001';
end;
$$;

create or replace function public.create_booking_transactional_v1(
  p_user_id uuid,
  p_pet_id bigint,
  p_provider_id bigint,
  p_provider_service_id uuid default null,
  p_booking_type text default 'service',
  p_package_id uuid default null,
  p_booking_date date default null,
  p_start_time time default null,
  p_booking_mode text default 'home_visit',
  p_location_address text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_provider_notes text default null,
  p_payment_mode text default 'direct_to_provider',
  p_discount_code text default null,
  p_discount_amount numeric default null,
  p_final_price numeric default null,
  p_add_ons jsonb default '[]'::jsonb
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
  v_service_id uuid;
  v_discount record;
  v_discount_amount numeric := 0;
  v_add_on_total numeric := 0;
  v_final_price numeric;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  if auth.uid() <> p_user_id and not public.is_admin() and not public.is_provider_owner(p_provider_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pets p where p.id = p_pet_id and p.user_id = p_user_id
  ) then
    raise exception 'PET_OWNERSHIP_INVALID' using errcode = 'P0001';
  end if;

  if p_booking_mode = 'home_visit' and (p_location_address is null or p_latitude is null or p_longitude is null) then
    raise exception 'HOME_VISIT_LOCATION_REQUIRED' using errcode = 'P0001';
  end if;

  if p_booking_type = 'package' then
    if p_package_id is null then
      raise exception 'PACKAGE_REQUIRED' using errcode = 'P0001';
    end if;

    select ps.provider_service_id
      into v_service_id
    from public.package_services ps
    join public.provider_services psv
      on psv.id = ps.provider_service_id
     and psv.provider_id = p_provider_id
     and psv.is_active = true
    where ps.package_id = p_package_id
    order by ps.sequence_order asc
    limit 1;

    if v_service_id is null then
      raise exception 'PACKAGE_SERVICE_NOT_FOUND' using errcode = 'P0001';
    end if;
  else
    v_service_id := p_provider_service_id;
  end if;

  select
    ps.id,
    ps.provider_id,
    ps.service_type,
    coalesce(ps.service_duration_minutes, 30) as service_duration_minutes,
    ps.base_price
  into v_service
  from public.provider_services ps
  where ps.id = v_service_id
    and ps.provider_id = p_provider_id
    and ps.is_active = true;

  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0001';
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

  if p_discount_code is not null then
    select
      pd.id,
      pd.code,
      pd.discount_type,
      pd.discount_value,
      pd.max_discount_amount,
      pd.min_booking_amount,
      pd.applies_to_service_type,
      pd.first_booking_only
    into v_discount
    from public.platform_discounts pd
    where upper(pd.code) = upper(trim(p_discount_code))
      and pd.is_active = true
      and (pd.valid_from is null or pd.valid_from <= now())
      and (pd.valid_until is null or pd.valid_until >= now())
    limit 1;

    if v_discount.id is null then
      raise exception 'DISCOUNT_INVALID' using errcode = 'P0001';
    end if;

    if v_discount.applies_to_service_type is not null and lower(trim(v_discount.applies_to_service_type)) <> lower(trim(v_service.service_type)) then
      raise exception 'DISCOUNT_NOT_APPLICABLE' using errcode = 'P0001';
    end if;

    if v_discount.min_booking_amount is not null and v_service.base_price < v_discount.min_booking_amount then
      raise exception 'DISCOUNT_MIN_AMOUNT_NOT_MET' using errcode = 'P0001';
    end if;

    if v_discount.discount_type = 'percentage' then
      v_discount_amount := (v_service.base_price * v_discount.discount_value) / 100;
    else
      v_discount_amount := v_discount.discount_value;
    end if;

    if v_discount.max_discount_amount is not null then
      v_discount_amount := least(v_discount_amount, v_discount.max_discount_amount);
    end if;

    v_discount_amount := greatest(v_discount_amount, 0);
  elsif p_discount_amount is not null then
    v_discount_amount := greatest(p_discount_amount, 0);
  end if;

  if jsonb_typeof(p_add_ons) = 'array' then
    select coalesce(sum(coalesce(sa.price, 0) * greatest((addon.item->>'quantity')::integer, 1)), 0)
      into v_add_on_total
    from jsonb_array_elements(p_add_ons) as addon(item)
    join public.service_addons sa
      on sa.id = (addon.item->>'id')::uuid
     and sa.is_active = true;
  end if;

  v_final_price := coalesce(p_final_price, greatest(v_service.base_price + v_add_on_total - v_discount_amount, 0));

  insert into public.bookings (
    user_id,
    pet_id,
    provider_id,
    provider_service_id,
    service_id,
    service_type,
    package_id,
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
    payment_mode,
    discount_code,
    discount_amount,
    final_price
  )
  values (
    p_user_id,
    p_pet_id,
    v_service.provider_id,
    v_service.id,
    null,
    v_service.service_type,
    p_package_id,
    p_booking_date,
    p_start_time,
    v_end_time,
    p_booking_mode,
    p_location_address,
    p_latitude,
    p_longitude,
    'pending',
    'pending',
    v_final_price,
    v_service.base_price,
    v_final_price,
    p_provider_notes,
    p_payment_mode,
    case when p_discount_code is not null then upper(trim(p_discount_code)) else null end,
    v_discount_amount,
    v_final_price
  )
  returning * into v_booking;

  if v_discount.id is not null then
    insert into public.discount_redemptions (
      discount_id,
      booking_id,
      user_id,
      discount_amount
    )
    values (
      v_discount.id,
      v_booking.id,
      p_user_id,
      v_discount_amount
    );
  end if;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'BOOKING_OVERLAP' using errcode = 'P0001';
end;
$$;

grant execute on function public.create_booking_transactional_v1(
  uuid,
  bigint,
  bigint,
  uuid,
  text,
  uuid,
  date,
  time,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  jsonb
) to authenticated;

commit;
