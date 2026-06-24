# Dofurs Mobile Apps - Refined Build Prompt

Use this document to build the Dofurs mobile apps against the current production webapp backend.

Aligned with the current Dofurs webapp implementation on 2026-06-24.

## Goal

Build two mobile apps:

1. Dofurs Customer App: for pet parents to sign up, manage pets, save addresses, book doorstep grooming, pay, use subscriptions/credits, refer friends, review bookings, and receive updates.
2. Dofurs Provider App: for approved Dofurs providers, initially groomers, to manage assigned bookings, availability, blocked dates, direct payment collection, reviews, documents, and profile details.

Do not create a new backend. Use the existing Dofurs Next.js + Supabase backend.

## Current Backend Truths

- Webapp: Next.js 15 App Router, TypeScript strict, Supabase Auth/PostgreSQL/Storage/RLS, Razorpay.
- Auth: Supabase email OTP. Password login is not the current product flow.
- Roles: `user`, `provider`, `admin`, `staff`.
- Customer role in code is `user`, not `customer`.
- Groomer role in code is `provider`, not `groomer`. Use "groomer" only in UI copy.
- Provider precedence is intentional: if a user has a linked row in `providers`, resolve them as `provider`.
- Main user table: `users`.
- Owner profile table: `profiles`.
- Provider table: `providers`.
- Booking catalog table: `provider_services`, not the legacy `services` table.
- Add-ons table: `service_addons`.
- Payments table: `payment_transactions`, not `payments`.
- Subscription tables: `subscription_plans`, `user_subscriptions`, `user_service_credits`, not `subscriptions`.
- Referral tables: `referral_codes`, `referral_redemptions`, `user_credit_balance`, `credit_wallet_transactions`.
- Notifications: `notifications`, `messages`.
- Bookings must be created through existing API routes. Do not insert into `bookings` directly from mobile.
- Payments, subscriptions, invoices, discounts, credits, referral rewards, booking status transitions, and booking creation are server-owned workflows.

## Required Backend Readiness First

Before building mobile screens that call protected APIs, update/verify the existing webapp backend for native app auth.

Required:

- Protected Next.js API routes must accept `Authorization: Bearer <supabase_access_token>`.
- Existing cookie-based web auth must continue working.
- Middleware must allow protected `/api/*` requests with valid bearer auth.
- Shared API auth must resolve user and role from either cookies or bearer token.
- Role resolution must keep provider precedence.
- Storage signed upload/read routes must work from native apps with bearer auth.
- Payment order and payment verify routes must work from native apps with bearer auth.

Current limitations to respect:

- Provider `in_progress` status is defined, but the provider status route does not currently handle it distinctly. Hide "Start Service" until backend is patched and tested.
- Customer reschedule does not have a confirmed route in the current API list. Hide reschedule until backend support exists.
- Subscription pause/cancel/resume routes are not currently present. V1 supports list plans, purchase, verify, and show active subscriptions only.
- True auto-assign is not currently supported by the booking create payload. V1 must select a concrete `providerId` and `providerServiceId`.
- Push notifications need backend device token storage and sender support. V1 uses in-app notifications/messages.
- Provider earnings need a backend endpoint for accurate payout reporting. V1 can show completed booking totals/payment collection state only if returned by APIs.

## Non-Negotiables

- Do not expose service role key, Razorpay secret, webhook secret, DB URL, or billing secret in mobile code.
- Do not create a separate backend or duplicate the service layer.
- Do not invent `customers`, `groomers`, `groomer_availability`, `groomer_services`, `payments`, `subscriptions`, or `reviews` tables.
- Do not write directly to server-owned tables from mobile.
- Do not trust mobile-computed price totals. Treat mobile totals as previews only.
- Do not ship unsupported UI actions behind fake success states.
- Keep mobile code in the in-repo workspace at `dofurs-mobile/` and coordinate backend changes in the same repository.

## Recommended Mobile Stack

