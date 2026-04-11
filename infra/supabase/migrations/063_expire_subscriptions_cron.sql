-- Migration 063: Auto-expire overdue subscriptions
-- Creates a scheduled job (pg_cron) that flips active subscriptions to 'expired'
-- when their ends_at timestamp has passed.
--
-- Requires pg_cron extension: https://github.com/citusdata/pg_cron
-- Enable in Supabase dashboard: Database → Extensions → pg_cron

-- Function: expire overdue subscriptions
CREATE OR REPLACE FUNCTION expire_overdue_subscriptions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND ends_at < NOW();
END;
$$;

-- Schedule: run every hour
-- pg_cron must be enabled first; comment out if not available
SELECT cron.schedule(
  'expire-overdue-subscriptions',   -- job name
  '0 * * * *',                      -- every hour
  $$SELECT expire_overdue_subscriptions()$$
);
