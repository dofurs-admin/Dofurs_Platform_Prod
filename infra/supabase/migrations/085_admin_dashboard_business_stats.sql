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
      'inProgress', count(*) filter (where effective_status in ('pending', 'confirmed'))::integer,
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
