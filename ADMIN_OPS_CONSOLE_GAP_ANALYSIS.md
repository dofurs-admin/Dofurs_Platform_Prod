# Dofurs Admin Ops Console — Gap Analysis & Improvement Roadmap

**Date:** 2026-09-03
**Prepared by:** Council review — CTO, CEO, Operations, Business Development, UI/UX, Data & Business Analysis, and Engineering personas
**Scope:** The admin operations console (`/dashboard/admin/**`) — CRM (lead pipeline, Meta sheet import, sales workflow, website leads, Customer 360, retention, analytics), Gaze (geographic operations view + CRM lead layer), and the surrounding admin platform (workspace shell, data loading, automation, deployment, quality infrastructure).

**Related documents:**

- `CRM_DEVELOPMENT_TRACKER.md` — CRM source of truth (phases, validation log, decision log)
- `GAZE_DEVELOPMENT_TRACKER.md` — Gaze source of truth (layers, lead matching chain, data notes)
- `MOBILE_APP_DEVELOPMENT_READINESS_TRACKER.md` — mobile readiness (admin-facing APIs overlap)
- `SINGLE_ENV_RELEASE_PLAYBOOK.md` — deployment workflow
- `OPERATIONS_ALERTS_SLOS.md` — alerting and SLO conventions

**Status:** Analysis only. No codebase files were modified to produce this report — this file is the sole deliverable. Findings cite evidence (file paths, line references where stable) so they can be independently verified before action.

---

## Contents

1. Executive summary
2. Methodology, scope, and data baseline
3. Persona findings — CTO · CEO · Operations · Business · UI/UX · Data/BA · Engineering
4. Master gap register (46 items, domains A–E)
5. Prioritized roadmap — Now / 30 days / Quarter / Strategic
6. Strengths to preserve — what NOT to change
7. Open verification items
8. Appendix: evidence index
9. Owner reality filter — what one engineer ships now (solo, single environment)

---

## 1. Executive Summary

### 1.1 Verdict

The CRM and Gaze programs have moved the admin ops console forward significantly, and the engineering quality of what was built is high: lead lifecycle transitions are guarded server-side, conversion requires a same-customer booking (correct-by-construction attribution), imports and sweeps are idempotent behind distributed locks, automation reports out-of-band heartbeats with failure/recovery alerting, and admin routes consistently apply role checks + Zod validation + rate limits + audit logging. The tracker discipline (validation logs, decision logs, honest state labels) exceeds most commercial teams'.

**The gaps are not in what was built — they are in what surrounds it.** The council grouped them into five clusters:

| # | Cluster | One-line summary |
|---|---|---|
| 1 | Data correctness edge cases | UTC-vs-IST day boundaries; "all-time" centroids sampled from an unordered 2,000-row slice; a silent 2,000-lead cap |
| 2 | Operator affordances | No "My leads" filter, no bulk actions, Gaze↔CRM dead ends, silent retention-panel failures |
| 3 | Unmeasured business metrics | No speed-to-lead, no spend/ROAS, no funnel/cohort trends, no data-quality view |
| 4 | Quality infrastructure | No CI pipeline, zero UI tests, 6,109 lines of dead code, god modules, normalized tsc errors |
| 5 | Environment & governance risk | Local dev writes to production Supabase, binary admin/staff roles, cron-in-DB vs code deploys |

### 1.2 Top 10 gaps (highest priority first)

| Rank | ID | Gap | Priority | Effort |
|---|---|---|---|---|
| 1 | A1 | Gaze "Today" window and lead windowing computed in UTC — wrong for IST 00:00–05:30 daily | P0 | S |
| 2 | A2 | "All-time" pincode centroids: unordered `.limit(2000)` sample, recomputed on every request | P0 | S |
| 3 | B1 | No assigned-to/source/priority filters in the CRM UI — no "My leads" queue (auto-assign is OFF) | P0 | M |
| 4 | E1 | Single environment: local dev writes to the production database | P0 | M–L |
| 5 | D1 | Dead code: `AdminDashboardClient.tsx` (6,109 lines, zero importers) + 1-line re-export chunk | P0 | S |
| 6 | D6 | Retention/campaign panels fail silently — a dead panel reads as "no follow-ups due" | P1 | S |
| 7 | D8 | Zero component/UI tests; every recent UI regression was found manually | P1 | M |
| 8 | D7 | No CI gate — tests, tsc, lint, and render.yaml validation all run by hand | P1 | M |
| 9 | B2 | Speed-to-lead unmeasured; no new-lead aging SLA (the data already exists) | P1 | S |
| 10 | C2 | No URL/filter state in CRM and Gaze — refresh loses context, deep links impossible | P1 | M |

### 1.3 Scoring model

- **Priority:** `P0` correctness / security / ops-blocking · `P1` high value, near-term · `P2` important, this quarter · `P3` strategic / nice-to-have
- **Effort:** `S` < 1 day · `M` 1–3 days · `L` 1–2 weeks · `XL` multi-week / structural
- **Impact:** `High` / `Med` / `Low` — on revenue, ops efficiency, or risk
- **Owner:** the persona most accountable for driving the fix

Full findings with evidence follow in §3; the complete indexed register is §4; sequencing is §5.

---

## 2. Methodology, Scope, and Data Baseline

### 2.1 What was reviewed

**Full reads:** `components/dashboard/admin/tabs/CrmTab.tsx` (1,985 lines), `tabs/GazeTab.tsx` (675), `gaze/GazeMap.tsx` (596), `AdminDashboardShell.tsx` (468), `AdminWorkspaceShell.tsx` (nav/shell), `app/dashboard/admin/_data.ts`, `app/dashboard/admin/{page,crm/page,gaze/page}.tsx`, `app/api/admin/gaze/route.ts` (617), `app/api/admin/crm/leads/route.ts`, `app/api/admin/crm/leads/[id]/route.ts`, `app/api/admin/crm/leads/export/route.ts`, `app/api/crm/enquiry/route.ts`, `lib/crm/service.ts` (2,201), `lib/crm/automation-status.ts`, `lib/gaze/leads.ts`, `lib/gaze/aggregates.ts` (types/tiers), `lib/service-areas.ts` (structure), `middleware.ts`, `infra/render.yaml`, both development trackers (complete), `graphify-out/GRAPH_REPORT.md`.

**Cross-checks:** git history (CRM/Gaze commits `91a8aa0`→`80faa4f`); migrations 096–101 inventory; `npx tsc --noEmit` (9 pre-existing errors — verified all in test files); targeted greps for: CI workflows (none exist), `useSearchParams` (only Bookings/Services tabs), `AdminBulkActionToolbar` (bookings only), `adminRequest` helper (Services/Providers/Access only), `bookingsTruncated` surfacing (rendered in GazeTab), dead-import verification for `AdminDashboardClient`, notification surface in the shell, test census (68 `.test.ts` / 0 `.test.tsx`).

### 2.2 Data baseline (2026-09-03, trackers + read-only diagnostics)

