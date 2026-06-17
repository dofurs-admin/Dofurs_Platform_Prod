create or replace function public.validate_booking_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed_transitions text[];
  is_admin_override boolean := (
    auth.role() = 'service_role'
    or coalesce(public.current_role_name() in ('admin', 'staff'), false)
    or current_user in ('postgres', 'supabase_admin')
    or session_user in ('postgres', 'supabase_admin')
  );
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.booking_status = old.booking_status then
    return new;
  end if;

  if is_admin_override then
    return new;
  end if;

  case old.booking_status
    when 'pending' then
      allowed_transitions := array['confirmed', 'cancelled'];
    when 'confirmed' then
      allowed_transitions := array['in_progress', 'completed', 'cancelled', 'no_show'];
    when 'in_progress' then
      allowed_transitions := array['completed', 'cancelled'];
    when 'completed' then
      allowed_transitions := array[]::text[];
    when 'cancelled' then
      allowed_transitions := array[]::text[];
    when 'no_show' then
      allowed_transitions := array['cancelled'];
    else
      allowed_transitions := array[]::text[];
  end case;

  if new.booking_status = any(allowed_transitions) then
    return new;
  end if;

  raise exception 'INVALID_BOOKING_TRANSITION:%->%', old.booking_status, new.booking_status using errcode = 'P0001';
end;
$$;
