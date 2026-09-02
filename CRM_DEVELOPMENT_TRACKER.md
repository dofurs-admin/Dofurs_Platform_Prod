# Dofurs CRM Development Tracker

Last audited: 2026-09-02
Applies to: `lib/crm/**`, `app/api/admin/crm/**`, `components/dashboard/admin/tabs/CrmTab.tsx`, `app/dashboard/admin/crm/**`, CRM migrations (`infra/supabase/migrations/096…`, `097…`), and the Gaze lead layer (`lib/gaze/leads.ts`)

Related documents:

- `GAZE_DEVELOPMENT_TRACKER.md` — the Gaze-side tracker (the lead layer spans both)
- `CLAUDE.md` — project architecture and conventions
- `SINGLE_ENV_RELEASE_PLAYBOOK.md` — deployment workflow
- The CRM feasibility analysis (delivered in-session, 2026-09-02) — requirement source: **Lead → Contact/Customer → Booking → Grooming → Payment → Repeat Customer** with marketing attribution **Source/Campaign → Lead → Customer → Booking → Revenue**

## Purpose

This file is the source of truth for the in-house CRM build. Agents and developers MUST update it whenever they complete, defer, reopen, or validate CRM work — including data-model changes, importer changes, UI changes, environment changes, and production deployment steps.

A table, route, or UI existing is not enough to mark work complete. A feature is complete only when its backend contract, failure handling, and documented validation succeed.

## Agent Update Rules

1. Read this file before making any CRM change.
2. Update this file in the same session as the code change — never leave it stale.
3. Change an item to `[x]` only after implementation AND validation succeed; record the command + result in the Validation Log.
4. Mark intentionally deferred work `DEFERRED` with a reason in the Decision Log; never silently drop a requirement.
5. Distinguish these states:
   - `NOT STARTED` — no meaningful implementation.
   - `BUILT` — code exists, not validated.
   - `DEV VERIFIED` — validated on the local dev server against the production Supabase (careful: local dev writes to prod DB).
   - `PRODUCTION VERIFIED` — deployed to Render and validated on https://dofurs.in.
6. Never treat route existence, API wiring, or no-op lint/test scripts as completed functionality.
7. Keep the Data Notes section current (import counts, mapping rates, known data quirks).
8. After code changes, run `npx graphify hook-rebuild` per `AGENTS.md`.

## Current Executive Status

| Area | State | Notes |
|---|---|---|
| Data model (migrations 096, 097) | **APPLIED TO PROD DB** | `crm_leads`, `crm_lead_activities`, `crm_sheet_import_runs` live; RLS admin/staff only |
| CRM admin UI + APIs (Phase 1) | **DEV VERIFIED** (leads pagination fix 2026-09-02 — UI re-verify pending) | Fully working on localhost dev server; code NOT yet committed or deployed |
| Lead attribution display | **DEV VERIFIED** | `source_details` rendered in Lead Detail modal |
| Meta Google-Sheet import (Phase 4a) | **DEV VERIFIED** | 392 leads imported into prod DB via dev admin UI; cron NOT scheduled yet |
| Lead location enrichment (manual pincode/address + hot toggle) | **DEV READY — migration 098 applied** | Owner applied + columns verified; UI dev-verification pending |
| Phase 2 — Sales workflow (assignment, follow-ups, alerts, lost reasons) | **BUILT 2026-09-02 — dev verification pending** | Least-loaded auto-assign, Due follow-ups queue, staff/reassign selects, in-app + Discord alerts, lost-reason vocabulary + summary |
| Phase 3 — Website leads (enquiry form + abandoned bookings) | **BUILT 2026-09-02 — migration 099 pending** | Contact form live on dev; booking-flow telemetry + sweep built; needs migration 099 + cron |
| Phase 4b — Direct Meta webhook | **IGNORED (owner, 2026-09-02)** | Sheet import remains the Meta channel; revisit only if the owner re-opens it |
| Phase 5 — Customer 360 | **BUILT 2026-09-02 — dev verification pending** | Modal in CRM tab; click any customer name |
| Phase 6 — Retention | **BUILT 2026-09-02 — dev verification pending** | "Repeat grooming due" card: minimized by default + cadence filter (30/60/90/120 d) + Previous/Next pagination (added 2026-09-02); automated outbound messaging still blocked (no sender) |
| Phase 7 — Analytics | **BUILT 2026-09-02 — dev verification pending** | Campaign performance table + leads CSV export |
| Cron automation + Render env | **NOT STARTED** | `CRM_SHEET_IMPORT_SECRET` + Google env vars must be set on Render; cron job must be added |
| Commit + production deploy | **NOT STARTED** | All CRM code uncommitted on `feature/crm-tool-development` |
| Phase 2 — Sales workflow | **BUILT — dev verification pending** | See "Phase 2 — Sales Workflow" section |
| Phase 3 — Website leads | **BUILT — migration 099 pending** | See "Phase 3 — Website Leads" section |
| Phase 4b — Direct Meta webhook | **IGNORED (owner)** | See Decision Log |
| Phase 5 — Customer 360 | **BUILT — dev verification pending** | See "Phase 5 — Customer 360" section |
| Phase 6 — Retention | **BUILT — dev verification pending** | See "Phase 6 — Retention" section |
| Phase 7 — Analytics | **BUILT — dev verification pending** | See "Phase 7 — Analytics" section |

