-- Migration: CRM lead location enrichment
-- Manual pincode/address on crm_leads so staff can geo-associate leads that
-- arrived without a usable area (manual leads, sheet rows with junk answers).
-- The explicit pincode feeds Gaze directly (indexed, coordinate lookup).

ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS address text CHECK (char_length(address) <= 500);

CREATE INDEX IF NOT EXISTS idx_crm_leads_pincode ON public.crm_leads(pincode);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'crm_lead_activity_type' AND e.enumlabel = 'location_updated'
  ) THEN
    ALTER TYPE public.crm_lead_activity_type ADD VALUE 'location_updated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'crm_lead_activity_type' AND e.enumlabel = 'priority_changed'
  ) THEN
    ALTER TYPE public.crm_lead_activity_type ADD VALUE 'priority_changed';
  END IF;
END
$$;
