begin;

-- Distributed rate limiting window table.
create table if not exists public.api_rate_limit_windows (
  key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (key, window_started_at)
);

create index if not exists idx_api_rate_limit_windows_updated_at
  on public.api_rate_limit_windows(updated_at desc);

alter table public.api_rate_limit_windows enable row level security;

-- No direct policies on this table; access should be through SECURITY DEFINER function.

create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (
  limited boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_window_started_at timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'RATE_LIMIT_KEY_REQUIRED';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'RATE_LIMIT_WINDOW_INVALID';
  end if;

  if p_max_requests is null or p_max_requests <= 0 then
    raise exception 'RATE_LIMIT_MAX_INVALID';
  end if;

  -- Snap to fixed window boundary in UTC.
  v_window_started_at := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_window_started_at + make_interval(secs => p_window_seconds);

  insert into public.api_rate_limit_windows (key, window_started_at, request_count, updated_at)
  values (p_key, v_window_started_at, 1, v_now)
  on conflict (key, window_started_at)
  do update
    set request_count = public.api_rate_limit_windows.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into v_count;

  -- Opportunistic cleanup to keep table bounded.
  if random() < 0.01 then
    delete from public.api_rate_limit_windows
    where updated_at < v_now - interval '2 days';
  end if;

  return query
  select
    v_count > p_max_requests,
    greatest(0, p_max_requests - v_count),
    v_reset_at;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated, service_role;

-- Automation lock table to avoid concurrent scheduler/manual reminder runs.
create table if not exists public.automation_locks (
  lock_key text primary key,
  holder text not null,
  acquired_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

create index if not exists idx_automation_locks_expires_at
  on public.automation_locks(expires_at asc);

alter table public.automation_locks enable row level security;

create or replace function public.try_acquire_automation_lock(
  p_lock_key text,
  p_holder text,
  p_ttl_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_rows integer := 0;
begin
  if p_lock_key is null or length(trim(p_lock_key)) = 0 then
    raise exception 'LOCK_KEY_REQUIRED';
  end if;

  if p_holder is null or length(trim(p_holder)) = 0 then
    raise exception 'LOCK_HOLDER_REQUIRED';
  end if;

  if p_ttl_seconds is null or p_ttl_seconds <= 0 then
    raise exception 'LOCK_TTL_INVALID';
  end if;

  delete from public.automation_locks
  where lock_key = p_lock_key
    and expires_at <= v_now;

  insert into public.automation_locks (lock_key, holder, acquired_at, expires_at)
  values (p_lock_key, p_holder, v_now, v_now + make_interval(secs => p_ttl_seconds))
  on conflict (lock_key) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.try_acquire_automation_lock(text, text, integer) from public;
grant execute on function public.try_acquire_automation_lock(text, text, integer) to authenticated, service_role;

create or replace function public.release_automation_lock(
  p_lock_key text,
  p_holder text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  if p_lock_key is null or length(trim(p_lock_key)) = 0 then
    raise exception 'LOCK_KEY_REQUIRED';
  end if;

  if p_holder is null or length(trim(p_holder)) = 0 then
    raise exception 'LOCK_HOLDER_REQUIRED';
  end if;

  delete from public.automation_locks
  where lock_key = p_lock_key
    and holder = p_holder;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.release_automation_lock(text, text) from public;
grant execute on function public.release_automation_lock(text, text) to authenticated, service_role;

commit;
