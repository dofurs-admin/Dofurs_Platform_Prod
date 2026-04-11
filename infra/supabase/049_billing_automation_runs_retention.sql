-- 049_billing_automation_runs_retention.sql
-- Adds retention helper for billing automation telemetry.

begin;

create index if not exists idx_billing_automation_runs_created_at
  on public.billing_automation_runs(created_at desc);

create or replace function public.cleanup_billing_automation_runs(retain_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if retain_days < 1 then
    raise exception 'retain_days must be >= 1';
  end if;

  delete from public.billing_automation_runs
  where created_at < (timezone('utc', now()) - make_interval(days => retain_days));

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_billing_automation_runs(integer) from public;
grant execute on function public.cleanup_billing_automation_runs(integer) to service_role;

commit;
