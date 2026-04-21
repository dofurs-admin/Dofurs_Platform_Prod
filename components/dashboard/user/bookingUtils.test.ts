import { describe, expect, it } from 'vitest';
import { extractBookedPetIds, normalizeBookingRecord, resolveBookingPetLabels, resolveBookingServiceLabel } from './bookingUtils';
import type { Booking, Pet } from './types';

function makeBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: 1,
    booking_start: '2026-04-24T09:00:00.000Z',
    booking_end: '2026-04-24T11:00:00.000Z',
    booking_date: '2026-04-24',
    start_time: '09:00:00',
    end_time: '11:00:00',
    status: 'confirmed',
    booking_status: 'confirmed',
    amount: 0,
    payment_mode: 'direct_to_provider',
    ...overrides,
  };
}

function makePet(id: number, name: string): Pet {
  return {
    id,
    name,
    breed: null,
    age: null,
    weight: null,
    gender: null,
    allergies: null,
    photo_url: null,
  };
}

describe('normalizeBookingRecord', () => {
  it('falls back to final_price when amount is zero', () => {
    const booking = makeBooking({ amount: 0, final_price: 2198 });

    const normalized = normalizeBookingRecord(booking);

    expect(normalized.amount).toBe(2198);
  });

  it('keeps explicit non-zero amount as primary value', () => {
    const booking = makeBooking({ amount: 1499, final_price: 2198, price_at_booking: 2298 });

    const normalized = normalizeBookingRecord(booking);

    expect(normalized.amount).toBe(1499);
  });
});

describe('resolveBookingServiceLabel', () => {
  it('returns bundled services label when multiple services are present in provider notes', () => {
    const booking = makeBooking({
      service_type: 'Summer Bonanza (Offer Package)',
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Summer Bonanza (Offer Package)',
        '2. Pet 81 | Doorstep Pet Grooming (Basic Package)',
      ].join('\n'),
    });

    expect(resolveBookingServiceLabel(booking)).toBe('Bundled services (2)');
  });

  it('keeps the package name for single-service bookings', () => {
    const booking = makeBooking({
      service_type: 'Summer Bonanza (Offer Package)',
      provider_notes: '',
    });

    expect(resolveBookingServiceLabel(booking)).toBe('Summer Bonanza (Offer Package)');
  });
});

describe('extractBookedPetIds', () => {
  it('extracts unique pet IDs from bundled provider notes', () => {
    const booking = makeBooking({
      pet_id: 81,
      provider_notes: [
        'Bundled services (3)',
        '1. Pet 81 | Summer Bonanza (Offer Package)',
        '2. Pet 82 | Doorstep Pet Grooming (Basic Package)',
        '3. Pet 81 | Nail Clipping',
      ].join('\n'),
    });

    expect(extractBookedPetIds(booking)).toEqual([81, 82]);
  });

  it('falls back to booking.pet_id when notes do not include pet lines', () => {
    const booking = makeBooking({
      pet_id: 77,
      provider_notes: 'General note without pet prefixes',
    });

    expect(extractBookedPetIds(booking)).toEqual([77]);
  });
});

describe('resolveBookingPetLabels', () => {
  it('resolves all matching pet names for multi-pet booking lines', () => {
    const booking = makeBooking({
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Summer Bonanza (Offer Package)',
        '2. Pet 82 | Doorstep Pet Grooming (Basic Package)',
      ].join('\n'),
    });

    const names = resolveBookingPetLabels(booking, [
      makePet(81, 'Meaw'),
      makePet(82, 'Tiger'),
    ]);

    expect(names).toEqual(['Meaw', 'Tiger']);
  });
});
