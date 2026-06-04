create or replace function public.admin_search_bookings(
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 200
)
returns table (
  id bigint,
  user_id uuid,
  provider_id bigint,
  booking_start timestamptz,
  booking_date date,
  start_time time,
  end_time time,
  status text,
  booking_status text,
  booking_mode text,
  service_type text,
  customer_name text,
  customer_email text,
  customer_phone text,
  provider_name text,
  completion_task_status text,
  completion_due_at timestamptz,
  completion_completed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select nullif(btrim(p_query), '') as q,
      case
        when p_filter in ('all', 'sla', 'high-risk', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show') then p_filter
        else 'all'
      end as filter_key,
      greatest(1, least(coalesce(p_limit, 200), 500)) as result_limit
  )
  select
    b.id,
    b.user_id,
    b.provider_id,
    b.booking_start,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.status::text as status,
    b.booking_status::text as booking_status,
    b.booking_mode::text as booking_mode,
    b.service_type,
    u.name as customer_name,
    u.email as customer_email,
    u.phone as customer_phone,
    p.name as provider_name,
    t.task_status as completion_task_status,
    t.due_at as completion_due_at,
    t.completed_at as completion_completed_at
  from public.bookings b
  left join public.users u on u.id = b.user_id
  left join public.providers p on p.id = b.provider_id
  left join public.provider_booking_completion_tasks t on t.booking_id = b.id
  cross join normalized n
  where
    (
      n.filter_key = 'all'
      or (
        n.filter_key = 'sla'
        and (
          b.booking_status = 'pending'
          or (b.booking_status is null and b.status = 'pending')
        )
      )
      or (
        n.filter_key = 'high-risk'
        and (
          b.booking_status in ('cancelled', 'no_show')
          or (b.booking_status is null and b.status in ('cancelled', 'no_show'))
        )
      )
      or (
        n.filter_key in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
        and coalesce(b.booking_status::text, b.status::text) = n.filter_key
      )
    )
    and (
      n.q is null
      or b.id::text = n.q
      or b.user_id::text = n.q
      or b.provider_id::text = n.q
      or b.id::text ilike '%' || n.q || '%'
      or b.user_id::text ilike '%' || n.q || '%'
      or b.provider_id::text ilike '%' || n.q || '%'
      or lower(coalesce(u.name, '')) ilike '%' || lower(n.q) || '%'
      or lower(coalesce(u.email, '')) ilike '%' || lower(n.q) || '%'
      or lower(coalesce(u.phone, '')) ilike '%' || lower(n.q) || '%'
      or lower(coalesce(p.name, '')) ilike '%' || lower(n.q) || '%'
      or lower(coalesce(b.service_type, '')) ilike '%' || lower(n.q) || '%'
      or lower(coalesce(b.booking_mode::text, '')) ilike '%' || lower(n.q) || '%'
      or lower(coalesce(b.booking_status::text, b.status::text, '')) ilike '%' || lower(n.q) || '%'
    )
  order by b.booking_start desc
  limit (select result_limit from normalized);
$$;

grant execute on function public.admin_search_bookings(text, text, integer) to authenticated;

create or replace function public.get_admin_dashboard_business_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not coalesce(public.current_role_name() in ('admin', 'staff'), false) then
    raise exception 'Admin dashboard statistics are available only to admin and staff roles'
      using errcode = '42501';
  end if;

  with normalized_bookings as (
    select
      coalesce(nullif(booking_status::text, ''), status::text) as effective_status,
      user_id
    from public.bookings
  )
  select jsonb_build_object(
    'bookingCount', count(*)::integer,
    'bookingRiskSummary', jsonb_build_object(
      'pending', count(*) filter (where effective_status = 'pending')::integer,
      'inProgress', count(*) filter (where effective_status in ('pending', 'confirmed', 'in_progress'))::integer,
      'completed', count(*) filter (where effective_status = 'completed')::integer,
      'noShow', count(*) filter (where effective_status = 'no_show')::integer,
      'cancelled', count(*) filter (where effective_status = 'cancelled')::integer
    ),
    'providerCount', (select count(*)::integer from public.providers),
    'serviceCount', (select count(*)::integer from public.provider_services where provider_id is null),
    'customerCount', count(distinct user_id)::integer,
    'activeDiscountCount', (select count(*)::integer from public.platform_discounts where is_active)
  )
  into result
  from normalized_bookings;

  return result;
end;
$$;

grant execute on function public.get_admin_dashboard_business_stats() to authenticated, service_role;