## Phase 1 — Foundation (COMPLETE, DEV VERIFIED)

- [x] Migration 096: `crm_leads` + `crm_lead_activities`, enums (`crm_lead_source` incl. all future sources, `crm_lead_status`, `crm_lead_activity_type`), unique `(source, external_lead_id)`, RLS admin/staff, indexes, updated_at trigger — applied to prod
- [x] `lib/crm/lead-transition-guard.ts` — lifecycle `new → contacted → interested → follow_up → converted`, `lost`/`cancelled` terminal (7 unit tests)
- [x] `lib/crm/service.ts` — duplicate-aware `createManualLead` via `createCustomerProfileForBooking` (never a second Customer ID), list/summary, detail (activities + converted booking), guarded status transitions, assignment validation (admin/staff only), conversion requires a same-customer booking, activities with auto-advance out of `new`
- [x] Admin APIs: `GET/POST /api/admin/crm/leads`, `GET/PATCH /api/admin/crm/leads/[id]`, `POST /api/admin/crm/leads/[id]/activities` — admin/staff, Zod, rate-limited, `logAdminAction` audited
- [x] UI: `CrmTab` — summary cards (incl. hot + overdue follow-ups), status filters, search, leads table, create-lead modal, lead-detail modal, "Attribution & lead details" section, activity form + timeline
- [x] Leads table pagination (fix 2026-09-02): the UI fetched only the newest 50 leads (`limit=50`, no offset, no paging UI) while the summary cards showed the true total — read as "leads missing from the tool". `listCrmLeads` now returns `{ leads, total }` (`includeTotal` exact filtered count via a shared-filter head-count query), the list API returns `pagination.total`, and the table has Previous/Next + "Showing X–Y of Z" with page reset on filter/search change and a snap-back guard for shrunken result sets
- [ ] Dev-verify pagination on localhost: table shows "Showing 1–50 of 392 leads" on "All leads" and Previous/Next page through every lead (incl. with a status filter applied)
- [x] Nav integration (`AdminWorkspaceShell` CRM item, `AdminDashboardShell` crm view)

## Lead Location Enrichment (BUILT 2026-09-02 — apply migration 098, then verify)

