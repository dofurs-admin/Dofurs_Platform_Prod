# Dofurs Mobile Monorepo

Phase-based mobile implementation workspace for Dofurs customer and provider apps.

## Structure

- apps/customer: Expo Router customer app
- apps/provider: Expo Router provider app
- packages/shared: shared API, auth, types, hooks, store, and UI primitives

## Quick Start

Run commands from the repository root:

1. Install dependencies:
   npm run mobile:install
2. Start customer app:
   npm run mobile:dev:customer
3. Start provider app:
   npm run mobile:dev:provider

## Environment Variables

Create app-specific `.env.local` files in both app folders:

- `dofurs-mobile/apps/customer/.env.local`
- `dofurs-mobile/apps/provider/.env.local`

Required for both apps:

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_API_BASE_URL
- EXPO_PUBLIC_APP_ENV (`development`, `preview`, or `production`; defaults to `development`)

Feature-specific (required only when that feature is enabled):

- EXPO_PUBLIC_RAZORPAY_KEY_ID
- EXPO_PUBLIC_GOOGLE_MAPS_KEY

Current scope:

- Customer app may require Razorpay and Maps keys for payment/location flows.
- Provider app startup does not require Razorpay or Maps keys unless a provider feature explicitly uses them.

API URL guidance by runtime:

- iOS simulator: `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`
- Android emulator: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000`
- Physical device (same LAN): `EXPO_PUBLIC_API_BASE_URL=http://<your-mac-lan-ip>:3000`
- Preview/production builds: use HTTPS public endpoints only, for example `https://dofurs.in`

Release safety checks:

- When `EXPO_PUBLIC_APP_ENV` is `preview` or `production`, the app rejects:
   - `http://` API URLs
   - `localhost` / `127.0.0.1`
   - private LAN IPv4 ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`)

Never add server secrets to mobile apps.
