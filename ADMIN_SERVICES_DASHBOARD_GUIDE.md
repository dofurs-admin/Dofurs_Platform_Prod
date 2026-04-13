# Admin Services Dashboard Guide

This guide explains how to operate the Admin Services area safely in production.

## Purpose

The dashboard now follows a clear split:

- Service Types: category definitions (for example Grooming, Vet Visit).
- Services: catalog template services (provider_id is null).
- Providers tab: provider rollout services and serviceable pincodes (provider_id is not null).

This split prevents accidental edits to provider rollout data from the catalog screens.

## Day-to-Day Workflow

1. Create or update Service Types
- Open Admin -> Services -> Service Types.
- Create top-level categories and display order.

2. Create or update Catalog Services
- Open Admin -> Services -> Services.
- Add template service definitions with defaults (price, duration, slug, media, requirements).
- Keep templates generic and reusable.

3. Roll out to Providers
- Open Admin -> Providers.
- Select provider.
- Assign service types, activate/deactivate services, and set serviceable pincodes.

4. Use Advanced Bulk Rollout only when needed
- Open Admin -> Services -> Service Catalog Management -> Advanced Bulk Rollout.
- Use for controlled, large updates only.
- For routine work, use provider-level rollout.

## Safety Rules

- Do not use Services screen to manage provider-specific service rows.
- Use Providers tab for any provider-specific service assignment or pincode changes.
- Avoid frequent global rollouts during peak traffic windows.

## Booking Compatibility Notes

Current booking flow depends on provider service rows and IDs.

- Booking create validates and uses provider_service_id.
- Availability and pricing rely on active provider_services rows.
- Discount and credit checks use service_type normalization in parts of the flow.

Because of this, dashboard updates should preserve provider service IDs and avoid destructive churn.

## Troubleshooting

Problem: Same service name appears multiple times in provider context.
- This is expected when multiple providers offer the same service_type.
- Verify template list in Services tab and provider rollout list in Providers tab separately.

Problem: Service was created but not visible for a provider.
- Check provider rollout assignment in Providers tab.
- Check service activation and provider service pincodes.

Problem: Booking unavailable for a pincode.
- Confirm provider_service_pincodes mapping for that provider service.
- Confirm service is active and provider has availability.

## Operational Checklist Before Production Changes

- Confirm change scope: template-only or provider rollout.
- If bulk rollout: note affected provider count before applying.
- Run strict sync-risk audit: npm run audit:service-catalog-sync -- --fail-on-risk
- Verify one booking in staging-like environment after rollout.
- Monitor booking creation and availability API logs for 15-30 minutes after change.

## Ownership

- Catalog templates: Admin Services tab owners.
- Provider rollout: Provider operations owners.
- Booking behavior regression checks: Backend/API owner on duty.
