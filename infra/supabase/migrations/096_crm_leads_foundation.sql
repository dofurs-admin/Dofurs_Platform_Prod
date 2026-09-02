-- Migration: CRM Leads Foundation (Phase 1)
-- Adds the lead layer for the in-house CRM: crm_leads + crm_lead_activities.
--
-- Design notes:
--   * Customers stay in public.users — a lead attaches to the existing user_id.
--     A repeat enquiry creates another crm_leads row, never a second customer.
--   * source values are fixed up front so later phases (Meta lead forms webhook,
--     Google ads attribution, website enquiries, abandoned bookings, WhatsApp
--     Cloud API) can feed the same table without enum churn.
--   * external_lead_id is reserved for inbound webhook idempotency
--     (unique per source; NULL allowed for manual leads).
--   * RLS mirrors 061_booking_admin_notes: admin/staff only.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_lead_source' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crm_lead_source AS ENUM (
      'meta_lead_form',
      'google_ads',
      'website_enquiry',
      'website_booking',
      'website_abandoned_booking',
      'whatsapp',
      'direct',
      'referral',
      'manual'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_lead_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crm_lead_status AS ENUM (
      'new',
      'contacted',
      'interested',
      'follow_up',
      'converted',
      'lost',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_lead_activity_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crm_lead_activity_type AS ENUM (
      'created',
      'note',
      'call',
      'whatsapp',
      'email',
      'status_change',
      'assignment',
      'followup_scheduled',
      'converted',
      'lost'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  source public.crm_lead_source NOT NULL,
  source_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.crm_lead_status NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'hot')),
  external_lead_id text,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  lost_reason text,
  converted_booking_id bigint REFERENCES public.bookings(id) ON DELETE SET NULL,
  first_contacted_at timestamptz,
  next_followup_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_external_lead_id_unique UNIQUE (source, external_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_user_id ON public.crm_leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status_followup ON public.crm_leads(status, next_followup_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_status ON public.crm_leads(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source_created ON public.crm_leads(source, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  activity_type public.crm_lead_activity_type NOT NULL,
  body text CHECK (char_length(body) BETWEEN 1 AND 4000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_activities_lead_id ON public.crm_lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_lead_activities_actor_id ON public.crm_lead_activities(actor_id);

-- updated_at maintenance for crm_leads
CREATE OR REPLACE FUNCTION public.set_crm_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_set_updated_at ON public.crm_leads;
CREATE TRIGGER crm_leads_set_updated_at
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.set_crm_leads_updated_at();

-- ── RLS: admin/staff only (service-role clients bypass these) ──────────────────

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_leads_select ON public.crm_leads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));

CREATE POLICY crm_leads_insert ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));

CREATE POLICY crm_leads_update ON public.crm_leads FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));

ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_lead_activities_select ON public.crm_lead_activities FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
  ));

CREATE POLICY crm_lead_activities_insert ON public.crm_lead_activities FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'staff')
    )
  );
