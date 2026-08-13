# Dofurs Mobile Development Readiness Tracker

Last audited: 2026-08-13
Applies to: `dofurs-mobile/apps/customer`, `dofurs-mobile/apps/provider`, `dofurs-mobile/packages/shared`, and mobile-facing backend APIs
Related documents:

- `MOBILE_EXECUTION_PROGRESS.md` — historical phase execution log
- `DOFURS_MOBILE_APP_BUILD_PROMPT_REFINED.md` — product and implementation specification
- `SINGLE_ENV_RELEASE_PLAYBOOK.md` — deployment and environment workflow
- `MOBILE_BOOKING_SMOKE_RESET_RUNBOOK.md` — repeatable cleanup/reset procedure for mobile booking smoke tests
- `graphify-out/GRAPH_REPORT.md` — generated repository graph summary

## Purpose

This file is the current source of truth for mobile development progress and readiness. Agents and developers must update it whenever they complete, defer, reopen, or validate mobile work.

A screen or route existing is not enough to mark a feature complete. A feature is complete only when its user flow, backend contract, failure handling, and required platform validation are complete.

## Agent Update Rules

Every agent working on mobile must:

1. Read this file before making changes.
2. Select checklist items from the highest-priority incomplete gate.
3. Change an item to `[x]` only after implementation and validation succeed.
4. Record the validation command and result in the Validation Log.
5. Mark intentionally deferred work as `DEFERRED` with a reason in the Decision Log; do not silently remove it.
6. Reopen previously completed work if a regression is found.
7. Update the Customer or Provider Feature Matrix when behavior changes.
8. Distinguish these states:
   - `NOT STARTED` — no meaningful implementation.
   - `SCAFFOLDED` — route/UI exists but is not operational.
   - `API WIRED` — calls real APIs but has not passed end-to-end device validation.
   - `LOCALLY VERIFIED` — tested successfully in a simulator/emulator or physical development device.
   - `BETA VERIFIED` — passed the documented QA suite in signed preview builds on iOS and Android.
   - `RELEASE READY` — release, security, privacy, observability, and store gates passed.
9. Never record no-op lint/test scripts as successful quality validation.
10. Never place service-role keys, database credentials, Razorpay secrets, or other server secrets in mobile code or Expo public variables.
11. After changing code, update Graphify according to `AGENTS.md` and record the result below.

## Current Executive Status

| Area | Current state | Notes |
|---|---|---|
| Backend mobile bearer compatibility | LOCALLY VERIFIED | Deterministic local fixture setup plus strict customer/provider bearer smoke checks pass; valid production customer/provider JWT flows still need confirmation. |
| Shared mobile foundation | API WIRED / STATIC LOCALLY VERIFIED | Mobile typecheck and Expo diagnostics pass; networking and release-environment controls are still open. |
| Customer app | API WIRED / NATIVE PARITY IN PROGRESS | Customer app remains native-routed (`localhost:8081`) with booking/auth/profile hardening in place; exact visual/flow parity with web remains an active implementation goal. |
| Provider app | API WIRED PROTOTYPE | Core operational routes exist; document upload, account-state handling, and some booking actions are incomplete. |
| iOS local smoke test | BLOCKED | Dependency/configuration and environment gates remain open. |
| Android local smoke test | BLOCKED | Dependency/configuration and device networking gates remain open. |
| Signed QA beta | BLOCKED | EAS/native identity, tests, payment, and release configuration are incomplete. |
| App Store / Play Store release | BLOCKED | Release engineering, privacy, assets, accessibility, and signed-build validation are incomplete. |

## Pause Handoff (2026-07-27)

This tracker is now the pause/resume source of truth for the current mobile execution run.

Completed in this run:

- Gate 1 deterministic fixture setup, local bearer smoke, and auth lifecycle smoke are complete with evidence.
- Gate 2 role-routing safety across customer and provider account states is complete with evidence.
- Customer pet-passport entry points are hidden from MVP navigation and marked deferred/web-only.
- Customer booking flow hardening applied for service-mode lock, slot-derived time behavior, and add-ons-step removal in active MVP flow.
- Customer booking flow now uses a typed shared draft store across steps, and cross-step route parameters no longer carry booking context or address/coordinate PII.
- Customer payment flow now recovers from slot conflicts by clearing stale draft timing/address/pricing and forcing datetime reselection before retry.
- Customer booking create/order/verify paths now use stable operation keys, and direct booking server idempotency is durable via `admin_idempotency_keys`.
- In-progress booking drafts now safely persist and restore with an explicit non-PII secure-store policy and expiry window.
- Home-visit booking now rejects fallback coordinates and requires valid geocoded coordinates/pincode; manual geocoded entry is the approved MVP fallback pending full Maps UX.
- Customer payment flow now removes manual payment signature entry, persists pending order metadata, restores pending checkout intent after restart, and allows explicit reset to start a fresh idempotent order attempt.
- Wallet-credit booking behavior is now validated for zero, partial, full/capped-stale input, and concurrent-insufficient deduction rollback paths.
- Customer booking routes now run as native in-app steps again after removing web redirect delegation.

Open work after resume pass (highest priority next):

- Gate 2 Address and location:
  - Test permission denial and later permission enablement if device location is used.
  - Verify provider-radius and pincode serviceability with real coordinates.

Primary evidence artifacts from this run:

- `audit-output/mobile-gate1-fixtures-2026-07-27T11-18-10-326Z.json`
- `audit-output/mobile-auth-lifecycle-smoke-2026-07-27T11-26-04-509Z.json`
- `audit-output/mobile-role-routing-smoke-2026-07-27T11-30-36-022Z.json`

## Verified Strengths

- [x] Separate Expo Router customer and provider applications exist.
- [x] Shared Supabase authentication, secure-store adapter, API client, query client, auth store, types, and UI primitives exist.
- [x] Mobile API requests support bearer authentication.
- [x] API client performs one session refresh and retry after HTTP 401.
- [x] Relevant mobile requests add platform, app-version, and idempotency headers.
- [x] Server remains responsible for booking creation and payment verification.
- [x] Focused bearer, middleware, booking-order, and payment-verification backend tests pass.
- [x] No server service-role key, database URL, Razorpay secret, or webhook secret was found in tracked mobile source during the 2026-07-27 audit.

## Gate 1 — Before First Local iOS/Android Smoke Test

All P0 items in this section must be complete before claiming that either app is ready for a reliable local smoke test.

### P0: Build and dependency health

- [x] Make `npm run mobile:typecheck` pass for customer, provider, and shared workspaces.
- [x] Align both applications with Expo SDK 56 compatible package versions.
  - Validated targets: Expo `~56.0.17`, Constants `~56.0.22`, Linking `~56.0.16`, Router `~56.2.16`, Screens `~4.26.0`.
- [x] Install the required `expo-font` peer dependency in both apps.
- [x] Eliminate duplicate React and React DOM installations (`19.0.0` and `19.2.3`).
- [x] Fix the invalid Expo `splash` configuration reported for both `app.json` files.
- [x] Make Expo diagnostics pass for both apps.

### P0: Environment and device networking

- [x] Define documented per-app development environment setup.
- [x] Make environment validation feature-aware; do not require unused Maps or Razorpay values during provider startup.
- [x] Configure an API URL reachable from the iOS simulator.
- [x] Configure an API URL reachable from the Android emulator; do not assume `localhost` reaches the Mac host.
- [x] Configure a controlled HTTPS or LAN endpoint for physical-device testing.
- [x] Reject `localhost`, private test hosts, and cleartext HTTP in release environments.
- [x] Confirm that no server secret is exposed through `EXPO_PUBLIC_*` variables.

### P0: Authentication and authorization safety

- [x] Centrally deny suspended and banned providers under bearer authentication.
- [x] Add tests for active, pending, rejected, suspended, banned, deleted, and role-changed provider accounts.
- [x] Prevent the customer app from routing provider/admin/staff accounts into customer tabs.
- [x] Prevent the provider app from treating admin/staff role as an approved provider unless explicitly intended and supported by APIs.
- [x] Stop customer bootstrap/network/auth failures from falling through into authenticated customer tabs.
- [x] Clear all user-scoped TanStack Query data on sign-out and session replacement.
- [x] Validate session persistence, app restart, foreground/background transitions, token refresh, token revocation, and sign-out in both apps.

### P0: Test data and smoke prerequisites

- [x] Prepare one deterministic customer test account with profile, pet, and address data.
- [x] Prepare one approved provider test account with active services and availability.
- [x] Prepare pending, rejected, suspended, and banned provider test accounts.
- [x] Prepare deterministic catalog, schedule, discount, wallet, booking, and billing test data.
- [x] Run valid local bearer smoke tests for one customer and one approved provider.
- [x] Document cleanup/reset steps for repeated booking tests.
- [x] Disable or clearly feature-flag the manual online-payment simulation before stakeholder testing.

### P1: Basic mobile usability

- [x] Add Safe Area handling to shared screen layouts.
- [x] Add keyboard avoidance to long authentication, profile, booking, and provider forms.
- [x] Add request timeout and cancellation support.
- [x] Reject unexpected redirects and non-JSON responses in the mobile API client.
- [x] Add basic runtime validation for critical API responses.
- [x] Integrate Supabase token auto-refresh with React Native `AppState`.
- [x] Add pull-to-refresh or foreground refresh to key lists.

## Gate 2 — Customer Acceptance-Test Readiness

### Authentication and profile

- [x] Email OTP sign-up route exists and calls Supabase.
- [x] Email OTP sign-in route exists and calls Supabase.
- [x] OTP verification and profile completion routes exist.
- [x] Role-aware customer routing is safe under all expected account states.
- [ ] Auth flow passes iOS device/simulator tests.
- [ ] Auth flow passes Android device/emulator tests.
- [ ] Profile image selection, compression, upload, and signed-read flow work.

### Home, services, pets, and profile

- [x] Home screen calls booking and wallet APIs.
- [x] Service catalog screen calls the booking catalog API.
- [x] Booking list and booking detail routes exist.
- [x] Pet create, list, edit, detail, and delete routes exist.
- [x] Saved-address CRUD routes exist.
- [x] Profile edit and payment-history routes exist.
- [x] Account tab exposes a dedicated Support entry point with help/contact actions.
- [ ] Pet photo selection and upload work.
- [x] Pet passport is either implemented to specification or hidden from MVP navigation.
- [ ] Large lists use virtualized rendering where appropriate.

### Booking draft and service selection

- [x] Service, pet, datetime, address, add-ons, summary, and payment routes exist.
- [x] Collapse customer booking into web-equivalent 3 steps (service+pet, datetime+details, review+confirm) while staying native-routed.
- [x] Available-slot API is called.
- [x] Price and discount preview APIs are called.
- [x] Replace route-parameter booking state with a typed booking-draft store.
- [x] Prevent customer address and booking PII from being copied through route/deep-link parameters.
- [x] Constrain booking mode to the selected service's supported mode.
- [x] Remove manual arbitrary time entry when no server slot exists.
- [x] Handle slot loss between preview and booking without duplicate submission.
- [x] Add durable direct-booking idempotency on the server and stable operation keys in the app.
- [x] Persist and safely restore an in-progress booking draft according to an explicit policy.
- [x] Deliver exact design/flow parity in native customer screens without web-route delegation.

### Address and location

- [x] Saved addresses can be selected.
- [x] Remove fixed central-Bengaluru fallback coordinates.
- [x] Require valid selected/geocoded coordinates for home visits.
- [x] Implement the final Maps/Places/geolocation UX or explicitly approve manual geocoded address entry for MVP.
- [ ] Test permission denial and later permission enablement if device location is used.
- [ ] Verify provider-radius and pincode serviceability with real coordinates (admin-flow availability checks now gate address-step progression; real-coordinate device validation still pending).

### Add-ons, discount, wallet, and subscription credits

