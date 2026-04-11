# Booking System Upgrade (v2)

## Implemented Artifacts

- Migration: `infra/supabase/018_booking_system_upgrade.sql`
- Service layer: `lib/bookings/service.ts`
- Types: `lib/bookings/types.ts`
- Dashboard query templates: `lib/bookings/dashboard-queries.ts`

## What This Upgrade Adds

1. Dynamic slot generation from `provider_availability` (+ optional `provider_blocked_dates`)
2. Overlap prevention for active bookings (`pending`, `confirmed`)
3. Booking mode support (`home_visit`, `clinic_visit`, `teleconsult`)
4. Status transition enforcement (`pending -> confirmed -> completed`, etc.)
5. Future-ready payment schema fields (no payment logic)

## Compatibility Note

The current production schema uses `providers.id bigint` and `bookings.id bigint`.
To avoid breaking existing flows, this rollout keeps those keys and introduces v2 scheduling columns on top.

## Example Booking Creation Flow (User)

1. Fetch catalog from `/api/bookings/catalog`
2. Fetch slots from `/api/bookings/available-slots?providerId=...&date=...&providerServiceId=...`
3. Submit booking to `/api/bookings/create` with:
   - `petId`
   - `providerId`
   - `providerServiceId`
   - `bookingDate`
   - `startTime`
   - `bookingMode`
   - `locationAddress`, `latitude`, `longitude` (required for `home_visit`)

## Service Layer Entry Points

### User
- `createBooking`
- `getMyBookings`
- `cancelBooking`
- `getAvailableSlots`

### Provider
- `getProviderBookings`
- `confirmBooking`
- `completeBooking`
- `markNoShow`

### Admin
- `overrideBooking`
- `updateBookingStatus`
- `manualAssignProvider`

## Recommended Post-Migration Checks

1. Verify `create_booking_v2` RPC exists and is executable by authenticated users.
2. Validate at least one provider has `provider_availability` rows with `slot_duration_minutes`.
3. Create two bookings with overlapping times for the same provider and date to confirm rejection.
4. Confirm Service Provider Dashboard can transition statuses only along allowed paths.