# Single-Environment Release Playbook

This runbook describes how to implement and release the mobile phases safely when production is the only shared environment.

## Principles

- Ship phase by phase, never as one large unvalidated change set.
- Keep changes on a branch until phase checks pass locally.
- Deploy with a short, controlled validation window.
- Roll forward quickly when checks pass; roll back quickly when checks fail.

## Branch Discipline

- Work branch: `feature/mobile-phase-0-backend-compat` (or the active mobile phase branch).
- Keep each phase bounded to a reviewable set of commits.
- Record outcomes in `MOBILE_EXECUTION_PROGRESS.md` at each checkpoint.

## Local Preflight (Required Before Deploy)

Run from repo root:

```bash
npm run lint
npm run test -- lib/auth/bearer-auth.test.ts lib/auth/api-auth.test.ts middleware.bearer.test.ts
npm run test -- app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/user/bookings/route.test.ts
```

Then run bearer smoke against local app:

```bash
npm run dev
# in another terminal
npm run test:mobile:bearer-smoke:clipboard:local
```

Expected smoke behavior:

- `/api/auth/bootstrap-profile`: `200`
- `/api/bookings/catalog`: `200`
- `/api/payments/bookings/order`: `400` with invalid payload is acceptable for this smoke script

## Production Validation Window

After deploy, run production smoke with the same copied user access token in clipboard:

```bash
npm run test:mobile:bearer-smoke:clipboard:prod
```

If production fails but local passes, treat as deployment lag or runtime drift first.

## Token Source Rules

- Use website user session `access_token` only (JWT with `sub` claim).
- Do not use `SUPABASE_ACCESS_TOKEN` values that start with `sbp_`.
- Do not use anon key, service role key, or webhook/billing secrets.

## Phase Release Checklist

For each phase:

1. Complete implementation on branch.
2. Run local preflight.
3. Run local bearer smoke.
4. Deploy.
5. Run production bearer smoke.
6. Update `MOBILE_EXECUTION_PROGRESS.md` with pass/fail and timestamp.

## Rollback Rule

- If production smoke returns `401`/redirects for bearer endpoints after deploy, rollback immediately to last known good commit.
- Document rollback reason and exact failing endpoint in `MOBILE_EXECUTION_PROGRESS.md`.

## Optional Hard Gate

Before wide rollout, run:

```bash
npm run release:gate
```

Use this only when environment prerequisites are available (`SUPABASE_DB_URL`, schema-health access, etc.).
