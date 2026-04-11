begin;

create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_overlap_provider'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap_provider
      exclude using gist (
        provider_id with =,
        tstzrange(booking_start, booking_end, '[)') with &&
      )
      where (status in ('pending', 'confirmed'));
  end if;
end
$$;

create or replace function public.create_booking(
  p_user_id uuid,
  p_pet_id bigint,
  p_service_id bigint,
  p_booking_start timestamptz,
  p_payment_mode text,
  p_amount numeric
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_booking_end timestamptz;
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  if auth.uid() <> p_user_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select s.provider_id, s.duration_minutes, s.buffer_minutes
  into v_service
  from public.services s
  where s.id = p_service_id;

  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.pets p
    where p.id = p_pet_id
      and p.user_id = p_user_id
  ) then
    raise exception 'PET_OWNERSHIP_INVALID' using errcode = 'P0001';
  end if;

  v_booking_end := p_booking_start + make_interval(mins => (v_service.duration_minutes + v_service.buffer_minutes));

  perform pg_advisory_xact_lock(v_service.provider_id);

  if exists (
    select 1
    from public.bookings b
    where b.provider_id = v_service.provider_id
      and b.status in ('pending', 'confirmed')
      and tstzrange(b.booking_start, b.booking_end, '[)') && tstzrange(p_booking_start, v_booking_end, '[)')
  ) then
    raise exception 'BOOKING_OVERLAP' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    user_id,
    pet_id,
    provider_id,
    service_id,
    booking_start,
    booking_end,
    status,
    payment_mode,
    amount
  )
  values (
    p_user_id,
    p_pet_id,
    v_service.provider_id,
    p_service_id,
    p_booking_start,
    v_booking_end,
    'pending',
    p_payment_mode,
    p_amount
  )
  returning * into v_booking;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'BOOKING_OVERLAP' using errcode = 'P0001';
end;
$$;

grant execute on function public.create_booking(uuid, bigint, bigint, timestamptz, text, numeric) to authenticated;

commit;