- **Leads:** 403 total · 324 with pincode (~80%) · 320 with address · pipeline: new 250 / contacted 107 / converted 34 (24 booking-linked) / lost 10 / interested 1 / follow_up 1
- **Gaze lead mapping:** 159/392 matched to gazetteer areas (60 areas) · 28/60 areas with windowed coordinates · 39/60 with the all-time fallback · ~21 areas unplot (no booking history) · 79 leads unpinnable
- **Data quality:** free-text area answers include junk ("Yes" ×14, "Grooming" ×4); 2 sheet-vs-DB pincode conflicts (DB values kept)
- **Automation:** pg_cron + pg_net live — sweep every 1 min, Meta sheet import every 5 min, both Healthy; Apps Script push trigger not yet installed
- **Quality baseline:** 440 unit tests passing / 0 failed · 9 pre-existing tsc errors (test files only) · 0 component tests · no CI workflows
- **Deploy:** Render web service ×2 instances; CRM scheduling lives in the database (migration 101); billing crons on Render

### 2.3 Council personas

| Persona | Mandate |
|---|---|
| CTO | Architecture, security, scalability, operational risk, quality infrastructure |
| CEO | Strategy, revenue levers, growth, competitive positioning |
| Operations | Daily workflows, triage efficiency, alerting, friction |
| Business Development | Pipeline conversion, channel ROI, partnerships |
| UI/UX | Information architecture, interaction design, accessibility, consistency |
| Data & BA | Metric definitions, data quality, reporting, attribution |
| Engineering | Code health, maintainability, testing, performance |

---

## 3. Persona Findings

### 3.1 CTO — architecture, risk, security, scalability

**E1 · Single environment: local dev writes to the production database** — `P0` · `M–L` · Impact High
Evidence: `CRM_DEVELOPMENT_TRACKER.md` Risks ("Local dev writes to the production Supabase — smoke-test data must be cleaned explicitly"); the trackers' DEV VERIFIED state literally means localhost vs prod DB; mobile smoke scripts also target prod.
Why it matters: every dev verification, smoke test, and future hire is one bad query away from customer-data damage. There is no delete API by design — cleanup is manual SQL.
Recommendation: minimal mitigation now — a read-only Supabase role for routine dev + a fixture-seeded shadow project for write-path tests. Full staging is the strategic fix (§5.4).

**D7 · No CI pipeline** — `P1` · `M` · Impact High
Evidence: `.github/` contains only `agents/ prompts/ skills/` — no `workflows/`; every validation entry in both trackers is a manually run command.
Why it matters: the 2026-09-03 automation incident (cron dead for days; three-part migration-101 fix) is exactly the failure class a PR gate catches. The "9 pre-existing tsc errors" baseline is normalized across sessions instead of fixed.
Recommendation: GitHub Actions on PR + push to main: `npx vitest run`, `npx tsc --noEmit` (fix the 9 first), `npm run lint`, render.yaml parse (js-yaml). ~Half a day to stand up.

**D8 · Zero UI tests; no E2E** — `P1` · `M` · Impact High
Evidence: 68 server/lib `.test.ts`, 0 `.test.tsx`. The CRM tracker records three UI regressions found manually within ~48 h (pagination "missing leads", Customer-360 accidentally gated to open leads, missing Converted status option).
Why it matters: the console is now the primary revenue workflow; UI regressions are invisible until an operator hits them.
Recommendation: component tests for the highest-risk flows (filter→list→pagination, convert-picker, lost-reason form), then a Playwright smoke: create lead → activity → follow-up → convert via booking → CSV export.

**E3 · Binary role model (admin vs staff), no permission matrix** — `P1` · `S` · Impact Med
Evidence: `lib/auth/api-auth.ts` — `ADMIN_ROLES = ['admin', 'staff']` gates nearly every `/api/admin/**` route; only the Access view distinguishes (`canManageUserAccess={role === 'admin'}`).
Why it matters: destructive ops (provider delete, user delete/promote, bulk booking status) share the same gate as read-only analytics. As staff grows, least-privilege becomes a governance requirement.
Recommendation: document the current route × role matrix; decide intentional exceptions; encode admin-only for the destructive few. Promote/delete routes have tests — verify their role assertions match intent.

**D2 · Every admin page loads the full dashboard dataset** — `P1` · `M` · Impact Med
Evidence: all 14 `app/dashboard/admin/*/page.tsx` call `loadAdminDashboardData()` (`app/dashboard/admin/_data.ts`) — ~10 queries (200 bookings, providers, moderation items, applications, categories, catalog services, discounts, discount analytics) — and pass everything into `AdminDashboardShell`. CRM/Gaze/Health/Audit/Blog render tabs that use almost none of it.
Why it matters: slower TTFB on every admin navigation, wasted DB load, and coupling that blocks per-view optimization.
Recommendation: split `_data.ts` into per-view loaders; CRM/Gaze/Health/Audit pages load nothing extra.

**D3 · Gaze request cost × 60 s auto-refresh** — `P1` · `M` · Impact Med
Evidence: `app/api/admin/gaze/route.ts` runs 8+ queries per request (bookings ≤1,000, users, addresses, providers, clinic details, provider services ≤3,000, coverage pincodes ≤10,000, leads ≤2,000, plus all-time centroids: 2,000 bookings + 3,000 addresses). GazeTab auto-refreshes every 60 s; Render runs 2 instances; N operators = N refresh streams.
Recommendation: cache centroids + coverage (5–15 min TTL — they change rarely), add ETag/`Cache-Control` semantics for the overview response (see also A2).

**D10 · Cron-in-DB vs code deploys drift** — `P2` · `M` · Impact Med
Evidence: CRM scheduling lives in the database (migration 101, pg_cron + pg_net) while the app deploys via Render; the activation incident required fixing both the live DB and the migration file.
Recommendation: a Health-tab check verifying `cron.job` entries exist, are active, and match expected schedules (the Supabase Management API channel already used for diagnostics can read this).

**D11 · No application error tracking** — `P2` · `M` · Impact Med
Evidence: observability today = `console.warn/error`, Discord webhooks, CRM heartbeats. No Sentry-equivalent for server or client errors; client-side failures are invisible.
Recommendation: lightweight error tracking with source maps; pipe client `window.onerror` + route-handler 500s into it.

**E6 · PII exposure surface on the pin layer** — `P3` · `S` · Impact Low today
Evidence: Gaze "Exact booking pins" shows customer locations; gaze reads use the service-role client; layer toggles are not audit-logged.
Recommendation: when compliance matters, audit-log pin-layer enablement per user. Low priority at current team size.

**Security posture — verified positives:** every CRM admin route applies `requireApiRole(ADMIN_ROLES)` + Zod + rate limit + `logAdminAction`; automation secret via timing-safe compare; RLS admin/staff on `crm_leads` / `crm_lead_activities` / heartbeats (anon read verified to return nothing); public enquiry endpoint protected by honeypot + 5/min/IP + 60-min dedupe; heartbeat endpoint deliberately outside the middleware matcher with its own secret auth + rate limit; the middleware automation-route whitelist is explicit and documented.

### 3.2 CEO — strategy, growth, revenue

**B6 · No ROAS/CAC — campaign analytics without spend** — `P1` · `M` · Impact High
Evidence: `listCampaignPerformance` (`lib/crm/service.ts`) aggregates leads / converted / revenue per campaign (final_price of bookings behind converted leads). No spend dimension, no window filter (all-time only); Google Ads deferred; WhatsApp manual.
Why it matters: the campaign table ranks channels by revenue but cannot answer "which campaign pays for itself?" — the core paid-growth question. Revenue-only ranking favors the biggest spender, not the most efficient one.
Recommendation: (1) date-window filter on the campaigns view; (2) import Meta spend (sheet tab or API) into a spend table; (3) surface CAC = spend / new customers and ROAS = attributed revenue / spend.

