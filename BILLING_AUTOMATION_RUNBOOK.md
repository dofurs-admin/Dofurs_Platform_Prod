# Billing Automation Runbook

Last updated: 2026-06-24

## Scope
This runbook covers secure operation of these automation endpoints:
- `POST /api/admin/billing/reminders/schedule`
- `POST /api/admin/payments/cleanup-stale-transactions`

## Step 2: Secret Rotation

Use a strong random secret and set the same value on:
- Web service environment (`BILLING_AUTOMATION_SECRET`)
- Cron services environment (`BILLING_AUTOMATION_SECRET`)

Generate a secret:

```bash
npm run ops:billing:secret:generate
```

Alternative with explicit length (64 bytes):

```bash
node scripts/generate-billing-automation-secret.mjs 64
```

Required env vars for automation jobs:
- `BILLING_AUTOMATION_SECRET`
- `BILLING_AUTOMATION_BASE_URL` (for example `https://dofurs.in`)

## Step 3: Scheduler Configuration

### Render blueprint (no immediate effect until deployment)
`infra/render.yaml` includes two cron services:
- `dofurs-billing-reminders-scheduler`
- `dofurs-cleanup-stale-transactions`

Both use script entry points that send token-authenticated requests.

### Script-based jobs (header behavior)
- `npm run ops:billing:run:schedule`
- `npm run ops:billing:run:cleanup-stale`

By default, scripts send:
- `Authorization: Bearer <BILLING_AUTOMATION_SECRET>`

Optional header mode:
- Set `BILLING_AUTOMATION_AUTH_MODE=x-token` to use `x-billing-automation-token`.

## Step 4: Verification

### Safe verification (status + reminder dry run)
This does not send live reminders.

```bash
BILLING_AUTOMATION_BASE_URL=https://dofurs.in \
BILLING_AUTOMATION_SECRET='<your-secret>' \
npm run ops:billing:verify
```

### Full verification (includes stale transaction cleanup call)
Run only when intended, because cleanup updates stale transaction rows.

```bash
BILLING_AUTOMATION_BASE_URL=https://dofurs.in \
BILLING_AUTOMATION_SECRET='<your-secret>' \
BILLING_AUTOMATION_VERIFY_CLEANUP=true \
npm run ops:billing:verify
```

Expected outcomes:
- `schedule_status.status` is `200`
- `schedule_dry_run.status` is `200` (or `409` if a run is already in progress)
- `cleanup.status` is `200` when cleanup verification is enabled

## Rollback
If automation token issues appear after rotation:
1. Revert cron jobs to previous secret immediately.
2. Keep web and cron secrets aligned.
3. Re-run `npm run ops:billing:verify` with dry-run only.
4. Re-enable cleanup verification after dry-run path is stable.
