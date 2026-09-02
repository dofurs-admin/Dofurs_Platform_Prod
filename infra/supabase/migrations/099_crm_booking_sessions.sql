-- Migration: CRM booking sessions (abandoned-booking detection, Phase 3)
-- Tracks public booking-flow progress per anonymous session key so the sweep
-- job can convert stale, unfinished flows into hot leads
-- (source = website_abandoned_booking, priority = hot).

CREATE TABLE IF NOT EXISTS public.crm_booking_sessions (
  session_key text PRIMARY KEY,
  stage text NOT NULL,
  service text,
  pet_count int,
  preferred_date text,
  area text,
  contact_name text,
  contact_phone text,
  contact_email text,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'booked', 'abandoned', 'expired')),
  abandoned_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_booking_sessions_sweep
  ON public.crm_booking_sessions(status, updated_at);

-- Service-role only writes; no anon/authenticated policies on purpose.
ALTER TABLE public.crm_booking_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS crm_booking_sessions_set_updated_at ON public.crm_booking_sessions;
CREATE TRIGGER crm_booking_sessions_set_updated_at
BEFORE UPDATE ON public.crm_booking_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_crm_leads_updated_at();
