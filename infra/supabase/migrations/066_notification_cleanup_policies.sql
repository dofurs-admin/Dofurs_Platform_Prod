-- 066: Notification & message auto-cleanup policies
-- Prevents unbounded table growth by purging stale records on a schedule
-- and capping per-user notification count.
--
-- Retention policy:
--   notifications: read → 30 days, unread → 90 days
--   messages:      read → 90 days, unread → 180 days
-- Per-user cap: 200 notifications max (oldest pruned on overflow)

-- ============================================================
-- 1. Cleanup indexes for efficient range deletes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_read_at_created
  ON notifications (read_at, created_at)
  WHERE read_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages (created_at);

CREATE INDEX IF NOT EXISTS idx_messages_read_at_created
  ON messages (read_at, created_at)
  WHERE read_at IS NOT NULL;

-- ============================================================
-- 2. Cleanup function — notifications
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_notifications()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_read   bigint;
  deleted_unread bigint;
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM notifications
  WHERE read_at IS NOT NULL
    AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_read = ROW_COUNT;

  -- Delete unread notifications older than 90 days
  DELETE FROM notifications
  WHERE read_at IS NULL
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_unread = ROW_COUNT;

  IF deleted_read > 0 OR deleted_unread > 0 THEN
    RAISE LOG 'cleanup_stale_notifications: removed % read, % unread',
      deleted_read, deleted_unread;
  END IF;
END;
$$;

-- ============================================================
-- 3. Cleanup function — messages
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_messages()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_read   bigint;
  deleted_unread bigint;
BEGIN
  -- Delete read messages older than 90 days
  DELETE FROM messages
  WHERE read_at IS NOT NULL
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_read = ROW_COUNT;

  -- Delete unread messages older than 180 days
  DELETE FROM messages
  WHERE read_at IS NULL
    AND created_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS deleted_unread = ROW_COUNT;

  IF deleted_read > 0 OR deleted_unread > 0 THEN
    RAISE LOG 'cleanup_stale_messages: removed % read, % unread',
      deleted_read, deleted_unread;
  END IF;
END;
$$;

-- ============================================================
-- 4. Per-user cap function — keeps max 200 notifications per user
--    Deletes oldest read first, then oldest unread if still over cap.
-- ============================================================
CREATE OR REPLACE FUNCTION cap_user_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_count bigint;
  excess     bigint;
BEGIN
  SELECT COUNT(*) INTO user_count
  FROM notifications
  WHERE user_id = NEW.user_id;

  IF user_count > 200 THEN
    excess := user_count - 200;

    -- Prefer deleting oldest read notifications first
    DELETE FROM notifications
    WHERE id IN (
      SELECT id FROM notifications
      WHERE user_id = NEW.user_id
      ORDER BY
        CASE WHEN read_at IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT excess
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cap_user_notifications
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION cap_user_notifications();

-- ============================================================
-- 5. Scheduled cron jobs (requires pg_cron extension)
-- ============================================================

-- Run notification cleanup daily at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-stale-notifications',
  '0 3 * * *',
  $$SELECT cleanup_stale_notifications()$$
);

-- Run message cleanup daily at 3:15 AM UTC
SELECT cron.schedule(
  'cleanup-stale-messages',
  '15 3 * * *',
  $$SELECT cleanup_stale_messages()$$
);
