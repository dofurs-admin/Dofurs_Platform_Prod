# Booking Flow Production Audit Report

**Date:** 2026-04-09
**Scope:** End-to-end booking flow — Customer, Provider, Admin, Payments, State Machine

---

## Executive Summary

Audited 60+ files across the entire booking lifecycle. Found **52 gaps** categorized into 4 severity tiers. The most critical issues are: **double-booking race conditions**, **non-atomic financial operations** (wallet credits, discounts), **zero notification infrastructure** for providers, and **timezone bugs** in booking time storage.

---

## P0 — Critical (Must Fix Before Scale)

### 1. Double-Booking Race Condition
**Files:** `lib/bookings/service.ts:443`, `infra/supabase/035_booking_creation_enhanced_atomic.sql`
**Issue:** `createBooking` uses a direct `INSERT` instead of the `create_booking_v2` RPC, which has `pg_advisory_xact_lock(provider_id)` for serialization. The DB trigger `ensure_no_booking_overlap` is vulnerable to TOCTOU races — two concurrent inserts can both pass the overlap check before either commits.
**Fix:**
- Change `createBookingWithLegacyServiceFallback` to call `create_booking_v2` RPC instead of direct INSERT
- Add integration test that simulates concurrent booking attempts for the same slot
- Fallback: add a UNIQUE partial index on `(provider_id, booking_date, start_time)` WHERE `booking_status IN ('pending','confirmed')`

