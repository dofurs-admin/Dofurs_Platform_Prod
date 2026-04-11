begin;

-- Add optional time-window columns to provider_blocked_dates.
-- When both are NULL  → the entire day is blocked (existing behaviour).
-- When both are set   → only that time window is blocked on that day.
alter table public.provider_blocked_dates
  add column if not exists block_start_time time,
  add column if not exists block_end_time   time;

-- Both must be provided together, and end must be after start.
alter table public.provider_blocked_dates
  add constraint provider_blocked_dates_time_pair_check
    check (
      (block_start_time is null) = (block_end_time is null)
    ),
  add constraint provider_blocked_dates_time_order_check
    check (
      block_end_time is null or block_end_time > block_start_time
    );

comment on column public.provider_blocked_dates.block_start_time is
  'Start of the blocked time window. NULL means the whole day is blocked.';
comment on column public.provider_blocked_dates.block_end_time is
  'End of the blocked time window. NULL means the whole day is blocked.';

-- Replace get_available_slots() to honour partial-day blocks.
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
  -- Full-day block: any entry with no time window → return nothing.
  if exists (
    select 1
    from public.provider_blocked_dates pbd
    where pbd.provider_id = p_provider_id
      and pbd.blocked_date = p_booking_date
      and pbd.block_start_time is null
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

      -- Skip slots that overlap with a time-windowed block.
      if exists (
        select 1
        from public.provider_blocked_dates pbd
        where pbd.provider_id = p_provider_id
          and pbd.blocked_date = p_booking_date
          and pbd.block_start_time is not null
          and v_cursor < pbd.block_end_time
          and v_slot_end > pbd.block_start_time
      ) then
        v_cursor := (v_cursor + make_interval(mins => v_step_minutes))::time;
        continue;
      end if;

      -- Skip slots with a booking overlap.
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

commit;
