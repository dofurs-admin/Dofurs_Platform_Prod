# Dofurs Gaze Development Tracker

Last audited: 2026-09-02
Applies to: `app/api/admin/gaze/**`, `components/dashboard/admin/gaze/**` (GazeMap), `components/dashboard/admin/tabs/GazeTab.tsx`, `lib/gaze/**` (aggregates, leads), and the lead-area matching chain into `lib/service-areas.ts`

Related documents:

- `CRM_DEVELOPMENT_TRACKER.md` — the CRM tracker (the lead layer is the bridge between both)
- `lib/service-areas.ts` — the Bengaluru areas gazetteer (area names → aliases → pincodes) that powers lead-area matching

## Purpose

Source of truth for Gaze (geographic operations view) capabilities and progress. Agents and developers MUST update this file whenever they change Gaze layers, aggregation logic, area matching, or the lead layer — in the same session as the code change.

A layer rendering on the dev map is not enough. A layer is complete only when its data pipeline, fallback behavior, legend explanation, and validation are complete.

## Agent Update Rules

1. Read this file before any Gaze change.
2. Update this file in the same session as the change.
3. `[x]` only after implementation AND validation; record commands/results in the Validation Log.
4. Every new visual symbol MUST have a legend entry — a symbol without a legend explanation is a bug.
5. Any optional-data fallback (e.g. lead layer on CRM query failure) MUST `console.warn` — silent empty layers are forbidden.
6. States: `NOT STARTED` / `BUILT` / `DEV VERIFIED` (localhost dev vs prod DB) / `PRODUCTION VERIFIED`.
7. Run `npx graphify hook-rebuild` after code changes per `AGENTS.md`.

## Current Executive Status

| Area | State | Notes |
|---|---|---|
| Core Gaze layers (heat, pins, groomers, coverage, gaps) | **PRODUCTION STABLE** | Pre-date the CRM work; untouched |
| Windows + booking status/mode/provider filters, auto-fit, auto-refresh | PRODUCTION STABLE | Unchanged |
| CRM leads layer (`Lead demand`) | **DEV VERIFIED** | Working on localhost vs prod data; NOT yet committed or deployed |
| Lead status/source filters (client-side) | DEV VERIFIED | Instant, no refetch |
| All-time pincode centroid fallback | DEV VERIFIED | Areas plot even without in-window bookings |
| Static gazetteer coordinates for areas with no booking history | NOT STARTED | ~21 of 60 lead areas currently unplot (side panel only) |
| Lead-area matching improvements | NOT STARTED | 159/392 leads mapped; junk answers exist |

## Lead Layer — Implementation Record (COMPLETE, DEV VERIFIED)

Matching chain: manual pincode (`crm_leads.pincode`, highest priority — reverse-lookup to its gazetteer area via `matchLeadAreaByPincode`) → lead `source_details.city` (free text from the Meta form area question) → `matchLeadArea()` against the Bengaluru gazetteer (exact name/alias → shorthand like "HSR"/"BTM" → unambiguous prefix like "Koramangala 5th block") → area's primary pincode → booking-derived pincode centroid (windowed `pincodeStats` first, all-time `pincodeCentroids` fallback). A lead with BOTH a manual pincode and a matched area text plots at the manual pincode while still grouping under the matched area.

- [x] `lib/gaze/leads.ts` — pure module: `matchLeadArea`, `resolveLeadPhase` (pipeline → open / converted / lost / cancelled), `buildGazeLeadPoints`, `aggregateLeadsByArea` (counts, hot, conversion rate), `buildGazeLeadKpis`, `resolveLeadAreaDisplayPhase` (dominant-status colouring, ties open > converted > lost > cancelled; hot overrides open-dominant only), `LEAD_PHASE_COLORS`
- [x] API `/api/admin/gaze` extended: `leads`, `leadAreas`, `leadKpis`, `pincodeCentroids` (all-time); leads windowed on `created_at`; booking status/mode/provider filters intentionally do NOT apply to leads (pre-booking demand); lead query errors logged loudly, degrade to empty
- [x] GazeMap: "Lead demand" CircleMarkers — translucent fill (0.5) + white halo (2.5px) + status colour, radius 10–28px by lead count, tooltip + popup breakdown (incl. dominant-colour explanation)
- [x] Legend: "Lead areas" section with all five status colours + sizing/click hints (only when layer enabled)
- [x] Layer toggle (`Target` icon, default on) + fit-bounds includes lead centroids
- [x] KPI cards: "Leads" (with mapped hint) + "Open leads" (with hot hint)
- [x] "Top lead areas" side panel (top 6, with open/converted/hot/conversion %)
- [x] Lead status filter (All/Open/Hot only/Converted/Lost/Cancelled) + lead source filter (all 9 sources) — applied client-side via the same pure aggregation functions (instant, no refetch)
- [x] 35 gaze unit tests incl. area matching, aggregation, colour coding, KPIs
- [x] **Manual lead location consumption (2026-09-02)** — `crm_leads.pincode` (staff-entered) is the highest-priority location signal: plots at that pincode's centroid + reverse-lookup assigns the gazetteer area when text matching fails (requires CRM migration 098); tested for both paths
- [x] **Bug fix (critical)**: lead query must use `users!crm_leads_user_id_fkey(name)` — `crm_leads` has two FKs to `users` (`user_id`, `assigned_to`) and the un-disambiguated embed makes PostgREST fail the whole query (this silently emptied the lead layer for an entire session before detection)

