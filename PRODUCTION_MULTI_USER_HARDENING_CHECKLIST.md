# Production Multi-User Hardening Checklist

Last updated: 2026-03-14

## 1) Distributed Rate Limiting
- [x] Replace process-local limiter with distributed limiter path.
- [x] Add DB-backed rate-limit primitive (`public.check_rate_limit`) in `infra/supabase/050_reliability_primitives_rate_limit_and_locks.sql`.
- [x] Keep local fallback for resilience if DB RPC is temporarily unavailable.
- [x] Apply limits to owner-profile and admin moderation routes.
- [x] Apply limits to booking and payment mutation endpoints.
- [x] Apply limits to public pre-signup validation endpoint.
- [x] Apply limits to heavy internal search/catalog endpoints.

## 2) Payment Idempotency and Duplicate Safety
- [x] Add `x-idempotency-key` support to subscription order creation endpoint.
- [x] Persist/replay idempotent response via `admin_idempotency_keys`.
- [x] Make subscription activation idempotent on `payment_transaction_id`.
- [x] Make subscription invoice creation idempotent on `payment_transaction_id`.
- [x] Make service invoice creation idempotent on `booking_id`.
- [x] Prevent duplicate manual service collection transactions by checking existing booking transaction before insert.

## 3) Webhook Replay Hardening
- [x] Verify webhook signature before processing.
- [x] Early-return when webhook event is already processed.
- [x] Upsert webhook log record to avoid insert race.
- [x] Ensure non-capture events are marked processed without executing payment side effects.

## 4) Query Path Scalability
- [x] Remove `auth.admin.listUsers` full pagination scans from booking catalog endpoint.
- [x] Remove `auth.admin.listUsers` full pagination scans from booking search endpoint.
- [x] Keep role-filtered users query in `public.users` only for predictable bounded query cost.

## 5) Automation Concurrency Guards
- [x] Add distributed lock primitives (`try_acquire_automation_lock` / `release_automation_lock`).
- [x] Guard billing reminder automation with lock acquire/release.
- [x] Return 409 when a concurrent run is already in progress.

## 6) Infrastructure Baseline
- [x] Upgrade Render service plan in `infra/render.yaml` from `free` to `starter` baseline.

## 7) Validation
- [x] Run TypeScript check (`npx tsc --noEmit`).
- [x] Run tests (`npm test`) and inspect failures.
- [x] Run schema migration in target DB and execute schema health check.

## 8) Post-Deploy Monitoring (Operational)
- [x] Add dashboard alerts for 429 rate spikes, booking creation failures, and webhook processing failures.
- [x] Add SLOs for p95 latency and error budget by route group (`bookings/*`, `payments/*`, `admin/*`).
- [x] Confirm horizontal scale settings in host and DB connection pool thresholds.

## Notes
- Migration `050_reliability_primitives_rate_limit_and_locks.sql` has been applied and smoke-verified (`check_rate_limit`, `try_acquire_automation_lock`, `release_automation_lock`).
- API limiter still keeps local in-memory fallback as a safety net for transient RPC outages.
- Alert/SLO baseline and monitor query templates are documented in `OPERATIONS_ALERTS_SLOS.md`.
- Render baseline sets `numInstances: 2`; DB pool warning/critical thresholds are codified in `OPERATIONS_ALERTS_SLOS.md` and surfaced by `GET /api/admin/ops/sli` for operator visibility.