- [x] Migration 098 applied to prod: `crm_leads.pincode` + `crm_leads.address` (≤500), pincode index, activity enum values `location_updated` + `priority_changed` — applied by owner 2026-09-02; columns verified read-only (sample query OK)
- [x] `normalizeLeadPincode` helper (6 digits; empty clears) in `lib/crm/service.ts`
- [x] `createManualLead` accepts optional `pincode`/`address`
- [x] `updateCrmLead` accepts `pincode`/`address`/`priority` (open leads only; `location_updated` + `priority_changed` activities logged)
- [x] API schemas extended (create POST + PATCH) with 6-digit pincode validation
- [x] UI: pincode + address fields in create-lead modal; "Location & priority" edit section (Save location, Mark/Clear hot) in lead detail; pincode/address shown in info panel
- [x] Gaze consumption: manual pincode wins for plotting; reverse-lookup `matchLeadAreaByPincode` assigns the area when the text fails (tested)
- [x] Dev-verify on localhost: set a pincode on a test lead → confirm it appears in the Gaze lead layer — E2E verified 2026-09-02 (pincode 560102 set, lead listed, activity logged)

## Phase 4a — Meta Leads Google-Sheet Import (COMPLETE, DEV VERIFIED)

- [x] Migration 097: `crm_sheet_import_runs` run-history — applied to prod
- [x] `google-auth-library` dependency (service-account JWT auth)
- [x] `lib/crm/sources/meta-sheet.ts` — multi-tab reader with `GOOGLE_SHEETS_LEADS_TABS` allow-list, tolerant header mapping (Meta default export + custom questions), phone E.164 normalization, stable external IDs (`lead:<meta id>` preferred), unknown columns passed through to `source_details.extra_fields` (tested)
- [x] `lib/crm/service.ts` — `createInboundLead` (idempotent upsert; customer match-or-create; skips staff/provider accounts; cron-run audits attributed to first admin) + `runMetaSheetImport` (distributed lock, dry-run, per-row error handling, run history, Discord ops alert on failure)
- [x] API `GET/POST /api/admin/crm/imports/meta-sheet` — dual auth (admin/staff session OR `CRM_SHEET_IMPORT_SECRET`), dry-run mode
- [x] `scripts/run-crm-meta-sheet-import.mjs` cron runner (mirrors billing scheduler pattern)
- [x] UI: import card (last-run status, dry run, import now) in `CrmTab`
- [x] History import executed: **392 leads imported into prod** (tabs "After July 10" + "Main Sheet"); re-runs skip already-imported rows (idempotency verified)
- [ ] `CRM_SHEET_IMPORT_SECRET` set on Render + 15-min cron job added — **required before production automation**
- [ ] Tab decision: confirm whether "Sheet3" (62 leads) is customer leads and add to `GOOGLE_SHEETS_LEADS_TABS` if so

## Phase 2 — Sales Workflow (BUILT 2026-09-02 — dev verification pending)

- [x] **Least-loaded auto-assignment** — `pickLeastLoadedAssignee` (pure, 5 unit tests) + `pickAutoAssignee`; applies to manual creation (when no explicit assignee) and every sheet-imported lead; env kill-switch `CRM_LEAD_AUTO_ASSIGN=false`; explicit assignment validated admin/staff only
- [x] **Manual assignment UI** — "Assign to (optional)" select in create-lead modal (staff list from API), "Assign to me" + "Reassign to… Apply" in lead detail
- [x] **Assignee notifications** — in-app `crm.lead_assigned` notification on every assignment path (create, import, update/reassign); notification failures never break lead flow
- [x] **Follow-up queue** — `due=true` API filter (open leads with `next_followup_at` ≤ now) + "Due follow-ups (N)" filter chip on the Leads dashboard (N from summary `overdue_followups`)
- [x] **Discord ops alerts** — new manual lead (per lead), hot-lead flagged (per flag), Meta import summary (one per run, only when something imported)
- [x] **Lost-reason handling** — inline "Why was this lead lost?" form with fixed vocabulary (No response / Price too high / Booked elsewhere / Out of coverage area / Not interested / Other + custom text) replacing the raw prompt; top-5 lost-reasons summary strip on the Leads dashboard
- [x] Dev-verify on localhost: create lead (auto-assign), due filter, reassign, mark lost with reason, hot toggle alert, notifications — E2E verified 2026-09-02 (all paths exercised service-level)

