-- Migration 073: Booking flow fixes
-- Adds in_progress state, meeting_link, cancellation_window, stale booking cleanup,
-- and performance indices.

-- 1. Add 'in_progress' to booking_status enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'in_progress'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'confirmed';
  END IF;
END$$;

-- 2. Add meeting_link column for teleconsult bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS meeting_link TEXT DEFAULT NULL;

-- 3. Add cancellation_window_hours to provider_services (default 2 hours)
ALTER TABLE provider_services
  ADD COLUMN IF NOT EXISTS cancellation_window_hours INTEGER DEFAULT 2;

-- 4. Update the booking status transition validation trigger
CREATE OR REPLACE FUNCTION validate_booking_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed_transitions TEXT[];
BEGIN
  IF OLD.booking_status = NEW.booking_status THEN
    RETURN NEW;
  END IF;

  CASE OLD.booking_status
    WHEN 'pending' THEN
      allowed_transitions := ARRAY['confirmed', 'cancelled'];
    WHEN 'confirmed' THEN
      allowed_transitions := ARRAY['in_progress', 'completed', 'cancelled', 'no_show'];
    WHEN 'in_progress' THEN
      allowed_transitions := ARRAY['completed', 'cancelled'];
    WHEN 'completed' THEN
      allowed_transitions := ARRAY[]::TEXT[];
    WHEN 'cancelled' THEN
      allowed_transitions := ARRAY[]::TEXT[];
    WHEN 'no_show' THEN
      allowed_transitions := ARRAY['cancelled'];
    ELSE
      allowed_transitions := ARRAY[]::TEXT[];
  END CASE;

  IF NEW.booking_status = ANY(allowed_transitions) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid booking status transition from % to %', OLD.booking_status, NEW.booking_status;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_validate_booking_status_transition ON bookings;
CREATE TRIGGER trg_validate_booking_status_transition
  BEFORE UPDATE OF booking_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_status_transition();

-- 5. Atomic discount usage check-and-increment RPC
CREATE OR REPLACE FUNCTION check_and_increment_discount_usage(
  p_discount_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_discount RECORD;
  v_total_uses BIGINT;
  v_user_uses BIGINT;
BEGIN
  SELECT usage_limit_total, usage_limit_per_user, is_active
  INTO v_discount
  FROM platform_discounts
  WHERE id = p_discount_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_discount.is_active THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Discount not found or inactive');
  END IF;

  SELECT COUNT(*) INTO v_total_uses
  FROM discount_redemptions
  WHERE discount_id = p_discount_id AND reversed_at IS NULL;

  IF v_discount.usage_limit_total IS NOT NULL AND v_total_uses >= v_discount.usage_limit_total THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Total usage limit reached');
  END IF;

  SELECT COUNT(*) INTO v_user_uses
  FROM discount_redemptions
  WHERE discount_id = p_discount_id AND user_id = p_user_id AND reversed_at IS NULL;

  IF v_discount.usage_limit_per_user IS NOT NULL AND v_user_uses >= v_discount.usage_limit_per_user THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Per-user usage limit reached');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'total_uses', v_total_uses + 1, 'user_uses', v_user_uses + 1);
END;
$$ LANGUAGE plpgsql;

-- 6. Auto-expire stale pending bookings after 24 hours
CREATE OR REPLACE FUNCTION expire_stale_pending_bookings()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE bookings
  SET booking_status = 'cancelled',
      cancellation_reason = 'Auto-expired: pending for over 24 hours'
  WHERE booking_status = 'pending'
    AND created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron if available (will silently fail if pg_cron not installed)
DO $outer$
BEGIN
  PERFORM cron.schedule(
    'expire-stale-pending-bookings',
    '17 * * * *',  -- every hour at :17
    $$SELECT expire_stale_pending_bookings()$$
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available — skipping cron job for stale booking expiry';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
END $outer$;

-- 7. Performance indices
CREATE INDEX IF NOT EXISTS idx_bookings_status_pending
  ON bookings (provider_id, booking_date)
  WHERE booking_status IN ('pending', 'confirmed', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_bookings_user_status
  ON bookings (user_id, booking_status);

-- 8. Notifications table (if not exists)
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- 9. Messages table (if not exists)
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'staff', 'provider')),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  booking_id INTEGER REFERENCES bookings(id),
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON messages (recipient_id, created_at DESC);

-- 10. Booking admin notes table (if not exists)
CREATE TABLE IF NOT EXISTS booking_admin_notes (
  id BIGSERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_admin_notes_booking
  ON booking_admin_notes (booking_id, created_at DESC);
