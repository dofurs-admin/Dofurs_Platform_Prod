# Provider Management System (Production Rollout)

## Implemented Artifacts

- Migration: `infra/supabase/016_provider_management_system.sql`
- Types: `lib/provider-management/types.ts`
- Services: `lib/provider-management/service.ts`
- Dashboard queries: `lib/provider-management/dashboard-queries.ts`

## Important Compatibility Note

Your existing app uses legacy `providers.id bigint` in bookings and slot logic.
To avoid breaking production flows, this rollout keeps `providers` as the core table but extends it with the new provider-management fields and related normalized tables.

## Service Provider Dashboard Sections Mapping

1. Profile Information -> `providers`
2. Professional/Clinic Details -> `provider_professional_details`, `provider_clinic_details`
3. Availability -> `provider_availability`
4. Documents -> `provider_documents`
5. Reviews -> `provider_reviews`
6. Performance Overview -> system metrics on `providers`

Pricing remains provider view-only and admin-writable through `provider_services`.

## Rollout Steps

1. Run migration `016_provider_management_system.sql` in Supabase SQL editor.
2. Backfill provider `user_id` links for existing provider accounts.
3. Use `recompute_provider_performance_scores(null)` after initial backfill.
4. Wire dashboard/API routes to `lib/provider-management/service.ts`.

## Suggested Next Improvements (Execute Together)

1. Add dedicated provider APIs:
   - `/api/provider/dashboard`
   - `/api/provider/profile`
   - `/api/provider/availability`
   - `/api/provider/documents`
   - `/api/provider/reviews/respond`
2. Add admin moderation APIs:
   - `/api/admin/providers/[id]/approve`
   - `/api/admin/providers/[id]/reject`
   - `/api/admin/providers/[id]/suspend`
   - `/api/admin/providers/[id]/pricing`
   - `/api/admin/provider-documents/[id]/verify`
3. Add database jobs:
   - Nightly metrics refresh (booking/review-based).
4. Add anti-fraud controls:
   - verification change audit log table + trigger.
5. Add performance indexes:
   - partial indexes for active/approved providers by provider_type and city.
6. Add onboarding quality gates:
   - required document matrix by provider_type.
7. Add payment readiness hardening:
   - encrypt payout_details via vault or KMS-backed approach.
