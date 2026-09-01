import type { BookingStatus } from '@/lib/bookings/types';
import { serviceCoveragePincodeMatches } from '@/lib/service-coverage';

// ── Shared response types ─────────────────────────────────────────────────────
//
// These types are consumed by both the /api/admin/gaze route and the Gaze admin
// tab, so they live in a dependency-free module that stays trivially testable.

export type GazeWindowKey = 'today' | '7d' | '30d' | '90d' | 'custom' | 'alltime';

export type GazeBookingPoint = {
  id: number;
  userId: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  city: string | null;
  locationAddress: string | null;
  bookingDate: string | null;
  startTime: string | null;
  status: BookingStatus;
  bookingMode: string | null;
  providerId: number;
  providerName: string | null;
  customerName: string | null;
  amountInr: number | null;
};

export type GazeProviderPoint = {
  id: number;
  name: string;
  providerType: string | null;
  accountStatus: string | null;
  approvalStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  city: string | null;
  serviceRadiusKm: number | null;
};

export type GazePincodeStat = {
  pincode: string;
  city: string | null;
  bookingCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  /** Expected booking value in INR (excludes cancelled and no-show bookings). */
  bookingValueInr: number;
  centroidLat: number | null;
  centroidLng: number | null;
};

export type GazeCoverageEntry = {
  providerId: number;
  providerName: string;
  pincodes: string[];
};

export type GazeCoverageGap = {
  pincode: string;
  bookingCount: number;
  bookingValueInr: number;
};

export type GazeKpis = {
  totalBookings: number;
  mappedBookings: number;
  totalBookingValueInr: number;
  completedCount: number;
  jobsToday: number;
  pincodeCount: number;
  activeGroomers: number;
  coverageGapCount: number;
};

export type GazeOverviewResponse = {
  bookings: GazeBookingPoint[];
  providers: GazeProviderPoint[];
  pincodeStats: GazePincodeStat[];
  coverage: GazeCoverageEntry[];
  coverageGaps: GazeCoverageGap[];
  kpis: GazeKpis;
  window: {
    key: GazeWindowKey;
    /** Null for the 'alltime' window (no date bounds). */
    fromDate: string | null;
    toDate: string | null;
  };
  bookingsTruncated: boolean;
  generatedAt: string;
};

// ── Heat bubble scale ──────────────────────────────────────────────────────────

export type GazeHeatBubble = {
  radiusMeters: number;
  color: string;
  fillColor: string;
  fillOpacity: number;
};

export const GAZE_HEAT_BUBBLE_TIERS: readonly GazeHeatBubble[] = [
  { radiusMeters: 700, color: '#b98a2f', fillColor: '#f6c66a', fillOpacity: 0.3 },
  { radiusMeters: 1100, color: '#c26a2e', fillColor: '#f0975a', fillOpacity: 0.35 },
  { radiusMeters: 1600, color: '#c2543a', fillColor: '#e07a4f', fillOpacity: 0.4 },
  { radiusMeters: 2200, color: '#a63a2a', fillColor: '#c94f3d', fillOpacity: 0.45 },
];

export function resolveHeatBubbleForCount(count: number, maxCount: number): GazeHeatBubble | null {
  if (!Number.isFinite(count) || !Number.isFinite(maxCount) || count <= 0 || maxCount <= 0) {
    return null;
  }

  const ratio = count / maxCount;

  if (ratio <= 0.25) {
    return GAZE_HEAT_BUBBLE_TIERS[0];
  }

  if (ratio <= 0.5) {
    return GAZE_HEAT_BUBBLE_TIERS[1];
  }

  if (ratio <= 0.75) {
    return GAZE_HEAT_BUBBLE_TIERS[2];
  }

  return GAZE_HEAT_BUBBLE_TIERS[3];
}

// ── Booking pin colors ─────────────────────────────────────────────────────────

export const GAZE_BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: '#d97706',
  confirmed: '#2563eb',
  in_progress: '#7c3aed',
  completed: '#16a34a',
  cancelled: '#64748b',
  no_show: '#dc2626',
};

// ── Normalization helpers ──────────────────────────────────────────────────────

export function toFiniteNumberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Coordinates of 0 are treated as "missing" (same convention as
 * components/forms/LocationPinMap.tsx).
 */
export function toMappableCoordinateOrNull(value: unknown): number | null {
  const parsed = toFiniteNumberOrNull(value);
  return parsed !== null && parsed !== 0 ? parsed : null;
}

export function normalizeGazePincode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digitsOnly) ? digitsOnly : null;
}

/**
 * Resolves a YYYY-MM-DD date key for a booking, preferring `booking_date` and
 * falling back to the `booking_start` timestamp. Mirrors the resolution used by
 * the admin bookings queue.
 */
export function resolveGazeDateKey(booking: {
  bookingDate?: string | null;
  bookingStart?: string | null;
}): string | null {
  const normalizedBookingDate = booking.bookingDate?.trim();

  if (normalizedBookingDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedBookingDate)) {
    return normalizedBookingDate;
  }

  const normalizedBookingStart = booking.bookingStart?.trim();

  if (!normalizedBookingStart) {
    return null;
  }

  const slicedDate = normalizedBookingStart.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(slicedDate)) {
    return slicedDate;
  }

  const parsedDate = new Date(normalizedBookingStart);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

