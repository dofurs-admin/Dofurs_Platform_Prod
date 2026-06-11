-- Migration 093: Enterprise-grade invoice sequencing by financial year and series.

begin;

create table if not exists public.invoice_number_counters (
  id uuid primary key default gen_random_uuid(),
  financial_year text not null,
  series text not null,
  last_value bigint not null default 0 check (last_value >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (financial_year, series)
);

alter table public.invoice_number_counters enable row level security;

drop policy if exists invoice_number_counters_service_write on public.invoice_number_counters;
create policy invoice_number_counters_service_write
  on public.invoice_number_counters
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.next_invoice_number(p_series text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series text;
  v_now_ist timestamp without time zone;
  v_fy_start integer;
  v_fy_end integer;
  v_financial_year text;
  v_next_value bigint;
begin
  v_series := upper(trim(coalesce(p_series, '')));

  if v_series not in ('SVC', 'SUB', 'MAN') then
    raise exception 'Unsupported invoice series: %', p_series;
  end if;

  v_now_ist := timezone('Asia/Kolkata', now());

  if extract(month from v_now_ist) >= 4 then
    v_fy_start := extract(year from v_now_ist)::integer;
  else
    v_fy_start := extract(year from v_now_ist)::integer - 1;
  end if;

  v_fy_end := mod(v_fy_start + 1, 100);
  v_financial_year := lpad(mod(v_fy_start, 100)::text, 2, '0') || '-' || lpad(v_fy_end::text, 2, '0');

  insert into public.invoice_number_counters (financial_year, series, last_value)
  values (v_financial_year, v_series, 1)
  on conflict (financial_year, series)
  do update
    set last_value = public.invoice_number_counters.last_value + 1,
        updated_at = timezone('utc', now())
  returning last_value into v_next_value;

  return format('INV/%s/%s/%s', v_financial_year, v_series, lpad(v_next_value::text, 6, '0'));
end;
$$;

revoke all on function public.next_invoice_number(text) from public;
grant execute on function public.next_invoice_number(text) to service_role;

commit;
