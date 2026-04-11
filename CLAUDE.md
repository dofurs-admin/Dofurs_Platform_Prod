# Dofurs Platform — Claude Code Guide

Pet services marketplace connecting pet parents with verified care professionals in Bangalore.
Roles: `user` (pet owners), `provider` (groomers, vets, trainers, sitters), `admin` / `staff`.

---

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Run Vitest once
npm run test:watch   # Vitest in watch mode
npm run test:schema-health   # Supabase schema integrity check
npm run release:gate         # Release readiness gate
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS (no CSS-in-JS, no inline styles) |
| Database | Supabase (PostgreSQL + RLS + PostgREST) |
| Auth | Supabase Auth (Email OTP) |
| Payments | Razorpay |
| Forms | React Hook Form + Zod |
| Maps | Leaflet / react-leaflet |
| Animations | Framer Motion |
| Testing | Vitest |
| Deployment | Render.io |

---

## Project Structure

```
app/                    # Next.js App Router — pages, layouts, API routes
  (public pages)        # /, /about, /blog, /faqs, /contact-us, /privacy-policy, etc.
  auth/                 # Sign in, sign up, callback, suspended
  forms/                # customer-booking, birthday-booking, provider-application
  dashboard/            # Protected: /user, /provider, /admin
  api/                  # All API routes (REST)
    auth/               # Pre-signup, bootstrap, complete-profile, logout
    bookings/           # Create, status, slots, catalog, availability
    payments/           # Razorpay orders, verify, webhook
    user/               # Profile, pets, owner-profile, addresses
    provider/           # Profile, availability, bookings, documents, reviews
    admin/              # Users, providers, bookings, services, billing, discounts
    services/           # Public service catalog endpoints
    storage/            # Signed upload/read URLs
    billing/            # Invoices, reconciliation, reminders
    credits/            # Credit eligibility
    subscriptions/      # Plans, user subscriptions

components/
  ui/                   # Base UI components (Button, Input, Modal, Badge, etc.)
  auth/                 # Auth-specific components
  forms/                # Form components + multi-step booking flows
    steps/              # ServiceSelection, PetSelection, DateTimeSlot, ReviewConfirm
  dashboard/
    premium/            # Premium dashboard components (StatCard, BookingCard, etc.)
    admin/              # Admin-specific modals and managers
    account/            # Billing, payments, addresses, subscriptions
  layouts/              # PageLayout, BookingFlowLayout, SettingsLayout
  payments/             # SubscriptionCheckoutPanel

lib/
  api/                  # HTTP client, error mapping, rate limiting, distributed locks
  auth/                 # Role resolution, inactivity, session management
  bookings/             # Types, service, state-transition-guard, slot/pricing/discount engines
  supabase/             # Browser client, server client, admin client, middleware
  forms/                # Zod validators, useAsyncForm hook
  hooks/                # useAsyncState, useAsyncData, useOptimisticSelection, useRealtime
  payments/             # Razorpay integration, invoices, webhooks
  subscriptions/        # Subscription CRUD, credit tracking
  service-catalog/      # Types, validation, pricing engine
  provider-management/  # Types, service, validation, dashboard queries
  pets/                 # CRUD, types, passport validation, share access
  owner-profile/        # Profile types, service, validation, audit
  storage/              # Upload client, image compression
  utils/                # date, india-phone, slug, stateGuard
  theme.ts              # Layout/spacing tokens (container, sectionSpacing)
  site-data.ts          # All static content (services, reviews, links, steps, nav)
  design-system.ts      # Design tokens

infra/
  supabase/migrations/  # Database migration files
  render.yaml           # Render.io deployment config
  monitoring/           # Datadog + Prometheus config
```

---

## Design System

### Colors
```
coral       #e39a5d   — primary brand, buttons, icons, accents
ink         #1f1f1f   — primary text
brand-*     50–900    — full brand palette (orange/coral tones)
```
Use Tailwind utilities: `text-coral`, `bg-coral`, `border-coral`, `text-ink`, `brand-100`, etc.
Warm cream/peach tones for backgrounds: `#fdf8f4`, `#fff8f0`, `#f6efe9`, `#f8f5f2`.

### Typography
Font: **Plus Jakarta Sans** (`font-family` loaded via `next/font/google`).
Scale: `display` (2.5rem/700), `page-title` (1.5rem/600), `section-title` (1.25rem/500), `card-title` (1.125rem/500).

