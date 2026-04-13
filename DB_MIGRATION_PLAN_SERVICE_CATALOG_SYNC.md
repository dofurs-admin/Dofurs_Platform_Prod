# DB Migration Plan: Service Catalog and Provider Rollout Sync

Status: planned (not yet applied)

Goal: harden data integrity while keeping booking flow fully backward compatible.

## Current Model

- Table: provider_services
- Template catalog rows: provider_id is null
- Provider rollout rows: provider_id is not null

## Constraints We Need

1. Prevent duplicate template service rows by service identity.
2. Prevent duplicate provider rollout rows for the same provider and service identity.
3. Keep existing booking references stable.

## Phase 0: Dry-Run Audit (No Schema Change)

Run these checks first in staging and production snapshots.

Recommended read-only script:

```bash
npm run audit:service-catalog-sync
# Optional strict mode for CI/gates:
npm run audit:service-catalog-sync -- --fail-on-risk
```

Release gate integration:

```bash
npm run release:gate
```

The release gate now runs this audit in strict mode and fails if duplicate-risk groups are detected.

```sql
-- Template duplicates by logical identity
select
  lower(trim(service_type)) as service_type_norm,
  coalesce(service_mode, 'home_visit') as service_mode_norm,
  count(*) as row_count
from provider_services
where provider_id is null
group by 1,2
having count(*) > 1
order by row_count desc;

-- Provider rollout duplicates by logical identity
select
  provider_id,
  lower(trim(service_type)) as service_type_norm,
  coalesce(service_mode, 'home_visit') as service_mode_norm,
  count(*) as row_count
from provider_services
where provider_id is not null
group by 1,2,3
having count(*) > 1
order by row_count desc;
```

## Phase 1: Data Cleanup (If Needed)

- Keep oldest active row per duplicate group as canonical.
- Repoint dependent coverage rows in provider_service_pincodes if needed.
- Archive deleted IDs and mappings in an audit table or change log.

Example approach (to customize carefully):

1. Build duplicate groups.
2. Choose canonical id per group.
3. Update provider_service_pincodes.provider_service_id to canonical id.
4. Delete non-canonical duplicate rows.

## Phase 2: Add Partial Unique Indexes

Apply after cleanup confirms zero duplicate groups.

```sql
-- Template catalog uniqueness
create unique index if not exists idx_provider_services_template_unique
on provider_services (lower(trim(service_type)), coalesce(service_mode, 'home_visit'))
where provider_id is null;

-- Provider rollout uniqueness
create unique index if not exists idx_provider_services_provider_unique
on provider_services (provider_id, lower(trim(service_type)), coalesce(service_mode, 'home_visit'))
where provider_id is not null;
```

## Phase 3: API Guardrail Alignment

- Catalog endpoints should reject non-null provider_id payloads.
- Provider rollout endpoints remain owner for provider-specific service rows.

## Rollback Plan

If rollout causes issues:

1. Drop new unique indexes.
2. Re-enable prior behavior with feature flag in admin UI if present.
3. Restore affected rows from backup snapshot if data cleanup was applied.

```sql
drop index if exists idx_provider_services_template_unique;
drop index if exists idx_provider_services_provider_unique;
```

## Booking Compatibility Guarantees

Do not change in this migration wave:

- bookings.provider_service_id semantics
- booking create API contract
- availability service lookup contract

These keep production booking flow stable while data quality is improved.

## Verification Checklist

- No duplicate groups from Phase 0 queries.
- Booking create smoke tests pass.
- Admin provider rollout edit works.
- Admin catalog template create/edit/delete works.
- Availability APIs return expected providers after rollout.
