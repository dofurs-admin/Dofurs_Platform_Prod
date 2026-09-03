-- Migration: CRM Automation Heartbeats
-- Out-of-band heartbeat log for the CRM cron jobs (Meta sheet import +
-- abandoned-booking sweep). The cron runners POST an outcome here after every
-- attempt on a PUBLIC path (/api/crm/automation/heartbeat) that sits outside
-- the middleware's protected-route list, so heartbeats land even when the main
-- /api/admin/crm/* endpoints are unreachable (e.g. the 2026-09-03 middleware
-- 401 incident, where every cron run failed invisibly for days).
-- Mirrors the crm_sheet_import_runs pattern: one row per cron attempt.

CREATE TABLE IF NOT EXISTS public.crm_automation_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL CHECK (job IN ('meta_sheet_import', 'abandoned_bookings_sweep')),
  ok boolean NOT NULL,
  http_status int,
  error_message text,
  duration_ms int,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_automation_heartbeats_job_created
  ON public.crm_automation_heartbeats(job, created_at DESC);

ALTER TABLE public.crm_automation_heartbeats ENABLE ROW LEVEL SECURITY;

-- Only admin/staff can review automation health (the heartbeat endpoint writes
-- with the service-role admin client, which bypasses RLS; no client-side
-- inserts are allowed).
CREATE POLICY crm_automation_heartbeats_select ON public.crm_automation_heartbeats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));