## Phase 3 — Website Leads (BUILT 2026-09-02 — migration 099 pending; Google attribution DEFERRED by owner)

- [x] Migration 099 applied to prod: `crm_booking_sessions` (session telemetry, RLS service-role-only) — applied by owner 2026-09-02; table verified read-only (sample query OK)
- [x] Public enquiry endpoint `POST /api/crm/enquiry` — rate-limited (5/min/IP), Zod, honeypot, `createWebsiteEnquiryLead` with 60-min dedupe + auto-assign + notifications + Discord alert
- [x] Contact-us enquiry form (`components/site/EnquiryForm.tsx` + `enquiry-fields.tsx`) wired into `app/contact-us/page.tsx`
- [x] Booking-flow telemetry: `lib/crm/booking-session-client.ts` + `POST /api/crm/booking-progress` (public, rate-limited 60/min/IP); `PremiumUserBookingFlow` reports step/service/pets/date + `booked` on confirmation (best-effort, never blocks booking)
- [x] Abandoned-booking sweep: `runAbandonedBookingSweep` (lock, 30-min inactivity, idempotent via `external_lead_id = session:<key>`) → **hot leads** (`website_abandoned_booking`) + assignee notifications + Discord alert; sessions without contact expire after 24h
- [x] Sweep endpoint `POST /api/admin/crm/abandoned-bookings/run` (admin session OR automation secret, dry-run support) + cron script `scripts/run-crm-abandoned-bookings-sweep.mjs`
- [ ] Add the abandoned-bookings cron on Render (every 15 min) — required for automatic hot-lead capture
- [ ] Dev-verify: submit the contact form → lead appears; partial booking → hot lead after sweep
- UTM/GCLID/referrer capture — **DEFERRED (owner, 2026-09-02; only Meta is live)**

## Phase 4b — Direct Meta Webhook (IGNORED BY OWNER 2026-09-02)

The owner dropped this from the roadmap; the Google-Sheet import remains the only Meta channel. Reopen only on explicit owner request — the design remains additive (webhook would reuse `createInboundLead`).

## Phase 5 — Customer 360 (BUILT 2026-09-02 — dev verification pending)

- [x] `getCrmCustomer360` service — user, pets, addresses, last 20 leads (with attribution), last 20 bookings, lifetime paid amount (payment_transactions), grooming cadence (last completed date, next recommended = +30d, days since)
- [x] API `GET /api/admin/crm/customers/[userId]` (admin/staff)
- [x] UI: Customer 360 modal — opened by clicking any customer name in the leads table or the "Customer 360" button in lead detail; pets + address chips, lifetime paid, last/next grooming (red when overdue), lead history, booking history
-[x] E2E service-verified 2026-09-02 (Customer 360 returned correct user, leads, grooming cadence)

## Phase 6 — Retention (BUILT 2026-09-02 — dev verification pending)

- [x] `listRetentionCandidates` — customers with completed bookings whose last grooming is (cadence − 5-day outreach lead time) old, excluding those with an open lead (no double-pipeline); supports cadence filter + offset pagination and returns `{ candidates, total }` with the exact in-memory total
- [x] API `GET /api/admin/crm/retention` — `days` (30/60/90/120, default 30), `limit` (default 10, max 100), `offset`; returns `candidates` + `total` + `pagination`
- [x] UI: "Repeat grooming due" card on the Leads dashboard — **minimized by default** (header shows the due count, expand/collapse toggle), "Recommended every" cadence chips (30/60/90/120 days; page resets on change), candidates with last-grooming date, next-recommended date, days since, lifetime value + **Create follow-up lead** button (reuses the manual-lead create with a pre-filled retention note), Previous/Next pagination ("Showing X–Y of Z", 10/page, snap-back guard)
- [x] Customer 360's next-recommended-grooming stays fixed at 30 days (`GROOMING_RECURRENCE_DAYS`); the retention cadence is a separate UI-selectable filter (`RETENTION_RECOMMENDED_DAY_OPTIONS` / `RETENTION_LEAD_TIME_DAYS` in `lib/crm/types.ts`, shared by service + API + UI)
- [ ] Dev-verify on localhost: section renders minimized → expand → 30-day default shows "Showing 1–10 of N"; cadence chips 60/90/120 change the list and header count; Previous/Next page through all candidates
- [ ] Automated outbound reminders remain BLOCKED until a sender service (email/WhatsApp) is chosen — owner decision pending