| Layer | Choice |
|---|---|
| Framework | Expo React Native, latest stable SDK supported by EAS |
| Language | TypeScript strict |
| Routing | Expo Router |
| Server state | TanStack Query |
| Local state | Zustand for auth-adjacent UI, booking draft, theme only |
| Auth client | `@supabase/supabase-js` with `expo-secure-store` |
| API client | Typed `fetch` wrapper to existing webapp API base URL |
| Payments | Razorpay React Native SDK, EAS build required |
| Maps | `react-native-maps` + Google Places autocomplete |
| Images | `expo-image`, signed upload URL flow |
| Forms | React Hook Form + Zod |
| Icons | `lucide-react-native` |
| Animation | Reanimated, Gesture Handler, Bottom Sheet, selected Lottie moments |
| Testing | Shared unit tests, screen tests, Maestro/Detox for critical flows |

## Repository Structure

Use an in-repo workspace named `dofurs-mobile`.
Manage dependencies from the repository root so web and mobile share a single npm lockfile.

```text
dofurs-mobile/
  apps/
    customer/
      app/
      assets/
      app.json
      package.json
    provider/
      app/
      assets/
      app.json
      package.json
  packages/
    shared/
      src/
        api/
        auth/
        components/
        constants/
        hooks/
        lib/
        store/
        types/
        utils/
  package.json
  turbo.json
  tsconfig.base.json
```

Use generated Supabase types from the webapp root:

```text
../lib/supabase/database.types.ts
```

## Environment Variables