**B2 · Speed-to-lead unmeasured** — `P1` · `S` · Impact High
Evidence: `first_contacted_at` is stamped on first contact; activities carry timestamps; nothing computes time-to-first-contact or new-lead aging. Meta leads also wait up to 5 min in the sheet (E4).
Why it matters: speed-to-lead is the strongest controllable conversion driver in service businesses; it is currently invisible. Hot abandoned-booking leads (~10–11 min after a customer goes quiet) are the fastest-decaying asset the team has.
Recommendation: KPI card + trend for avg/median time-to-first-contact by source; "new leads uncontacted > X hours" count with a Discord alert at threshold.

**B7 · Retention engine under-powered** — `P1` · `M` · Impact High
Evidence: Phase 6 state — repeat-grooming-due card exists (minimized by default, cadence chips, manual "Create follow-up lead"); automated outbound blocked pending a sender decision.
Why it matters: for a grooming business, repeat cadence is the LTV engine. Today retention is a buried manual worklist with no automation, no churn-risk view, and no LTV/repeat-rate trend.
Recommendation: (1) promote retention to a first-class worklist (nav badge or its own view); (2) decide the sender — the `whatsapp` source value is already reserved in the enum; (3) add repeat-rate/LTV trend to Overview.

**B13 · Single-city architecture** — `P3` · `XL` · Impact Strategic
Evidence: `lib/service-areas.ts` is a hardcoded Bengaluru gazetteer; area matching (`lib/gaze/leads.ts`), coverage, and Gaze assume one city.
Why it matters: city #2 (or partner expansion) is a re-architecture, not a config change. Not urgent — but every new hard dependency on the gazetteer raises the future cost.
Recommendation: when expansion is ~2 quarters out, add a city dimension to gazetteer + matching + coverage; until then keep new features city-agnostic where cheap.

**B12 · No leadership digest** — `P3` · `S` · Impact Med
Evidence: all pipeline/automation insight requires opening the console; Discord alerts are event-based, not summary-based.
Recommendation: daily 09:00 IST digest (new leads, conversions, overdue follow-ups, automation health) to Discord/email — reuses heartbeat/summary machinery.

**Attribution completeness** — `P2`
Google Ads deferred (owner), WhatsApp enters as a manual source, pre-CRM historical revenue is source-unknown. Acceptable now; revisit together with B6 so ROAS covers all paid channels when spend import lands.

### 3.3 Operations — daily workflows, triage, alerting

**B1 · No "My leads" / assigned / source / priority filters in the CRM UI** — `P0` · `M` · Impact High
Evidence: the list API already supports `assignedTo=me`, `source`, `priority` (`app/api/admin/crm/leads/route.ts` ~28–38); the CrmTab toolbar renders only status chips + text search (`statusFilters` ~857–867). Auto-assignment has been OFF by default since 2026-09-03 (owner decision).
Why it matters: with leads entering unassigned and no per-staff queue view, every operator triages the full 400+ list. Assignment exists (reassign UI + in-app notifications) but the queue it creates is visible nowhere. Leads can sit untouched with no one noticing.
Recommendation: toolbar filters — Assigned (All / Me / Unassigned / per-person), Source, Priority (hot) — plus an "Unassigned & uncontacted" saved view. The single highest-impact ops fix in this register.

**D6 · Retention and campaign panels fail silently** — `P1` (borderline P0 for ops trust) · `S` · Impact High
Evidence: `CrmTab.tsx` `loadRetention` / `loadCampaigns` — `catch { // supplementary — silent skip }` (~615–619, ~630–632).
Why it matters: this violates the project's own loud-fallback rule (born from the silent lead-layer failure that hid an empty map for a full session). Worse, a dead retention panel does not read as an error — it reads as "no follow-ups due", which can silently stop the retention motion entirely.
Recommendation: `console.warn` at minimum, plus an inline error state with retry on each panel.

**B3 · No bulk actions in CRM** — `P1` · `M` · Impact Med
Evidence: `AdminBulkActionToolbar` exists but is wired only into `AdminBookingsView`; CRM actions are strictly per-lead modals.
Why it matters: after a backfill or a busy ad day, working 100+ leads one modal at a time is the difference between triage happening and not happening.
Recommendation: bulk assign, bulk status (same transition guards), bulk pincode set for a known area batch.

**B4 · Gaze↔CRM dead ends** — `P1` · `M` · Impact Med
Evidence: Gaze backlog (explicit) — lead bubbles have no click-through to a filtered CRM view; coverage-gap pincodes have no action path. Gaze filters are not URL-encoded (C2), which is the technical blocker for deep links.
Why it matters: Gaze's value proposition is "see demand → act on it". Today the operator sees a hot lead bubble or an uncovered pincode and must manually recreate the filter in the CRM tab.
Recommendation: after C2 — lead-bubble click → `/dashboard/admin/crm?area=…&status=open`; coverage-gap click → provider onboarding prefilled for that pincode; "Top lead areas" rows → same deep link.

**B10 · No proactive overdue-follow-up alert** — `P2` · `S` · Impact Med
Evidence: `overdue_followups` is counted and filterable ("Due follow-ups"), but `sendCrmOpsAlert` fires only for hot-lead flags and assignments.
Recommendation: threshold-based Discord ping or daily digest when overdue > 0, reusing `ops-alert`.

**B11 · No unified automation control tower** — `P2` · `M` · Impact Med
Evidence: the Automation health panel covers the two CRM jobs only. Billing automation (Render crons: reminders scheduler, stale-txn cleanup) has a runbook + runs UI but no health panel; HealthTab covers schema checks.
Recommendation: one Automation surface listing all scheduled systems (CRM import, sweep, billing reminders, cleanup, subscription expiry) with last-run / next-run / health — the heartbeat pattern generalizes.

**E2 · Dev-verification backlog** — `P1` · `S` · Impact Med
Evidence: CRM tracker open items — Phase 2 workflow UI walkthrough; Phase 5/6/7 dev verification; pagination walkthrough; convert-picker + converted-lead Customer-360 walkthrough.
Why it matters: BUILT-but-unverified features have already produced three UI bugs in ~48 h (see D8); unverified UI rots into "probably broken, nobody knows".
Recommendation: one 60–90 min localhost walkthrough to close every pending dev-verify item; record results in the tracker.

**E4 · Apps Script push trigger not installed** — `P2` · `S` · Impact Med
Evidence: CRM tracker deployment checklist — "the only remaining item". Until installed, Meta leads land up to 5 min late (pg_cron is the fallback safety net).
Recommendation: install it (owner action, ~10 min) — a latency optimization layered on the 5-min net.

**B8 · Customer 360 entry points and actions are thin** — `P2` · `M` · Impact Med
Evidence: only CrmTab links to `/api/admin/crm/customers/[userId]`; UsersTab, BookingDetailModal, and payments do not. Lists are capped (6 leads, 8 bookings); no click-to-call (`tel:`), no WhatsApp deep link, no inline edit.
Recommendation: link Customer 360 from UsersTab rows and booking-detail customer names; add `tel:`/WhatsApp links; "view all" affordance for capped lists.