## Phase 7 — Analytics (BUILT 2026-09-02 — dev verification pending)

- [x] `listCampaignPerformance` — per campaign (name + campaign_id): total/open/converted/lost leads, conversion %, revenue (final_price of bookings behind converted leads, chunked lookups)
- [x] API `GET /api/admin/crm/analytics/campaigns`
- [x] UI: "Campaign performance" table on the Leads dashboard (top 8 campaigns with conversion % and revenue)
- [x] CSV export: `buildLeadsCsv` (18 columns incl. campaign/adset/ad/area/pincode/lost reason) + `GET /api/admin/crm/leads/export` (Content-Disposition attachment) + "Export CSV" button
-[x] E2E service-verified 2026-09-02 (campaign analytics returned 2 campaigns; CSV export built 18-column headers; revenue column populated for converted leads)

## Deployment Checklist (must be done in order)

- [ ] Commit all CRM files on `feature/crm-tool-development` (never `.env.local`)
- [ ] Deploy to Render; verify CRM tab + `/api/admin/crm/*` on https://dofurs.in
- [ ] Render env: `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_LEADS_SPREADSHEET_ID`, `GOOGLE_SHEETS_LEADS_TABS` (same values as local)
- [ ] Render env: `DISCORD_CRM_WEBHOOK_URL` — webhook for the dedicated CRM alerts Discord channel (until set, CRM alerts fall back to the booking webhook with a `console.warn`)
- [ ] Generate + set `CRM_SHEET_IMPORT_SECRET` (`openssl rand -hex 32`)
- [ ] Add Render cron: `CRM_IMPORT_BASE_URL=https://dofurs.in CRM_SHEET_IMPORT_SECRET=… node scripts/run-crm-meta-sheet-import.mjs` every 15 min
- [ ] Add Render cron: `CRM_IMPORT_BASE_URL=https://dofurs.in CRM_SHEET_IMPORT_SECRET=… node scripts/run-crm-abandoned-bookings-sweep.mjs` every 15 min
- [ ] Dry-run on prod → import → verify lead KPIs

## Data Notes (keep current — last measured 2026-09-02)

- 392 Meta leads imported; all still `status = new` (open)
- Lead form has **no email question** — all leads are phone-based (phone-only customer profiles, invite-free)
- Sheet tabs: allow-list = "After July 10" + "Main Sheet"; EXCLUDED deliberately: "Hiring Groomers" (job applicants), "Experiment_Ad_Copy" (test data), "Sheet3" (pending owner confirmation, 62 leads)
- `external_lead_id` = `lead:<Meta lead id>` — re-imports can never duplicate
- Area answers are free text: top values include junk ("Yes", "Grooming") — see Gaze tracker for mapping rate
- Historical revenue/bookings have no lead attribution (source data never existed) — reports must show source `unknown` for pre-CRM history
- Root cause of "leads missing from the tool" (fixed 2026-09-02): the leads table was capped at its first page (50 rows, offset pagination existed in the API but was never used by the UI; the API also hard-capped `limit` at 100). All 392 leads were in the DB and in the CSV export (which scans 5000) — a listing-only gap, no data loss. Secondary caps to know: search pre-filters matching customers to 50 users, and the API still caps `limit` at 100 per page
- Retention cadence (added 2026-09-02): "due" threshold = selected recommendation (30/60/90/120 d) − 5-day outreach lead time → 25/55/85/115 days since last grooming; the 30-day default preserves the old fixed 25+ behavior. Exact candidate total is computed in memory from the last-1000-completed-bookings scan — if completed bookings ever exceed 1000 rows, older customers could be missed (pre-existing scan cap, same as before)