### 2. Timezone Bug — Booking Times Stored as UTC, Compared as IST
**Files:** `lib/bookings/service.ts:501-504`, `lib/bookings/engines/slotEngine.ts:42`
**Issue:** Booking start time is constructed with `Z` suffix (UTC), but the slot engine uses IST via `Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata'})`. A booking at "23:00 IST" would be stored as "23:00 UTC" (which is 04:30 IST next day). This causes date boundary mismatches.
**Fix:**
- Remove the `Z` suffix in `service.ts:501` — construct as `new Date(\`${input.bookingDate}T${input.startTime}:00+05:30\`)`
- Or store `start_time`/`end_time` as plain time strings without timezone conversion (they're already in IST context)
- Add a shared `toIstDate(dateStr, timeStr)` utility in `lib/utils/date.ts`
- Audit all places where `new Date()` is used for booking time comparisons

### 3. Bundle Bookings Have No Rollback on Partial Failure
**File:** `components/forms/PremiumUserBookingFlow.tsx:2033-2083`
**Issue:** Multi-pet/service bundles create bookings sequentially via separate `POST` calls. If booking 3 of 5 fails, bookings 1-2 remain live with no rollback. User sees a generic error but has invisible partial bookings.
**Fix:**
- Option A: Create a server-side `/api/bookings/create-bundle` endpoint that processes all bookings in a single transaction
- Option B: Implement client-side rollback — track created booking IDs and cancel them on failure
- Option C (quick): Show partial success state to user with links to manage the created bookings

### 4. Wallet Credit Deduction is Non-Transactional
**Files:** `app/api/bookings/create/route.ts:168-193`, `lib/credits/wallet.ts`
**Issue:** Credits are deducted AFTER booking creation. If deduction fails, the booking is cancelled directly (bypassing state machine), but if the cancellation also fails, credits are lost and booking remains. Credits can also be double-restored if `restoreCredits` is called from multiple paths.
**Fix:**
- Move credit deduction INTO the `create_booking_v2` RPC as part of the same transaction
- Add idempotency key to `restoreCredits` based on `bookingId` to prevent double-restore
- Use the state machine for cancellation even in the error path

### 5. `CreateBookingInput.finalPrice` Allows Price Bypass
**Files:** `lib/bookings/types.ts:80`, `lib/bookings/service.ts:510-514`
**Issue:** The `createBookingWithLegacyServiceFallback` function reads `input.finalPrice` and `input.discountAmount` to calculate the stored `finalAmount`. While the API route doesn't pass these, any internal caller of `createBooking` could set `finalPrice: 0`.
**Fix:**
- Remove `finalPrice` and `discountAmount` from `CreateBookingInput` type
- Always calculate pricing server-side in `createBooking` using the pricing engine
- If legacy compatibility is needed, add a separate `LegacyBookingInput` type

### 6. No Automatic Refund on Provider-Initiated Cancellation
**Files:** `lib/bookings/service.ts:712-735`, `app/api/bookings/[id]/status/route.ts`
**Issue:** When a provider cancels, wallet credits are restored but Razorpay payment is NOT refunded. Users who paid online must contact support for manual refund.
**Fix:**
- Add auto-refund logic in `runPostTransitionHooks` for provider-initiated cancellations
- Check if booking has a linked Razorpay payment transaction with status `captured`
- Initiate refund via `razorpayInstance.payments.refund()` automatically
- Send email/SMS to user confirming the refund

---

## P1 — High (Operational Risk)

### 7. Zero Push Notification Infrastructure
**Files:** `lib/hooks/useRealtime.ts`
**Issue:** Providers learn about new bookings ONLY if they have the dashboard tab open. No email, SMS, push notifications, or WhatsApp alerts exist anywhere in the codebase.
**Fix:**
- Phase 1: Add email notifications via transactional email service (Resend/Postmark) for: new booking, booking confirmed, booking cancelled, booking completed
- Phase 2: Add WhatsApp Business API or SMS (MSG91/Twilio) for time-critical notifications
- Trigger from `runPostTransitionHooks` in `service.ts`

### 8. No Slot Availability Re-check at Booking Creation
**File:** `app/api/bookings/create/route.ts`
**Issue:** Between loading availability (client) and submitting (server), the slot could be taken. The API never calls `get_available_slots` to verify.
**Fix:**
- Before INSERT, call `get_available_slots` for the requested provider+date and verify the requested time is still available
- Or rely on the DB-level overlap constraint (fix #1 above) and handle the conflict error gracefully with a user-friendly message

### 9. Discount Usage Limit Race Condition
**Files:** `lib/bookings/discounts.ts:128-148`
**Issue:** Usage count check and redemption creation are separate operations. Two concurrent bookings can both pass the limit check.
**Fix:**
- Use `SELECT ... FOR UPDATE` in the discount validation query
- Or use a DB function that atomically checks and increments usage count
- Or use distributed lock keyed on `discount_id`

### 10. Reschedule is Non-Atomic (Can Create Duplicate Bookings)
**File:** `components/forms/PremiumUserBookingFlow.tsx:1511-1552`
**Issue:** New booking is created first, then old booking is cancelled. If cancel fails, rollback can also fail, leaving two active bookings.
**Fix:**
- Create a server-side `/api/bookings/reschedule` endpoint that atomically creates the new booking and cancels the old one in a single transaction
- Return both the new booking ID and confirmation of old booking cancellation

### 11. Pending Bookings Never Expire
**Files:** `lib/bookings/service.ts`, `lib/bookings/state-transition-guard.ts`
**Issue:** A booking can stay in `pending` state indefinitely. No TTL, no cron, no auto-cancel.
**Fix:**
- Add a scheduled job (Supabase pg_cron or external) that cancels bookings pending for >24 hours
- Send a reminder notification to the provider after 2 hours of pending
- Log the auto-cancellation in transition events

### 12. Availability Changes Don't Cascade to Existing Bookings
**Files:** `app/api/provider/availability/route.ts`, `lib/provider-management/service.ts`
**Issue:** When a provider removes availability or blocks a date, existing bookings in that window are not affected, warned, or cancelled.
**Fix:**
- When availability is reduced or blocked, query for affected pending/confirmed bookings
- Show a warning to the provider: "You have X bookings during this window"
- Require explicit confirmation before proceeding
- Optionally auto-notify affected users

### 13. Suspended Providers Still Have Active Bookings
**File:** `lib/provider-management/service.ts`
**Issue:** Suspending a provider does not cancel or reassign their bookings. Users have upcoming bookings with an inaccessible provider.
**Fix:**
- On provider suspension, query all pending/confirmed bookings
- Auto-cancel them with reason "Provider suspended"
- Trigger refund/credit restoration for affected bookings
- Email affected users

### 14. Bulk Status Update Missing Critical Side Effects
**File:** `app/api/admin/bookings/bulk-status/route.ts`
**Issue:** Bulk cancellation does NOT restore wallet credits. Bulk completion does NOT trigger referral rewards. Inconsistent with single-booking status updates.
**Fix:**
- Add `restoreCredits` call for bulk cancellations (match single-booking behavior)
- Add `processReferrerRewardOnFirstBooking` for bulk completions
- Extract shared logic into a helper used by both paths

### 15. Post-Transition Financial Hooks Silently Fail
**File:** `lib/bookings/service.ts` (runPostTransitionHooks)
**Issue:** Credit restoration, invoice generation, discount reversal are all fire-and-forget. Failures are only logged to console.
**Fix:**
- Create a `failed_hooks` or `pending_operations` table to track failed side effects
- Implement a retry mechanism for critical operations (credits, invoices)
- Alert admin dashboard when financial hooks fail

### 16. Provider Cancellation Requires No Reason
**Files:** `app/api/provider/bookings/[id]/status/route.ts`, `app/api/bookings/[id]/status/route.ts`
**Issue:** Provider can cancel any booking without explanation. Bad for dispute resolution and user trust.
**Fix:**
- Make `cancellationReason` required when role is `provider` and status is `cancelled`
- Add predefined reason categories (e.g., "unavailable", "emergency", "scheduling conflict")
- Surface the reason to the user

---

## P2 — Medium (UX & Operational Gaps)

### 17. Map Completely Disabled on Mobile
**File:** `components/forms/LocationPinMap.tsx:88-91`
**Issue:** `dragging={false}`, `touchZoom={false}`, `tap={false}` make it impossible to pan/zoom on touch devices.
**Fix:** Enable `dragging` and `touchZoom` on mobile. Keep `scrollWheelZoom={false}` to prevent accidental scroll hijacking.

### 18. No Past-Date Validation on Booking Date
**File:** `components/forms/PremiumUserBookingFlow.tsx:1721-1768`
**Issue:** `handleNextStep` checks if `bookingDate` is truthy but never validates it's a future date.
**Fix:** Add `if (bookingDate < todayIST) { setError('Cannot book in the past') }` check.

### 19. First-Booking Discount Counts Cancelled Bookings
**File:** `lib/bookings/discounts.ts:114-123`
**Issue:** SELECT counts all bookings including cancelled ones. A user with only cancelled bookings can't use first-booking discounts.
**Fix:** Add `.in('booking_status', ['confirmed', 'completed'])` filter.

### 20. No Cancellation Window or Policy
**Files:** All status change routes
**Issue:** Users can cancel 1 minute before appointment with no penalty. No configurable cancellation window.
**Fix:**
- Add `cancellation_window_hours` to service catalog or provider settings
- Before allowing cancellation, check if booking start time - now < window
- If inside window, apply cancellation fee or block cancellation

### 21. No Teleconsult Meeting Link Support
**Issue:** `teleconsult` mode bookings have no field for video call URL, phone number, or meeting link.
**Fix:** Add `meeting_link` field to booking schema. Require it when confirming a teleconsult booking.

### 22. No Clinic Address Shown for Clinic Visits
**Issue:** `clinic_visit` bookings don't include the provider's clinic address.
**Fix:** Include `clinic_address` from provider profile in the booking confirmation.

### 23. Pricing Shows ₹0 While Loading
**File:** `components/forms/steps/ReviewConfirmStep.tsx:158`
**Issue:** `discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0` shows 0 before API responds.
**Fix:** Show a skeleton loader or "Calculating..." text when pricing data hasn't loaded yet.

### 24. Discount Codes Don't Work for Multi-Pet Bookings
**File:** `components/forms/PremiumUserBookingFlow.tsx:1813`
**Issue:** `if (totalSelectedServices > 1) return false` silently blocks discounts for bundles.
**Fix:** Either support discount codes for bundles or show an explicit message: "Discount codes cannot be applied to multi-pet bookings."

### 25. `no_show` and `completed` Are Terminal With No Recovery
**File:** `lib/bookings/state-transition-guard.ts`
**Issue:** Mistakes in marking `no_show` or `completed` require database intervention.
**Fix:**
- Allow `admin` role to transition `no_show → cancelled` and `completed → disputed`
- Or add an admin `overrideBookingStatus` function that bypasses the guard with audit logging

### 26. No `in_progress` Booking State
**File:** `lib/bookings/state-transition-guard.ts`
**Issue:** No way to indicate "service is currently being delivered" for multi-hour services.
**Fix:** Add `in_progress` state: `confirmed → in_progress → completed`. Migration: add value to enum, update guard, update UI.

### 27. Provider Cannot Reschedule Bookings
**Issue:** Only admin can change booking time via `overrideBooking`. Providers must cancel and ask the user to rebook.
**Fix:** Add provider-facing reschedule API that proposes a new time (requiring user confirmation).

### 28. No Provider Earnings Dashboard
**Issue:** `provider_payout_status` exists but no provider-facing summary of earnings, pending payouts, or history.
**Fix:** Add `/api/provider/earnings` endpoint and earnings tab in provider dashboard.

### 29. Today's Schedule Has No Realtime Updates
**File:** `app/dashboard/provider/today/page.tsx`
**Issue:** Server-rendered page with no realtime subscription. Stale data if user cancels while page is open.
**Fix:** Add `useProviderBookingRealtime` hook to the client component.

### 30. No Confirmation Dialog Before Booking Submission
**File:** `components/forms/steps/ReviewConfirmStep.tsx`
**Issue:** "Confirm & Schedule" button submits immediately with no confirmation for cash bookings.
**Fix:** Add confirmation modal for cash/pay-after-service bookings.

### 31. Draft Restoration Doesn't Validate Service Catalog
**File:** `components/forms/PremiumUserBookingFlow.tsx:1271-1402`
**Issue:** Restored draft could reference a service type that no longer exists.
**Fix:** Validate `selectedServiceType` against current catalog on draft restore. Clear if invalid.

### 32. No Max Boarding Duration
**Issue:** No upper bound on boarding end date. Could book 365+ days.
**Fix:** Add max boarding duration (e.g., 30 days) in validation.

### 33. Admin Booking Reassign Has No Slot Conflict Check
**File:** `app/api/admin/bookings/[id]/reassign/route.ts`
**Issue:** No proactive slot conflict check. Relies on DB trigger after the fact.
**Fix:** Check availability before reassigning. Return conflict error with available alternatives.

### 34. Orphan Bookings From Payment Verify/Webhook Race
**Files:** `app/api/payments/bookings/verify/route.ts`, `lib/payments/webhookHandler.ts`
**Issue:** Both can create a booking for the same payment. The loser's booking is never cleaned up.
**Fix:** Add a cleanup job that finds bookings without linked transactions (orphans) and cancels them. Or use `SELECT ... FOR UPDATE` on the transaction row before creating the booking.

### 35. `deleteProvider` Hard-Deletes Bookings
**File:** `lib/provider-management/service.ts:462-470`
**Issue:** Destroys booking history needed for user records and audits.
**Fix:** Soft-delete bookings (set `deleted_at`) or archive them before deleting the provider record.

---

## P3 — Low (Polish & Tech Debt)

### 36. Console.log Statements in Production
**Files:** `lib/hooks/useRealtime.ts:39,56,100,129,209,237`
**Fix:** Remove or gate behind `process.env.NODE_ENV === 'development'`.

### 37. Stale Step Indicators ("Step 1 of 4")
**Files:** `components/forms/steps/PetSelectionStep.tsx:30`, `ServiceSelectionStep.tsx:67`
**Fix:** Update to "Step 1 of 3" or remove if these are legacy unused components.

### 38. `createPortal` Imported But Unused
**File:** `components/forms/steps/DateTimeSlotStep.tsx:4`
**Fix:** Remove unused import.

### 39. Multi-Day Slot Queries Are Sequential
**File:** `lib/bookings/engines/slotEngine.ts:259-286`
**Fix:** Use `Promise.all()` to parallelize day queries. Add concurrency limit to avoid DB overload.

### 40. Addon Queries Are Sequential
**File:** `lib/bookings/engines/pricingEngine.ts:36-49`
**Fix:** Batch addon lookup with `.in('id', addonIds)` instead of individual queries.

### 41. Rate Limit Fallback Is Per-Process
**File:** `lib/api/rate-limit.ts`
**Fix:** Ensure Supabase RPC is always available, or use Redis for distributed rate limiting.

### 42. No Rate Limiting on Slot/Availability Endpoints
**Files:** `app/api/bookings/available-slots/route.ts`, `app/api/bookings/availability-calendar/route.ts`
**Fix:** Add rate limiting (e.g., 60 requests/min for slots, 10 requests/min for calendar).

### 43. Mixed Auth Patterns Across Routes
**Issue:** Some routes use `requireApiRole()`, others use `getApiAuthContext()` + manual checks.
**Fix:** Standardize on `requireApiRole()` across all protected endpoints.

### 44. `localAddresses` State Never Populated
**File:** `components/forms/steps/DateTimeSlotStep.tsx:127`
**Fix:** Remove the unused state or wire it up if it was intended for local-only addresses.

### 45. Min Date Uses UTC Instead of IST
**File:** `components/forms/steps/DateTimeSlotStep.tsx:629`
**Fix:** Use IST-aware date calculation: `new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'})`.

### 46. No Escape Key Handler for Address Modal
**File:** `components/forms/steps/DateTimeSlotStep.tsx`
**Fix:** Add `onKeyDown` handler for Escape key to close the modal.

### 47. Provider Notes Have No Client-Side Length Limit
**File:** `components/forms/steps/DateTimeSlotStep.tsx`
**Fix:** Add `maxLength={2000}` to the textarea.

### 48. No Pet Type/Species Field
**File:** `lib/pets/types.ts`
**Fix:** Add `pet_type: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other'` field to pet schema.

### 49. No Aggression/Bite History Warning to Provider
**Issue:** Pets with `is_bite_history: true` have no warning in provider booking view.
**Fix:** Show a prominent warning badge on booking cards for aggressive/bite-history pets.

### 50. Booking 7-Day History Limit for Providers
**File:** `components/dashboard/ProviderDashboardClient.tsx:316`
**Fix:** Add date range filters and pagination to provider booking list.

### 51. No Idempotency on Cash Collection
**File:** `app/api/provider/bookings/[id]/collect/route.ts`
**Fix:** Check if payment already exists for this booking before creating a new record.

### 52. Webhook Replay Protection Bypassed Without Timestamp
**File:** `lib/payments/webhookHandler.ts:62-65`
**Fix:** Reject webhook events that do not include `created_at` timestamp.

---

## Recommended Fix Order

### Sprint 1 — Safety & Data Integrity (Week 1-2)
1. Fix double-booking race condition (#1) — use `create_booking_v2` RPC
2. Fix timezone bug (#2) — IST offset in booking time construction
3. Make wallet credit operations transactional (#4)
4. Remove `finalPrice` from `CreateBookingInput` (#5)
5. Fix bulk status missing side effects (#14)
6. Fix first-booking discount counting cancelled (#19)

### Sprint 2 — Financial Safety (Week 2-3)
7. Auto-refund on provider cancellation (#6)
8. Atomic discount usage limits (#9)
9. Atomic reschedule flow (#10)
10. Retry mechanism for failed financial hooks (#15)
11. Fix orphan booking cleanup (#34)
12. Cancellation window/policy (#20)

### Sprint 3 — Operational Must-Haves (Week 3-4)
13. Email/SMS notification infrastructure (#7)
14. Pending booking auto-expiry (#11)
15. Availability cascade warnings (#12)
16. Suspended provider booking cascade (#13)
17. Provider cancellation requires reason (#16)
18. Slot re-check at booking creation (#8)

### Sprint 4 — UX Improvements (Week 4-5)
19. Mobile map fix (#17)
20. Past date validation (#18)
21. Pricing loading state (#23)
22. Bundle booking rollback (#3)
23. Discount code messaging for bundles (#24)
24. Confirmation dialog (#30)
25. Teleconsult meeting link (#21)
26. Clinic address display (#22)

### Sprint 5 — Polish & Tech Debt (Week 5-6)
27-52. Remaining P3 items, sequential slot optimization, auth standardization, console.log cleanup, etc.

---

## Testing Recommendations

After fixes, add these test categories:

1. **Concurrency tests**: Simulate 10 users booking the same slot simultaneously
2. **Financial integrity tests**: Verify credits deducted = credits in booking record, no double-restore
3. **Timezone tests**: Verify bookings at 23:00 IST, 00:00 IST, and 00:30 IST boundaries
4. **State machine tests**: Verify all transitions with all roles, including edge cases
5. **Payment sync tests**: Simulate webhook before/after verify, verify after timeout
6. **Bundle tests**: Multi-pet booking with partial failures
7. **Cancellation tests**: Cancel at various times relative to booking start, verify refund/credit behavior