### 3.4 UI/UX — information architecture, interaction, accessibility

**C1 · CrmTab is a mega-page** — `P1` · `M` · Impact Med
Evidence: 1,985 lines in one tab — summary cards, status chips, search, table, lost-reasons strip, retention card, campaign table, automation-health panel, import controls, plus three modals (create lead, lead detail, Customer 360).
Why it matters: one page now hosts four different jobs (work the pipeline / plan retention / review marketing / operate automation). Cognitive load scales with every new phase; Phase 8+ features have nowhere natural to go.
Recommendation: sub-navigation inside CRM (Pipeline · Follow-ups · Retention · Campaigns · Automation) or promote Automation to the System nav group. Do this before adding features, not after.

**C2 · No URL/filter state in CRM and Gaze** — `P1` · `M` · Impact Med
Evidence: only BookingsTab and ServicesTab use `useSearchParams`; CRM/Gaze filters live in component state only.
Why it matters: refresh/back loses operator context; views cannot be bookmarked or shared ("look at HSR demand this week" is impossible to link); blocks B4 deep links.
Recommendation: sync filters to query params (Next `useSearchParams` + `router.replace`), then build deep links on top.

**C3 · Type scale and focus visibility** — `P1` · `S` · Impact Med
Evidence: pervasive `text-[10px]` / `text-[11px]` for KPI labels, legends, and meta rows across admin tabs; `focus:outline-none` on the follow-up datetime input without a replacement ring (`CrmTab.tsx` ~1836).
Why it matters: an all-day ops console at 10–11px strains readability (contrast is fine; size is the issue); keyboard users lose orientation on outline-stripped inputs.
Recommendation: minimum 11–12px for primary meta, 10px only for tertiary hints; every `focus:outline-none` gets a `focus:ring`/border replacement.

**C4 · Lead-detail modal is a long stacked form** — `P2` · `M` · Impact Med
Evidence: one modal stacks attribution, info, actions (move status with inline convert-picker, lost-reason form, reassign), location & priority, activity form, and full history — no in-modal navigation; follow-up scheduling uses a raw `datetime-local` input.
Recommendation: quick-presets for follow-up (Tomorrow 10:00 / +3 days / +1 week); section anchors or a two-column layout on wide screens; optimistic activity posting.

**C5 · Map density affordances** — `P2` · `M` · Impact Med
Evidence: translucent lead bubbles (radius 10–28 px) + booking pins overlap heavily in dense areas; no clustering, no opacity control, no pincode/area search-jump.
Recommendation: cluster at low zoom, an area/pincode jump search, and a lead-bubble opacity slider when combined with the heat layer.

**C6 · Command palette navigates only** — `P2` · `S` · Impact Low–Med
Evidence: ⌘K filters `navItems` only (`AdminWorkspaceShell.tsx` `filteredCommands`).
Recommendation: add entity search (lead by name/phone, customer, booking id) that deep-links into the right view — pairs naturally with C2.

**C7 · Mobile-admin pass** — `P3` · `M` · Impact Low today
Evidence: mobile nav drawer exists (good); dense multi-column tables (leads, bookings) are the open question — not verified on small screens.
Recommendation: verify during the E2 walkthrough; card layouts below `md` if staff ever work leads from phones.

**C8 · Terminology consistency** — `P3` · `S` · Impact Low
Evidence: `SOURCE_LABELS` (CrmTab: "Meta Lead Form") vs `LEAD_SOURCE_LABELS` (GazeTab: "Meta lead form"); label/format maps duplicated per file.
Recommendation: one shared labels module imported by all admin surfaces (pairs with D5).

**UX positives to keep:** grouped nav with descriptions; ⌘K palette; resizable + collapsible sidebar with localStorage persistence; layer toggles with legend discipline (tracker-enforced); `bookingsTruncated` banner (GazeTab ~520); pagination snap-back guards; `aria-expanded` on collapsibles; 60 s auto-refresh that preserves operator zoom (fit-signature design).

### 3.5 Data & Business Analysis — metrics, quality, governance

**A1 · "Today" and window boundaries computed in UTC, not IST** — `P0` · `S` · Impact High (correctness)
Evidence: `app/api/admin/gaze/route.ts` — `resolveTodayKey()` returns `new Date().toISOString().slice(0,10)` (UTC), and window edges are UTC midnights (`T00:00:00.000Z`) in both booking and lead queries. Migration 075 enforces IST in the DB, but this route's date keys are UTC.
Why it matters: the IST day starts 05:30 UTC — between 00:00 and 05:30 IST every day, "Today" shows the previous day's window, "Jobs today" undercounts, and leads created after IST midnight are excluded from "Today". For a Bengaluru ops team this is silently wrong ~23% of every day.
Recommendation: compute date keys in IST (a shared IST helper already exists — `getISTTimestamp` in `lib/utils/date`); add a unit test pinning the boundary.

**A2 · "All-time" centroids are an unordered 2,000-row sample, recomputed per request** — `P0` · `S` · Impact High (correctness + performance)
Evidence: `computeAllTimePincodeCentroids` — `.from('bookings').select('user_id, latitude, longitude').limit(2000)` with **no `.order()` and no date filter** (route ~131–136), then `.in('user_id', …)` addresses ≤3,000.
Why it matters: (1) it is neither "all-time" nor deterministic — PostgREST returns rows in unspecified (typically insertion) order, so once bookings exceed 2,000, every newer pincode silently loses its centroid and its lead areas stop plotting — exactly the failure mode this fallback was built to prevent; (2) it runs on every gaze request (60 s auto-refresh) although centroids change rarely.
Recommendation: order by `booking_start desc` (or compute a true aggregate via RPC/materialized view) and cache the result (5–15 min in-memory or a cron-refreshed table).

**A3 · Lead layer has a silent 2,000 cap** — `P1` · `S` · Impact Med
Evidence: lead query `.limit(2000)` newest-first (route ~323–339); the response exposes `bookingsTruncated` for bookings but **no equivalent flag for leads** — lead KPIs and bubbles silently undercount past 2,000 windowed leads.
Recommendation: add `leadsTruncated` to the response + a banner hint in GazeTab, mirroring the bookings pattern.

**A4 · Inconsistent revenue definitions across views** — `P1` · `M` · Impact Med
Evidence: Gaze booking value uses an amount / final_price / price_at_booking fallback chain; campaign revenue = `final_price` of converted bookings; Customer 360 shows paid transactions; Billing works off invoices.
Why it matters: the same question ("what did we make?") returns different numbers in different tabs — eroding trust in all of them.
Recommendation: a one-page revenue definitions doc (GMV vs collected vs attributed); each surface labels the definition it displays.

**A5 · No standing data-quality view** — `P1` · `M` · Impact Med
Evidence: every quality number in this report came from one-off diagnostics — ~40% of leads unmapped to areas, junk city values ("Yes" ×14), 79 unpinnable leads, 2 sheet-vs-DB pincode conflicts.
Why it matters: mapping share is the difference between "Gaze shows demand" and "Gaze shows ~60% of demand" — it must be watched, not rediscovered.
Recommendation: a data-quality card (leads with pincode %, mapped-to-area %, unmapped count, junk-answer count) + alert when mapped share drops; also quantifies gazetteer-improvement ROI.

