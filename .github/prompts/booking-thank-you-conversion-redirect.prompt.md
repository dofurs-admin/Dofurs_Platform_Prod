---
description: "Analyze, plan, and implement a constant booking thank-you conversion redirect page before the dynamic booking confirmation page."
agent: "agent"
---

# Booking Thank-You Conversion Redirect

<!-- <goal> -->
You WILL analyze, plan, and implement a constant customer booking thank-you page that appears after a successful new booking and before the existing dynamic confirmation page.

The constant page URL MUST be `/forms/customer-booking/thank-you`. It MUST NOT include the booking id in the path. It SHOULD avoid query parameters for the normal success flow so marketing tools can count conversions from one stable URL.

After a short, bounded thank-you experience, the page MUST redirect the customer to `/forms/customer-booking/confirmation/[bookingId]`.
<!-- </goal> -->

<!-- <context> -->
## Current Codebase Context

You MUST inspect these files before editing:
- [graphify report](../../graphify-out/GRAPH_REPORT.md)
- [customer booking page](../../app/forms/customer-booking/page.tsx)
- [premium booking flow](../../components/forms/PremiumUserBookingFlow.tsx)
- [booking confirmation page](../../app/forms/customer-booking/confirmation/[bookingId]/page.tsx)
- [booking confirmation tracker](../../app/forms/customer-booking/confirmation/[bookingId]/BookingConfirmationTracker.tsx)
- [booking conversion API](../../app/api/bookings/[id]/conversion/route.ts)
- [Google Ads analytics helper](../../lib/analytics/google-ads.ts)
- [Meta Ads analytics helper](../../lib/analytics/meta-ads.ts)

Important existing behavior:
- `PremiumUserBookingFlow` currently centralizes success navigation in `navigateToBookingConfirmation` and appends `?conversion=booking` for non-reschedule bookings.
- `BookingConfirmationPage` only renders `BookingConfirmationTracker` providers when `conversion=booking` is present and `data.conversion.eligible` is true.
- `BookingConfirmationTracker` claims and acknowledges conversion events through `/api/bookings/[id]/conversion`, which is already idempotent per booking/provider/label.
- Reschedules MUST NOT be counted as new booking conversions.
<!-- </context> -->

<!-- <research-standards> -->
## Research Standards To Apply

You MUST apply these implementation standards:
- Next.js App Router redirects: use `router.replace` from client event/effect flows; use `redirect()` only while rendering Server Components, Route Handlers, or Server Actions.
- Google Ads URL-based conversions: a conversion can be triggered when a user lands on a specific page URL; a stable thank-you URL is appropriate for codeless page-load conversion counting.
- Google/Meta coded conversion events: keep transaction identifiers and the existing idempotent claim/ack API so refreshes, retries, or final confirmation redirects do not create duplicate coded conversion events.
<!-- </research-standards> -->

<!-- <required-plan> -->
## Required Plan Before Editing

Before editing, you MUST provide a concise implementation plan that answers:
1. Where the booking id will be stored between successful booking creation and the constant thank-you URL.
2. How the thank-you page will avoid exposing the booking id in its URL while still redirecting to the correct confirmation page.
3. Where conversion tracking will fire so the dynamic confirmation page does not double count normal success-flow bookings.
4. How reschedules, missing booking ids, direct visits to the thank-you URL, and payment verification retries will behave.
<!-- </required-plan> -->

<!-- <implementation-requirements> -->
## Implementation Requirements

You MUST implement the smallest cohesive change that satisfies the goal:

1. Update booking success navigation in [PremiumUserBookingFlow](../../components/forms/PremiumUserBookingFlow.tsx).
   - For successful new bookings, persist the confirmed `bookingId` in `window.sessionStorage` under a namespaced key such as `dofurs.booking.thankYou.bookingId`.
   - Store a timestamp and optional return target if useful for stale-session handling.
   - Navigate with `router.replace('/forms/customer-booking/thank-you')`.
   - For reschedule mode, keep direct navigation to `/forms/customer-booking/confirmation/[bookingId]` and do not count it as a conversion.