// ── Aggregations ───────────────────────────────────────────────────────────────

type PincodeStatAccumulator = GazePincodeStat & {
  latSum: number;
  lngSum: number;
  coordinateCount: number;
};

/**
 * Rolls bookings up by pincode. Bookings without a normalizable pincode are
 * excluded; bookings without mappable coordinates still count toward volume
 * but do not contribute to the pincode centroid.
 */
export function aggregateBookingsByPincode(bookings: GazeBookingPoint[]): GazePincodeStat[] {
  const statsByPincode = new Map<string, PincodeStatAccumulator>();

  for (const booking of bookings) {
    const pincode = normalizeGazePincode(booking.pincode);

    if (!pincode) {
      continue;
    }

    let stat = statsByPincode.get(pincode);

    if (!stat) {
      stat = {
        pincode,
        city: null,
        bookingCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        noShowCount: 0,
        bookingValueInr: 0,
        centroidLat: null,
        centroidLng: null,
        latSum: 0,
        lngSum: 0,
        coordinateCount: 0,
      };
      statsByPincode.set(pincode, stat);
    }

    stat.bookingCount += 1;

    if (booking.status === 'completed') {
      stat.completedCount += 1;
    } else if (booking.status === 'cancelled') {
      stat.cancelledCount += 1;
    } else if (booking.status === 'no_show') {
      stat.noShowCount += 1;
    }

    if (booking.status !== 'cancelled' && booking.status !== 'no_show') {
      stat.bookingValueInr += booking.amountInr ?? 0;
    }

    if (!stat.city && booking.city?.trim()) {
      stat.city = booking.city.trim();
    }

    const latitude = toMappableCoordinateOrNull(booking.latitude);
    const longitude = toMappableCoordinateOrNull(booking.longitude);

    if (latitude !== null && longitude !== null) {
      stat.latSum += latitude;
      stat.lngSum += longitude;
      stat.coordinateCount += 1;
    }
  }

  return Array.from(statsByPincode.values())
    .map((stat) => {
      const { latSum, lngSum, coordinateCount, ...finalStat } = stat;

      return {
        ...finalStat,
        centroidLat: coordinateCount > 0 ? latSum / coordinateCount : null,
        centroidLng: coordinateCount > 0 ? lngSum / coordinateCount : null,
      };
    })
    .sort((left, right) => right.bookingCount - left.bookingCount || left.pincode.localeCompare(right.pincode));
}

/**
 * A requested (demand) pincode is covered when any configured coverage pincode
 * matches it. This reuses the platform coverage semantics, including the
 * '560000' Bengaluru city-wide preset covering every 560xxx pincode.
 */
export function isPincodeCovered(requestedPincode: string, configuredPincodes: Iterable<string>): boolean {
  for (const configuredPincode of configuredPincodes) {
    if (serviceCoveragePincodeMatches(configuredPincode, requestedPincode)) {
      return true;
    }
  }

  return false;
}

/**
 * Demand pincodes (from booking volume) that no active provider service covers.
 * Sorted by booking count so the most urgent gaps surface first.
 */
export function computeCoverageGaps(
  pincodeStats: GazePincodeStat[],
  coverage: GazeCoverageEntry[],
): GazeCoverageGap[] {
  const configuredPincodes = new Set<string>();

  for (const entry of coverage) {
    for (const rawPincode of entry.pincodes) {
      const pincode = normalizeGazePincode(rawPincode);

      if (pincode) {
        configuredPincodes.add(pincode);
      }
    }
  }

  return pincodeStats
    .filter((stat) => !isPincodeCovered(stat.pincode, configuredPincodes))
    .map((stat) => ({
      pincode: stat.pincode,
      bookingCount: stat.bookingCount,
      bookingValueInr: stat.bookingValueInr,
    }))
    .sort((left, right) => right.bookingCount - left.bookingCount || left.pincode.localeCompare(right.pincode));
}

export function buildGazeKpis(input: {
  bookings: GazeBookingPoint[];
  pincodeStats: GazePincodeStat[];
  providers: GazeProviderPoint[];
  coverageGaps: GazeCoverageGap[];
  todayKey: string;
}): GazeKpis {
  let totalBookingValueInr = 0;
  let completedCount = 0;
  let jobsToday = 0;
  let mappedBookings = 0;

  for (const booking of input.bookings) {
    if (booking.status !== 'cancelled' && booking.status !== 'no_show') {
      totalBookingValueInr += booking.amountInr ?? 0;
    }

    if (booking.status === 'completed') {
      completedCount += 1;
    }

    if (booking.bookingDate === input.todayKey) {
      jobsToday += 1;
    }

    if (booking.latitude !== null && booking.longitude !== null) {
      mappedBookings += 1;
    }
  }

  return {
    totalBookings: input.bookings.length,
    mappedBookings,
    totalBookingValueInr,
    completedCount,
    jobsToday,
    pincodeCount: input.pincodeStats.length,
    activeGroomers: input.providers.filter((provider) => provider.accountStatus === 'active').length,
    coverageGapCount: input.coverageGaps.length,
  };
}