**A6 · Summary scan cap 5,000** — `P2` · `S` · Impact Low
Evidence: `SUMMARY_SCAN_LIMIT = 5000` (`lib/crm/service.ts` ~81) — summary cards silently undercount past 5,000 leads. Fine at 403; a trap at 10× volume.
Recommendation: exact count query or a truncation-aware label.

**A7 · Heartbeat/run tables grow unbounded** — `P2` · `S` · Impact Low
Evidence: sweep heartbeats every 1 min (~1,440 rows/day) + import runs every 5 min; billing automation has a cleanup script — CRM does not.
Recommendation: retention job (keep ~30 days of heartbeats / ~90 days of import runs), mirroring the billing cleanup pattern.

**A8 · Gazetteer governance** — `P2` · `M` · Impact Med
Evidence: `lib/service-areas.ts` is marketing/SEO data doubling as ops matching data; matching runs at read time in the gaze route, so an alias edit silently remaps history (tracker risk note).
Recommendation: a matcher fixture test that runs current distinct `source_details.city` values against `matchLeadArea` and reports the unmatched set; refresh periodically alongside the A5 panel.

### 3.6 Engineering — code health, maintainability, performance

**D1 · Dead code** — `P0` · `S` · Impact Med
Evidence: `components/dashboard/AdminDashboardClient.tsx` — 6,109 lines, zero importing files (verified by grep; only a comment mention in `AdminProvidersView.tsx`); `tabs/BookingsTabChunkV2.tsx` is a 1-line re-export of BookingsTab.
Recommendation: delete both in a standalone commit (trivially revertible). Re-run the import grep immediately before deleting.

**D4 · God modules** — `P1` · `L` · Impact Med
Evidence: `lib/crm/service.ts` 2,201 lines (leads + import + sweep + retention + campaigns + CSV + Customer 360); `CrmTab.tsx` 1,985; `ProvidersTab` 1,479; `ServicesTab` 1,205; `BillingTab` 1,041.
Why it matters: review friction, merge conflicts, onboarding cost, and the "one more feature" temptation that pushes C1 over the edge.
Recommendation: split `service.ts` by domain (`crm/leads.ts`, `crm/import.ts`, `crm/sweep.ts`, `crm/analytics.ts`); extract CrmTab subcomponents (LeadsTable, LeadDetailModal, RetentionCard, CampaignsTable, AutomationPanel, ImportPanel) — mechanical moves; the pure logic is already tested.

**D5 · Inconsistent data-fetch + duplicated types/labels** — `P1` · `S` · Impact Med
Evidence: an `adminRequest` helper exists but is used only by Services/Providers/Access; CRM/Gaze/Overview/Billing hand-roll `fetch` + error toast. CrmTab re-declares `AutomationJobHealth`, `SheetImportRunRow`, `CrmLeadSummary`, etc. instead of importing from `lib/crm/*` — they must match by convention.
Recommendation: adopt one shared typed admin fetch hook; import shared types; centralize labels (with C8).

**D9 · DB-backed rate limiting on every guarded request** — `P2` · `S` · Impact Low
Evidence: `isRateLimited` does a Supabase roundtrip per guarded request. Fine at current scale; revisit if admin traffic or DB pressure grows (an in-memory token bucket is the usual next step).

**D2 / D3 / D7 / D8 / D10 / D11** — see §3.1 CTO (per-page data loading, gaze request cost, CI, UI tests, cron drift, error tracking).

**Engineering positives:** pure aggregation modules with real unit tests (`lib/gaze/*`, `lib/crm/automation-status.ts`, `lead-transition-guard.ts`); distributed locks with TTL and release-on-finally; idempotent upserts; graceful per-layer degradation in the gaze route with loud `console.warn`s; Zod schemas at every boundary; `CrmServiceError` → HTTP status mapping.

---

## 4. Master Gap Register

46 items across five domains. "Risk if ignored" is the council's honest downside estimate. Detailed evidence for each row is in §3.

### A — Data correctness & quality

| ID | Gap | Pri | Eff | Impact | Owner | Risk if ignored |
|---|---|---|---|---|---|---|
| A1 | UTC day keys — "Today"/lead windows wrong 00:00–05:30 IST | **P0** | S | High | Data/Eng | Daily silent miscounts in Gaze KPIs and windows |
| A2 | "All-time" centroids — unordered 2,000-row sample, per-request recompute | **P0** | S | High | Data/Eng | Lead areas silently stop plotting as bookings grow; DB load |
| A3 | Lead layer 2,000 cap with no truncation flag | P1 | S | Med | Eng | Silent KPI undercount at volume |
| A4 | Inconsistent revenue definitions (Gaze / campaigns / C360 / billing) | P1 | M | Med | Data | Numbers disagree across tabs; trust erosion |
| A5 | No standing data-quality view (mapped %, junk answers, unpinnable) | P1 | M | Med | Data/BA | Demand blind spot grows unnoticed |
| A6 | Summary scan cap 5,000 (silent undercount past it) | P2 | S | Low | Eng | Wrong summary cards at 10× volume |
| A7 | Heartbeat/import-run tables unbounded (~1,440 rows/day) | P2 | S | Low | Eng | Table bloat; slower health queries |
| A8 | Gazetteer governance — alias edits silently remap history | P2 | M | Med | Data | Read-time matching rewrites the past without trace |

### B — Product & operations functionality

| ID | Gap | Pri | Eff | Impact | Owner | Risk if ignored |
|---|---|---|---|---|---|---|
| B1 | No assigned/source/priority filters in CRM UI ("My leads" missing) | **P0** | M | High | Ops/Product | Unassigned leads sit untouched; triage inefficiency |
| B2 | No speed-to-lead metric / new-lead aging SLA | P1 | S | High | CEO/BA | Strongest conversion lever unmanaged |
| B3 | No bulk actions in CRM (assign/status/pincode) | P1 | M | Med | Ops | Backfills and ad spikes unworkable one-by-one |
| B4 | Gaze↔CRM dead ends (lead bubbles, coverage gaps not clickable) | P1 | M | Med | Ops/UX | "See demand → act" loop broken at the act step |
| B5 | CSV export ignores active filters; no params | P1 | S | Med | BA | Cohort exports impossible; manual re-filtering |
| B6 | Campaign analytics: all-time only; no spend/CAC/ROAS | P1 | M | High | CEO | Cannot rank channels by efficiency |
| B7 | Retention under-powered (no sender, buried, no automation/trend) | P1 | M | High | CEO/Ops | LTV engine idle |
| B8 | Customer 360: single entry point, capped lists, no tel:/WhatsApp actions | P2 | M | Med | Ops/UX | Context switching during calls |
| B9 | No funnel/cohort analytics (lead aging, stage durations, trends) | P2 | M | Med | BA | Pipeline managed on snapshot counts only |
| B10 | No proactive overdue-follow-up alert | P2 | S | Med | Ops | Follow-ups slip silently |
| B11 | No unified automation control tower (billing crons outside panel) | P2 | M | Med | CTO/Ops | Partial blind spots repeat the middleware-incident pattern |
| B12 | No scheduled leadership digest | P3 | S | Med | CEO | Insight requires console access |
| B13 | Single-city architecture (hardcoded Bengaluru gazetteer) | P3 | XL | Strategic | CTO | City #2 = re-architecture |

