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

Create app-specific .env files with:

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_API_BASE_URL
- EXPO_PUBLIC_RAZORPAY_KEY_ID
- EXPO_PUBLIC_GOOGLE_MAPS_KEY

Never add server secrets to mobile apps.
