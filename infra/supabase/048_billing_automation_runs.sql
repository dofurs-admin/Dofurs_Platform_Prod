-- 048_billing_automation_runs.sql
-- Stores reminder automation run telemetry for admin observability.

begin;

create table if not exists public.billing_automation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('admin_panel', 'scheduler')),
  status text not null check (status in ('success', 'failed')),
  run_scope text not null check (run_scope in ('manual', 'scheduled')),
  bucket text not null,
  channel text not null,
  dry_run boolean not null default false,
  enforce_cadence boolean not null default true,
  enforce_cooldown boolean not null default true,
  scanned integer not null default 0,
  sent integer not null default 0,
  skipped_cadence integer not null default 0,
  skipped_cooldown integer not null default 0,
  escalated integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_billing_automation_runs_finished_at
  on public.billing_automation_runs(finished_at desc nulls last, created_at desc);

create index if not exists idx_billing_automation_runs_status
  on public.billing_automation_runs(status, created_at desc);

commit;
