-- Add business/individual fields to service_provider_applications
ALTER TABLE service_provider_applications
  ADD COLUMN partner_category TEXT CHECK (partner_category IN ('individual', 'business')) DEFAULT 'individual',
  ADD COLUMN business_name TEXT,
  ADD COLUMN team_size INTEGER;

-- Optionally, add NOT NULL/length constraints if desired
-- ALTER TABLE service_provider_applications ALTER COLUMN partner_category SET NOT NULL;
-- ALTER TABLE service_provider_applications ALTER COLUMN business_name SET NOT NULL;
-- ALTER TABLE service_provider_applications ALTER COLUMN team_size SET NOT NULL;