Both apps need:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=https://dofurs.in
EXPO_PUBLIC_RAZORPAY_KEY_ID=
EXPO_PUBLIC_GOOGLE_MAPS_KEY=
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
BILLING_AUTOMATION_SECRET
```

## Design Direction

Match the current Dofurs brand and keep the app premium, calm, and practical.

Core colors:

```text
Coral: #e39a5d
Ink: #1f1f1f
Warm surfaces: #fdf8f4, #fff8f0, #f6efe9, #f8f5f2
Success: #22c55e
Warning: #f59e0b
Error: #ef4444
Info: #3b82f6
```

Typography:

- Prefer Plus Jakarta Sans to match the webapp.
- Use Outfit only if a mobile-specific brand direction is approved.
- Keep one font family across both apps.

Shared components:

- Button, IconButton, Card, Input, Select, Badge, Avatar, EmptyState, Skeleton, BottomSheet, Screen, Header, Stepper, PriceBreakdown, BookingStatusBadge.

UX rules:

- Use bottom sheets for confirmations, pickers, filters, payment choice, and status actions.
- Use haptics on primary success, destructive confirmation, and payment/booking completion.
- Use skeleton states for networked lists and cards.
- Use real pet/provider/service images when available.
- Build dark mode only if complete enough for both apps; otherwise ship a light v1 with tokenized colors.

## Auth Flow

### Customer Signup

1. Collect `name`, `email`, Indian E.164 `phone`, optional `referralCode`.
2. POST `/api/auth/pre-signup`.
3. Call Supabase `signInWithOtp` for email OTP.
4. Verify OTP in the app or through configured deep link callback.
5. POST `/api/auth/complete-profile` with signup fields.
6. POST `/api/auth/bootstrap-profile`.
7. Resolve role. Route `user` to Customer App. Route `provider` to Provider App.

### Customer Login

1. Collect email.
2. Send Supabase email OTP.
3. Verify OTP.
4. POST `/api/auth/bootstrap-profile`.
5. Resolve role and route.

### Provider Login

Use the same email OTP flow.

After login:

1. Resolve user from Supabase session.
2. Resolve role with provider precedence.
3. If no linked provider row exists, show provider application.
4. If provider is pending/rejected/suspended/banned, show the correct state.
5. If approved/active, enter Provider App.

Do not implement password login unless the production auth policy changes.

## Shared API Client

Every protected API request must:

- Attach `Authorization: Bearer <supabase_access_token>`.
- Attach `Content-Type: application/json` for JSON requests.
- Attach `x-client-platform: ios` or `android`.
- Attach `x-app-version`.
- Attach `x-idempotency-key` for payment order/create-style mutation routes.
- On 401, refresh session once and retry once.
- On 403, show access denied/suspended/role mismatch state.
- On 409, show conflict/reload state.
- On 429, show cooldown and do not spam retry.

## Existing API Routes To Use

### Auth/Profile

| Method | Endpoint | Use |
|---|---|---|
| POST | `/api/auth/pre-signup` | Validate signup details before OTP |
| POST | `/api/auth/complete-profile` | Create/update profile after auth |
| POST | `/api/auth/bootstrap-profile` | Ensure `users` and `profiles` rows exist |
| POST | `/api/auth/logout` | Optional server logout helper |
| GET | `/api/user/profile` | Load base user profile |
| PATCH | `/api/user/profile` | Update base user profile |
| GET | `/api/user/owner-profile` | Load owner profile |
| PATCH | `/api/user/owner-profile` | Update owner profile |

### Pets/Addresses

| Method | Endpoint | Use |
|---|---|---|
| GET | `/api/user/pets` | List pets |
| POST | `/api/user/pets` | Create pet |
| PATCH | `/api/user/pets/[id]` | Update pet |
| DELETE | `/api/user/pets/[id]` | Delete pet |
| GET | `/api/user/pets/[id]/passport` | Load passport details |
| PATCH | `/api/user/pets/[id]/passport` | Update passport details |
| GET | `/api/user/pets/upcoming-vaccinations` | Upcoming vaccination reminders |
| GET | `/api/user/pets/reminder-preferences` | Load reminder preferences |
| PUT | `/api/user/pets/reminder-preferences` | Save reminder preferences |
| GET | `/api/user/owner-profile/addresses` | List addresses |
| POST | `/api/user/owner-profile/addresses` | Create address |
| PATCH | `/api/user/owner-profile/addresses/[id]` | Update address |
| DELETE | `/api/user/owner-profile/addresses/[id]` | Delete address |

### Booking/Payment

| Method | Endpoint | Use |
|---|---|---|
| GET | `/api/bookings/catalog` | Providers, provider services, pets, addresses, discounts |
| GET | `/api/bookings/available-slots?providerId=&date=&providerServiceId=` | Available slots |
| POST | `/api/services/calculate-price` | Base/add-on price preview |
| POST | `/api/bookings/discount-preview` | Coupon preview |
| POST | `/api/payments/bookings/order` | Create Razorpay order for prepaid booking |
| POST | `/api/payments/bookings/verify` | Verify payment and create booking |
| POST | `/api/bookings/create` | Create non-prepaid or subscription-credit booking |
| GET | `/api/user/bookings` | Customer booking list |
| PATCH | `/api/bookings/[id]/status` | Customer cancel and supported role transitions |
| GET | `/api/user/bookings/[id]/review` | Load review state |
| POST | `/api/user/bookings/[id]/review` | Submit review |
| GET | `/api/credits/eligibility` | Credit eligibility |
| GET | `/api/user/credit-wallet` | Credit wallet balance |

### Provider

| Method | Endpoint | Use |
|---|---|---|
| POST | `/api/provider-applications` | Submit provider application |
| GET | `/api/provider/dashboard` | Provider dashboard bundle |
| GET | `/api/provider/bookings?status=&fromDate=&toDate=&limit=` | Provider bookings |
| PATCH | `/api/provider/bookings/[id]/status` | Confirm, complete, no-show, cancel |
| POST | `/api/provider/bookings/[id]/collect` | Mark direct payment collected |
| GET | `/api/provider/availability` | Load availability |
| PUT | `/api/provider/availability` | Save availability |
| GET | `/api/provider/blocked-dates` | List blocked dates |
| POST | `/api/provider/blocked-dates` | Create blocked date/time window |
| DELETE | `/api/provider/blocked-dates/[id]` | Delete blocked date/time window |
| GET | `/api/provider/documents` | List documents |
| POST | `/api/provider/documents` | Add document |
| PATCH | `/api/provider/details` | Update provider details |
| PATCH | `/api/provider/profile` | Update provider profile |
| GET | `/api/provider/reviews` | List reviews |
| PATCH | `/api/provider/reviews/[id]/respond` | Respond to review |

### Subscriptions/Referrals/Notifications

| Method | Endpoint | Use |
|---|---|---|
| GET | `/api/subscriptions/plans` | Active subscription plans |
| GET | `/api/subscriptions/me` | Current subscriptions and credits |
| POST | `/api/payments/subscriptions/order` | Create Razorpay subscription order |
| POST | `/api/payments/subscriptions/verify` | Verify and activate subscription |
| GET | `/api/referrals/my-code` | Referral code, share URL, stats, credits |
| POST | `/api/referrals/validate` | Validate referral code |
| GET | `/api/notifications?limit=&offset=&unreadOnly=` | Notification feed |
| POST | `/api/notifications` | Mark all read with `{ "action": "mark_all_read" }` |
| PATCH | `/api/notifications/[id]` | Mark notification read |
| GET | `/api/messages?limit=&offset=` | Message list |
| PATCH | `/api/messages/[id]` | Mark message read |

### Storage/Billing/Area

| Method | Endpoint | Use |
|---|---|---|
| POST | `/api/storage/signed-upload-url` | Upload user/pet/provider images |
| POST | `/api/storage/signed-read-url` | Read private images |
| GET | `/api/pincode/[pincode]` | Pincode/service area validation |
| GET | `/api/billing/me` | Billing overview |
| GET | `/api/billing/me/invoices/[id]` | Invoice detail |
| GET | `/api/billing/me/invoices/[id]/pdf` | Invoice PDF |

## Booking Payload Contract

Use this payload for booking create/order requests:

```json
{
  "bookingType": "service",
  "petId": 123,
  "providerId": 456,
  "providerServiceId": "uuid",
  "bookingDate": "2026-07-15",
  "startTime": "10:00",
  "endTime": "11:00",
  "bookingMode": "home_visit",
  "locationAddress": "Full address",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "providerNotes": "Optional notes",
  "discountCode": "OPTIONAL",
  "addOns": [{ "id": "uuid", "quantity": 1 }],
  "bundleProviderServiceIds": ["uuid"],
  "useSubscriptionCredit": false,
  "walletCreditsAppliedInr": 0,
  "paymentMode": "platform",
  "pincode": "560001"
}
```

Rules:

- `home_visit` requires `locationAddress`, `latitude`, and `longitude`.
- `providerId` and `providerServiceId` must come from `/api/bookings/catalog`.
- `providerServiceId` must match the selected provider.
- `endTime` should come from service duration or slot response.
- Use `paymentMode: platform` for prepaid Razorpay checkout.
- Use `paymentMode: direct_to_provider` only when product approves pay-after-service.
- Use `useSubscriptionCredit: true` only after checking subscription/credit eligibility.

## Customer Booking Flow

1. Load `/api/bookings/catalog`.
2. Group services from returned `services` by `service_type` and provider.
3. Let user select a concrete service/provider combination.
4. Select pet from catalog or create pet.
5. Select saved address or create address with Google Places.
6. Validate pincode if needed.
7. Select date and time through `/api/bookings/available-slots`.
8. Add optional add-ons if available for selected provider service.
9. Preview price through `/api/services/calculate-price`.
10. Preview coupon through `/api/bookings/discount-preview`.
11. For prepaid booking, call `/api/payments/bookings/order`, open Razorpay, then call `/api/payments/bookings/verify`.
12. For subscription-credit or direct-provider booking, call `/api/bookings/create`.
13. Show confirmation only after server success.
14. Refresh bookings, credits, subscriptions, and notifications.

## Customer App Routes

```text
app/
  (auth)/
    onboarding.tsx
    sign-in.tsx
    sign-up.tsx
    verify-otp.tsx
    complete-profile.tsx
  (tabs)/
    home.tsx
    bookings.tsx
    services.tsx
    pets.tsx
    profile.tsx
    _layout.tsx
  booking/
    new/service.tsx
    new/pet.tsx
    new/address.tsx
    new/datetime.tsx
    new/addons.tsx
    new/summary.tsx
    new/payment.tsx
    confirmation.tsx
    [id]/index.tsx
    [id]/cancel.tsx
    [id]/review.tsx
    [id]/invoice.tsx
  pets/
    add.tsx
    [id]/index.tsx
    [id]/edit.tsx
    [id]/passport.tsx
  subscription/
    index.tsx
    plans.tsx
  referral/
    index.tsx
  notifications/
    index.tsx
  messages/
    index.tsx
  profile/
    edit.tsx
    addresses.tsx
    payment-history.tsx
    settings.tsx
    help.tsx