### C — UX & information architecture

| ID | Gap | Pri | Eff | Impact | Owner | Risk if ignored |
|---|---|---|---|---|---|---|
| C1 | CrmTab mega-page (four jobs on one screen) | P1 | M | Med | UX | Cognitive overload compounds with every phase |
| C2 | No URL/filter state in CRM + Gaze | P1 | M | Med | UX/Eng | Context lost on refresh; deep links blocked |
| C3 | 10–11px type scale; focus-ring gaps | P1 | S | Med | UX | Readability strain; keyboard a11y regressions |
| C4 | Lead-detail modal: long stack, raw datetime input | P2 | M | Med | UX | Slow per-lead handling |
| C5 | No clustering / opacity / area-jump on the map | P2 | M | Med | UX | Dense areas unreadable |
| C6 | Command palette: navigation only, no entity search | P2 | S | Low | UX | Missed speed affordance |
| C7 | Mobile-admin table usability unverified | P3 | M | Low | UX | Unknown phone workflow quality |
| C8 | Label/terminology drift between tabs | P3 | S | Low | UX/Eng | Confusion at the edges ("Meta lead form" vs "Meta Lead Form") |

### D — Engineering & performance

| ID | Gap | Pri | Eff | Impact | Owner | Risk if ignored |
|---|---|---|---|---|---|---|
| D1 | Dead code: AdminDashboardClient.tsx (6,109 lines) + re-export chunk | **P0** | S | Med | Eng | 6k lines of confusion for every future reader |
| D2 | Per-page full `loadAdminDashboardData()` (~10 queries/view) | P1 | M | Med | Eng | TTFB + DB waste on every admin navigation |
| D3 | Gaze: 8+ queries per 60 s refresh; no caching | P1 | M | Med | Eng | DB load scales with open tabs × instances |
| D4 | God modules (service.ts 2,201; CrmTab 1,985; Providers 1,479…) | P1 | L | Med | Eng | Velocity decay; merge conflicts |
| D5 | Inconsistent fetch helper; duplicated client types/labels | P1 | S | Med | Eng | Convention-bound type parity; drift bugs |
| D6 | Silent retention/campaign panel failures | P1 | S | High | Eng/Ops | "No follow-ups due" illusion |
| D7 | No CI pipeline (tests/tsc/lint manual; 9 tsc errors normalized) | P1 | M | High | CTO/Eng | Incident-class failures ship undetected |
| D8 | Zero component tests / no E2E for admin UI | P1 | M | High | Eng | UI regressions found by operators |
| D9 | DB-backed rate limiting on every guarded request | P2 | S | Low | Eng | Latency + DB load at scale |
| D10 | Cron-in-DB vs code deploys (no presence check) | P2 | M | Med | CTO | Schedule drift after deploys/migrations |
| D11 | No application error tracking (server or client) | P2 | M | Med | CTO | Failures invisible between Discord alerts |

### E — Process, governance & environment

| ID | Gap | Pri | Eff | Impact | Owner | Risk if ignored |
|---|---|---|---|---|---|---|
| E1 | Single env: local dev writes to production DB | **P0** | M–L | High | CTO | One bad query from customer-data damage |
| E2 | 5+ shipped features still dev-verification pending | P1 | S | Med | Ops/Eng | Unverified UI rots; bugs surface in prod |
| E3 | Binary admin/staff roles; no permission matrix | P1 | S | Med | CTO | Least-privilege impossible as team grows |
| E4 | Apps Script push trigger not installed (5-min lead latency) | P2 | S | Med | Ops | Speed-to-lead gap on paid leads |
| E5 | Tracker knowledge not surfaced in-console | P3 | S | Low | Ops | Context lives outside the tool |
| E6 | Pin-layer PII views not audit-logged | P3 | S | Low | CTO | Future compliance retrofit cost |

---

## 5. Prioritized Roadmap

### 5.1 Now — quick wins (≤ 1 day each; batch as one "hygiene + correctness" release)

| Order | Item | Note |
|---|---|---|
| 1 | A1 — IST date keys | Shared IST helper + boundary unit test |
| 2 | A2 — centroid fix + cache | Order desc + 5–15 min cache; kills both the correctness and the perf issue |
| 3 | D1 — delete dead code | Standalone commit; re-run import grep first; trivially revertible |
| 4 | D6 — loud panel failures | `console.warn` + inline retry state on retention/campaign panels |
| 5 | B5 — export honors filters | Pass current filters as query params; default remains all leads |
| 6 | B10 — overdue alert | Reuse `sendCrmOpsAlert`; threshold or daily digest |
| 7 | E4 — install Apps Script trigger | Owner action, ~10 min; seconds-latency Meta leads |
| 8 | C3 (partial) — type scale + focus ring | Raise worst 10px usages to 11–12px; restore focus ring on outline-stripped inputs |

### 5.2 Next 30 days

- **B1** — Assigned / Source / Priority filters + "Unassigned & uncontacted" view (the highest-impact ops fix)
- **D7** — CI gate (fix the 9 tsc errors first; then vitest + tsc + eslint + render.yaml parse on PR)
- **D8** — first component tests (CrmTab filters / pagination / convert-picker) + Playwright lead-lifecycle smoke
- **B2** — speed-to-lead KPI + new-lead aging alert
- **C2** — URL state for CRM + Gaze filters (unblocks B4)
- **E2** — close every dev-verification pending item in one walkthrough session
- **A3** — `leadsTruncated` flag + banner
- **A5** — data-quality card
- **D3** — gaze response caching (centroids / coverage TTL)
- **E1 (mitigation)** — read-only dev role + decision on a fixture shadow project

### 5.3 This quarter

- **B3** bulk actions · **B4** Gaze↔CRM deep links (needs C2) · **B6** campaign windows + Meta spend import → ROAS/CAC
- **C1** CRM IA split · **D4** module splits (`service.ts`, CrmTab) · **D2** per-view data loading
- **A4** revenue definitions doc + alignment · **B9** funnel/cohort analytics · **B11** unified automation panel
- **A6/A7** caps + retention job · **D10** cron presence check in Health · **E3** permission matrix
- **C4/C5/C6** modal presets, map clustering, palette entity search

### 5.4 Strategic (multi-quarter)

- **E1 (full)** — staging environment with sanitized data sync
- **B7** — retention engine: sender selection (WhatsApp Cloud API vs email), automated cadence, churn-risk view, LTV trend
- **B13** — multi-city architecture (city dimension in gazetteer / matching / coverage)
- **D11** — error tracking with source maps
- **C7** — mobile-admin pass · **B12** — scheduled digests

---

## 6. Strengths to Preserve — What NOT to Change

