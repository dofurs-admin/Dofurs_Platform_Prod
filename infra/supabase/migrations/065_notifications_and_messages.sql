-- 065: Notifications & Messages system
-- Persistent notification records for activity feed + admin/provider messaging

-- ============================================================
-- 1. notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            bigserial PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text        NOT NULL,        -- booking_created, booking_status_changed, pet_added, message_received
  title         text        NOT NULL,
  body          text        NOT NULL,
  data          jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- metadata (booking_id, pet_id, message_id, etc.)
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_id_created ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at) WHERE read_at IS NULL;

-- ============================================================
-- 2. messages table (admin/provider → user communication)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id            bigserial PRIMARY KEY,
  sender_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role   text        NOT NULL CHECK (sender_role IN ('admin', 'staff', 'provider')),
  recipient_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject       text,
  body          text        NOT NULL,
  booking_id    integer     REFERENCES bookings(id) ON DELETE SET NULL,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_recipient_created ON messages (recipient_id, created_at DESC);
CREATE INDEX idx_messages_sender_created ON messages (sender_id, created_at DESC);
CREATE INDEX idx_messages_booking ON messages (booking_id) WHERE booking_id IS NOT NULL;

-- ============================================================
-- 3. RLS policies
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Notifications: users can read/update their own
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications: service role can insert (used by API routes with admin client)
CREATE POLICY notifications_insert_service ON notifications
  FOR INSERT WITH CHECK (true);

-- Messages: recipients can read their own messages
CREATE POLICY messages_select_recipient ON messages
  FOR SELECT USING (auth.uid() = recipient_id);

-- Messages: senders can see messages they sent
CREATE POLICY messages_select_sender ON messages
  FOR SELECT USING (auth.uid() = sender_id);

-- Messages: recipients can update (mark read)
CREATE POLICY messages_update_recipient ON messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Messages: service role can insert
CREATE POLICY messages_insert_service ON messages
  FOR INSERT WITH CHECK (true);
