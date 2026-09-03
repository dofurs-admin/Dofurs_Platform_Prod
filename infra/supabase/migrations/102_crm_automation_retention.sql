-- Migration 102: CRM automation observability retention
--
-- Keeps the heartbeat + import-run tables bounded now that CRM scheduling is
-- database-side (migration 101):
--   crm_automation_heartbeats → keep 30 days (the sweep reports every minute,
--                              ~1,440 rows/day)
--   crm_sheet_import_runs     → keep 90 days (imports run every 5 min)
--
-- Mirrors the billing-automation runs cleanup pattern
-- (scripts/cleanup-billing-automation-runs.mjs) but runs database-side via
-- pg_cron, like the CRM scheduling in migration 101.
--
-- Requires the pg_cron extension (already enabled for migrations 063 + 101).

-- Function: prune CRM automation observability rows past their retention age
CREATE OR REPLACE FUNCTION crm_automation_retention_cleanup()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM crm_automation_heartbeats
  WHERE created_at < NOW() - INTERVAL '30 days';

  DELETE FROM crm_sheet_import_runs
  WHERE started_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Re-run safety: drop any previous schedule with the same name first.
SELECT cron.unschedule('crm-automation-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-automation-retention');

-- Schedule: daily at 21:30 UTC = 03:00 IST (outside peak booking hours).
SELECT cron.schedule(
  'crm-automation-retention',   -- job name
  '30 21 * * *',                -- daily 21:30 UTC (03:00 IST)
  $$SELECT crm_automation_retention_cleanup()$$
);
