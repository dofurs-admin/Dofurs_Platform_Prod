# Operations Alerts and SLOs

Last updated: 2026-03-14

## Scope
This document defines production alerting and SLO policy for:
- `bookings/*`
- `payments/*`
- `admin/*`

Primary incidents covered:
- 429 rate-limit spikes
- Booking creation failures
- Webhook processing failures
- Latency/error-budget degradation

## Alert Destinations
- `sev1`: PagerDuty/on-call phone + Slack `#ops-critical`
- `sev2`: Slack `#ops-alerts`
- `sev3`: Slack `#ops-observability`

## Route Groups
- `bookings`: `/api/bookings/**`
- `payments`: `/api/payments/**`
- `admin`: `/api/admin/**`

## Alert Rules

### 1) 429 Rate-Limit Spike (`sev2`)
Purpose: detect abusive traffic bursts or bad client retry behavior.

Trigger:
- Window: `5m`
- Condition A: `http_requests_total{status=429,route_group in [bookings,payments,admin]} >= 50`
- Condition B: `429_rate = 429_count / total_count >= 0.05`
- Fire when A and B are true for `2` consecutive windows.

Escalation to `sev1`:
- `429_rate >= 0.15` for `10m`.

Runbook:
1. Confirm top offending route and client fingerprint (IP/user-agent/auth principal).
2. Verify no deploy/regression changed retry loops.
3. Apply temporary WAF/rate-limit tightening if abusive pattern is external.
4. If internal client regression, hotfix retry/backoff behavior.

### 2) Booking Creation Failure Spike (`sev1`)
Purpose: protect core revenue flow.

Critical route:
- `/api/bookings/create`

Trigger:
- Window: `5m`
- `booking_create_5xx_rate >= 0.02` AND `booking_create_requests >= 100`
  or
- `booking_create_5xx_count >= 20`.

Warning (`sev2`):
- `booking_create_error_rate >= 0.05` (all non-2xx, excluding expected 409 slot conflicts) for `10m`.

Runbook:
1. Check latest deploy and logs for `booking.failure` entries.
2. Confirm DB health/locks/RPC response times.
3. Validate provider availability + overlap constraints behavior.
4. Roll back last deploy if error is code regression.

### 3) Webhook Processing Failure (`sev1`)
Purpose: avoid subscription/payment state drift.

Critical route/table:
- `/api/payments/webhook`
- `public.payment_webhook_events`

Trigger (HTTP path):
- `webhook_5xx_count >= 5` in `5m`.

Trigger (DB processing path):
- `payment_webhook_events` rows with `processed=false AND processing_error IS NOT NULL`
- threshold `>= 10` in `15m`.

Runbook:
1. Validate webhook signature verification path and secret rotation state.
2. Inspect failing provider event IDs and error messages.
3. Confirm idempotency protections still active.
4. Replay failed events safely once underlying cause is fixed.

## SLO Policy

### Availability SLOs (30-day rolling)
- `bookings/*`: `99.90%`
- `payments/*`: `99.95%`
- `admin/*`: `99.50%`

Availability formula:
- `availability = good_requests / total_requests`
- `good_requests`: HTTP status `<500` (exclude intentional auth denials `401/403` from error budget)

### Latency SLOs (p95)
- `bookings/*`: `p95 <= 1200ms`
- `payments/*`: `p95 <= 1500ms`
- `admin/*`: `p95 <= 1000ms`

Burn alerting:
- Fast burn (`sev1`): consumption rate `>= 14x` budget over `1h`.
- Slow burn (`sev2`): consumption rate `>= 2x` budget over `6h`.
- Automated in Prometheus: `infra/monitoring/prometheus-rules.yaml` (`dofurs-slo-error-budget-burn` rule group).

### Error Budget Targets (per 30 days)
- `bookings/*` (`99.90`): `0.10%` bad request budget.
- `payments/*` (`99.95`): `0.05%` bad request budget.
- `admin/*` (`99.50`): `0.50%` bad request budget.

