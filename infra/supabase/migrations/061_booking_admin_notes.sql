-- Migration: Booking Admin Notes
-- Allows admin/staff to attach internal notes to bookings

CREATE TABLE public.booking_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id bigint NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_admin_notes_booking_id ON public.booking_admin_notes(booking_id, created_at DESC);

ALTER TABLE public.booking_admin_notes ENABLE ROW LEVEL SECURITY;

-- Only admin/staff can read notes
CREATE POLICY booking_admin_notes_select ON public.booking_admin_notes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));

-- Only admin/staff can insert notes
CREATE POLICY booking_admin_notes_insert ON public.booking_admin_notes FOR INSERT TO authenticated
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
    )
  );
