begin;

drop type if exists public.booking_creation_response cascade;

create type public.booking_creation_response as (
  success boolean,
  booking_id bigint,
  user_id uuid,
  provider_id bigint,
  service_type text,
  booking_date date,
  start_time time,
  end_time time,
  booking_status text,
  base_price numeric,
  discount_code text,
  discount_amount numeric,
  add_on_total numeric,
  taxable_amount numeric,
  final_price numeric,
  payment_mode text,
  created_at timestamptz,
  error_code text,
  error_message text
);

create or replace function public.create_booking_atomic(
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
returns public.booking_creation_response
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.booking_creation_response;
  v_service record;
  v_duration integer;
  v_end_time time;
  v_booking public.bookings%rowtype;
  v_service_id uuid;
  v_discount record;
  v_discount_amount numeric := 0;
  v_add_on_total numeric := 0;
  v_final_price numeric;
  v_error_code text;
  v_error_message text;
begin
  v_response.success := false;
  v_response.error_code := null;
  v_response.error_message := null;

  begin
    if auth.uid() is null then
      v_error_code := 'UNAUTHORIZED';
      v_error_message := 'User not authenticated.';
      raise exception '%: %', v_error_code, v_error_message using errcode = '28000';
    end if;

    if auth.uid() <> p_user_id and not public.is_admin() and not public.is_provider_owner(p_provider_id) then
      v_error_code := 'FORBIDDEN';
      v_error_message := 'You do not have permission to create a booking for this user.';
      raise exception '%: %', v_error_code, v_error_message using errcode = '42501';
    end if;

    if not exists (select 1 from public.pets p where p.id = p_pet_id and p.user_id = p_user_id) then
      v_error_code := 'PET_OWNERSHIP_INVALID';
      v_error_message := 'Pet does not belong to this user.';
      raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
    end if;

    if p_booking_mode = 'home_visit' and (p_location_address is null or p_latitude is null or p_longitude is null) then
      v_error_code := 'HOME_VISIT_LOCATION_REQUIRED';
      v_error_message := 'Home visit bookings require address and geo coordinates.';
      raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
    end if;

    if p_booking_type = 'package' then
      if p_package_id is null then
        v_error_code := 'PACKAGE_REQUIRED';
        v_error_message := 'Package ID is required for package bookings.';
        raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
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
        v_error_code := 'PACKAGE_SERVICE_NOT_FOUND';
        v_error_message := 'No active service found for the selected package.';
        raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
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
      v_error_code := 'SERVICE_NOT_FOUND';
      v_error_message := 'Service not found or is inactive.';
      raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
    end if;

    v_duration := greatest(v_service.service_duration_minutes, 1);
    v_end_time := (p_start_time + make_interval(mins => v_duration))::time;

    perform pg_advisory_xact_lock(v_service.provider_id);

    if not exists (
      select 1
      from public.get_available_slots(v_service.provider_id, p_booking_date, v_duration) s
      where s.start_time = p_start_time
        and s.end_time = v_end_time
        and s.is_available = true
    ) then
      v_error_code := 'SLOT_UNAVAILABLE';
      v_error_message := 'Selected time slot is no longer available.';
      raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.bookings b
      where b.provider_id = v_service.provider_id
        and b.booking_date = p_booking_date
        and b.booking_status not in ('cancelled', 'no_show')
        and not (p_start_time >= b.end_time or p_start_time + make_interval(mins => v_duration) <= b.start_time)
    ) then
      v_error_code := 'BOOKING_CONFLICT';
      v_error_message := 'Slot already booked for this provider at the requested time.';
      raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
    end if;

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
        v_error_code := 'DISCOUNT_INVALID';
        v_error_message := 'Discount code is invalid or expired.';
        raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
      end if;

      if v_discount.applies_to_service_type is not null and lower(trim(v_discount.applies_to_service_type)) <> lower(trim(v_service.service_type)) then
        v_error_code := 'DISCOUNT_NOT_APPLICABLE';
        v_error_message := 'Discount code does not apply to this service type.';
        raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
      end if;

      if v_discount.min_booking_amount is not null and v_service.base_price < v_discount.min_booking_amount then
        v_error_code := 'DISCOUNT_MIN_AMOUNT_NOT_MET';
        v_error_message := 'Booking amount does not meet minimum discount requirement.';
        raise exception '%: %', v_error_code, v_error_message using errcode = 'P0001';
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

    v_response.success := true;
    v_response.booking_id := v_booking.id;
    v_response.user_id := v_booking.user_id;
    v_response.provider_id := v_booking.provider_id;
    v_response.service_type := v_booking.service_type;
    v_response.booking_date := v_booking.booking_date;
    v_response.start_time := v_booking.start_time;
    v_response.end_time := v_booking.end_time;
    v_response.booking_status := v_booking.booking_status;
    v_response.base_price := v_service.base_price;
    v_response.discount_code := v_booking.discount_code;
    v_response.discount_amount := v_discount_amount;
    v_response.add_on_total := v_add_on_total;
    v_response.taxable_amount := v_service.base_price;
    v_response.final_price := v_booking.final_price;
    v_response.payment_mode := v_booking.payment_mode;
    v_response.created_at := v_booking.created_at;

    return v_response;

  exception when others then
    if v_error_code is null then
      v_error_code := sqlstate;
      v_error_message := sqlerrm;
    end if;

    v_response.success := false;
    v_response.error_code := v_error_code;
    v_response.error_message := v_error_message;
    return v_response;
  end;
end;
$$;

grant execute on function public.create_booking_atomic(
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
