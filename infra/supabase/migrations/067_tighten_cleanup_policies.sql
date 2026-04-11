-- 067: Tighten notification & message retention + reduce per-user cap
--
-- New retention policy:
--   notifications: read → 3 days, unread → 15 days
--   messages:      read → 7 days, unread → 30 days
-- Per-user cap: 50 notifications max

-- ============================================================
-- 1. Updated cleanup function — notifications
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_notifications()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_read   bigint;
  deleted_unread bigint;
BEGIN
  DELETE FROM notifications
  WHERE read_at IS NOT NULL
    AND created_at < NOW() - INTERVAL '3 days';
  GET DIAGNOSTICS deleted_read = ROW_COUNT;

  DELETE FROM notifications
  WHERE read_at IS NULL
    AND created_at < NOW() - INTERVAL '15 days';
  GET DIAGNOSTICS deleted_unread = ROW_COUNT;

  IF deleted_read > 0 OR deleted_unread > 0 THEN
    RAISE LOG 'cleanup_stale_notifications: removed % read, % unread',
      deleted_read, deleted_unread;
  END IF;
END;
$$;

-- ============================================================
-- 2. Updated cleanup function — messages
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_messages()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_read   bigint;
  deleted_unread bigint;
BEGIN
  DELETE FROM messages
  WHERE read_at IS NOT NULL
    AND created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_read = ROW_COUNT;

  DELETE FROM messages
  WHERE read_at IS NULL
    AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_unread = ROW_COUNT;

  IF deleted_read > 0 OR deleted_unread > 0 THEN
    RAISE LOG 'cleanup_stale_messages: removed % read, % unread',
      deleted_read, deleted_unread;
  END IF;
END;
$$;

-- ============================================================
-- 3. Updated per-user cap — 50 notifications max
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

  IF user_count > 50 THEN
    excess := user_count - 50;

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