1. **Tracker discipline** — validation logs with commands and results, decision logs with reasons, honest state labels. Keep updating them in-session; they are the project's institutional memory.
2. **Server-side lifecycle contracts** — `lead-transition-guard`, conversion-requires-same-customer-booking, lost-reason required on `lost`. Correct-by-construction beats UI-only validation.
3. **Idempotency + distributed locks** — `external_lead_id` upserts, lock/TTL/release-on-finally on import and sweep. This is what made the pg_cron cutover safe.
4. **Heartbeat observability design** — out-of-band, public-but-secret-authed, failure/recovery alerting, panel in-console. Generalize it (B11) rather than replace it.
5. **The loud-fallback rule** — "optional layers `console.warn`; never degrade silently." D6 is a violation to fix, not a pattern to copy.
6. **Pure aggregation modules with unit tests** — `lib/gaze/*`, `lib/crm/automation-status.ts`, `lead-transition-guard.ts`; pure functions first, routes thin.
7. **Consistent route hygiene** — role check + Zod + rate limit + audit log on every admin route; timing-safe secret compares.
8. **The workspace shell** — grouped nav, ⌘K, resizable/collapsible persisted sidebar, layer/legend discipline on Gaze.

---

## 7. Open Verification Items

Claims to confirm in the dev walkthrough (the E2 session) before or while acting:

1. **A1/A2** — reproduce: compare "Today" counts at 00:30 IST vs 06:00 IST; inspect the centroid source rows (`.limit(2000)` ordering) with a read-only query.
2. **C7** — leads/bookings tables on a phone-sized viewport.
3. **B8** — confirm the desired Customer 360 entry points (UsersTab? BookingDetailModal? Payments?).
4. **Notification surface** — the shell's Bell icon: verify assignment notifications actually render for staff.
5. **B11** — check BillingTab's existing run visibility to decide merge vs. link for the unified automation panel.
6. **E3** — verify runtime role gating on promote/delete routes with a staff session (tests exist; confirm behavior).
7. **D1** — re-run the dead-import grep immediately before deleting (branches may have revived the file).

---

## 8. Appendix — Evidence Index

| Evidence | Cited by |
|---|---|
| `app/api/admin/gaze/route.ts` — `resolveTodayKey` (UTC), `computeAllTimePincodeCentroids` (unordered limit 2000), lead query (limit 2000, no flag), 8+ queries per request | A1, A2, A3, D3 |
| `app/api/admin/crm/leads/route.ts` — `assignedTo=me` / `source` / `priority` params supported | B1 |
| `components/dashboard/admin/tabs/CrmTab.tsx` — status-chips-only toolbar; silent catches in `loadRetention`/`loadCampaigns`; 1,985 lines; re-declared types; `focus:outline-none` datetime | B1, D6, C1, C3, D5 |
| `app/api/admin/crm/leads/export/route.ts` — no filter params, limit 5000 | B5 |
| `app/dashboard/admin/_data.ts` + `app/dashboard/admin/*/page.tsx` — full dataset load on every page | D2 |
| `components/dashboard/AdminDashboardClient.tsx` — 6,109 lines, zero importers (grep-verified) | D1 |
| `lib/auth/api-auth.ts` — `ADMIN_ROLES = ['admin','staff']` | E3 |
| `lib/crm/service.ts` — `SUMMARY_SCAN_LIMIT` 5000; 2,201 lines; campaign analytics without spend | A6, D4, B6 |
| `lib/crm/automation-status.ts` + migrations 100/101 + `infra/render.yaml` — heartbeat design, pg_cron scheduling, 2 web instances | B11, D10, D3 |
| `.github/` (no `workflows/`) + tracker validation logs (manual commands) | D7 |
| Test census — 68 `.test.ts`, 0 `.test.tsx`; `npx tsc --noEmit` → 9 errors (all test files, verified) | D8, D7 |
| `CRM_DEVELOPMENT_TRACKER.md` — dev-verification pendings, single-env risk, auto-assign OFF decision, Apps Script open item, three manually-found UI bugs | E1, E2, B1, E4, D8 |
| `GAZE_DEVELOPMENT_TRACKER.md` — backlog (dead ends, static coords, unmapped visibility), data notes (junk answers, 159/392 mapped) | B4, A5, A8 |
| Grep checks — `useSearchParams` (Bookings/Services only), `AdminBulkActionToolbar` (bookings only), `adminRequest` (Services/Providers/Access only), `bookingsTruncated` (rendered, GazeTab ~520) | C2, B3, D5, A3 |

---

---

## 9. Owner Reality Filter — What One Engineer Ships Now

*Added 2026-09-03, after the owner's constraints: one person holds the CTO + developer + tester roles; production is the only environment (local dev writes to prod; deploy = branch → preflight → Render, per `SINGLE_ENV_RELEASE_PLAYBOOK.md`); no process or pipeline changes are possible right now. This section re-triages the §4 register against those constraints. IDs reference §3/§4.*

### 9.1 Classification rules

- **CAN** — pure code change; verifiable with the existing DEV-VERIFIED pattern (localhost vs prod DB); no new external service, account, or pending business decision; sized for one person.
- **SPLIT** — the code half ships now; the external half (data access, sender account, business decision) waits.
- **CANNOT** — needs a process/pipeline change, an external dependency, or a pending decision — or its payoff is team-scale and unrealized solo.
- **NO-CODE** — owner actions that require no code change.

### 9.2 ✅ CAN — Batch A: correctness & hygiene quick wins (≤ 1 day each; ship as one release)

| ID | What | Solo-safe note |
|---|---|---|
| A1 | IST date keys in the gaze route | Pure date-key fix + one boundary unit test; verify by comparing "Today" counts before/after 05:30 IST |
| A2 | Centroid fix (order by `booking_start desc`) + 5–15 min cache | One query change + a small cache; fixes correctness and the per-refresh DB cost together |
| A3 | `leadsTruncated` flag + banner | Mirror the existing bookings-truncation pattern |
| A6 | Summary cap: exact count or truncation-aware label | Small service change in `lib/crm/service.ts` |
| A7 | Heartbeat/run retention job | One migration; mirrors the existing billing cleanup pattern |
| A8 | Gazetteer matcher fixture test | Test file only; zero runtime risk |
| B5 | CSV export honors current filters | Pass the list API's existing filter params through |
| B10 | Overdue-follow-up Discord alert | Reuses `sendCrmOpsAlert` |
| C3 | Type-scale (10px → 11–12px) + focus rings | CSS-class edits; zero logic risk |
| C8 | Shared labels module | Mechanical extraction of duplicated maps |
| D1 | Delete dead `AdminDashboardClient.tsx` + re-export chunk | Re-run the import grep, delete, deploy |
| D6 | Loud retention/campaign failures | `console.warn` + inline retry state |

*Roughly one focused week for all twelve (several are under an hour) — or ship the top five (A1, A2, D1, D6, B5) as a single afternoon-to-day release.*

### 9.3 ✅ CAN — Batch B: high-value operator features (1–3 days each)

| ID | What | Why it pays solo |
|---|---|---|
| B1 | Assigned / Source / Priority filters + an "Unassigned & uncontacted" triage view | If you are also the only one working leads, the unassigned/aging triage view is the part that pays — nothing gets lost in a 400-row list |
| B2 | Speed-to-lead KPI + new-lead aging alert | You are the analyst too; strongest conversion lever and the data already exists (`first_contacted_at` + activity timestamps) |
| C2 | URL/filter state for CRM + Gaze | Unblocks B4; makes views bookmarkable/shareable |
| D3 | Gaze response caching (centroids/coverage TTL) | Pairs with A2; cuts per-refresh DB load |
| A5 | Data-quality card (pincode %, mapped %, junk answers) | You currently rediscover these numbers by hand |
| D5 | Shared typed admin fetch + import shared types | Small; kills the convention-parity risk in CrmTab |
| B8 | Customer 360 entry points + `tel:`/WhatsApp links | Context switching during calls costs solo time too |
| D7′ | Extend `release:gate` with `lint` + a render.yaml parse check, then run it before every deploy | The gate script already runs tsc + tests + schema-health + catalog audit + build — lint and yaml-parse are the only missing checks. Same failure classes as CI, zero process change |

