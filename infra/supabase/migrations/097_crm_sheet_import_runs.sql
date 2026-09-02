-- Migration: CRM Meta Sheet Import Runs
-- Run history for the Google-Sheet → crm_leads importer (Meta lead forms sync).
-- Mirrors the billing_automation_runs pattern: one row per attempt, success or failed.

CREATE TABLE IF NOT EXISTS public.crm_sheet_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source text NOT NULL CHECK (trigger_source IN ('admin_panel', 'cron')),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  dry_run boolean NOT NULL DEFAULT false,
  rows_scanned int NOT NULL DEFAULT 0,
  rows_imported int NOT NULL DEFAULT 0,
  rows_skipped int NOT NULL DEFAULT 0,
  rows_invalid int NOT NULL DEFAULT 0,
  rows_empty int NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_sheet_import_runs_created ON public.crm_sheet_import_runs(created_at DESC);

ALTER TABLE public.crm_sheet_import_runs ENABLE ROW LEVEL SECURITY;

-- Only admin/staff can review import history
CREATE POLICY crm_sheet_import_runs_select ON public.crm_sheet_import_runs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));

-- Only admin/staff can insert run rows (service-role cron writes bypass RLS)
CREATE POLICY crm_sheet_import_runs_insert ON public.crm_sheet_import_runs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));
