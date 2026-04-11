-- Allow provider-agnostic service templates in provider_services.
-- Provider assignment should happen in provider workflows.

alter table if exists public.provider_services
  alter column provider_id drop not null;