```

Customer MVP screens:

- Email OTP auth and profile completion.
- Home with next booking, quick actions, subscription/credits, referral CTA, notifications.
- Pet list/detail/create/edit/passport/photo upload.
- Address list/create/edit/delete with map preview.
- Service catalog from `/api/bookings/catalog`.
- Booking wizard for doorstep grooming.
- Razorpay prepaid payment.
- Booking list/detail/cancel/review/invoice.
- Subscription plans, purchase, and current subscription state.
- Referral code/share/stats/credits.
- Notifications and messages.
- Profile/settings/help.

Hide from v1 unless backend is added:

- Reschedule.
- Subscription pause/cancel/resume.
- Live provider tracking.
- True auto-assign.

## Provider App Routes

```text
app/
  (auth)/
    sign-in.tsx
    verify-otp.tsx
    apply.tsx
    application-status.tsx
  (tabs)/
    home.tsx
    bookings.tsx
    schedule.tsx
    reviews.tsx
    profile.tsx
    _layout.tsx
  bookings/
    [id]/index.tsx
    [id]/complete.tsx
    [id]/collect.tsx
    [id]/cancel.tsx
  schedule/
    weekly.tsx
    block-date.tsx
  profile/
    edit.tsx
    documents.tsx
    services.tsx
    settings.tsx
  notifications/
    index.tsx
  messages/
    index.tsx
