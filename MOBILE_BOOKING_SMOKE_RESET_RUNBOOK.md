# Mobile Booking Smoke Reset Runbook

Last updated: 2026-07-27
Scope: Repeatable local reset for customer/provider mobile booking smoke sessions.

## Purpose

This runbook defines a safe, deterministic cleanup loop before and after mobile booking smoke tests.

Use this when you need to re-run customer/provider booking flows without stale idempotency responses, noisy historical rows, or ambiguous account state.

## Prerequisites

- Local backend running on http://localhost:3000.
- `.env.local` contains:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Valid customer JWT and provider JWT available for smoke commands.
- `npm run mobile:typecheck` already passing.

## Reset Workflow (Deterministic)

1. Snapshot current data before cleanup.

```bash
node scripts/cleanup-booking-addresses.mjs --limit=20000 --batch-size=500 --sample-size=20
```

Expected:
- Dry-run summary prints scanned and candidate rows.
- Report file appears under `audit-output/booking-address-cleanup-<timestamp>.json`.

2. Normalize duplicated booking addresses (apply mode).

```bash
npm run cleanup:booking-addresses -- --apply --max-apply=5000 --limit=20000 --batch-size=500
```

Expected:
- `updated_rows` may be `0` or greater depending on drift.
- New audit report is generated in `audit-output/`.

3. Remove stale idempotency key responses tied to booking/payment retries.

```bash
node - <<'SQL'
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const endpoints = ['payments/bookings/order:%', 'payments/subscriptions/order:%'];
  for (const endpointPattern of endpoints) {
    const { error } = await supabase
      .from('admin_idempotency_keys')
      .delete()
      .like('endpoint', endpointPattern);
    if (error) throw error;
  }
  console.log('Deleted booking/subscription idempotency cache rows for smoke reset.');
})().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
SQL
```

Expected:
- Command exits cleanly and prints deletion confirmation.

4. Optional: clear stale pending payment transactions older than 2 hours.

```bash
npm run ops:billing:run:cleanup-stale
```

Expected:
- API call succeeds and returns cleanup summary payload.

5. Run local bearer smoke once with customer token and once with approved provider token.

```bash
# Customer token copied to clipboard
npm run test:mobile:bearer-smoke:clipboard:local

# Provider token copied to clipboard
npm run test:mobile:bearer-smoke:clipboard:local
```

Expected for each run:
- `Bootstrap profile bearer check` passes.
- `Booking catalog bearer check` passes.
- `Booking order auth gate check` returns valid 400/422 JSON (auth gate accepted).

6. Record evidence in tracker.

Update `MOBILE_APP_DEVELOPMENT_READINESS_TRACKER.md`:
- Validation Log row with commands and outcomes.
- Gate 1 checklist status for reset documentation and smoke runs.

## Safety Notes

- Do not delete bookings, users, providers, payment transactions, or credit tables in shared environments.
- Restrict deletion to idempotency cache entries and approved cleanup scripts.
- Keep all reset runs auditable through generated `audit-output` reports.

## Rollback / Recovery

If reset produces unexpected results:

1. Stop further smoke executions.
2. Attach the latest `audit-output/booking-address-cleanup-*.json` evidence.
3. Restore state through standard database backup/restore procedures for the environment.
4. Reopen affected tracker items and log the incident in the Decision Log.
