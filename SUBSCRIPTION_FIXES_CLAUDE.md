# Dofurs Platform: Subscription & Credit System Gaps - Execution Plan

Hello Claude! Please read this document carefully and implement the fixes for the critical production gaps identified in our subscription and credit system. 

## Context & Analysis
The Dofurs platform implements a token-based subscription system. Users purchase plans via Razorpay, which grants them "service credits" (e.g., Grooming = 2 credits). Credits are reserved during booking and consumed upon completion.

While the core credit transaction logic is solid, there are **5 critical gaps** missing before moving to production:

1. **NO Admin UI to Manage Subscription Plans:** Admins currently cannot create, edit, or rollout credit packages.
2. **Lack of Auto-Expiry Status Updates:** Subscriptions expire based on their `ends_at` timestamp in queries, but their database `status` remains `'active'` forever.
3. **Missing Webhook Events for Refunds:** `webhookHandler.ts` ignores everything except `payment.captured`. Refunds don't revoke credits.
4. **Overlapping Subscriptions (Race Condition):** If a user buys two plans at once, the system only grabs `.limit(1)` plan based on the latest date, locking the other credits out.
5. **Invoice Generation Fails Silently:** If `createSubscriptionInvoice` errors out in the webhook, the webhook crashes *after* subscription activation, potentially causing retry mismatches.

---

## Your Implementation Plan

Please tackle these phase by phase. Make sure you run relevant linting and testing steps between phases.

### Phase 1: Admin UI for Subscription Plans
**Goal:** Give Admins a dashboard to manage plans.
1. Create new API routes: 
   - `POST /api/admin/subscriptions/plans` (Create a plan & its services)
   - `PATCH /api/admin/subscriptions/plans/[id]` (Update plan or toggle `is_active`)
   *Ensure you enforce `requireApiRole(['admin'])` on these.*
2. Build an Admin component: `components/dashboard/admin/AdminSubscriptionPlansClient.tsx`
   - Fetch all plans (active and inactive) from `subscription_plans`.
   - Provide a UI to **Create a New Plan**, specifying `name`, `code`, `price_inr`, `duration_days`, and add `subscription_plan_services` (e.g., select service type and assign credit count).
   - Provide a toggle to archive/activate existing plans.
3. Integrate this into `components/dashboard/AdminDashboardClient.tsx`, perhaps as a new tab named "Billing Catalog".

### Phase 2: Overlapping Subscriptions Logic fix
**Goal:** Allow users to have multiple active plans gracefully.
1. Modify `lib/subscriptions/creditTracking.ts` (`reserveCreditForBooking`):
   - Instead of `.limit(1)`, fetch all `.eq('status', 'active')` subscriptions for that user.
   - Iterate through them and find the first active plan that has `available_credits > 0` for the requested `service_type`.
   - Use that specific `subscription.id` for the `booking_subscription_credit_links`.
2. Ensure UI components (`CreditBalanceWidget.tsx`) sum up `available_credits` properly across multiple active plans if a user has them.

### Phase 3: Webhook Expansion (Refunds)
**Goal:** Revoke credits if a plan is refunded via Razorpay.
1. Update `lib/payments/webhookHandler.ts`:
   - Add handling for `payment.refunded` or `refund.created`.
   - Look up the associated `payment_transactions` -> `user_subscriptions`.
   - If a refund happens, `UPDATE user_subscriptions SET status = 'cancelled'`.
   - Iterate through the associated `user_service_credits` and set `available_credits = 0` (preventing future usage). Create a warning log/event if they already consumed credits prior to the refund.

### Phase 4: Auto-Expiry Sweep
**Goal:** Ensure the absolute `'active'` status flips to `'expired'`.
1. Since we do not easily run cron jobs, implement a "lazy evaluation sweep".
2. In `app/api/subscriptions/me/route.ts` (or wherever user subscriptions are fetched):
   - Add a lightweight Supabase RPC or direct backend query `UPDATE user_subscriptions SET status = 'expired' WHERE user_id = $userId AND status = 'active' AND ends_at < NOW();`.
   - This ensures whenever a user visits the app, any freshly expired plans are definitively updated, keeping admin analytics clean.

### Phase 5: Invoice Generation Fail-safe
**Goal:** Keep Webhooks robust.
1. In `webhookHandler.ts` at the end where `createSubscriptionInvoice` is called, wrap it in a `try...catch` block.
2. If it catches an error, `console.error` it or use the platform's logging mechanism, but **do not throw**. Let the webhook return `{ accepted: true }` so Razorpay knows the core transaction was successful.

---

### Executing This Plan:
You are good to start executing. Please output a summary in your terminal as you finish each phase. Do not hesitate to use grep/search or list directory tools to orient yourself in the codebase. You can run `npm run lint` periodically to maintain code health.