### Components
- **Cards**: `rounded-3xl` or `rounded-[28px]`, `border border-[#e7c4a7]`, `shadow-premium`
- **Badges/pills**: `rounded-full`, small uppercase tracking
- **CTAs**: Always use `premiumPrimaryCtaClass()` or `premiumSecondaryCtaClass()` from `lib/styles/premium-cta.ts`
- **Shadows**: `shadow-soft`, `shadow-premium`, `shadow-premium-lg`, `shadow-premium-xl`
- **Container**: `mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8`
- **Section spacing**: `py-16 md:py-24`
- **Dark mode**: class-based via `next-themes`

---

## Authentication & Authorization

### Auth Flow
- Supabase Auth (Email OTP) — no password auth
- Browser: `createBrowserClient()` from `lib/supabase/browser-client.ts`
- Server (API routes): `createServerClient()` from `lib/supabase/server-client.ts`
- Admin ops: `createAdminClient()` from `lib/supabase/admin-client.ts`

### Roles
```
user      — pet owners
provider  — service professionals
admin     — full platform access
staff     — same as admin in practice
```
**Provider precedence rule**: If a user has a provider record, middleware resolves them as `provider` role, not `user`. This is intentional — do not change without discussion.

### Protected Routes (middleware.ts)
All `/dashboard/*`, `/forms/customer-booking/*`, `/api/bookings/*`, `/api/storage/*`, `/api/provider/*`, `/api/admin/*`, `/api/user/*` require authentication.

Inactivity timeout: 30 min (configurable via `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES`).

---

## API Route Conventions

- Routes live under `app/api/`
- Resource-based structure: `/api/resource`, `/api/resource/[id]`, `/api/resource/[id]/action`
- Validate role in every API handler before any DB operation
- Use `createServerClient()` (not browser client) in all API routes
- Rate limiting applied on auth and sensitive endpoints via `lib/api/rate-limit.ts`
- Return friendly error messages using `lib/api/errors.ts` mappings
- Webhooks (Razorpay, billing) validated via secret before processing

---

## Database Conventions

- Supabase PostgreSQL with RLS policies on all tables
- 35+ migrations in `infra/supabase/migrations/` — never edit migrations manually
- Use service layer functions (e.g. `lib/bookings/service.ts`) for DB operations, not raw Supabase queries in components
- Transactional operations use Supabase RPC functions
- Generated types in `lib/supabase/owner-profile.database.types.ts`

---

## Form Conventions

- **React Hook Form** + **Zod** for all forms
- Reusable validators in `lib/forms/validation.ts` — use before writing new ones
- `useAsyncForm` hook from `lib/forms/hooks.ts` for async submissions
- Multi-step flows use step components in `components/forms/steps/`
- India phone validation: `lib/utils/india-phone.ts`
- Image upload fields: `components/ui/ImageUploadField.tsx` (handles compression via `browser-image-compression`)

---

## State Management

- No global store (no Zustand, Redux, etc.)
- Supabase is source of truth
- Custom hooks for async data: `useAsyncState`, `useAsyncData` from `lib/hooks/`
- Realtime subscriptions: `useRealtime` hook
- Theme: `next-themes` via `AppProviders`
- Toast notifications: `ToastProvider` from `components/ui/`

---

## Testing Conventions

- **Framework**: Vitest (not Jest)
- Test files colocated with source: `foo.test.ts` next to `foo.ts`
- Engines have full unit test coverage: slot, pricing, discount engines
- State transition guard has tests — update them when modifying booking states
- Smoke tests for payment API flows

---

## Booking State Machine

Booking state transitions are strictly controlled by `lib/bookings/state-transition-guard.ts`.
Do not change booking status directly — always go through the transition guard.
`BookingMode`: `home_visit` | `clinic_visit` | `teleconsult`

---

## Key Env Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
BILLING_AUTOMATION_SECRET
NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES
```
**Never commit `.env.local`** — it contains live secrets.

---

## Git Conventions

- Branch: `feature/description`, `fix/description`
- Commit style: imperative lowercase verb — `Add ...`, `Fix ...`, `Move ...`, `Refine ...`
- Only stage relevant files — never `git add .` blindly (`.env.local` must stay unstaged)
- Always run `npm run lint` before committing

---

## Landing Page Notes

The main landing page (`app/page.tsx`) is fully self-contained — all sections are inline.
The standalone component files (`HeroSection.tsx`, `ServicesSection.tsx`, `ReviewsSection.tsx`, etc.) exist but are **not imported** by the main page. Do not assume they are in use.

Static content (service names, reviews, links, nav) lives in `lib/site-data.ts` — update there first.
