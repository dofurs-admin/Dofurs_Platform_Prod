import { describe, expect, it } from 'vitest';
import {
  GAZE_HEAT_BUBBLE_TIERS,
  aggregateBookingsByPincode,
  buildGazeKpis,
  computeCoverageGaps,
  isPincodeCovered,
  normalizeGazePincode,
  resolveGazeDateKey,
  resolveHeatBubbleForCount,
  toMappableCoordinateOrNull,
  type GazeBookingPoint,
  type GazeProviderPoint,
} from './aggregates';

function makeBooking(overrides?: Partial<GazeBookingPoint>): GazeBookingPoint {
  return {
    id: 101,
    userId: 'user-1',
    latitude: 12.9352,
    longitude: 77.6245,
    pincode: '560095',
    city: 'Bengaluru',
    locationAddress: '12 Koramangala 5th Block, Bengaluru',
    bookingDate: '2026-09-01',
    startTime: '10:00',
    status: 'confirmed',
    bookingMode: 'home_visit',
    providerId: 7,
    providerName: 'Bob Groomer',
    customerName: 'Alice',
    amountInr: 1299,
    ...overrides,
  };
}

describe('normalizeGazePincode', () => {
  it('accepts valid six digit pincodes', () => {
    expect(normalizeGazePincode('560095')).toBe('560095');
    expect(normalizeGazePincode(' 560001 ')).toBe('560001');
  });

  it('rejects invalid or non-string values', () => {
    expect(normalizeGazePincode('5600951')).toBeNull();
    expect(normalizeGazePincode('060095')).toBeNull();
    expect(normalizeGazePincode('')).toBeNull();
    expect(normalizeGazePincode(null)).toBeNull();
    expect(normalizeGazePincode(560095)).toBeNull();
  });
});

describe('toMappableCoordinateOrNull', () => {
  it('returns finite non-zero coordinates', () => {
    expect(toMappableCoordinateOrNull(12.9716)).toBe(12.9716);
    expect(toMappableCoordinateOrNull('77.5946')).toBe(77.5946);
  });

  it('treats zero, non-finite, and non-numeric values as missing', () => {
    expect(toMappableCoordinateOrNull(0)).toBeNull();
    expect(toMappableCoordinateOrNull(Number.NaN)).toBeNull();
    expect(toMappableCoordinateOrNull(null)).toBeNull();
    expect(toMappableCoordinateOrNull('not-a-number')).toBeNull();
  });
});

describe('resolveGazeDateKey', () => {
  it('prefers a well-formed booking_date', () => {
    expect(resolveGazeDateKey({ bookingDate: '2026-09-01', bookingStart: '2026-09-02T10:00:00Z' })).toBe('2026-09-01');
  });

  it('falls back to the booking_start timestamp', () => {
    expect(resolveGazeDateKey({ bookingDate: null, bookingStart: '2026-09-02T10:00:00Z' })).toBe('2026-09-02');
  });

  it('returns null when no date can be resolved', () => {
    expect(resolveGazeDateKey({ bookingDate: null, bookingStart: null })).toBeNull();
    expect(resolveGazeDateKey({ bookingDate: 'not-a-date', bookingStart: '' })).toBeNull();
  });
});

describe('resolveHeatBubbleForCount', () => {
  it('maps volume ratios onto bubble tiers', () => {
    expect(resolveHeatBubbleForCount(2, 40)).toBe(GAZE_HEAT_BUBBLE_TIERS[0]);
    expect(resolveHeatBubbleForCount(10, 40)).toBe(GAZE_HEAT_BUBBLE_TIERS[0]);
    expect(resolveHeatBubbleForCount(12, 40)).toBe(GAZE_HEAT_BUBBLE_TIERS[1]);
    expect(resolveHeatBubbleForCount(24, 40)).toBe(GAZE_HEAT_BUBBLE_TIERS[2]);
    expect(resolveHeatBubbleForCount(40, 40)).toBe(GAZE_HEAT_BUBBLE_TIERS[3]);
  });

  it('returns null without usable volume', () => {
    expect(resolveHeatBubbleForCount(0, 40)).toBeNull();
    expect(resolveHeatBubbleForCount(10, 0)).toBeNull();
    expect(resolveHeatBubbleForCount(Number.NaN, 40)).toBeNull();
  });
});


