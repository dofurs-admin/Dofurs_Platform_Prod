begin;

create extension if not exists pg_trgm;

create index if not exists idx_bookings_user_id on public.bookings(user_id);
create index if not exists idx_bookings_booking_status on public.bookings(booking_status);
create index if not exists idx_bookings_legacy_status on public.bookings(status);
create index if not exists idx_users_name_trgm on public.users using gin (lower(name) gin_trgm_ops);
create index if not exists idx_users_email_trgm on public.users using gin (lower(email) gin_trgm_ops);
create index if not exists idx_users_phone_trgm on public.users using gin (lower(phone) gin_trgm_ops);
create index if not exists idx_providers_name_trgm on public.providers using gin (lower(name) gin_trgm_ops);

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
  provider_name text
)
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select nullif(btrim(p_query), '') as q,
      case
        when p_filter in ('all', 'sla', 'high-risk') then p_filter
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
    p.name as provider_name
  from public.bookings b
  left join public.users u on u.id = b.user_id
  left join public.providers p on p.id = b.provider_id
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

commit;