Operational policy:
1. At `>= 50%` burn: freeze risky non-essential releases in affected area.
2. At `>= 75%` burn: require incident review before next release in affected area.
3. At `>= 100%` burn: reliability-only changes until 7-day trend recovers.

## Query Templates

Use equivalent queries in your telemetry stack (Datadog/Prometheus/New Relic/Render metrics).

For Prometheus-first deployments, prefer the ready rules in `infra/monitoring/prometheus-rules.yaml` and keep label names (`route_group`, `route`, `status`) consistent in your HTTP metrics pipeline.

### HTTP 429 rate (5m)
```text
sum(rate(http_requests_total{status="429",route_group=~"bookings|payments|admin"}[5m]))
/
sum(rate(http_requests_total{route_group=~"bookings|payments|admin"}[5m]))
```

### Booking create 5xx rate (5m)
```text
sum(rate(http_requests_total{route="/api/bookings/create",status=~"5.."}[5m]))
/
sum(rate(http_requests_total{route="/api/bookings/create"}[5m]))
```

### Route-group p95 latency
```text
histogram_quantile(0.95,
  sum(rate(http_request_duration_ms_bucket{route_group="bookings"}[5m])) by (le)
)
```

### Supabase webhook failure probe
```sql
select count(*) as unprocessed_failed_last_15m
from public.payment_webhook_events
where processed = false
  and processing_error is not null
  and created_at >= timezone('utc', now()) - interval '15 minutes';
```

## Deployment Checklist
1. Create monitors for all alert rules above in your telemetry platform.
2. Route `sev1/sev2/sev3` to configured channels.
3. Verify route tagging emits `route` and `route_group` dimensions.
4. Run synthetic checks for:
   - `/api/bookings/create`
   - `/api/payments/subscriptions/order`
   - `/api/payments/webhook`
5. Review SLO report weekly in engineering ops review.

## Host Scaling Baseline
- Render baseline (`infra/render.yaml`):
  - `plan: starter`
  - `numInstances: 2`
  - `healthCheckPath: /`

## DB Pool Threshold Policy
- Warning threshold: `70%` utilization
- Critical threshold: `85%` utilization
- Track in operational dashboard and on-call review.
- If utilization exceeds warning for 15m:
  1. reduce expensive query concurrency in hot routes,
  2. raise instance count,
  3. increase pool size only after DB CPU/IO verification.

## Load/Performance Gate
Use scripted gate before broad public release:

1. Configure staging load-test env vars:
  - `LOAD_TEST_BASE_URL`
  - `LOAD_TEST_BOOKING_BEARER`
  - `LOAD_TEST_PAYMENTS_BEARER`
  - Optional: `LOAD_TEST_WEBHOOK_SIGNATURE`, payload overrides
2. Run core flow load gate:
  - `npm run test:load:core`
3. Run release gate bundle:
  - `npm run release:gate`

Notes:
- `test:load:core` targets booking create, subscription order, and webhook paths.
- Gate tolerates expected `409`/`429` responses as non-fatal outcomes while enforcing latency and success-rate thresholds.

## Ready-to-Import Specs
- Datadog monitor definitions: `infra/monitoring/datadog-monitors.json`
- PrometheusRule definition: `infra/monitoring/prometheus-rules.yaml`
- Alertmanager routing template: `infra/monitoring/alertmanager-config.example.yaml`

## Admin SLI Endpoint
- Endpoint: `GET /api/admin/ops/sli`
- Auth: `admin` or `staff`
- Returns lightweight DB-backed operational signals for dashboarding:
  - rate-limit window pressure (`api_rate_limit_windows`)
  - booking creation throughput (`bookings`)
  - webhook processing backlog/failure ratio (`payment_webhook_events`)
  - billing automation failures (`billing_automation_runs`)