```

Provider MVP screens:

- Email OTP login.
- Provider application through `/api/provider-applications`.
- Pending/rejected/suspended states.
- Dashboard from `/api/provider/dashboard`.
- Booking list from `/api/provider/bookings`.
- Booking detail with customer, pet, service, address, status, payment mode, completion requirements.
- Confirm, complete, no-show, cancel.
- Collect payment through `/api/provider/bookings/[id]/collect` before completion when outstanding amount exists.
- Weekly availability editor.
- Blocked dates/time windows.
- Reviews and responses.
- Profile and documents.

Hide from v1 unless backend is patched:

- Start Service / In Progress.
- Full earnings dashboard.
- Provider service/pricing writes unless product approves mobile edits.

## Provider Application Payload

Use `POST /api/provider-applications` with:

```json
{
  "partner_category": "individual",
  "business_name": "",
  "team_size": null,
  "full_name": "Provider Name",
  "email": "provider@example.com",
  "phone_number": "+919999999999",
  "city": "Bengaluru",
  "state": "Karnataka",
  "provider_type": "groomer",
  "years_of_experience": 3,
  "service_modes": ["home_visit"],
  "service_areas": "Indiranagar, HSR Layout, Koramangala",
  "portfolio_url": "",
  "motivation": "",
  "website": ""
}
```

Keep `website` hidden as honeypot if included.

## Booking Status Rules

Statuses:

```text
pending
confirmed
in_progress
completed
cancelled
no_show
```

Allowed transitions:

```text
pending -> confirmed, cancelled
confirmed -> in_progress, completed, cancelled, no_show
in_progress -> completed, cancelled
no_show -> cancelled
```

Mobile-safe v1 behavior:

- Customer can cancel own booking.
- Provider can confirm, complete, mark no-show, cancel.
- Provider completion may fail if payable amount is outstanding. In that case show collect payment first.
- Hide `in_progress` until backend handling is fixed.

## Payment Rules

Prepaid booking:

1. Build booking payload.
2. POST `/api/payments/bookings/order` with idempotency key.
3. Open Razorpay checkout.
4. POST `/api/payments/bookings/verify` with `providerOrderId`, `providerPaymentId`, `providerSignature`.
5. Treat verify success as booking creation success.

Subscription purchase:

1. GET `/api/subscriptions/plans`.
2. POST `/api/payments/subscriptions/order` with `planId` and idempotency key.
3. Open Razorpay checkout.
4. POST `/api/payments/subscriptions/verify`.
5. Refresh `/api/subscriptions/me`.

Direct provider payment:

- Customer creates booking only if product allows `direct_to_provider`.
- Provider marks collection through `/api/provider/bookings/[id]/collect`.
- Provider must collect before completing if backend reports outstanding amount.

Payment recovery:

- If Razorpay succeeds but verify fails, store payment identifiers locally and show recovery UI.
- Allow retry verify.
- Do not create a second payment order unless user explicitly restarts checkout.

## Storage and Images

Use signed uploads.

Allowed mobile buckets:

```text
user-photos
pet-photos
service-images only where provider/admin flow permits
```

Upload flow:

1. Compress image on device.
2. POST `/api/storage/signed-upload-url` with `bucket`, `fileName`, `contentType`, `fileSizeMB`.
3. Upload to returned signed URL/token.
4. Save returned path through relevant profile/pet/provider API.

Do not store base64 image blobs in database rows.

## Notifications

V1:

- Use in-app `notifications` and `messages` APIs.
- Refresh on app open, foreground, pull-to-refresh, and after booking/payment/status actions.
- Mark read via existing APIs.

Phase 2 push:

- Add approved device token table/API in webapp.
- Register Expo/FCM/APNs tokens.
- Revoke tokens on logout.
- Send push from backend notification service.

## Offline and Reliability

- Cache GET data with TanStack Query.
- Allow read-only cached home/bookings/pets/profile when offline.
- Disable booking creation, payment verification, status changes, payment collection, and profile writes when offline.
- Persist booking draft until success or discard.
- Use idempotency keys for payment order creation.
- Handle 401, 403, 409, 429, and 5xx explicitly.
- Never retry payment verification in an infinite loop.

## Build Phases

### Phase 0 - Backend Mobile Compatibility

- Bearer auth for protected API routes.
- Mobile OTP deep links.
- Confirm storage signed uploads from native.
- Confirm Razorpay order/verify from native.
- Decide/patch `in_progress`, reschedule, push, subscription management, provider earnings.

### Phase 1 - Shared Foundation

- Monorepo setup.
- Strict TypeScript.
- Shared UI system.
- Supabase SecureStore auth.
- Typed API client with bearer auth.
- TanStack Query setup.
- Role routing.
- Error/toast/loading/empty states.

### Phase 2 - Customer MVP

- Auth/profile.
- Home.
- Pets.
- Addresses.
- Catalog.
- Booking wizard.
- Razorpay booking payment.
- Booking history/detail/cancel/review/invoice.
- Subscription plans/status/purchase.
- Referral screen.
- Notifications/messages.

### Phase 3 - Provider MVP

- Auth/application/status.
- Dashboard.
- Bookings/detail/actions.
- Collect payment.
- Availability.
- Blocked dates.
- Reviews.
- Profile/documents.

### Phase 4 - Polish and Release

- Haptics.
- Skeletons.
- Empty states.
- Accessibility labels.
- Payment recovery tests.
- Booking conflict tests.
- EAS build config.
- Store assets and privacy labels.

### Phase 5 - Later Enhancements

- Push notifications.
- Reschedule.
- Auto-assign provider.
- Provider in-progress/start-service.
- Subscription pause/cancel/resume.
- Provider earnings dashboard.
- Live provider location.

## Acceptance Criteria

Customer v1 is complete when:

- New customer signs up with email OTP and completes profile.
- Existing customer logs in with email OTP.
- Customer creates/edits pet with photo.
- Customer saves address with location.
- Customer books selected provider service with pet, address, date, slot, price preview, and Razorpay payment.
- Booking appears in history only after backend success.
- Customer can book with subscription credit when eligible.
- Customer can cancel allowed bookings.
- Customer can review completed bookings.
- Customer can view subscription state, credits, referral code/stats, notifications, messages, and invoices.

Provider v1 is complete when:

- Provider logs in with email OTP.
- Unlinked provider can submit application.
- Approved provider lands in provider dashboard.
- Provider sees assigned bookings and booking details.
- Provider can confirm, complete, no-show, and cancel according to backend rules.
- Provider can collect direct/mixed payment before completion when required.
- Provider can manage weekly availability and blocked dates.
- Provider can view/respond to reviews and manage basic profile/documents.

Release is blocked if:

- Protected APIs do not authenticate native bearer tokens.
- Any secret key is present in mobile code.
- Booking creation bypasses backend API routes.
- Payment verification recovery is missing.
- Unsupported actions are visible as working features.
- Mobile uses incorrect table names from the older prompt.

## Explicit MVP Non-Goals

- No new backend.
- No password login.
- No direct booking table writes.
- No direct payment/subscription table writes.
- No customer reschedule until backend exists.
- No subscription pause/cancel/resume until backend exists.
- No push notifications until backend device-token support exists.
- No live provider tracking until backend exists.
- No provider Start Service/In Progress until route handling is fixed.
- No full earnings dashboard until backend exposes reliable payout data.