### 9.4 ✅ CAN — Batch C: bigger bets (after A + B, in value order)

1. **B4** Gaze↔CRM deep links (needs C2) — closes the "see demand → act" loop
2. **B3** bulk actions (assign / status / pincode) — the historical backfill proved the need
3. **C4** follow-up quick-presets + lead-modal layout
4. **D2** per-view data loading — faster admin pages, less DB waste
5. **B11** unified automation panel — generalize the heartbeat pattern to the billing crons
6. **C6** palette entity search (the users-search API and the leads `q` param already exist)
7. **C5** map clustering + area/pincode jump
8. **B6-window** campaign date filter (spend/ROAS waits — 9.5)
9. **B7-worklist** retention promotion + repeat-rate/LTV trend (outbound waits — 9.5)
10. **B9** funnel/cohort analytics — lead aging + stage durations from the activities table
11. **C1** CRM IA split — incrementally, whenever CrmTab is already open; never as a standalone project
12. **D8-lite** component tests only for flows that keep regressing (filters / pagination / convert-picker) — you are the tester; a few tests amplify you

### 9.5 🔶 SPLIT — code half ships now, external half waits

| ID | Ships now (code) | Waits (external / decision) |
|---|---|---|
| B6 | Campaign date-window filter | Spend import → CAC/ROAS: needs Meta Ads spend-data access |
| B7 | Retention worklist, churn-risk view, LTV trend | Automated outbound: sender decision (WhatsApp Cloud API vs email) + account setup |
| D8 | Component tests for the regressing flows | Full Playwright E2E suite — heavy setup, low solo ROI today |
| A4 | One-page revenue definitions note (30 min, no code) | Cross-surface alignment — do opportunistically per surface |
| E3 | Optional quick win: tighten destructive routes to admin-only | Full permission matrix — governance for a team that doesn't exist yet |

### 9.6 ⛔ CANNOT do now — reason, and the solo-friendly substitute where one exists

| ID | Why not now | Substitute |
|---|---|---|
| D7 CI pipeline | A process/pipeline change; your flow is branch → preflight → Render | **D7′ (Batch B)**: extend + habitually run `npm run release:gate` before every deploy — catches the same failure classes, zero process change |
| E1 staging environment | Infra + data-sync design + process — exactly what you ruled out | Keep the tracker's smoke-data cleanup discipline; a read-only dev role in Supabase is a later, config-only half-step |
| D11 error tracking | External SaaS account (or self-hosted infra) | Heartbeats + Discord alerts already cover the automation class; add `console.error` breadcrumbs when touching risky code |
| B13 multi-city | XL re-architecture with no second city to serve | Keep new features city-agnostic where cheap |
| D4 full module splits | Payoff is review/merge friction — a team-scale problem you don't have | Split opportunistically when a file is open; never as a standalone project |
| D9 rate-limit backend | No problem at current scale | None needed |
| D10 cron presence check | Heartbeat staleness already catches dead crons (proved 2026-09-03); the direct check needs a new env secret | The Automation health panel is the check — glance at it after each deploy |
| E3 full permission matrix | Governance for a team | The quick admin-only tightening (9.5) is enough |
| E5 in-console tracker links | Nice-to-have | — |
| E6 pin-layer audit logging | Compliance-scale concern | — |
| B12 scheduled digest | Code-only, but low value while you live in the console daily | Revisit when the console stops being a daily habit |
| C7 mobile-admin pass | Verification task, not a code change | Do it during the E2 walkthrough; any fixes it surfaces are CAN |

### 9.7 📋 Do now — no code required

- **E4** — install the Apps Script push trigger (`infra/apps-script/`): ~10 min, seconds-latency Meta leads, the 5-min pg_cron import stays as the safety net
- **E2** — the 60–90 min dev-verification walkthrough closing every pending tracker item (you are the tester); record results in the CRM tracker
- **A4-doc** — write the one-page revenue definitions note (GMV vs collected vs attributed)

### 9.8 Suggested solo sequence (maps to `SINGLE_ENV_RELEASE_PLAYBOOK.md`)

1. **Release 1 — Batch A** (or just its top five: A1, A2, D1, D6, B5): branch → `npm run release:gate` → deploy → prod spot-checks ("Today" counts after 05:30 IST, Gaze lead layer still plotting, dead file gone) → update `GAZE_DEVELOPMENT_TRACKER.md` (A1/A2/A3) and `CRM_DEVELOPMENT_TRACKER.md` (A6/A7/B5/B10/D6) per `AGENTS.md`.
2. **No-code day** — E4 trigger install + E2 walkthrough + A4 note; log walkthrough results in the CRM tracker.
3. **Release 2 — B1 + B2 + C2** (the operator-features core: triage view, speed-to-lead, URL state).
4. **Release 3 — D3 + A5 + B8 + D5 + D7′.**
5. **Then Batch C in the §9.4 order**, one item per release, gate + tracker update every time.

Every CAN item stays verifiable with the existing localhost-vs-prod DEV-VERIFIED pattern — nothing above requires a new environment, a pipeline change, or a second person.

---

## 10. Implementation Status (2026-09-03 — same session)

Batches A, B, and C were implemented on main per the owner's instruction. **28 of 32 items shipped**; all validated: `vitest` 467/0, `tsc` at the 9-error baseline, `eslint` clean, production `next build` PASSED.

| Batch | Shipped | Deferred (reasons in §9.4/§9.6) |
|---|---|---|
| A — correctness & hygiene | **12/12** | — |
| B — operator features | **8/8** (B2+B10 combined; D7′ = release-gate extension) | — |
| C — bigger bets | **8/12** — B4 deep links, B3 bulk actions, C4 presets, D2 per-view loading, B11-lite automation card, C6 palette search, B6 campaign window, B7-lite retention promotion | B9 funnel analytics; C5 map clustering/jump (new dependency + pin-layer rewrite); C1-lite modal extraction; D8-lite component tests (needs testing-library setup) |

Per-item records, validation logs, and decision logs live in `CRM_DEVELOPMENT_TRACKER.md` and `GAZE_DEVELOPMENT_TRACKER.md` ("Console Improvements Release" sections).

**Ship steps (owner):** ① review the working-tree diff ② apply migration 102 (pg_cron retention job) via the usual migration flow ③ commit + push (Render auto-deploys) ④ post-deploy spot-checks: "Today" counts after 05:30 IST, CRM filters + bulk bar, Gaze deep-links, Health tab automation card, ⌘K entity search.

---

*End of report. Sections 1–8: read-only council review of the working tree at commit `80faa4f` (main), 2026-09-03. Section 9: owner-constraint filter (solo operator, single environment), added 2026-09-03. Section 10: implementation status, 2026-09-03.*