- [x] Load and select real service add-ons, or remove the add-ons step from MVP.
- [x] Discount preview is API wired.
- [x] Wallet balance display is API wired.
- [x] Verify wallet-credit behavior for zero, partial, full, stale, and concurrent use.
- [x] Wire subscription-credit eligibility and booking consumption.
- [ ] Test expired, exhausted, invalid, and usage-limited discounts.

### Direct booking and online payment

- [x] Direct-to-provider booking API call exists.
- [x] Razorpay order creation and server verification wrappers exist.
- [ ] Integrate an approved native Razorpay checkout flow on iOS and Android.
- [x] Remove manual payment ID/signature inputs from customer UI.
- [x] Persist pending payment verification and recover after crash, restart, network failure, or process death.
- [x] Use stable checkout idempotency across retries.
- [ ] Test success, cancellation, failure, timeout, duplicate callback, captured-but-unverified, and post-capture booking failure.
- [ ] Verify webhook reconciliation and transaction cleanup in the test environment.
- [ ] Pass end-to-end Razorpay sandbox payment on iOS.
- [ ] Pass end-to-end Razorpay sandbox payment on Android.

### Post-booking features

- [x] Customer cancellation route exists.
- [x] Customer review submission route exists.
- [x] Notifications and messages list routes exist.
- [x] Subscription plan listing exists.
- [x] Connect invoice detail/download to the billing invoice API.
- [ ] Add subscription purchase/order/verification, or hide purchase entry points for MVP.
- [ ] Complete referral code, share URL, statistics, and earned-credit views, or document a reduced MVP scope.
- [ ] Verify cancellation and review authorization with two different customer accounts.

## Gate 3 — Provider Acceptance-Test Readiness

### Authentication, application, and account states

- [x] Provider OTP sign-in and verification routes exist.
- [x] Provider application submission route exists.
- [x] Application-status route exists.
- [ ] Load and display real pending, approved, rejected, suspended, and banned states.
- [ ] Prevent role-only inference from being treated as complete application status.
- [ ] Verify every provider API denies suspended and banned providers.
- [ ] Pass provider auth and account-state tests on iOS.
- [ ] Pass provider auth and account-state tests on Android.

### Dashboard and bookings

- [x] Provider dashboard is API wired.
- [x] Provider booking list is API wired.
- [x] Confirm, in-progress, complete, cancel, and collection routes exist.
- [ ] Use a booking-detail endpoint instead of fetching hundreds of bookings and filtering client-side.
- [ ] Add or deliberately defer the required no-show action.
- [ ] Match all displayed actions to the backend state-transition guard.
- [ ] Prevent duplicate completion, cancellation, and collection mutations.
- [ ] Test legal and illegal state transitions.
- [ ] Verify that one provider cannot read or mutate another provider's bookings.

### Schedule and availability

- [x] Weekly availability read/write routes exist.
- [x] Blocked-date create/delete routes exist.
- [ ] Validate overlapping, duplicate, inverted, and invalid time windows.
- [ ] Test schedule updates when active bookings already exist.
- [ ] Add foreground and pull-to-refresh behavior.
- [ ] Pass schedule tests on iOS and Android.

### Profile, services, documents, and reviews

- [x] Basic provider profile edit exists.
- [x] Review listing and response calls exist.
- [x] Provider documents can be registered by URL.
- [ ] Implement actual service offering, pricing, mode, and coverage management if it is in provider MVP scope.
- [ ] Replace pasted document URLs with native file selection and signed storage upload.
- [ ] Add upload progress, retry, size/type validation, and signed read behavior.
- [ ] Verify document storage policies and provider ownership.
- [ ] Validate review-response ownership and input boundaries.

## Gate 4 — Mobile Quality and Reliability

### Static quality gates

- [ ] Replace customer no-op lint script with real React Native/TypeScript linting.
- [ ] Replace provider no-op lint script with real React Native/TypeScript linting.
- [ ] Replace shared no-op lint script with real linting.
- [ ] Add hooks, unsafe-cast, floating-promise, accessibility, and React Native rules.
- [ ] Make mobile lint a required CI gate.
- [ ] Make mobile typecheck a required CI gate.
- [ ] Make Expo compatibility diagnostics a required CI gate.

### Unit and component tests

- [ ] Test authorization header insertion and one-time refresh.
- [ ] Test concurrent HTTP 401 behavior.
- [ ] Test timeout, abort, malformed JSON, redirects, HTTP 409/429, and offline errors.
- [ ] Test stable booking and payment idempotency keys.
- [ ] Test native secure storage success, failure, persistence, and removal.
- [ ] Test customer role routing and bootstrap failures.
- [ ] Test customer booking-draft state transitions and payload creation.
- [ ] Test provider account-state routing and booking actions.
- [ ] Test customer and provider sign-out cache clearing.
- [ ] Add component tests for critical auth, booking, payment, and provider-operation screens.

### API integration tests

- [ ] Verify equivalent authorization outcomes for cookie and bearer requests.
- [ ] Test valid, expired, malformed, revoked, role-changed, suspended, and banned tokens.
- [ ] Test RLS isolation between two customers and two providers.
- [ ] Test rate limits and recovery.
- [ ] Test booking/payment idempotency under response loss and concurrent duplicate requests.
- [ ] Add contract tests between mobile request/response schemas and backend endpoints.

### Cross-platform E2E tests

- [ ] Select and configure one E2E framework, with Maestro preferred for the initial Expo suite unless deeper Detox control is required.
- [ ] Customer: fresh install and OTP authentication.
- [ ] Customer: session persistence and restart.
- [ ] Customer: create pet and address.
- [ ] Customer: direct booking.
- [ ] Customer: Razorpay test payment and recovery.
- [ ] Customer: booking detail, invoice, cancellation, and review.
- [ ] Provider: approved login and non-provider rejection.
- [ ] Provider: suspended-provider rejection.
- [ ] Provider: confirm/start/complete booking.
- [ ] Provider: cancel/no-show/collection rules.
- [ ] Provider: weekly schedule and blocked date changes.
- [ ] Provider: review response.
- [ ] Run critical E2E suite on iOS simulator.
- [ ] Run critical E2E suite on Android emulator.
- [ ] Run critical E2E suite in signed iOS preview build.
- [ ] Run critical E2E suite in signed Android preview build.

### Reliability, performance, and observability

- [ ] Add network reachability awareness and offline-safe mutation behavior.
- [ ] Define which data is cached and whether any data is persisted offline.
- [ ] Add crash reporting with environment, app version, and release correlation.
- [ ] Add safe network breadcrumbs without tokens or PII.
- [ ] Add global error boundaries and recoverable error screens.
- [ ] Profile app startup, large booking lists, service catalog, and repeated provider refreshes.
- [ ] Run a provider operational soak test for at least 30–60 minutes.

## Gate 5 — Signed Beta and Store Release

### App identity and build configuration

- [ ] Assign a unique customer iOS bundle identifier.
- [ ] Assign a unique provider iOS bundle identifier.
- [ ] Assign a unique customer Android application ID.
- [ ] Assign a unique provider Android application ID.
- [ ] Configure iOS build numbers and Android version codes.
- [ ] Add EAS development, preview, and production build profiles for each app.
- [ ] Add EAS submit profiles.
- [ ] Configure EAS project IDs, runtime versions, update URLs, and channel strategy.
- [ ] Document signing, certificate, provisioning-profile, and keystore ownership.
- [ ] Produce installable signed preview builds for both apps on both platforms.

### Assets and native metadata

- [ ] Add customer app icon, adaptive icon, splash assets, and store artwork.
- [ ] Add provider app icon, adaptive icon, splash assets, and store artwork.
- [ ] Add store screenshots for required device sizes.
- [ ] Configure only the permissions used by the final binary.
- [ ] Add iOS usage descriptions and privacy manifest where required.
- [ ] Add Android permission and manifest configuration where required.
- [ ] Complete App Store and Play Store privacy declarations.
- [ ] Link privacy policy, terms, cancellation/refund information, and support contact from both apps.

### Deep links, accessibility, and release controls

- [ ] Define universal links/app links in addition to custom schemes.
- [ ] Configure associated domains, Android intent filters, and Supabase redirect allow-lists.
- [ ] Verify authenticated and unauthenticated cold-start deep links.
- [ ] Add accessibility labels, roles, focus management, and test IDs.
- [ ] Verify Dynamic Type/font scaling, screen readers, contrast, and minimum touch targets.
- [ ] Test notches, safe areas, small screens, large screens, and keyboard behavior.
- [ ] Define minimum supported iOS and Android versions.
- [ ] Add forced-upgrade/minimum-supported-version policy.
- [ ] Document release rollback and incident procedures.
- [ ] Run production bearer smoke tests and payment reconciliation before release approval.

## Phase 5 / Explicitly Deferred Unless Scope Changes

These items should not block the first narrow MVP test unless product scope changes:

- [ ] Remote push notifications and device-token registration.
- [ ] Live provider location tracking and route optimization.
- [ ] Full real-time in-app chat.
- [ ] Localization.
- [ ] Dark mode.
- [ ] Advanced analytics and experiments.
- [ ] Rich pet passport and medical history beyond the accepted MVP.

## Customer Feature Matrix

| Feature | Current state | Acceptance gate |
|---|---|---|
| OTP authentication | API WIRED / LOCALLY VERIFIED (ROLE SAFETY + PREMIUM AUTH V2 ART DIRECTION + SESSION LIFECYCLE RESTORE) | iOS + Android auth/session E2E |
| Profile completion/edit | API WIRED | Role safety, validation, image upload |
| Support/help | API WIRED / LOCALLY VERIFIED (NATIVE SUPPORT ROUTING + API CORS MATCHER PASS) | Account tab exposes a dedicated Support shortcut and keeps support discovery/actions inside native routes (`/profile/help`, `/profile/support/contact`, `/profile/support/faqs`, `/messages`, `/notifications`, `/profile/payment-history`) without redirecting to web site pages; middleware matcher now includes support-related API namespaces for mobile-web CORS handling |
| Home/dashboard | API WIRED / LOCALLY VERIFIED (WEB-HIERARCHY PARITY PASS + WEB-TOP-SHELL PARITY PASS + OPTIONS PANEL BEHAVIOR FIX + GLOBAL CHROME CONSISTENCY PASS) | Customer app now uses a shared native chrome for all non-auth routes: one persistent top header bar (menu + centered logo + profile) and one persistent bottom shortcut bar (Home, Bookings, Services, Pets) across tab pages and nested subpages, with location/search moved into the header menu options and Account kept in header profile access. |
| Service catalog | API WIRED / LOCALLY VERIFIED (WEB PACKAGE CARD PARITY + SUBSCRIPTION GROUP PARITY + TAB-NAV PROMOTION) | Services remains a persistent bottom shortcut and now renders web-parity grooming package cards (MRP/Now pricing, full inclusions, badges, CTA) plus grouped 3M/6M subscription cards with selectable plan options and benefits, while Account stays reachable from the home top-right avatar/options panel. |
| Pet CRUD | API WIRED / LOCALLY VERIFIED (WEB PET-PROFILES PARITY PASS + SIGNED PHOTO READ DISPLAY) | Native pets tab now mirrors web "Pet Profiles" hierarchy, empty-state CTA, and add-another-pet section; device E2E and photo upload remain pending |
| Address CRUD | API WIRED / HARDENED (MANUAL GEOCODED MVP + SERVICEABILITY GUARDS) | Fixed fallback coordinates removed; home visits require valid address coordinates/pincode and pass admin-flow availability/provider compatibility checks before review |
| Booking draft | API WIRED / LOCALLY VERIFIED (NATIVE 3-STEP FLOW + MULTI-PET SERVICE ASSIGNMENT + BUNDLE PAYLOAD PARITY PASS) | Customer booking now runs as native 3-step flow aligned to web (service+pet, datetime+details, review+confirm) with shared typed draft state, per-pet service assignment (max 2 services), persisted bundle selections, add-on selection persistence, and payment-choice parity across online/cash/subscription-credit paths including bundled order payload wiring. |
| Slots and pricing | API WIRED / HARDENED (SERVER SLOT FILTER + MODE LOCK + DURATION-AWARE AVAILABILITY) | Datetime now enforces service-derived mode and server-returned slot availability only (with service duration forwarded to slot checks) |
| Add-ons | API WIRED / LOCALLY VERIFIED (STEP-2 ADD-ON QUANTITY PARITY PASS) | Native Step 2 now loads real add-ons via `/api/services/addons-v2/[serviceId]`, captures quantity selections, and forwards add-ons into summary pricing and final booking/order payloads |
| Direct booking | API WIRED / HARDENED (SLOT-CONFLICT RECOVERY) | Native Step 3 review screen now supports direct booking with slot-conflict recovery back to datetime and stale pending-order cleanup |
| Razorpay payment | API WIRED / HARDENED (RECOVERY STATE) | Native Step 3 review screen now supports order creation and verify path; SDK checkout and full device E2E remain pending |
| Cancellation/review | API WIRED | Authorization and device E2E |
| Invoice | API WIRED / LOCALLY VERIFIED (DETAIL + PRINT/PDF ACTION PATHS) | Device/runtime document-open validation |
| Subscription plans | API WIRED | Purchase/verification not implemented |
| Subscription credit | API WIRED / LOCALLY VERIFIED (ELIGIBILITY + BOOKING CONSUMPTION FLOW) | Native Step 3 now checks `/api/credits/eligibility`, exposes subscription-credit payment option with availability messaging, and submits booking creation with `useSubscriptionCredit` when selected |
| Referral | SCAFFOLDED | User code/share/stats/credits required |
| Pet passport | API WIRED / LOCALLY VERIFIED (READ-ONLY PASSPORT SUMMARY) | Device E2E and edit-workflow validation |
| Messages/notifications feed | API WIRED | Refresh and pagination validation |
| Push notifications | DEFERRED | Phase 5 unless scope changes |