## Validation Log

| Date | Command | Result |
|---|---|---|
| 2026-09-02 | `npx vitest run lib/crm` | 20/20 pass (guard 7, meta-sheet mapping 12, passthrough 1) |
| 2026-09-02 | `npx vitest run` (full suite) | 379 passed / 0 failed / 1 pre-existing skipped |
| 2026-09-02 | `npx tsc --noEmit` | 0 CRM errors (9 pre-existing in unrelated legacy tests) |
| 2026-09-02 | `npm run lint` | clean for all CRM files (1 pre-existing error in untouched `middleware.bearer.test.ts`) |
| 2026-09-02 | Read-only pre-flight vs live Google Sheet | AUTH OK; 8 tabs enumerated; header rows verified |
| 2026-09-02 | Dry run + real import via dev admin UI | 392 leads created in prod; second run skipped all (idempotency) |
| 2026-09-02 | Read-only DB check of imported `source_details` | all attribution keys present (campaign/adset/ad/form ids, pet_info, city, platform) |
| 2026-09-02 | Read-only PostgREST embed check | confirmed ambiguous `users(name)` embed fails; `users!crm_leads_user_id_fkey(name)` works (5/5) |
| 2026-09-02 | `npx vitest run lib/gaze lib/crm` (location enrichment) | 59/59 pass incl. pincode reverse-lookup + manual-pincode plotting precedence |
| 2026-09-02 | `npx vitest run` (full suite) | 383 passed / 0 failed |
| 2026-09-02 | Read-only check after owner applied migration 098 | `crm_leads.pincode` + `.address` columns live; sampled rows return nulls as expected |
| 2026-09-02 | `npx vitest run lib/crm lib/gaze` (Phase 2) | 64/64 pass incl. 5 assignment-engine tests |
| 2026-09-02 | `npx vitest run` (full suite) | 388 passed / 0 failed |
| 2026-09-02 | `npx tsc --noEmit` + `npm run lint` (Phases 3/5/6/7) | 0 new errors/warnings (9 pre-existing tsc + 1 pre-existing lint, both in unrelated legacy files) |
| 2026-09-02 | `npx vitest run` (full suite, after all phases) | 388 passed / 0 failed |
| 2026-09-02 | Read-only check after owner applied migration 099 | `crm_booking_sessions` live; sampled rows return empty as expected |
| 2026-09-02 | **E2E service-level test (real prod DB, temp test file, deleted after)** | enquiry + dedupe ✓ / auto-assign ✓ / location + priority + status transitions + lost ✓ / activity timeline (7 events) ✓ / Customer 360 ✓ / abandoned-booking sweep dry-run → run → hot lead → idempotency ✓ / retention candidates (50 found) ✓ / campaign analytics (2 campaigns, 389 leads) ✓ / CSV export (18 cols) ✓ |
| 2026-09-02 | **Bug fixed during E2E**: `updateCrmLead` never wrote `status` to the row (the update payload omitted it — status transitions silently no-oped). Root cause: the status block built `activityInserts` and side-field updates but forgot `update.status = input.status`. Fix: one line added at the top of the status block. | Caught by E2E; would have been a critical prod bug (status changes from UI/API would never persist) |
| 2026-09-02 | Test data cleanup | All 99999xxxxx users, leads, activities, notifications, and booking sessions deleted; verified 0 remaining |
| 2026-09-02 | Leads pagination fix — `npx tsc --noEmit` + `npx eslint lib/crm/service.ts app/api/admin/crm/leads components/dashboard/admin/tabs/CrmTab.tsx app/api/admin/crm/leads/export` + `npm run test` | 0 CRM type errors/warnings (only pre-existing unrelated test-file tsc errors); 388 passed / 0 failed |
| 2026-09-02 | Leads pagination fix — UI dev-verification | PENDING (open CRM tab, confirm "Showing 1–50 of 392 leads" + Previous/Next, incl. with status filter) |
| 2026-09-02 | Retention cadence filter + collapse + pagination — `npx tsc --noEmit` + `npx eslint lib/crm/types.ts lib/crm/service.ts app/api/admin/crm/retention components/dashboard/admin/tabs/CrmTab.tsx` + `npm run test` | 0 CRM type errors/warnings (only pre-existing unrelated test-file tsc errors); 388 passed / 0 failed |
| 2026-09-02 | Retention UI dev-verification | PENDING (minimized by default → expand → cadence chips 30/60/90/120 → "Showing 1–10 of N" + Previous/Next) |
| 2026-09-02 | CRM Discord channel split — `npx vitest run lib/crm/ops-alert.test.ts` + `npx eslint lib/crm/ops-alert.ts lib/crm/ops-alert.test.ts` + `npx tsc --noEmit` | 5/5 pass (CRM webhook preferred, booking-webhook fallback warns, disable flag, not_configured, http_500); 0 lint errors; 0 new tsc errors |

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-02 | Build CRM in-house, not external CRM | Feasibility analysis: bookings/pets/payments/identity already native; external CRM would duplicate customers and break attribution |
| 2026-09-02 | Lead = event on `users`; repeat enquiry = new lead on the same Customer ID | Preserves `users.phone` unique constraint; no duplicate customers |
| 2026-09-02 | `lost`/`cancelled` are terminal; reopen is forbidden | Clean pipeline math; new enquiries create new leads |
| 2026-09-02 | Conversion (`status=converted`) requires a booking of the same customer | Correct-by-construction attribution |
| 2026-09-02 | Sheet import before direct Meta webhook (Phase 4a before 4b) | Experiment isolation; no Meta app review lead time; additive upgrade later |
| 2026-09-02 | Tab allow-list env (`GOOGLE_SHEETS_LEADS_TABS`) | Workbook contains non-customer tabs (hiring applicants, experiments) that must never become customers |
| 2026-09-02 | Unknown sheet columns passed through to `extra_fields` | Future form questions never silently lose data |
| 2026-09-02 | Lead-layer failures must `console.warn`, never degrade silently | The silent PostgREST embed ambiguity bug hid zero-lead state for a full session — loud fallbacks only |
| 2026-09-02 | Cron-run customer creation audited to the first admin | `admin_audit_log.admin_user_id` is NOT NULL FK; no human actor exists for cron |
| 2026-09-02 | Outbound messaging (email/WhatsApp) out of scope until a sender exists | Platform has no sender infra; outreach stays manual + logged as activities |
| 2026-09-02 | WhatsApp enters as manual `source` now; full Cloud API later | `whatsapp` source value reserved in the enum from day one for forward compatibility |
| 2026-09-02 | Manual location = real columns (`crm_leads.pincode`/`address`), not `source_details` JSON | Owner-requested staff enrichment; indexed column is directly consumable by Gaze; JSONB stays machine-imported attribution only |
| 2026-09-02 | Manual pincode wins for plotting; area text still groups the area | Explicit human-entered location is the most accurate coordinate signal |
| 2026-09-02 | Priority (hot) editable on open leads via PATCH + UI toggle | Staff need to flag urgency while working the pipeline; every change logged as `priority_changed` activity |
| 2026-09-02 | Google Ads attribution deferred by owner | Only Meta is live; revisit alongside Phase 3 website capture |
| 2026-09-02 | Phase 4b (direct Meta webhook) ignored by owner | Sheet import is the Meta channel; webhook design stays additive for a future reopen |
| 2026-09-02 | Least-loaded assignment (not round-robin) | Balances actual pipeline load instead of rotation; ties resolve to earliest-created staff for stability |
| 2026-09-02 | Auto-assignment ON by default, env kill-switch `CRM_LEAD_AUTO_ASSIGN=false` | Sheet leads arrive unattended and must not sit unassigned; kill-switch for experimentation |
| 2026-09-02 | Import Discord alert = one summary per run | Per-lead alerts would spam 390 messages during backfills |
| 2026-09-02 | Fixed lost-reason vocabulary + custom "Other" | Keeps the top-lost-reasons summary meaningful for Phase 7 reporting |
| 2026-09-02 | `crm.lead_assigned` added to `NotificationType` | In-app notifications are the existing staff channel; type union extended additively |
| 2026-09-02 | Public enquiry = contact form with honeypot + 5/min/IP rate limit + 60-min dedupe | Spam-resistant without auth friction; dedupe stops repeat submissions from creating duplicate leads |
| 2026-09-02 | Abandoned bookings: session telemetry table + 30-min sweep (not real-time events) | Reuses the proven lock+cron pattern; idempotent per session via `external_lead_id`; no new infrastructure |
| 2026-09-02 | Abandoned sessions without contact info are expired (24h), not converted to leads | Customer identity requires phone; contactless sessions cannot become CRM customers |
| 2026-09-02 | Booking-flow telemetry is best-effort and never surfaces errors to the customer | The booking flow is production-critical; telemetry failures must be invisible |
| 2026-09-02 | Retention candidates = 25+ days since last grooming, open-lead users excluded | 30-day grooming recommendation minus 5-day lead time; avoids double-pipeline |
| 2026-09-02 | Retention follow-ups created as manual leads with pre-filled notes (not a new source type) | Avoids enum migration; notes carry the retention context; assignment machinery reused |
| 2026-09-02 | Campaign revenue = final_price of bookings behind converted leads | Direct lead→booking→revenue attribution; historical (pre-CRM) revenue stays source-unknown |
| 2026-09-02 | E2E booking-session test uses delete-then-insert, not upsert | The BEFORE UPDATE trigger on `crm_booking_sessions` resets `updated_at = now()`, making upserted stale sessions non-stale; delete-then-insert preserves the injected timestamp |
| 2026-09-02 | Leads table paginated (50/page) with a filtered exact-count total instead of raising limits | The UI requested only the newest 50 leads while the summary cards scanned 5000 rows — the mismatch read as "missing leads". Offset pagination + a `count: 'exact'` head query from the same shared filter builder keeps payloads small and the total exact; if the count query fails it degrades to `null` (UI falls back to fetched count) and never fails the list |
| 2026-09-02 | Retention "due" threshold derived from the selected cadence (cadence − 5-day lead time) instead of a fixed 25 days | Keeps the outreach lead-time model intact at every cadence; 30 days preserves the previous 25-day behavior exactly |
| 2026-09-02 | Retention section minimized by default with the due count shown in the collapsed header | It is a supplementary card on the leads dashboard — staff expand it when working follow-ups; the count keeps it discoverable without occupying space |
| 2026-09-02 | Retention pagination total computed in memory, not via a DB count query | Candidate eligibility is post-processing (last-1000-completed-bookings scan + open-lead exclusion), so the exact total falls out of the same computation — no extra query, always consistent with the viewed page |
| 2026-09-02 | Customer 360's next-recommended date stays fixed at 30 days while the retention list is cadence-filterable | Customer 360 describes one customer's own cadence; the retention filter is an outreach-window selector, not a per-customer cadence change |
| 2026-09-02 | CRM Discord alerts route to `DISCORD_CRM_WEBHOOK_URL` (new dedicated channel), falling back to `DISCORD_BOOKING_WEBHOOK_URL` with a `console.warn` while unset | Owner created a separate CRM alerts channel; fallback keeps alerts flowing (never silently lost) during env rollout instead of hard-failing |

## Risks

- Local dev writes to the **production** Supabase — smoke-test data must be cleaned explicitly (no delete API by design; use `DELETE FROM crm_leads WHERE …`)
- The sheet becomes critical infrastructure for lead capture until Phase 4b (direct webhook)
- Lead volume caps: import scans ≤ 2000 rows, gaze lead layer ≤ 2000 — revisit if Meta volume grows 5×