## Backlog / Ideas (NOT STARTED)

- [ ] Static approximate coordinates per gazetteer area so the ~21 lead areas with zero booking history can plot (data entry into `lib/service-areas.ts` or a derived table)
- [ ] Lead-area matching improvements for common granularities ("HSR Sector 2", "Koramangala 4th Block") — extend shorthands/aliases from real lead data
- [ ] Unmapped-leads visibility: panel or KPI drill-down for the ~233 leads whose area answers are junk/unrecognized ("Yes", "Grooming", out-of-gazetteer places like Hoskote/Attibele)
- [ ] Lead-vs-booking conversion overlay (compare lead demand bubble vs booking heat in the same pincode)
- [ ] Server-side lead filters if lead volume ever exceeds the 2000-point cap
- [ ] Lead bubble click-through to a filtered CRM leads view (area + status deep-link)

## Data Notes (last measured 2026-09-02, read-only diagnostics vs prod)

- 392 leads in DB, all `new` → every area currently open-dominant (amber) until statuses diversify
- 159/392 leads matched to gazetteer areas (60 distinct areas)
- Lead areas with coordinates: 28/60 in a 30d window; 39/60 with the all-time fallback
- Lead city values include junk ("Yes" ×14, "Grooming" ×4) — form question is free text
- Booking pincodes come from `user_addresses` (default address preferred), NOT from `booking.location_address` — sheet-imported lead customers have no saved addresses and contribute no centroids
- Areas with leads but zero bookings ever: appear only in "Top lead areas" panel, not on the map

## Validation Log

| Date | Command | Result |
|---|---|---|
| 2026-09-02 | `npx vitest run lib/gaze` | 35/35 pass (24 lead-layer incl. matching/colours/KPIs + 11 aggregates) |
| 2026-09-02 | `npx vitest run` (full suite) | 379 passed / 0 failed |
| 2026-09-02 | `npx tsc --noEmit` | 0 Gaze errors (9 pre-existing unrelated) |
| 2026-09-02 | `npm run lint` | clean for Gaze files |
| 2026-09-02 | Read-only DB diagnostic (replicated route pipeline) | 392 leads, 159 mapped, 28/60 + 39/60 centroids quantified — proved data pipeline fine, isolated the query bug |
| 2026-09-02 | Read-only PostgREST embed check | ambiguous `users(name)` → error (0 rows); `users!crm_leads_user_id_fkey(name)` → 5/5 rows |
| 2026-09-02 | Manual dev-map verification by owner | Lead bubbles visible after embed fix; final style translucent + white halo per owner request |

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-02 | Lead layer added to Gaze (owner request) | Leads are pre-booking demand; next to heat/coverage they expose high-interest/low-coverage areas |
| 2026-09-02 | Colour by dominant lead status (green=converted etc.) | Owner requested status colour coding for analysis |
| 2026-09-02 | Translucent bubbles (0.5 fill) + white halo | Owner requested transparency; halo keeps the status colour readable on the amber heat layer |
| 2026-09-02 | All-time pincode centroid fallback | Window-bound centroids hid 21–32 of 60 lead areas |
| 2026-09-02 | Lead filters client-side | Instant UX; reuses pure aggregation functions; no refetch |
| 2026-09-02 | Lead layer must never break Gaze, but must warn loudly | The silent embed failure hid the layer for a full session |
| 2026-09-02 | Hot is a display override only for open-dominant areas | A mostly-converted area stays green even with one hot lead |
| 2026-09-02 | Manual pincode = top-priority location signal (reverse-lookup area) | Staff-entered location is more accurate than free-text area guessing; improves mapped-share of leads |

## Risks

- Lead mapping depends on the gazetteer (`lib/service-areas.ts`) — renamed/added areas there silently change lead mapping; keep aliases in sync with real lead answers
- Lead-area coordinate quality depends on booking-derived centroids (customer address pincodes); the first booking in a new pincode may shift an area bubble
- Uncommitted: the whole lead layer exists only in the working tree until `feature/crm-tool-development` is committed + deployed