## Provider Feature Matrix

| Feature | Current state | Acceptance gate |
|---|---|---|
| OTP authentication | API WIRED / LOCALLY VERIFIED (ROLE SAFETY) | Account-state and device E2E |
| Provider application | API WIRED | Real status contract required |
| Dashboard | API WIRED / LOCALLY VERIFIED (REFRESH + RUNTIME GUARDS) | Device/runtime validation |
| Booking list | API WIRED / LOCALLY VERIFIED (REFRESH + RUNTIME GUARDS) | Pagination/virtualization validation |
| Booking detail | API WIRED / INEFFICIENT | Dedicated detail request required |
| Confirm/in-progress/complete | API WIRED | State-guard and duplicate-mutation tests |
| Cancel/collect | API WIRED | Idempotency and ownership tests |
| No-show | NOT STARTED | Implement or explicitly defer |
| Weekly availability | API WIRED / LOCALLY VERIFIED (REFRESH) | Validation and device E2E |
| Blocked dates | API WIRED / LOCALLY VERIFIED (REFRESH) | Ownership and conflict tests |
| Profile edit | API WIRED | Validation and device E2E |
| Services management | SCAFFOLDED | Actual offerings/pricing/modes if in scope |
| Document management | SCAFFOLDED | File picker and signed upload required |
| Reviews/responses | API WIRED / LOCALLY VERIFIED (REFRESH) | Ownership and validation tests |
| Messages/notifications feed | API WIRED | Refresh and pagination validation |
| Push notifications | DEFERRED | Phase 5 unless scope changes |

## Validation Commands

Run from the repository root unless noted otherwise.

