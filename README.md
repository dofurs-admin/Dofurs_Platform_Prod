# Dofurs Single-Page Website

Modern, minimalistic one-page marketing site for **Dofurs** built with **Next.js App Router**, **Tailwind CSS**, and **Framer Motion**.

## Development

```bash
npm install
npm run dev
```

## Mobile Workspace (In Repo)

The Expo mobile apps live inside this repository under `dofurs-mobile/` and are managed as a self-contained npm workspace.

Primary workflow (inside `dofurs-mobile/`):

```bash
cd dofurs-mobile
npm run install:workspaces
npm run dev:customer
npm run dev:provider
npm run typecheck
npm run doctor
```

Compatibility wrappers are still available from the repository root:

```bash
npm run mobile:install
npm run mobile:dev:customer
npm run mobile:dev:provider
npm run mobile:typecheck
npm run mobile:doctor
```

This layout keeps mobile portable as one folder so it can be moved to a standalone repository with minimal script changes.

## Graphify

`graphifyy` is installed as a dev dependency and provides the `graphify` CLI.

For Codex parallel extraction, enable multi-agent mode in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

Factory Droid uses the Task tool for parallel subagent dispatch.

Add a root `.graphifyignore` file to exclude folders you do not want included in graph extraction.

Graph output is written to `graphify-out/`.

Project commands:

```bash
npm run graphify:rebuild
npm run graphify:watch
npm run graphify:query -- "your question"
```

## Backend Integration (Supabase)

1. Copy `.env.example` to `.env.local` and set:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- Optional booking ops alerts: `DISCORD_BOOKING_WEBHOOK_URL`, `DISCORD_BOOKING_ALERTS_ENABLED`, `DISCORD_BOOKING_MENTION`
2. Run SQL migrations in order inside Supabase SQL Editor:
	- `infra/supabase/001_initial_schema.sql`
	- `infra/supabase/002_rls_policies.sql`
	- `infra/supabase/003_storage_setup.sql`
	- `infra/supabase/004_booking_engine.sql`
	- `infra/supabase/005_provider_blocks.sql`
	- `infra/supabase/006_users_email_unique.sql`
	- `infra/supabase/007_users_profile_fields.sql`
	- (Optional for existing data) `infra/supabase/009_backfill_users_profile_fields_example.sql`
	- `infra/supabase/008_enforce_users_profile_required.sql`
	- `infra/supabase/010_users_updated_at_trigger.sql`
	- `infra/supabase/011_users_photo_url.sql`
3. Enable Email OTP auth in Supabase Auth settings.
4. Add redirect URLs in Supabase Auth settings:
	- `http://localhost:3000/auth/callback`
	- `http://localhost:3001/auth/callback`
	- `http://localhost:3002/auth/callback`
	- Your production callback URL, e.g. `https://your-domain.com/auth/callback`
5. Keep `SUPABASE_SERVICE_ROLE_KEY` configured in deployment env vars (used by pre-signup validation route).
6. For provider accounts, set `provider_id` in user `app_metadata` to map auth users to `providers.id`.

### Supabase Migration Workflow

1. Ensure `SUPABASE_DB_URL` is set.
2. Apply pending SQL migrations with tracking:
	- `npm run db:migrate`
3. Check migration status:
	- `npm run db:migrate:status`

Migration files are read from `infra/supabase/migrations` and tracked in `public.schema_migrations`.

### Supabase Type Generation

1. Set `SUPABASE_PROJECT_ID` in your shell environment.
2. Generate typed database definitions:
	- `npm run db:types`

Output file: `lib/supabase/database.types.ts`

### Google Ads Conversion Tracking

The Google Ads global tag is centralized in `app/layout.tsx` and booking conversions fire from the stable thank-you URL `/forms/customer-booking/thank-you` before the customer is redirected to their booking confirmation.

Production booking conversion tracking stays behind an explicit feature flag. Set this in the deployment environment when Google Ads should count confirmed bookings:

- `BOOKING_CONVERSION_TRACKING_ENABLED=true`

The default Google Ads account and booking conversion label are `AW-17976541101` and `6bf3CKWwibQcEK3_8PtC`. Override them only if Google Ads issues a new account ID or conversion label:

- `GOOGLE_ADS_ID=AW-17976541101`
- `GOOGLE_ADS_BOOKING_CONVERSION_LABEL=6bf3CKWwibQcEK3_8PtC`

### Production Rollout Checklist

1. Run `006` + `007` in staging and verify signup + sign-in.
2. Backfill existing users with `009` only if required (if null fields exist).
3. Run `008` to enforce required profile fields (`address`, `age`, `gender`).
4. Verify duplicate email and phone checks return `409` on signup.
5. Verify callback flow auto-creates user profile after email OTP verification.
6. Promote the same migration order to production.

### Key Routes

- Auth: `/auth/sign-in`
- User dashboard: `/dashboard/user`
- Service Provider Dashboard: `/dashboard/provider`
- Admin dashboard: `/dashboard/admin`
- Booking flow: `/forms/customer-booking`

## Project Structure

- `app/`: App Router pages, global styles, and SEO metadata
- `components/`: Reusable UI sections and shared UI pieces
- `lib/theme.ts`: Centralized theme tokens and shared layout classes
- `lib/site-data.ts`: Centralized content for sections, links, and imagery

## Ops Runbooks

- Billing reminder automation: `BILLING_AUTOMATION_RUNBOOK.md`
- Operational alerts and SLOs: `OPERATIONS_ALERTS_SLOS.md`
- Single-environment mobile rollout: `SINGLE_ENV_RELEASE_PLAYBOOK.md`
- Monitor specs: `infra/monitoring/datadog-monitors.json`, `infra/monitoring/prometheus-rules.yaml`
- Alertmanager template: `infra/monitoring/alertmanager-config.example.yaml`
- Admin operational SLI endpoint: `GET /api/admin/ops/sli`
- Load/perf gate: `npm run test:load:core`
- Release readiness gate: `npm run release:gate`

### Mobile Bearer Smoke Shortcuts

Copy a valid website user JWT access token to macOS clipboard, then run:

```bash
npm run test:mobile:bearer-smoke:clipboard:local
npm run test:mobile:bearer-smoke:clipboard:prod
```

The clipboard helper validates token shape and claims before running smoke checks.

## Sections

- Navbar
- HeroSection
- ServicesSection
- HowItWorksSection
- CTASection (customer booking)
- ProviderSection
- Footer