describe('aggregateBookingsByPincode', () => {
  it('groups bookings by pincode with volume, status counts, and booking value', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, status: 'completed', amountInr: 1000 }),
      makeBooking({ id: 2, status: 'confirmed', amountInr: 500 }),
      makeBooking({ id: 3, status: 'cancelled', amountInr: 700 }),
      makeBooking({ id: 4, status: 'no_show', amountInr: 300 }),
      makeBooking({ id: 5, pincode: '560001', status: 'pending', amountInr: 250 }),
    ]);

    expect(stats).toHaveLength(2);

    const koramangala = stats.find((stat) => stat.pincode === '560095');
    expect(koramangala).toMatchObject({
      bookingCount: 4,
      completedCount: 1,
      cancelledCount: 1,
      noShowCount: 1,
      // Cancelled and no-show bookings do not count toward booking value.
      bookingValueInr: 1500,
      city: 'Bengaluru',
    });

    const indiranagar = stats.find((stat) => stat.pincode === '560001');
    expect(indiranagar?.bookingCount).toBe(1);
    expect(indiranagar?.bookingValueInr).toBe(250);
  });

  it('sorts by booking volume descending', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, pincode: '560001' }),
      makeBooking({ id: 2, pincode: '560095' }),
      makeBooking({ id: 3, pincode: '560095' }),
    ]);

    expect(stats.map((stat) => stat.pincode)).toEqual(['560095', '560001']);
  });

  it('computes pincode centroids from mappable coordinates only', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, latitude: 12.9, longitude: 77.6 }),
      makeBooking({ id: 2, latitude: 13.1, longitude: 77.8 }),
      makeBooking({ id: 3, latitude: null, longitude: null }),
      makeBooking({ id: 4, latitude: 0, longitude: 0 }),
    ]);

    expect(stats).toHaveLength(1);
    expect(stats[0].bookingCount).toBe(4);
    expect(stats[0].centroidLat).toBeCloseTo(13.0);
    expect(stats[0].centroidLng).toBeCloseTo(77.7);
  });

  it('excludes bookings without a normalizable pincode', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, pincode: null }),
      makeBooking({ id: 2, pincode: 'invalid' }),
      makeBooking({ id: 3, pincode: '560095' }),
    ]);

    expect(stats).toHaveLength(1);
    expect(stats[0].bookingCount).toBe(1);
  });

  it('keeps null centroids when no booking in a pincode has coordinates', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, latitude: null, longitude: null }),
    ]);

    expect(stats[0].centroidLat).toBeNull();
    expect(stats[0].centroidLng).toBeNull();
  });

describe('coverage matching and gaps', () => {
  it('treats the 560000 Bengaluru preset as covering every 560xxx pincode', () => {
    expect(isPincodeCovered('560095', ['560000'])).toBe(true);
    expect(isPincodeCovered('560001', ['560000'])).toBe(true);
    expect(isPincodeCovered('560095', ['560001'])).toBe(false);
    expect(isPincodeCovered('560095', [])).toBe(false);
  });

  it('flags demand pincodes without any enabled provider coverage', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, pincode: '560095', amountInr: 1000 }),
      makeBooking({ id: 2, pincode: '560095', amountInr: 500 }),
      makeBooking({ id: 3, pincode: '560076', amountInr: 800 }),
    ]);

    const gaps = computeCoverageGaps(stats, [
      { providerId: 7, providerName: 'Bob Groomer', pincodes: ['560095'] },
    ]);

    expect(gaps).toEqual([
      { pincode: '560076', bookingCount: 1, bookingValueInr: 800 },
    ]);
  });

  it('sorts coverage gaps by booking volume descending', () => {
    const stats = aggregateBookingsByPincode([
      makeBooking({ id: 1, pincode: '560076' }),
      makeBooking({ id: 2, pincode: '560103' }),
      makeBooking({ id: 3, pincode: '560103' }),
    ]);

    const gaps = computeCoverageGaps(stats, []);

    expect(gaps.map((gap) => gap.pincode)).toEqual(['560103', '560076']);
  });

  it('normalizes configured coverage pincodes before matching', () => {
    const stats = aggregateBookingsByPincode([makeBooking({ id: 1, pincode: '560095' })]);

    const gaps = computeCoverageGaps(stats, [
      { providerId: 7, providerName: 'Bob Groomer', pincodes: ['not-a-pincode', '560095'] },
    ]);

    expect(gaps).toEqual([]);
  });
});


describe('buildGazeKpis', () => {
  it('summarizes volume, value, mapping, and coverage signals', () => {
    const bookings = [
      makeBooking({ id: 1, status: 'completed', amountInr: 1000, bookingDate: '2026-09-01' }),
      makeBooking({ id: 2, status: 'cancelled', amountInr: 500, bookingDate: '2026-09-01' }),
      makeBooking({ id: 3, status: 'pending', amountInr: 250, bookingDate: '2026-09-01' }),
      makeBooking({ id: 4, status: 'confirmed', amountInr: 750, bookingDate: '2026-08-30', latitude: null, longitude: null }),
    ];
    const pincodeStats = aggregateBookingsByPincode(bookings);
    const providers: GazeProviderPoint[] = [
      {
        id: 7,
        name: 'Bob Groomer',
        providerType: 'groomer',
        accountStatus: 'active',
        approvalStatus: 'approved',
        latitude: 12.9,
        longitude: 77.6,
        pincode: '560095',
        city: 'Bengaluru',
        serviceRadiusKm: 10,
      },
      {
        id: 8,
        name: 'Idle Groomer',
        providerType: 'groomer',
        accountStatus: 'suspended',
        approvalStatus: 'approved',
        latitude: null,
        longitude: null,
        pincode: null,
        city: null,
        serviceRadiusKm: null,
      },
    ];

    const kpis = buildGazeKpis({
      bookings,
      pincodeStats,
      providers,
      coverageGaps: [{ pincode: '560076', bookingCount: 2, bookingValueInr: 900 }],
      todayKey: '2026-09-01',
    });

    expect(kpis).toEqual({
      totalBookings: 4,
      mappedBookings: 3,
      totalBookingValueInr: 2000,
      completedCount: 1,
      jobsToday: 3,
      pincodeCount: pincodeStats.length,
      activeGroomers: 1,
      coverageGapCount: 1,
    });
  });
});

});