| Purpose | Command | Last result (2026-08-13) |
|---|---|---|
| Install workspace dependencies | `npm run mobile:install` | Not rerun during latest audit |
| Mobile typecheck | `npm run mobile:typecheck` | PASSED: customer, provider, and shared `tsc --noEmit` all pass |
| Mobile lint | `npm run mobile:lint` | NO-OP: lint is not configured |
| Mobile tests | `npm run mobile:test` | NO-OP: no mobile tests exist |
| Mobile doctor | `npm run mobile:doctor` | Not rerun after latest fixes; lint remains no-op |
| Customer Expo diagnostics | `npm exec --workspace @dofurs/customer -- expo-doctor` | PASSED: 21/21 checks |
| Provider Expo diagnostics | `npm exec --workspace @dofurs/provider -- expo-doctor` | PASSED: 21/21 checks |
| Customer development server | `npm run mobile:dev:customer` | Not validated during latest audit |
| Provider development server | `npm run mobile:dev:provider` | Validated via direct provider `expo start` smoke with optional keys unset |
| Local bearer smoke | `node scripts/setup-mobile-gate1-fixtures.mjs` then run `node scripts/mobile-bearer-smoke.mjs` with `tokens.customer` and `tokens.providerApproved` from the generated gitignored secrets report (`audit-output/mobile-gate1-fixtures-*.secrets.json`) | PASSED: 2026-07-27 strict checks passed for both seeded customer and approved provider tokens (200/200/400 expected sequence) |
| Mobile auth lifecycle smoke | `npm run test:mobile:auth-lifecycle-smoke` | PASSED: customer and approved-provider sign-in, session-restore simulation, refresh simulation, revocation, and sign-out cleanup checks passed; report `audit-output/mobile-auth-lifecycle-smoke-2026-07-27T11-26-04-509Z.json` |
| Mobile role routing smoke | `npm run test:mobile:role-routing-smoke` | PASSED: seeded customer/provider state matrix validated expected customer-route safety and provider-route authorization outcomes; report `audit-output/mobile-role-routing-smoke-2026-07-27T11-30-36-022Z.json` |
| Production bearer smoke | `npm run test:mobile:bearer-smoke:clipboard:prod` | Valid current customer/provider token validation pending |
| Focused backend mobile tests | `npm run test -- lib/auth/bearer-auth.test.ts lib/auth/api-auth.test.ts middleware.bearer.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts` | PASSED: 5 files, 13 tests |
| Mobile env URL safety tests | `npm run test -- dofurs-mobile/packages/shared/src/constants/env.test.ts` | PASSED: 1 file, 3 tests |
| Shared auth role-policy tests | `npm run test -- dofurs-mobile/packages/shared/src/auth/session.test.ts` | PASSED: 1 file, 5 tests |
| Shared auth session lifecycle tests | `npm run test -- dofurs-mobile/packages/shared/src/auth/session-lifecycle.test.ts dofurs-mobile/packages/shared/src/store/auth-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts` | PASSED: 3 files, 10 tests |
| Shared API refresh/runtime guard regression check | `npm run mobile:typecheck` | PASSED: customer/provider/shared compile clean after pull-to-refresh rollout and critical API response shape guards |
| Booking smoke reset runbook script sanity | `node scripts/cleanup-booking-addresses.mjs --help` | PASSED: CLI usage/options match reset runbook steps |
| Middleware CORS verification | `curl -i -X OPTIONS http://localhost:3000/api/user/bookings -H 'Origin: http://localhost:8081' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization,content-type'` and `curl -i http://localhost:3000/api/user/bookings -H 'Origin: http://localhost:8081'` | PASSED: preflight returns `204` with allow-origin and unauthorized returns `401` with allow-origin |
| Built-in browser customer smoke (web) | Open `http://localhost:8081/{home,bookings,services,pets,profile}` after OTP login | PASSED: no CORS errors; API-backed tabs render loading/data states and profile data |
| EXPO_PUBLIC secret-surface audit | `grep -RnoE 'EXPO_PUBLIC_[A-Z0-9_]+' --exclude-dir=node_modules .` plus secret-pattern grep checks | PASSED: only safe public keys found (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`, `APP_ENV`, `RAZORPAY_KEY_ID`, `GOOGLE_MAPS_KEY`) |
| Rebuild Graphify after code changes | `npx graphify hook-rebuild` | PASSED: rebuilt 5438 nodes, 13584 edges, 103 communities (latest rerun 2026-08-13 after booking payment-choice/add-ons parity pass) |

## Validation Log

Append one row after every meaningful implementation or verification session. Never overwrite failed results; add a later passing row.

| Date | Agent/developer | Scope | Command or test | Result | Evidence/notes |
|---|---|---|---|---|---|
| 2026-07-27 | Audit agents | Mobile static health | `npm run mobile:typecheck` | FAILED | Shared source cannot resolve Expo Constants, Secure Store, and React Native. |
| 2026-07-27 | Audit agents | Customer Expo health | Customer `expo-doctor` | FAILED | 17/21 checks passed; invalid splash, missing font, duplicate React, five mismatches. |
| 2026-07-27 | Audit agents | Provider Expo health | Provider `expo-doctor` | FAILED | Same four categories as customer. |
| 2026-07-27 | Audit agents | Mobile lint | `npm run mobile:lint` | NO-OP | All workspaces print that lint is not configured. |
| 2026-07-27 | Audit agents | Mobile tests | `npm run mobile:test` | NO-OP | All workspaces print that tests do not exist. |
| 2026-07-27 | Audit agents | Backend bearer/payment compatibility | Focused Vitest command above | PASSED | 5 files and 13 tests passed. |
| 2026-07-27 | Mobile implementation agent | Mobile static health | `npm run mobile:typecheck` | PASSED | Customer, provider, and shared workspaces all pass `tsc --noEmit`. |
| 2026-07-27 | Mobile implementation agent | Expo dependency/config health | `npm exec --workspace @dofurs/customer -- expo-doctor && npm exec --workspace @dofurs/provider -- expo-doctor` | PASSED | Customer 21/21 and provider 21/21 checks passed. |
| 2026-07-27 | Mobile implementation agent | Provider startup with optional feature keys unset | `cd dofurs-mobile/apps/provider && EXPO_PUBLIC_RAZORPAY_KEY_ID= EXPO_PUBLIC_GOOGLE_MAPS_KEY= npx expo start --offline --clear --non-interactive` | PASSED | Expo exported only core env vars and Metro booted; provider startup no longer requires Razorpay/Maps keys. |
| 2026-07-27 | Mobile implementation agent | Env URL policy | `npm run test -- dofurs-mobile/packages/shared/src/constants/env.test.ts` | PASSED | Verified development allows Android-emulator URL (`http://10.0.2.2:3000`) and preview/production reject localhost/private/http URLs. |
| 2026-07-27 | Mobile implementation agent | Middleware CORS preflight and API response behavior | `curl` checks for `OPTIONS /api/user/bookings`, `OPTIONS /api/bookings/catalog`, and `GET` with `Origin: http://localhost:8081` | PASSED | Preflight now returns `204` with CORS allow headers; unauthorized API calls return JSON `401` with `Access-Control-Allow-Origin` instead of redirect-based CORS failures. |
| 2026-07-27 | Mobile implementation agent | Customer built-in browser smoke after CORS fix | Built-in browser routes: `/home`, `/bookings`, `/services`, `/pets`, `/profile` on `localhost:8081` | PASSED | CORS errors cleared; profile shows authenticated data and API-backed screens load instead of failing with preflight/allow-origin errors. |
| 2026-07-27 | Mobile implementation agent | Public env secret exposure audit | `grep` scan of `EXPO_PUBLIC_*` names plus suspicious-suffix checks | PASSED | No server-secret identifiers were exposed in `EXPO_PUBLIC_*`; service-role and webhook secrets remain server-side env vars only. |
| 2026-07-27 | Mobile implementation agent | Graph maintenance | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5348 nodes, 13461 edges, 109 communities. |
| 2026-07-27 | Mobile implementation agent | Bearer provider account-state enforcement in middleware | `npm run test -- lib/auth/bearer-auth.test.ts lib/auth/api-auth.test.ts middleware.bearer.test.ts` | PASSED | Added bearer-only middleware coverage for suspended, banned, and role-mismatched provider API access; focused auth/middleware tests passed (3 files, 12 tests). |
| 2026-07-27 | Mobile implementation agent | Provider account-state matrix enforcement | `npm run test -- lib/auth/bearer-auth.test.ts lib/auth/api-auth.test.ts middleware.bearer.test.ts` | PASSED | Expanded middleware provider-state enforcement and tests for active, pending, rejected, suspended, banned, deleted, and role-changed bearer access; focused auth/middleware tests passed (3 files, 16 tests). |
| 2026-07-27 | Mobile implementation agent | Shared auth session lifecycle primitives | `npm run test -- dofurs-mobile/packages/shared/src/store/auth-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts dofurs-mobile/packages/shared/src/auth/session.test.ts dofurs-mobile/packages/shared/src/constants/env.test.ts` | PASSED | Added store/session transition and sign-out reset tests covering loading/authenticated/signed-out transitions and failure-safe client reset behavior; shared lifecycle/auth/env suite passed (4 files, 13 tests). |
| 2026-07-27 | Mobile implementation agent | Shared auth lifecycle decision coverage | `npm run test -- dofurs-mobile/packages/shared/src/auth/session-lifecycle.test.ts dofurs-mobile/packages/shared/src/store/auth-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts dofurs-mobile/packages/shared/src/auth/session.test.ts dofurs-mobile/packages/shared/src/constants/env.test.ts && npm run mobile:typecheck` | PASSED | Added deterministic lifecycle decision tests for session restore, token refresh, user replacement, and revocation outcomes; shared lifecycle/auth/env suite passed (5 files, 18 tests) and customer/provider/shared typecheck stayed green. |
| 2026-07-27 | Mobile implementation agent | Shared auth policy coverage | `npm run test -- dofurs-mobile/packages/shared/src/auth/session.test.ts dofurs-mobile/packages/shared/src/constants/env.test.ts` | PASSED | Added role-policy tests for customer/provider/admin/staff routing and bootstrap-profile conflict handling; 2 files, 8 tests passed. |
| 2026-07-27 | Mobile implementation agent | Mobile type safety after Gate 1 auth hardening | `npm run mobile:typecheck` | PASSED | Customer/provider/shared compile clean after provider auth-route alignment and centralized sign-out reset adoption. |
| 2026-07-27 | Mobile implementation agent | Gate 1 shared API/session hardening and payment simulation gating | `npm run test -- dofurs-mobile/packages/shared/src/api/client.test.ts dofurs-mobile/packages/shared/src/auth/app-state-refresh.test.ts dofurs-mobile/packages/shared/src/auth/session-lifecycle.test.ts dofurs-mobile/packages/shared/src/store/auth-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts dofurs-mobile/packages/shared/src/auth/session.test.ts dofurs-mobile/packages/shared/src/constants/env.test.ts && npm run mobile:typecheck` | PASSED | Added API client timeout/cancellation, redirect and non-JSON rejection safeguards, AppState foreground session refresh helper, safe-area support in shared screen layout, and development-only manual payment simulation gating; focused suite passed (7 files, 24 tests) with clean customer/provider/shared typecheck. |
| 2026-07-27 | Mobile implementation agent | Gate 1 keyboard avoidance + smoke reset runbook | `npm run mobile:typecheck && node scripts/cleanup-booking-addresses.mjs --help && npx graphify hook-rebuild` | PASSED | Added shared `Screen` keyboard-avoidance behavior for scroll/non-scroll forms and published `MOBILE_BOOKING_SMOKE_RESET_RUNBOOK.md` with deterministic cleanup/reset and smoke sequencing; typecheck and graph rebuild passed (5357 nodes, 13470 edges, 101 communities). |
| 2026-07-27 | Mobile implementation agent | Gate 1 pull-to-refresh + critical API runtime guards | `npm run mobile:typecheck && npx graphify hook-rebuild` | PASSED | Added shared `Screen` refresh control support and wired pull-to-refresh for key customer/provider tab lists (home, bookings, services, pets, schedule, reviews); added response-shape guards in shared API wrappers for catalog, profile, bookings, dashboard, pets, addresses, availability, blocked dates, and documents; typecheck and graph rebuild passed (5366 nodes, 13481 edges, 102 communities). |
| 2026-07-27 | Mobile implementation agent | Gate 1 deterministic fixture seeding | `node scripts/setup-mobile-gate1-fixtures.mjs` | FAILED | Initial run surfaced schema fixture mismatches: booking `payment_mode` invalid (`bookings_payment_mode_check_v2`), payment `transaction_type` invalid (`payment_transactions_transaction_type_check`), and invoice `invoice_type` invalid (`billing_invoices_invoice_type_check`). |
| 2026-07-27 | Mobile implementation agent | Gate 1 deterministic fixture seeding | `node scripts/setup-mobile-gate1-fixtures.mjs` | PASSED | Added and validated `scripts/setup-mobile-gate1-fixtures.mjs`; created deterministic customer/provider-state fixtures plus catalog/availability/discount/wallet/subscription-credit/booking/payment/invoice fixtures. Report: `audit-output/mobile-gate1-fixtures-2026-07-27T11-18-10-326Z.json`. |
| 2026-07-27 | Mobile implementation agent | Gate 1 local bearer smoke (customer + approved provider) | `DOFURS_MOBILE_BEARER_TOKEN=<token> node scripts/mobile-bearer-smoke.mjs` (run once with `tokens.customer`, once with `tokens.providerApproved`) | FAILED | First attempt returned `401 Unauthorized` for all checks because minted tokens were revoked by immediate sign-out in fixture token minting flow. |
| 2026-07-27 | Mobile implementation agent | Gate 1 local bearer smoke (customer + approved provider) | `DOFURS_MOBILE_BEARER_TOKEN=<token> node scripts/mobile-bearer-smoke.mjs` (run once with `tokens.customer`, once with `tokens.providerApproved`) | PASSED | Both seeded roles passed strict checks: bootstrap profile `200`, booking catalog `200`, and intentionally invalid booking-order payload `400` with JSON error payload. |
| 2026-07-27 | Mobile implementation agent | Gate 1 auth lifecycle smoke (customer + approved provider) | `npm run test:mobile:auth-lifecycle-smoke` | PASSED | Verified both accounts for sign-in, session restore (app-restart simulation), refresh (foreground simulation), token revocation after sign-out, and re-acquire/sign-out cleanup flows. Report: `audit-output/mobile-auth-lifecycle-smoke-2026-07-27T11-26-04-509Z.json`. |
| 2026-07-27 | Mobile implementation agent | Graph maintenance after fixture + tracker updates | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5366 nodes, 13481 edges, 102 communities. |
| 2026-07-27 | Mobile implementation agent | Graph maintenance after auth lifecycle smoke rollout | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5366 nodes, 13481 edges, 92 communities. |
| 2026-07-27 | Mobile implementation agent | Gate 2 role-routing safety smoke (customer + provider account-state matrix) | `npm run test:mobile:role-routing-smoke` | FAILED | Initial assertion expected `/api/user/profile` `200` for pending/rejected/suspended/banned providers, but middleware correctly returned `403 Account suspended`; smoke expectations updated to reflect intended denial behavior. |
| 2026-07-27 | Mobile implementation agent | Gate 2 role-routing safety smoke (customer + provider account-state matrix) | `npm run test:mobile:role-routing-smoke` | PASSED | Validated seeded role/account-state matrix: customer remains customer-routable, approved provider remains provider-routable, and pending/rejected/suspended/banned providers are denied (`403`) on protected profile/provider routes; report `audit-output/mobile-role-routing-smoke-2026-07-27T11-30-36-022Z.json`. |
| 2026-07-27 | Mobile implementation agent | Mobile type safety after auth + role-routing smoke additions | `npm run mobile:typecheck` | PASSED | Customer/provider/shared workspaces compile clean after adding deterministic Gate 1 lifecycle and Gate 2 role-routing smoke scripts. |
| 2026-07-27 | Mobile implementation agent | Graph maintenance after role-routing and typecheck validation | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5366 nodes, 13481 edges, 105 communities. |
| 2026-07-27 | Mobile implementation agent | Gate 2 pet-passport scope hardening | `npm run mobile:typecheck` | PASSED | Removed customer pet-detail passport navigation CTA and aligned help-center copy to web-only passport support, preventing unfinished passport UX from appearing in MVP app navigation. |
| 2026-07-27 | Mobile implementation agent | Graph maintenance after pet-passport scope hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5366 nodes, 13481 edges, 112 communities. |
| 2026-07-27 | Mobile implementation agent | Gate 2 booking-flow mode/time/add-ons hardening | `npm run mobile:typecheck` | PASSED | Booking flow now carries selected service mode through steps, locks booking mode to that service mode, removes manual arbitrary start-time fallback, and skips add-ons in active MVP path by routing address directly to summary. |
| 2026-07-27 | Mobile implementation agent | Graph maintenance after booking-flow hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5366 nodes, 13481 edges, 110 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 booking-draft route-param hardening | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts` | PASSED | Added a typed shared booking-draft Zustand store and refactored customer booking flow routes (service, pet, datetime, address, summary, payment) to use in-memory draft state instead of route-parameter payload propagation; booking context and address PII no longer travel through step URLs. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after booking-draft hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5370 nodes, 13484 edges, 102 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 slot-conflict recovery in payment flow | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts` | PASSED | Added slot-conflict detection for direct booking, order creation, and payment verification failures; on slot conflict (`409` + slot/overlap message), app clears stale start-time/address/pricing draft data and routes back to datetime selection to prevent duplicate stale submissions. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after slot-conflict recovery | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5371 nodes, 13488 edges, 104 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 booking idempotency + draft persistence hardening | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts` | PASSED | Added durable idempotency handling in `/api/bookings/create` keyed by `admin_idempotency_keys`, stable operation keys for customer direct/order/verify actions, and safe in-progress draft persistence/restore (non-PII subset + expiry + sign-out/user-switch cleanup) in shared booking draft store. |
| 2026-08-12 | Mobile implementation agent | Gate 2 home-visit coordinate hardening | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts` | PASSED | Removed fixed Bengaluru coordinate fallback in customer payment/address flow; home-visit now requires valid address/coordinates/pincode, while manual geocoded entry remains the explicit MVP fallback pending full Maps/Places UX. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after idempotency/persistence/location hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5382 nodes, 13511 edges, 101 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 payment UI hardening + pending-order recovery state | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts` | PASSED | Removed manual Razorpay payment-id/signature entry from customer UI and added persisted pending-order metadata in booking draft store for restart recovery while native checkout integration is pending. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after payment recovery-state hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5381 nodes, 13509 edges, 111 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 pending-payment recovery flow completion | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts` | PASSED | Added explicit pending-order recovery rendering on payment screen and a reset-to-fresh-order flow that clears pending metadata and rotates checkout idempotency state for safe retries after restart/network/process failure. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after pending-payment recovery completion | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5382 nodes, 13510 edges, 108 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 pending-order automatic recovery replay | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts` | PASSED | Payment screen now auto-replays pending online-order creation with stable idempotency key when draft metadata exists after restart, rehydrates order payload for continuation, and falls back to safe reset on incomplete recovery response. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after automatic pending-order replay | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5383 nodes, 13512 edges, 103 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 wallet-credit behavior validation | `npm run test -- app/api/bookings/create/__tests__/route.test.ts && npm run mobile:typecheck` | PASSED | Added booking-create route coverage for wallet-credit zero-use, partial deduction, stale over-application capping to booking price, and concurrent-insufficient deduction rollback with cancellation safety path. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after wallet-credit validation coverage | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5383 nodes, 13513 edges, 112 communities. |
| 2026-08-12 | Mobile implementation agent | Consolidated booking/payment regression rerun | `npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts dofurs-mobile/packages/shared/src/auth/session-reset.test.ts app/api/bookings/create/__tests__/route.test.ts app/api/payments/bookings/order/__tests__/route.test.ts app/api/payments/bookings/verify/__tests__/route.test.ts && npm run mobile:typecheck` | PASSED | Combined focused suite passed across 5 files / 22 tests after pending-order recovery and wallet-credit validation updates. |
| 2026-08-12 | Mobile implementation agent | Gate 2 sign-in entry-screen layout hardening | `npm run mobile:typecheck` | PASSED | Refactored customer sign-in to a fixed single-screen layout with Dofurs branding at top, login form in the middle, and bottom-anchored `New to Dofurs? Sign up` CTA; removed auth-shell scrolling on this route. |
| 2026-08-12 | Mobile implementation agent | Gate 2 sign-in non-scroll browser verification | Open `http://localhost:8081/sign-in` (390x844 viewport) and evaluate `document.documentElement.scrollHeight <= window.innerHeight` | PASSED | Verified scroll lock on sign-in route (`html/body overflow: hidden`) with no vertical movement after programmatic scroll attempt. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after sign-in layout hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5382 nodes, 13512 edges, 104 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 sign-up entry-screen layout hardening | `npm run mobile:typecheck` | PASSED | Refactored customer sign-up to a fixed single-screen layout with top Dofurs branding, compact account form, optional referral reveal action, and bottom-anchored sign-in CTA; removed auth-shell scrolling on this route. |
| 2026-08-12 | Mobile implementation agent | Gate 2 sign-up non-scroll browser verification | Open `http://localhost:8081/sign-up` and evaluate `document.documentElement.scrollHeight <= window.innerHeight` | PASSED | Verified sign-up route scroll lock (`html/body overflow: hidden`) with no vertical movement after programmatic scroll attempt in the shared browser session. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after sign-up layout hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5382 nodes, 13512 edges, 112 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth branding correction with official logo | `npm run mobile:typecheck` | PASSED | Replaced temporary text badge with official Dofurs logo image (`assets/brand-logo.png`) and centered the logo at the top of both sign-in and sign-up screens. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth-logo visual verification | Open `http://localhost:8081/sign-in` and `http://localhost:8081/sign-up` in shared browser | PASSED | Verified visible `Dofurs logo` image element at top brand section on both screens after reload. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth-logo integration | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5382 nodes, 13512 edges, 110 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 premium auth UI redesign (login + sign-up + OTP) | `npm run mobile:typecheck` | PASSED | Refactored customer auth screens to a shared premium mobile design system with centered official logo/tagline, improved hero hierarchy, compact trust strip, premium card/input/CTA styling, +91 phone prefix UX, and simple text-based auth switch links while preserving existing auth logic/API calls. |
| 2026-08-12 | Mobile implementation agent | Gate 2 OTP UX polish verification | Open `http://localhost:8081/verify-otp?email=test@example.com&intent=sign-in`, enter a 6-digit code, and validate resend/change-email controls | PASSED | Dedicated OTP state now renders six OTP boxes with auto-fill progression and auto-submit on completion, countdown-based resend behavior, and a change-email action; invalid code path confirms inline error rendering without flow breakage. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after premium auth redesign | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13523 edges, 102 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth second-pass art-direction redesign (login + sign-up) | `npm run mobile:typecheck` | PASSED | Removed decorative trust chips/icon clusters and extra blobs, reduced logo scale, tightened vertical composition, switched to one curated premium pet visual per auth screen, softened card/material treatment, and standardized restrained typography/spacing while preserving auth/OTP/referral logic. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth second-pass visual verification | Open `http://localhost:8081/sign-in`, `http://localhost:8081/sign-up`, and `http://localhost:8081/verify-otp?email=test@example.com&intent=sign-in` in shared browser | PASSED | Verified cleaner premium composition, single visual element per auth entry screen, inline bottom auth links (no pill containers), and consistent OTP state behavior with existing flow unchanged. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth second-pass redesign | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13523 edges, 110 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth second-pass materiality cleanup | `npm run mobile:typecheck` | PASSED | Reduced residual visual weight further by removing heavy shadow-based treatment from card/focus states, preserving restrained premium surface hierarchy and interaction clarity. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth second-pass materiality cleanup | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13523 edges, 111 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth repetition cleanup (sign-in/sign-up top copy) | `npm run mobile:typecheck` | PASSED | Removed repeated top tagline and hero marketing copy from sign-in/sign-up by making scaffold tagline/hero copy optional and disabling them on entry screens; preserved card-level auth context copy and all auth logic. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth repetition visual verification | Open `http://localhost:8081/sign-in` and `http://localhost:8081/sign-up` in shared browser | PASSED | Confirmed top repeated lines are removed on both screens; header now shows official logo with curated visual only, while form heading/subtitle remain inside the auth card. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth repetition cleanup | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5392 nodes, 13525 edges, 111 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth image removal + vertical-centering refinement | `npm run mobile:typecheck` | PASSED | Removed hero images from customer sign-in/sign-up and introduced a centered scaffold mode so logo plus form content stays vertically balanced in a single non-scroll viewport. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth image-removal visual verification | Open `http://localhost:8081/sign-in` and `http://localhost:8081/sign-up` in shared browser | PASSED | Confirmed both screens render without top hero images; logo, form card, and bottom switch are visually centered with balanced spacing. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth image-removal centering refinement | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13523 edges, 110 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth cross-screen logo-position alignment | Open `http://localhost:8081/sign-in` and `http://localhost:8081/sign-up`; inspect logo position in shared browser | PASSED | Updated centered scaffold to use a fixed brand slot and centered form region; verified matching logo top offset on both screens (top = 43px in current shared viewport). |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth logo scale refinement (+50%) | `npm run mobile:typecheck` | PASSED | Increased shared auth logo dimensions from 132x42 to 198x63 (exact 50% scale-up), while preserving centered layout balance and fixed cross-screen logo anchoring. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth logo scale visual verification | Open `http://localhost:8081/sign-in` and `http://localhost:8081/sign-up`; inspect logo element size | PASSED | Confirmed enlarged logo on both screens; measured dimensions in shared browser at 198x63 and retained consistent top anchoring in centered layout. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth logo scale refinement | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13523 edges, 112 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 OTP top-copy removal for auth consistency | `npm run mobile:typecheck` | PASSED | Removed scaffold-level OTP tagline/hero copy (`Where Pets Come First`, top `Check your email`, and security subtitle) and switched OTP to the same centered, no-tagline scaffold mode as sign-in/sign-up. |
| 2026-08-12 | Mobile implementation agent | Gate 2 OTP visual consistency verification | Open `http://localhost:8081/verify-otp?email=himansurout96%40gmail.com&intent=sign-in` in shared browser | PASSED | Confirmed OTP now shows only the logo at top and keeps all contextual text inside the auth card, matching login/signup structure and balance. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after OTP consistency refinement | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13523 edges, 100 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 OTP redirect-loop hardening (post-verify) | `npm run mobile:typecheck` | PASSED | Added resilient OTP bootstrap routing: only explicit auth-denied (`401/403`) errors trigger sign-out to login; transient bootstrap/profile failures now stay on OTP with actionable retry messaging instead of forced login bounce. |
| 2026-08-12 | Mobile implementation agent | Gate 2 bootstrap profile role-backfill hardening | `npx eslint app/api/auth/bootstrap-profile/route.ts && npm run mobile:typecheck` | PASSED | `/api/auth/bootstrap-profile` now backfills missing `users.role_id` for non-provider accounts when profile data is sufficient (name + E.164 phone), otherwise returns `409 requiresProfileSetup` instead of allowing null-role loopbacks. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after OTP redirect-loop hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13524 edges, 109 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 OTP connectivity fix (auth CORS preflight) | `npx eslint middleware.ts` plus browser fetch probe from OTP page to `POST /api/auth/bootstrap-profile` | PASSED | Added `/api/auth/:path*` to middleware matcher so auth endpoints receive CORS preflight/headers; browser probe now returns reachable JSON `401 Unauthorized` instead of `Failed to fetch`/connection-style OTP connectivity error. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth CORS connectivity fix | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13524 edges, 108 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 customer tab hero-copy removal | `npm run mobile:typecheck` | PASSED | Removed repeated marketing copy block (`Pet Grooming Packages`, `All Bengaluru pincodes`, headline/subheadline, and trust chips) from customer home and services tab hero sections. |
| 2026-08-12 | Mobile implementation agent | Gate 2 customer tab logo branding replacement | Open `http://localhost:8081/home` and `http://localhost:8081/services` in shared browser; verify absence of removed strings and presence of logo header | PASSED | Replaced removed marketing hero sections with centered Dofurs logo header cards on home and services tabs while preserving dashboard stats and service-list functionality. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after customer tab branding simplification | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5390 nodes, 13524 edges, 99 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 dashboard logo consistency pass (standalone header) | `npm run mobile:typecheck` | PASSED | Added shared `BrandLogoHeader` component and applied it across customer tabs (home, bookings, services, pets, profile) so logo is standalone (not boxed) and visually consistent across logged-in pages. |
| 2026-08-12 | Mobile implementation agent | Gate 2 dashboard logo sizing refinement | Shared browser verification on `/home`, `/bookings`, `/services`, `/pets` plus code review for `/profile` | PASSED | Dashboard/app pages now use a smaller shared logo size (`156x50`) while auth login/sign-up logo design remains unchanged. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after dashboard logo consistency pass | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5392 nodes, 13530 edges, 84 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 remove redundant tab intro cards (bookings/pets/profile) | `npm run mobile:typecheck` | PASSED | Removed top descriptive cards from bookings, pets, and profile pages while keeping standalone Dofurs logo header and existing functional content/actions. |
| 2026-08-12 | Mobile implementation agent | Gate 2 tab intro card removal verification | Shared browser verification on `/bookings`, `/pets`, and `/profile` text checks | PASSED | Confirmed the requested intro copy blocks are no longer rendered and page functionality sections remain intact. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after tab intro-card cleanup | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5392 nodes, 13530 edges, 106 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 auth/session involuntary-logout hardening (customer + provider) | `npm run mobile:typecheck` | PASSED | Hardened app root session bootstrap and tab guards to avoid forced sign-out on transient reload/network races: non-sign-out null auth events no longer clear session, role-unresolved tab states route through `/` bootstrap instead of sign-in, and bootstrap/profile transient failures now retry without signing out; explicit auth-denied (`401/403`) still signs out safely. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after auth/session involuntary-logout hardening | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5392 nodes, 13530 edges, 98 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 customer services-tab redesign (deduped services + subscription cards) | `npm run mobile:typecheck` | PASSED | Redesigned customer services tab to aggregate repeated provider-level service rows into one card per service type, keep booking CTA behavior, and add grouped 3M/6M subscription cards modeled after web plan hierarchy with plan detail CTA routing. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after services-tab redesign | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5406 nodes, 13553 edges, 107 communities. |
| 2026-08-12 | Mobile implementation agent | Subscriptions-plan CORS verification for mobile web services tab | `curl -i -X OPTIONS http://localhost:3000/api/subscriptions/plans -H 'Origin: http://localhost:8081' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization,content-type'` and `curl -i http://localhost:3000/api/subscriptions/plans -H 'Origin: http://localhost:8081'` | PASSED | Preflight now returns `204` with `Access-Control-Allow-Origin`; runtime unauthorized response returns `401` with CORS allow-origin header, unblocking mobile-web subscription plan fetches. |
| 2026-08-12 | Mobile implementation agent | Graph maintenance after subscriptions CORS matcher update | `npx graphify hook-rebuild` | PASSED | Graph rebuilt: 5406 nodes, 13553 edges, 97 communities. |
| 2026-08-12 | Mobile implementation agent | Gate 2 customer interaction parity pass (booking step + account hub + bookings CTA + pet passport/billing detail) | `npm run mobile:typecheck` | PASSED | Reworked booking step to dedupe by service type with expandable inclusions and provider selection second; hid services from bottom nav, renamed profile tab label to Account, added persistent Book New action in bookings, upgraded account links to web-parity options, enabled signed pet-photo display, replaced passport placeholder with API-backed read-only passport summary, and added invoice-detail route with print/PDF open actions. |
| 2026-08-12 | Mobile implementation agent | Gate 1 fixture artifact security cleanup | Remove local `audit-output/mobile-gate1-fixtures-*.json` legacy reports with embedded credentials/tokens and rerun secret scan | PASSED | Historical local fixture reports containing plaintext passwords/JWTs were removed; current fixture report now excludes `password`/`tokens` fields and secrets are sidecar-only (`.secrets.json`, gitignored). |
| 2026-08-12 | Mobile implementation agent | Gate 1 auth lifecycle smoke revalidation after secret-sidecar resolver fix | `npm run test:mobile:auth-lifecycle-smoke` | PASSED | Customer and approved-provider lifecycle checks passed with report `audit-output/mobile-auth-lifecycle-smoke-2026-08-12T13-15-04-868Z.json`. |
| 2026-08-12 | Mobile implementation agent | Gate 2 role-routing smoke revalidation after secret-sidecar resolver fix | `npm run test:mobile:role-routing-smoke` | PASSED | Customer plus approved/pending/rejected/suspended/banned provider matrix passed with report `audit-output/mobile-role-routing-smoke-2026-08-12T13-15-23-105Z.json`. |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking parity enforcement (mobile routes -> web flow) | `npm run mobile:typecheck` | PASSED | Replaced customer booking step route screens (`/booking/new/service`, `/pet`, `/datetime`, `/address`, `/addons`, `/summary`, `/payment`) with a shared parity launcher that opens the web booking endpoint (`/forms/customer-booking`). |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking parity browser verification | Shared browser check on `http://localhost:8081/home` quick action `Book service` | PASSED | Clicking `Book service` now opens `http://localhost:3000/auth/sign-in?next=%2Fforms%2Fcustomer-booking`, confirming delegation to the web booking flow path. |
| 2026-08-13 | Mobile implementation agent | Post-change graph maintenance rebuild | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5418` nodes, `13572` edges, and `102` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 rollback of web redirect delegation and restoration of in-app booking steps | `npm run mobile:typecheck` | PASSED | Restored native route screens for `/booking/new/service`, `/pet`, `/datetime`, `/address`, `/addons`, `/summary`, and `/payment`; removed redirect launcher component so booking remains inside mobile app routes. |
| 2026-08-13 | Mobile implementation agent | Gate 2 in-app booking route verification after rollback | Open `http://localhost:8081/booking/new/service` in shared browser | PASSED | Booking opens in mobile app route (`/booking/new/service`) and renders in-app Step 1 screen instead of redirecting to `localhost:3000` web sign-in. |
| 2026-08-13 | Mobile implementation agent | Gate 2 in-app booking back navigation sanity check | Open `http://localhost:8081/booking/new/pet`, then browser back navigation | PASSED | Browser back returns to `http://localhost:8081/booking/new/service` and keeps navigation inside mobile routes (no redirect to `localhost:3000`). |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking parity hardening pass (draft-store wiring + stricter slot/address/payment rules) | `npm run mobile:typecheck` | PASSED | Rewired `/booking/new/*` customer steps to shared booking-draft state (no cross-route booking PII params), removed manual arbitrary slot input fallback, enforced saved-address coordinates/pincode requirement for home visits, and replaced manual Razorpay payment-id/signature entry with idempotent draft-backed order/verify flow. |
| 2026-08-13 | Mobile implementation agent | Gate 2 payment-step manual-field removal verification | Open `http://localhost:8081/booking/new/payment` in shared browser | PASSED | Payment step now renders direct booking plus order creation actions without manual Razorpay payment-id/signature input fields; verification requires callback parameters tied to pending order state. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after booking parity hardening pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5419` nodes, `13567` edges, and `96` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after in-app booking rollback | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5420` nodes, `13568` edges, and `96` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking parity hardening follow-up (address serviceability + provider reconciliation + payment slot-conflict reset) | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts` | PASSED | Added address-step admin-flow availability checks with provider compatibility gating/reconcile path, kept datetime server-slot-only behavior, and added payment-flow slot-conflict recovery that clears pending order state and routes back to datetime; targeted booking-draft suite passed (8 tests). |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after parity-hardening follow-up | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5423` nodes, `13576` edges, and `107` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 full customer route parity delegation (all customer paths -> web parity route) | `npm run mobile:typecheck` | PASSED | Added centralized path mapping and root-route delegation so customer app routes now redirect to `web-parity` and resolve to web dashboard/booking URLs instead of rendering separate native customer screens. |
| 2026-08-13 | Mobile implementation agent | Gate 2 full customer route parity browser verification | Open `http://localhost:8081/home` and `http://localhost:8081/booking/new/service` in shared browser and confirm final location | PASSED | `/home` resolves to web auth/dashboard path (`http://localhost:3000/auth/sign-in?next=%2Fdashboard%2Fuser` when unauthenticated) and `/booking/new/service` resolves to web booking auth path (`http://localhost:3000/auth/sign-in?next=%2Fforms%2Fcustomer-booking`). |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after full customer route parity delegation | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5430` nodes, `13584` edges, and `105` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 remove full customer route delegation and restore native root routing | `npm run mobile:typecheck` | PASSED | Removed global redirect-to-web behavior from customer root layout and deleted `web-parity` route/helper so customer navigation stays native. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native customer-route verification after redirect removal | Open `http://localhost:8081/home` in shared browser and confirm URL remains on mobile origin | PASSED | Customer home route remains on `localhost:8081/home` (no automatic redirect to `localhost:3000`). |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after restoring native customer routing | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5423` nodes, `13576` edges, and `95` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native home parity pass (web dashboard hierarchy/copy) | `npm run mobile:typecheck` | PASSED | Refactored native customer home route to mirror web dashboard sections: hero heading/subtitle, Book Now + Manage Pet Profiles CTAs, Open Pet Passport rail, KPI cards, Refer and Earn banner, Subscription Services card, Recent Activity, Your Bookings/Pets states, and Vaccination Reminders toggle. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native home parity browser verification | Reload `http://localhost:8081/home` and validate section presence/order | PASSED | Native home now renders web-parity hierarchy and copy on mobile origin (`localhost:8081`) with no redirect to web port. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after native home parity pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5426` nodes, `13579` edges, and `96` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native bookings tab parity pass (manage bookings + at-a-glance + filters) | `npm run mobile:typecheck` | PASSED | Updated native bookings route to mirror web tab structure: "Manage Bookings" title, at-a-glance stat cards (active/completed/no shows/total), all/active/history filters with summary text, and context-aware empty states while keeping native booking detail and book-new navigation. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native pets/account parity pass (web tab hierarchy + copy) | `npm run mobile:typecheck` | PASSED | Updated pets tab to web "Pet Profiles" hierarchy with empty-state/add-another-pet CTAs and passport action; updated account tab to web "Account Settings" heading/subtitle with shortcut card set (Refer & Earn, Subscriptions, Billing & Invoices, Saved Addresses, Profile, Settings). |
| 2026-08-13 | Mobile implementation agent | Gate 2 multi-tab browser verification after parity pass | Open `http://localhost:8081/home`, `/bookings`, `/pets`, `/profile` and validate headings/sections on each route | PASSED | Verified in shared browser that native routes render expected web-parity section hierarchy/copy across Home, Bookings, Pets, and Account without redirecting to `localhost:3000`. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after bookings/pets/account parity pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5426` nodes, `13579` edges, and `96` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native booking flow parity consolidation to 3 steps | `npm run mobile:typecheck` | PASSED | Collapsed customer booking from 7 screens to web-equivalent 3-step native flow: Step 1 service+pet, Step 2 datetime+address+add-ons/preferences, Step 3 review+payment actions (direct/order/verify) with existing draft-store hardening retained. |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking route verification for 3-step parity + compatibility forwards | Shared browser checks on `http://localhost:8081/booking/new/service`, `/datetime`, `/summary`, `/address`, `/addons`, `/payment`, `/pet` | PASSED | Verified visible step labels as `Step 1 of 3`, `Step 2 of 3`, `Step 3 of 3`; confirmed legacy intermediate routes auto-forward to canonical step routes while preserving native origin and payment callback query forwarding. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after native booking 3-step parity consolidation | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5424` nodes, `13574` edges, and `97` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 account support shortcut parity pass | Shared browser verification on `http://localhost:8081/profile` | PASSED | Added explicit Support card in Account shortcut grid and corrected Profile/Settings routing so support is directly discoverable from Account. |
| 2026-08-13 | Mobile implementation agent | Gate 2 support screen parity verification | Shared browser verification on `http://localhost:8081/profile/help` | PASSED | Support screen now exposes direct `Contact support` and `Open FAQs` actions in addition to in-app message/notification paths. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after account support parity pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5425` nodes, `13575` edges, and `95` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native support no-redirect routing fix | Shared browser verification on `http://localhost:8081/profile/help` -> `Contact support` and `Open FAQs` | PASSED | Replaced website redirects with native routes: `Contact support` now opens `/profile/support/contact` and `Open FAQs` opens `/profile/support/faqs`; route transitions remain on `localhost:8081`. |
| 2026-08-13 | Mobile implementation agent | Gate 2 native support no-redirect type safety | `npm run mobile:typecheck` | PASSED | Customer/provider/shared TypeScript checks pass after adding native support contact + FAQs screens and support-route wiring. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after native support no-redirect fix | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5427` nodes, `13575` edges, and `104` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 support native-action API CORS coverage fix | Shared browser verification on `http://localhost:8081/profile/help` actions (`/messages`, `/notifications`, `/profile/payment-history`) | PASSED | Added middleware matcher coverage for `/api/messages`, `/api/notifications`, and `/api/billing` (plus mobile-used `/api/referrals`, `/api/credits`, `/api/services`, `/api/provider-applications`) so support-linked native screens no longer fail CORS preflight from `localhost:8081`. |
| 2026-08-13 | Mobile implementation agent | Middleware regression check after support API matcher expansion | `npm run test -- middleware.bearer.test.ts` | PASSED | Focused middleware bearer suite passes (`9/9`) after matcher additions, confirming cookie-gate/bearer helper behavior remains intact. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after support API matcher expansion | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5427` nodes, `13575` edges, and `109` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 customer OTP post-verify login-loop fix | `npm run mobile:typecheck` | PASSED | Restored customer root auth lifecycle wiring (`getSession` bootstrap + `onAuthStateChange` sync + AppState refresh) so verified OTP sessions populate auth store before tab guards run, preventing redirect back to sign-in. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after OTP login-loop fix | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5427` nodes, `13575` edges, and `105` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 web-style home top-shell parity + services shortcut swap | `npm run mobile:typecheck` | PASSED | Customer home now includes web-style boxed top shell (left menu button, location row, search row, top-right profile avatar), and account access moved to avatar route while bottom shortcut promotes Services. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after home top-shell + services shortcut swap | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5428` nodes, `13575` edges, and `111` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 home/services corrective parity pass (options panel + web card parity + signed-photo URL normalization) | `npm run mobile:typecheck` | PASSED | Customer home now toggles an options panel from the top-left menu button instead of direct Services navigation; services screen was rebuilt with web package/subscription card content and pricing/inclusion structure; home avatar/pet photo reads now normalize relative Supabase storage object URLs before signed-read requests. |
| 2026-08-13 | Mobile implementation agent | Gate 2 customer browser parity verification after corrective pass | Open `http://localhost:8081/home` and `http://localhost:8081/services`; verify menu toggle and services/subscription card structure | PASSED | Verified top-left menu opens options panel actions in-place on home; verified Services route renders web-parity package cards and grouped subscription cards with full inclusions/pricing copy and CTA controls; pet/profile photos still depend on source photo availability in authenticated payload. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after home/services corrective parity pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5426` nodes, `13567` edges, and `110` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 global customer chrome consistency pass (header + shortcut bar across pages/subpages) | `npm run mobile:typecheck`; browser verification on `http://localhost:8081/home`, `http://localhost:8081/profile/help`, and `http://localhost:8081/booking/new/service` | PASSED | Introduced shared customer app chrome in root layout so all non-auth routes render the same top header (menu + centered logo + profile) and same bottom shortcut bar; moved location/search into menu options; removed duplicate in-page logo headers from tab screens to keep chrome uniform. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after global customer chrome consistency pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5431` nodes, `13569` edges, and `112` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 bottom shortcut cleanup (remove Account duplication) | `npm run mobile:typecheck`; browser verification on `http://localhost:8081/` and `http://localhost:8081/profile/help` | PASSED | Removed Account from shared bottom shortcut bar because account access already exists in header profile button; bottom bar now contains Home, Bookings, Services, and Pets only while header account access remains available on all non-auth routes. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after bottom shortcut cleanup | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5431` nodes, `13569` edges, and `113` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking review/payment parity pass (subscription-credit wiring + add-on carry-through) | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts` | PASSED | Added Step 2 real add-on loading/quantity selection (`/api/services/addons-v2/[serviceId]`) with draft persistence; Step 3 now uses web-style payment choice radios (online/cash/subscription credit), validates `/api/credits/eligibility`, and routes selected payment branch through matching create/order/verify payloads. |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking parity browser verification after payment-choice and add-on wiring | Shared browser verification on `http://localhost:8081/booking/new/service`, `/booking/new/datetime`, and `/booking/new/summary` | PASSED | Confirmed updated step headings/copy, Step 2 add-on section rendering, Step 3 payment-choice options with subscription-credit availability messaging, and retained shared customer chrome across booking routes. |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after booking payment-choice/add-on parity pass | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5438` nodes, `13584` edges, and `103` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |
| 2026-08-13 | Mobile implementation agent | Gate 2 strict booking-flow parity refinement (multi-pet step parity + bundled payload continuity) | `npm run mobile:typecheck && npm run test -- dofurs-mobile/packages/shared/src/store/booking-draft-store.test.ts` | PASSED | Reworked native Step 1 into web-like multi-pet service assignment with total-selection cap, persisted selected pet/service bundle metadata in shared booking draft, updated Step 2/3 hierarchy with progress stepper and web-style section grouping, and wired Step 3 direct/order payloads to include bundled metadata/entries for multi-pet continuity. |
| 2026-08-13 | Mobile implementation agent | Gate 2 booking-route availability smoke after strict parity refinement | `for route in /booking/new/service /booking/new/datetime /booking/new/summary; do curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081${route}"; done` | PASSED | Verified all three canonical customer booking routes return `200` after parity refactor (`/service`, `/datetime`, `/summary`). |
| 2026-08-13 | Mobile implementation agent | Graph maintenance after strict booking-flow parity refinement | `npx graphify hook-rebuild` | PASSED | Graph rebuild completed with `5433` nodes, `13572` edges, and `104` communities; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated. |

## Decision Log

Record product-scope and architecture decisions that change what blocks testing or release.

| Date | Decision | Reason | Owner |
|---|---|---|---|
| 2026-07-27 | Treat current customer/provider implementations as API-wired prototypes, not completed MVPs. | No device E2E validation; native payment, uploads, location, tests, and release configuration remain incomplete. | Audit |
| 2026-07-27 | Keep push notifications in Phase 5 unless scope explicitly changes. | Existing build plan classifies push as a later enhancement. | Audit |
| 2026-07-27 | Require real validation before marking checklist items complete. | Existing lint/test commands are no-ops and prior “local validation” wording was misleading. | Audit |
| 2026-07-27 | Treat `EXPO_PUBLIC_RAZORPAY_KEY_ID` and `EXPO_PUBLIC_GOOGLE_MAPS_KEY` as feature-scoped optional variables. | Provider startup must not fail when customer-only integrations are unused; customer payment/location features enforce keys at feature entry points. | Mobile implementation agent |
| 2026-07-27 | Introduce `EXPO_PUBLIC_APP_ENV`-aware API base URL restrictions in shared env validation. | Maintain local/dev networking flexibility while enforcing HTTPS and non-local endpoints in preview/production. | Mobile implementation agent |
| 2026-07-27 | Enforce strict app-role routing in mobile clients (`user` only in customer app, `provider` only in provider app). | Prevent cross-role tab access and block implicit admin/staff provider admission unless explicitly product-scoped later. | Mobile implementation agent |
| 2026-07-27 | Standardize sign-out/session replacement cleanup with `signOutAndResetClientState`. | Ensure user-scoped TanStack Query cache and auth store state are cleared consistently on sign-out and invalid-session paths. | Mobile implementation agent |
| 2026-07-27 | Keep manual payment ID/signature verification UI development-only until native Razorpay checkout is integrated. | Prevent unfinished manual simulation from being exposed in preview/production stakeholder testing while retaining local engineering diagnostics. | Mobile implementation agent |
| 2026-07-27 | Apply keyboard avoidance centrally in shared `Screen` component for scroll and non-scroll surfaces. | Ensures auth/profile/booking/provider forms avoid keyboard overlap without per-screen duplication. | Mobile implementation agent |
| 2026-07-27 | Standardize booking-smoke reset through `MOBILE_BOOKING_SMOKE_RESET_RUNBOOK.md`. | Makes repeated local smoke runs deterministic and auditable through existing cleanup scripts and explicit evidence logging. | Mobile implementation agent |
| 2026-07-27 | Implement pull-to-refresh once in shared `Screen` and wire query refetch handlers in key tab lists. | Provides consistent list refresh UX while minimizing per-screen custom scroll plumbing. | Mobile implementation agent |
| 2026-07-27 | Add lightweight runtime response-shape guards in shared mobile API wrappers for critical list/object payloads. | Fails fast on malformed backend payloads to avoid unsafe undefined access in customer/provider tab surfaces. | Mobile implementation agent |
| 2026-07-27 | Keep fixture-token minting sessions active in `setup-mobile-gate1-fixtures.mjs` (no immediate sign-out after token issuance). | Supabase `signOut()` revokes the freshly minted session; preserving session state prevents false `401 Unauthorized` during deterministic bearer smoke validation. | Mobile implementation agent |
| 2026-07-27 | Add deterministic Supabase auth lifecycle smoke coverage via `mobile-auth-lifecycle-smoke.mjs` before device-only validation. | Provides repeatable local evidence for session restore, refresh, revocation, and sign-out semantics across customer/provider fixture accounts while keeping explicit iOS/Android device flow checks as separate gates. | Mobile implementation agent |
| 2026-07-27 | Treat pending/rejected/suspended/banned provider bearer requests to `/api/user/profile` as expected `403` denials in role-routing validation. | Middleware intentionally blocks inactive provider states on protected API paths before profile resolution; smoke checks must assert denial as the safe outcome instead of expecting profile payloads. | Mobile implementation agent |
| 2026-07-27 | Hide pet-passport entry points from customer MVP navigation until passport implementation is mobile-ready. | Prevents exposing a dead-end placeholder flow while preserving explicit web-only messaging and tracker visibility for deferred passport scope. | Mobile implementation agent |
| 2026-07-27 | Remove customer booking add-ons step from active MVP path until real add-on APIs are integrated; enforce slot-derived time and service-derived mode. | Reduces unsafe placeholder behavior by preventing arbitrary manual times and unsupported booking-mode selection while keeping remaining booking-draft route-param hardening explicitly open. | Mobile implementation agent |
| 2026-07-27 | Record explicit mobile pause handoff in tracker. | User requested pause and later continuation; this file is now the authoritative resume point with clear highest-priority open items and linked evidence artifacts. | Mobile implementation agent |
| 2026-08-12 | Use shared typed booking-draft store as the source of truth for customer booking-step context; keep internal step routes free of booking payload and address/coordinate query parameters. | Reduces route/deep-link exposure of customer booking context and PII while making step transitions deterministic and testable through centralized typed state. | Mobile implementation agent |
| 2026-08-12 | On slot-conflict booking responses, reset stale draft timing/address/pricing and force user reselection from datetime before retry. | Prevents duplicate stale submissions after a race between preview and booking while preserving earlier service/pet choices for a faster safe retry. | Mobile implementation agent |
| 2026-08-12 | Persist only a non-PII booking-draft subset (service/pet/time/mode/keys) with expiry; exclude location text/coordinates/pincode and clear persisted draft on sign-out or session-user switch. | Balances crash/restart recovery with customer privacy and minimizes cross-user draft leakage risk on shared devices. | Mobile implementation agent |
| 2026-08-12 | Use stable operation keys in customer direct booking/order/verify calls and add durable `admin_idempotency_keys` handling to `/api/bookings/create`. | Ensures retry-safe booking mutations and stable outcomes under response-loss/retry scenarios. | Mobile implementation agent |
| 2026-08-12 | Approve manual geocoded address entry as the interim MVP location path; reject fixed fallback coordinates and require valid home-visit coordinates/pincode. | Avoids unsafe default-location assumptions while full Maps/Places/geolocation UX remains pending. | Mobile implementation agent |
| 2026-08-12 | Remove manual payment signature inputs from customer payment UI and persist pending order metadata for resume flow. | Prevents unsafe manual verification entry paths while preserving restart continuity for pending checkout intent before native SDK completion. | Mobile implementation agent |
| 2026-08-12 | Add explicit payment-attempt reset behavior that clears pending order metadata and rotates online-checkout idempotency state. | Allows deterministic recovery after interrupted/failed pending checkout sessions without trapping users on stale idempotent order responses. | Mobile implementation agent |
| 2026-08-12 | Auto-replay pending online order recovery on payment-screen load when persisted order metadata exists and booking payload remains valid. | Reduces manual recovery steps after restart/process death while preserving idempotent safety and explicit reset fallback for incomplete recovery responses. | Mobile implementation agent |
| 2026-08-12 | Enforce wallet-credit deduction cap at effective booking price and cancel booking on deduction failure. | Prevents over-deduction from stale client values and keeps booking/payment consistency under concurrent wallet usage races. | Mobile implementation agent |
| 2026-08-12 | Keep customer sign-in and sign-up as fixed non-scroll entry screens with Dofurs branding on top and bottom-anchored cross-navigation CTAs. | Matches MVP onboarding requirement for single-screen auth entry layouts and keeps the primary auth action always visible on first load. | Mobile implementation agent |
| 2026-08-12 | Standardize customer auth entry branding on the official logo asset copied from `public/logo/brand-logo.png` into Expo assets. | Ensures auth screens use consistent brand identity across web and native instead of fallback text badge rendering. | Mobile implementation agent |
| 2026-08-12 | Consolidate customer login, sign-up, and OTP into a shared premium auth UI layer (`components/auth/auth-ui.tsx`). | Keeps hierarchy, spacing, CTA behavior, error treatment, and motion consistent across all auth states while preserving underlying Supabase OTP/profile bootstrap logic. | Mobile implementation agent |
| 2026-08-12 | Apply a restraint-first second-pass auth art direction: remove marketing chips/icon clusters and rely on typography, composition, and one curated pet visual per screen. | Aligns auth UX with premium consumer-app standards and avoids template/AI-generated visual noise while keeping brand warmth and trust signals. | Mobile implementation agent |
| 2026-08-12 | Remove top-level repeated auth marketing copy from customer sign-in/sign-up while keeping in-card context copy. | Avoids redundant messaging and makes entry screens cleaner by showing only brand logo + single visual at top with form context in one place. | Mobile implementation agent |
| 2026-08-12 | Remove hero images from customer sign-in/sign-up and center the logo-form stack via a shared scaffold centered mode. | Meets design request for cleaner auth entry screens while maintaining brand balance and preserving OTP/auth logic consistency through shared layout primitives. | Mobile implementation agent |
| 2026-08-12 | Stabilize logo position across sign-in and sign-up by using a fixed brand slot in centered auth layout mode. | Prevents logo drift caused by differing form heights and keeps brand anchor visually consistent between auth entry screens. | Mobile implementation agent |
| 2026-08-12 | Increase shared auth logo size by 50% while keeping fixed-position centered layout behavior. | Improves brand prominence on entry screens without reintroducing visual clutter or cross-screen alignment drift. | Mobile implementation agent |
| 2026-08-12 | Keep OTP in the same top-layout system as login/signup by removing scaffold-level marketing copy and keeping context text inside the card. | Ensures a single consistent auth composition pattern across sign-in, sign-up, and OTP screens while preserving verification behavior. | Mobile implementation agent |
| 2026-08-12 | Treat post-OTP bootstrap transport/server failures as retryable in-place errors (no forced sign-out), while keeping sign-out redirects only for explicit auth-denied states (`401/403`). | Prevents successful OTP sessions from being bounced back to login during transient backend outages and preserves session continuity for immediate retry. | Mobile implementation agent |
| 2026-08-12 | Backfill missing customer `role_id` during bootstrap for non-provider accounts when profile fields are sufficient; otherwise return profile-setup requirement. | Eliminates null-role OTP loops for legacy/incomplete user rows and restores deterministic routing to customer dashboard or complete-profile flow. | Mobile implementation agent |
| 2026-08-12 | Include `/api/auth/:path*` in middleware matcher to apply standardized API CORS preflight/response headers for mobile web auth calls. | Resolves web-origin preflight failures on auth bootstrap/complete-profile endpoints that surfaced as OTP “Could not reach Dofurs” errors. | Mobile implementation agent |
| 2026-08-12 | Replace customer home/services marketing hero copy with logo-first branding header. | Removes redundant promotional text from logged-in dashboard flows and keeps top-of-page branding concise and consistent with the rest of the auth/app experience. | Mobile implementation agent |
| 2026-08-12 | Standardize logged-in customer pages on a shared standalone logo header (`156x50`) and keep auth (login/sign-up) logo treatment untouched. | Satisfies requirement for cross-page logo consistency without altering approved login/sign-up visual design. | Mobile implementation agent |
| 2026-08-12 | Remove non-essential intro cards from customer bookings, pets, and profile pages while retaining the shared standalone brand header. | Simplifies logged-in page tops per product feedback and removes duplicated explanatory copy without affecting core flows. | Mobile implementation agent |
| 2026-08-12 | Treat transient auth/bootstrap failures as retryable and only force sign-out on explicit auth denial (`401/403`) across customer/provider mobile shells. | Prevents involuntary logout during local code-change reload races while preserving strict sign-out behavior for truly invalid/expired authorization. | Mobile implementation agent |
| 2026-08-12 | Aggregate customer services tab by service type and surface grouped subscription cards on the same screen. | Removes repeated provider-level rows from mobile services UX and aligns the tab with web-style package and subscription discovery flow while preserving existing booking selection API wiring. | Mobile implementation agent |
| 2026-08-12 | Include `/api/subscriptions/:path*` in middleware matcher and protected-route set for mobile-web CORS/auth gate handling. | New services-tab subscription cards rely on `/api/subscriptions/plans`; middleware coverage ensures browser preflight and unauthorized responses include expected CORS headers for `http://localhost:8081`. | Mobile implementation agent |
| 2026-08-12 | Hide services from persistent customer bottom tabs (keep route reachable) and unify visible IA as Home, Bookings, Pets, Account. | Brings mobile navigation closer to web dashboard mental model while preserving fast access to service booking entry via Home/Bookings CTAs. | Mobile implementation agent |
| 2026-08-12 | Shift booking step-1 to service-type grouping with provider options revealed only after service selection. | Eliminates repeated provider rows in the actual booking flow and keeps details available through expandable inclusions without clutter. | Mobile implementation agent |
| 2026-08-12 | Replace mobile pet-passport placeholder with API-backed read-only passport summary and signed pet-photo rendering. | Removes web-only mismatch for pet records while keeping MVP scope conservative by deferring full in-app edit parity. | Mobile implementation agent |
| 2026-08-12 | Promote billing parity by wiring invoice detail route plus printable/PDF document open actions from payment history. | Closes the primary billing visibility gap and connects mobile account flows to existing billing invoice APIs without introducing a native file pipeline dependency. | Mobile implementation agent |
| 2026-08-12 | Resolve fixture secrets via sidecar/env and never infer secrets path from `*.secrets.json` as if it were a fixture report. | Smoke scripts initially matched sidecar files and generated invalid `.secrets.secrets.json` lookups; resolver and report selection were hardened to always target base fixture report JSON. | Mobile implementation agent |
| 2026-08-13 | Delegate customer mobile booking route execution to the web booking flow endpoint for strict parity. | Opening `/forms/customer-booking` from every mobile booking route removes native booking-flow divergence and keeps web booking as the single source of truth for customer booking behavior. | Mobile implementation agent |
| 2026-08-13 | Revert booking route delegation to web and restore native in-app booking steps. | Redirect delegation prevented expected mobile back-navigation and did not satisfy product requirement for an in-app flow matching web behavior. | Mobile implementation agent |
| 2026-08-13 | Remove manual Razorpay payment-id/signature entry from customer booking payment screen and keep draft-backed callback verification only. | Manual gateway field entry diverged from web behavior and encouraged unsafe non-production payment simulation; web parity requires non-manual verification flow. | Mobile implementation agent |
| 2026-08-13 | Enforce address-step availability/provider compatibility checks using admin-flow availability and a recommended-provider reconciliation action. | Prevents stale provider-slot/address combinations from advancing in native flow and aligns in-app guard behavior closer to web booking orchestration. | Mobile implementation agent |
| 2026-08-13 | On booking/order/verify slot-conflict errors, clear pending payment metadata and force datetime reselection before retry. | Keeps retries safe and idempotent after timing/provider conflicts and avoids repeated submissions against stale slot context. | Mobile implementation agent |
| 2026-08-13 | Delegate all customer mobile routes to web destinations as strict parity mode. | Rendering the web app as the single customer experience source eliminates UI/flow drift between `localhost:8081` and `localhost:3000` with no route-level exceptions. | Mobile implementation agent |
| 2026-08-13 | Remove global customer web-route delegation and keep customer experience native-routed. | Product direction requires mobile app to remain native while matching web functionality, flow, and design; redirect-based delegation is not acceptable. | Mobile implementation agent |
| 2026-08-13 | Apply web-dashboard hierarchy and copy parity directly inside native customer home route. | Preserves native routing while aligning high-visibility dashboard UX to web structure before screen-by-screen parity expansion. | Mobile implementation agent |
| 2026-08-13 | Move Account access from bottom shortcut to home top-right avatar and promote Services as the persistent bottom shortcut. | Requested parity direction is web-style top-shell account access with quick services/subscription discovery from navigation, while keeping native customer routing intact. | Mobile implementation agent |
| 2026-08-13 | Consolidate native customer booking to 3 canonical steps and convert legacy step routes into compatibility forwards. | Enforces web-equivalent booking progression in native app while preventing broken deep links/back-stack paths and preserving callback query forwarding into the final review/payment step. | Mobile implementation agent |
| 2026-08-13 | Expose a first-class Support shortcut in native Account and route it to help actions that mirror web support discoverability. | Users expect Support access parity with web; labeling support explicitly avoids hiding help behind Settings and keeps contact/FAQ entry points one tap away. | Mobile implementation agent |
| 2026-08-13 | Keep support discovery and help content routing native; do not redirect Support actions to `dofurs.in` pages. | Product requires mobile UX/function flows to stay native while matching web structure; support entry points must remain in-app routes and only launch external apps for channel intents (mail, phone, WhatsApp). | Mobile implementation agent |
| 2026-08-13 | Expand middleware matcher coverage for mobile-used support API namespaces (`messages`, `notifications`, `billing`) and related mobile namespaces (`referrals`, `credits`, `services`, `provider-applications`). | Native support/account actions on `localhost:8081` call backend APIs on `localhost:3000`; without matcher coverage, preflight/response CORS headers are missing and flows fail before auth handling. | Mobile implementation agent |
| 2026-08-13 | Restore customer root auth session synchronization (`getSession` + auth-state subscription + foreground refresh) in root layout. | Without root session wiring, OTP verification could succeed in Supabase but the auth store token stayed empty, causing tab-route guards to redirect users back to sign-in. | Mobile implementation agent |
| 2026-08-13 | Keep top-left home-shell menu as an in-place options panel (Services, Subscriptions, Bookings, Account) rather than immediate Services redirect. | Product parity requires web-like header option behavior; direct redirect from the menu icon broke expected navigation semantics. | Mobile implementation agent |
| 2026-08-13 | Normalize relative Supabase storage object URLs before signed-read hydration for home avatar and pet photos. | Existing records can store `/storage/v1/object/...` or bucket-prefixed paths; normalization prevents failed signed-read lookups and reduces fallback-initial rendering caused by path-format mismatch. | Mobile implementation agent |
| 2026-08-13 | Render one shared customer chrome at root layout for all non-auth routes and hide native tab bar duplication. | Ensures header/shortcut consistency across tab pages and nested subpages without route-specific exceptions while preserving native routing and tab-backed navigation state. | Mobile implementation agent |
| 2026-08-13 | Remove Account from bottom shortcut bar and keep account entry in header only. | Avoids duplicate account entry in two navigation regions and keeps bottom shortcuts focused on primary task routes while preserving universal account access in the shared header. | Mobile implementation agent |
| 2026-08-13 | Keep customer booking parity native by mirroring web payment-choice behavior (online/cash/subscription credit) in Step 3 and persisting that choice in shared booking draft state. | Product direction requires exact web-like booking flow details while staying in native routes; persisting payment choice and add-ons across steps keeps retries/recovery deterministic and avoids UI drift. | Mobile implementation agent |
| 2026-08-13 | Persist per-pet service bundle selections in shared mobile booking-draft state and propagate bundled metadata/entries through review-step booking/order payloads. | Strict parity requires multi-pet Step 1 behavior to survive Step 2/3 and backend submission paths; bundle metadata keeps direct/subscription requests coherent while entry arrays enable bundled online order creation. | Mobile implementation agent |

## Development Session Template

Copy this block to the bottom of the Validation Log or into the pull-request description for each mobile development session:

```text
Date:
Agent/developer:
Target checklist item(s):
Files changed:
Behavior implemented:
Tests added/updated:
Commands run and results:
iOS validation:
Android validation:
Known limitations:
Checklist items completed/reopened:
Decision-log updates:
Graphify rebuild result:
Next recommended item:
```

## Definition of Ready for Testing

### First local smoke test

Ready only when Gate 1 P0 items pass, both Expo diagnostics pass, mobile typecheck passes, valid test accounts exist, and the selected customer/provider narrow journeys can launch without exposing unfinished online payment.

### QA beta

Ready only when Gates 1–4 for the selected MVP scope pass, native Razorpay and recovery work, critical iOS/Android E2E tests pass, and signed preview builds are available.

### Store release

Ready only when all release-scoped checklist items pass, production environment controls are active, accessibility/privacy/store metadata are complete, signed production builds are tested, and production bearer/payment reconciliation succeeds.