2. Add a constant thank-you route at `app/forms/customer-booking/thank-you/page.tsx`.
   - Set `dynamic = 'force-dynamic'` if needed for auth/config behavior.
   - Set metadata title such as `Thank You for Booking` and `robots: { index: false, follow: false }`.
   - Require authentication using the existing auth helper and use a stable `next` value for sign-in.
   - Render a polished Dofurs-branded thank-you experience using existing `Navbar`, `Footer`, `BrandMark`, `premiumPrimaryCtaClass`, `premiumSecondaryCtaClass`, and lucide icons where appropriate.
   - Keep the page visually aligned with the existing warm premium booking confirmation design.
   - Include concise copy such as: `Thank you for booking`, `Your Dofurs visit is locked in`, and `Opening your booking details...`.

3. Add a client redirect/tracking controller for the thank-you page.
   - Read the pending booking id from `sessionStorage` after mount.
   - Validate that it is a positive integer.
   - Trigger the existing booking conversion claim/ack flow on this constant page for eligible providers.
   - Refactor `BookingConfirmationTracker` only as much as needed to support a configurable `source` and an optional completion callback, or create a small shared tracker if that is cleaner.
   - Wait a bounded amount of time before redirecting, long enough for page-load conversion tags and coded conversion requests to start. Prefer redirecting after tracker completion or after a timeout fallback.
   - Redirect with `router.replace('/forms/customer-booking/confirmation/[bookingId]')` without `?conversion=booking` for the normal new booking flow.
   - Remove or expire the session storage values after the redirect decision.
   - If no valid booking id exists, show a friendly fallback and link to `/dashboard/user?view=bookings` instead of spinning forever.

4. Preserve existing confirmation behavior.
   - The dynamic confirmation page MUST still load and authorize bookings exactly as before.
   - It MAY keep legacy `?conversion=booking` support for direct or old links, but normal new booking success flow MUST no longer need that query parameter.
   - Avoid duplicate Google/Meta coded conversion firing for the same booking.

5. Preserve payment and retry flows.
   - All successful booking branches, including cash, subscription credit, online payment verification, bundled booking, and verification retry, MUST reach the same navigation helper.
   - Failed payment and failed verification states MUST remain on the booking form and MUST NOT visit the thank-you URL.

6. Keep implementation style local and idiomatic.
   - Use TypeScript strict-friendly code.
   - Use Tailwind classes; do not add CSS-in-JS or inline styles.
   - Use existing UI helpers and local patterns before adding new abstractions.
   - Do not edit Supabase migrations for this task unless a verified schema gap requires it.
<!-- </implementation-requirements> -->

<!-- <verification> -->
## Verification Requirements

You MUST verify the change before finishing:
- Run `npm run lint`.
- Run focused Vitest tests if you add or modify testable helpers; otherwise state why no targeted unit test was added.
- Manually verify the URL flow in the browser or with Playwright where feasible:
  1. Successful new booking redirects to `/forms/customer-booking/thank-you`.
  2. The thank-you page shows branded copy and does not include a booking id in the URL.
  3. It redirects to `/forms/customer-booking/confirmation/[bookingId]` without `?conversion=booking`.
  4. Directly visiting `/forms/customer-booking/thank-you` without session state shows the fallback.
  5. Reschedule success goes directly to the confirmation page and does not visit the thank-you URL.
- After modifying code files, run `npx graphify hook-rebuild`.
<!-- </verification> -->

<!-- <success-criteria> -->
## Success Criteria

The task is complete only when:
- The conversion-counting URL is consistently `/forms/customer-booking/thank-you`.
- New successful bookings pass through that page exactly once in the normal flow.
- The customer still lands on the correct booking confirmation page.
- Existing idempotent Google Ads and Meta conversion logic remains protected from duplicate normal-flow firing.
- Reschedules and failed bookings are not counted as new booking conversions.
- Lint and relevant verification steps pass or any blocker is clearly documented.
<!-- </success-criteria> -->