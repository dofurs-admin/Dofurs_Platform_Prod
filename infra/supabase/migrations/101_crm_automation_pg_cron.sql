-- Migration: CRM Automation Scheduling (pg_cron + pg_net)
-- Replaces the two planned Render cron services for the CRM automation:
--   * abandoned-booking sweep — every minute (hot leads ~10–11 min after a
--     customer goes quiet mid-booking, down from 10–15 min with a 5-min cron)
--   * Meta sheet import — every 5 min as a FALLBACK safety net (the Google
--     Sheet push trigger in infra/apps-script/ normally imports within seconds
--     of a new lead row; this schedule catches anything the trigger misses)
-- Both jobs POST to the EXISTING production endpoints with the shared
-- CRM_SHEET_IMPORT_SECRET (the same dual-auth path the cron runner scripts
-- use — the middleware whitelist already passes these routes through):
--   POST https://dofurs.in/api/admin/crm/abandoned-bookings/run  {"dryRun":false}
--   POST https://dofurs.in/api/admin/crm/imports/meta-sheet       {"dryRun":false}
-- The endpoints record ROUTE-SIDE heartbeats for secret-authenticated runs,
-- so the "Automation health" panel + Discord alerts keep working unchanged.
--
-- Why database-side scheduling: pg_cron is already enabled on this project
-- (migrations 063/066/073) and costs nothing extra, vs ~$6/mo for two Render
-- cron services. pg_net (Supabase first-party extension, same family as
-- pg_cron) provides the outbound HTTP call; it creates its own `net` schema
-- and is NOT relocatable, so it is created without a schema qualifier.
--
-- NOTE (deliberate difference from migration 073's silent-skip pattern): if
-- pg_cron/pg_net are missing, this migration FAILS LOUDLY. A silently skipped
-- schedule is exactly the invisible-failure class that hid the 2026-09-03
-- incident — a failed migration apply is impossible to miss.

-- 1. Enable pg_net (pg_cron is already enabled on this project).
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Private config store for the automation secret. The `private` schema is
--    NOT exposed by PostgREST (only `public` is served by the API), and
--    anon/authenticated roles are revoked as defense in depth — only roles
--    with direct database access (dashboard SQL editor / service role) can
--    read it. Never put the value in this committed file.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.crm_automation_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon, authenticated;

-- 3. Set the automation secret — MUST be the SAME value as
--    CRM_SHEET_IMPORT_SECRET on the Render web service. Replace the
--    placeholder BEFORE applying this migration.
INSERT INTO private.crm_automation_config (key, value)
VALUES ('crm_sheet_import_secret', '<PASTE_THE_CRM_SHEET_IMPORT_SECRET_HERE>')
ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();

-- 4. Trigger function: reads the secret, POSTs the endpoint via pg_net.
--    SECURITY DEFINER so the pg_cron job (running as postgres) can call it,
--    while anon/authenticated roles cannot execute it directly.
CREATE OR REPLACE FUNCTION private.crm_trigger_automation(p_job text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret text;
  v_url text;
  v_request_id bigint;
BEGIN
  IF p_job NOT IN ('meta_sheet_import', 'abandoned_bookings_sweep') THEN
    RAISE EXCEPTION 'Unknown CRM automation job: %', p_job;
  END IF;

  SELECT value INTO v_secret
  FROM private.crm_automation_config
  WHERE key = 'crm_sheet_import_secret';

  -- Self-heal copy-paste padding: a trailing newline in the stored secret
  -- caused silent 401s on 2026-09-03 (65 chars instead of 64).
  v_secret := btrim(v_secret, E' \n\r\t');

  IF v_secret IS NULL OR v_secret = '' OR v_secret LIKE '<%' THEN
    RAISE EXCEPTION 'CRM automation secret is not configured: insert the CRM_SHEET_IMPORT_SECRET value into private.crm_automation_config (key = crm_sheet_import_secret)';
  END IF;

  IF p_job = 'meta_sheet_import' THEN
    v_url := 'https://dofurs.in/api/admin/crm/imports/meta-sheet';
  ELSE
    v_url := 'https://dofurs.in/api/admin/crm/abandoned-bookings/run';
  END IF;

  -- pg_net's http_post RETURNS the request id directly (bigint) — it is NOT a
  -- table function. `SELECT id FROM net.http_post(...)` fails with
  -- "column id does not exist" (the 2026-09-03 activation incident: every
  -- tick failed until this direct-call form was applied).
  v_request_id := net.http_post(
    url := v_url,
    body := '{"dryRun": false}'::jsonb,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || v_secret
    ),
    -- The sheet import can take ~50 s (405-row scan; first production run
    -- measured 48.9 s). pg_net's default 5 s timeout would only mark the
    -- request timed-out client-side (the endpoint finishes the run
    -- regardless); a generous timeout keeps the response visible in
    -- net._http_response for debugging.
    timeout_milliseconds := 180000
  );

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.crm_trigger_automation(text) FROM anon, authenticated;

-- 5. Schedules. cron.schedule with an existing job name UPDATES it, so
--    re-applying this migration is safe.
SELECT cron.schedule(
  'crm-abandoned-bookings-sweep',
  '* * * * *',  -- every minute
  $$SELECT private.crm_trigger_automation('abandoned_bookings_sweep')$$
);

SELECT cron.schedule(
  'crm-meta-sheet-import',
  '*/5 * * * *',  -- every 5 minutes (fallback for the sheet push trigger)
  $$SELECT private.crm_trigger_automation('meta_sheet_import')$$
);

-- 6. Verification helpers (run in the Supabase SQL editor after applying):
--    Schedules:        SELECT jobname, schedule, active FROM cron.job ORDER BY jobid;
--    Invocations:      SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--    HTTP responses:   SELECT id, status_code, timed_out, error_msg, left(content, 200) AS body
--                        FROM net._http_response ORDER BY created DESC LIMIT 20;
--    Panel truth:      the CRM "Automation health" panel should show both jobs
--                      Healthy with heartbeats every ~1 min (sweep) and ~5 min
--                      (import). Heartbeat rows land ROUTE-SIDE (secret-auth
--                      POSTs to the endpoints record their own heartbeats).
