import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { BOOKING_MODES, BOOKING_STATUSES, type BookingMode, type BookingStatus } from '@/lib/bookings/types';
import {
  aggregateBookingsByPincode,
  buildGazeKpis,
  computeCoverageGaps,
  normalizeGazePincode,
  resolveGazeDateKey,
  toFiniteNumberOrNull,
  toMappableCoordinateOrNull,
  type GazeBookingPoint,
  type GazeCoverageEntry,
  type GazeOverviewResponse,
  type GazeProviderPoint,
  type GazeWindowKey,
} from '@/lib/gaze/aggregates';

const GAZE_WINDOWS = ['today', '7d', '30d', '90d', 'custom', 'alltime'] as const;

const querySchema = z.object({
  window: z.enum(GAZE_WINDOWS).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  mode: z.enum(BOOKING_MODES).optional(),
  providerId: z.coerce.number().int().positive().optional(),
});

const BOOKING_POINT_LIMIT = 1000;

type GazeBookingSourceRow = {
  id: number;
  user_id: string | null;
  provider_id: number;
  booking_start: string;
  booking_date: string | null;
  start_time: string | null;
  status: string | null;
  booking_status: string | null;
  booking_mode: string | null;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  amount: number | null;
  final_price: number | null;
  price_at_booking: number | null;
};

type GazeProviderSourceRow = {
  id: number;
  name: string;
  provider_type: string | null;
  account_status: string | null;
  admin_approval_status: string | null;
  lat: number | null;
  lng: number | null;
  service_radius_km: number | null;
};

type GazeClinicDetailRow = {
  provider_id: number;
  pincode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type GazeProviderServiceRow = {
  id: string | number;
  provider_id: number;
};

type GazeCoverageRow = {
  provider_service_id: string | number | null;
  pincode: string | null;
  is_enabled: boolean | null;
};

type GazeUserRow = {
  id: string;
  name: string | null;
};

type GazeUserAddressRow = {
  user_id: string;
  pincode: string | null;
  city: string | null;
  is_default: boolean | null;
};

function normalizeBookingStatusValue(value: unknown): BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : 'pending';
}

function normalizeBookingModeValue(value: unknown): BookingMode | null {
  return BOOKING_MODES.includes(value as BookingMode) ? (value as BookingMode) : null;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveWindowRange(windowKey: GazeWindowKey, fromDate?: string, toDate?: string) {
  const todayKey = resolveTodayKey();

  if (windowKey === 'today') {
    return { fromDate: todayKey, toDate: todayKey, todayKey };
  }

  if (windowKey === '7d') {
    return { fromDate: addDaysToDateKey(todayKey, -6), toDate: todayKey, todayKey };
  }

  if (windowKey === '30d') {
    return { fromDate: addDaysToDateKey(todayKey, -29), toDate: todayKey, todayKey };
  }

  if (windowKey === '90d') {
    return { fromDate: addDaysToDateKey(todayKey, -89), toDate: todayKey, todayKey };
  }

  if (windowKey === 'alltime') {
    return { fromDate: null, toDate: null, todayKey };
  }

  return {
    fromDate: fromDate ?? addDaysToDateKey(todayKey, -29),
    toDate: toDate ?? todayKey,
    todayKey,
  };
}

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    window: url.searchParams.get('window') ?? undefined,
    fromDate: url.searchParams.get('fromDate') ?? undefined,
    toDate: url.searchParams.get('toDate') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    mode: url.searchParams.get('mode') ?? undefined,
    providerId: url.searchParams.get('providerId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const windowKey: GazeWindowKey = parsed.data.window ?? '30d';
  const range = resolveWindowRange(windowKey, parsed.data.fromDate, parsed.data.toDate);

  if (range.fromDate !== null && range.toDate !== null && range.fromDate > range.toDate) {
    return NextResponse.json({ error: 'fromDate cannot be after toDate' }, { status: 400 });
  }

  const statusFilter = parsed.data.status;
  const modeFilter = parsed.data.mode;
  const providerFilterId = parsed.data.providerId;

  try {
    const adminSupabase = getSupabaseAdminClient();

    const bookingsQuery = adminSupabase
      .from('bookings')
      .select(
        'id, user_id, provider_id, booking_start, booking_date, start_time, status, booking_status, booking_mode, location_address, latitude, longitude, amount, final_price, price_at_booking',
      )
      .order('booking_start', { ascending: false })
      .limit(BOOKING_POINT_LIMIT);

    // Windowed requests constrain booking_start with a one-day padded range
    // (timezone safety). "All time" queries without a range so the whole
    // booking history is considered, newest first.
    if (range.fromDate !== null) {
      bookingsQuery.gte('booking_start', `${addDaysToDateKey(range.fromDate, -1)}T00:00:00.000Z`);
    }

    if (range.toDate !== null) {
      bookingsQuery.lte('booking_start', `${addDaysToDateKey(range.toDate, 1)}T23:59:59.999Z`);
    }

    const [bookingsResult, providersResult, clinicDetailsResult, providerServicesResult, coverageResult] =
      await Promise.all([
        bookingsQuery.returns<GazeBookingSourceRow[]>(),
        adminSupabase
          .from('providers')
          .select('id, name, provider_type, account_status, admin_approval_status, lat, lng, service_radius_km')
          // Only fully operational groomers appear in Gaze: an active account that
          // has also cleared admin approval (mirrors the platform-wide definition
          // of an active provider used by the provider management service).
          .eq('account_status', 'active')
          .eq('admin_approval_status', 'approved')
          .order('name', { ascending: true })
          .limit(300)
          .returns<GazeProviderSourceRow[]>(),
        adminSupabase
          .from('provider_clinic_details')
          .select('provider_id, pincode, city, latitude, longitude')
          .limit(2000)
          .returns<GazeClinicDetailRow[]>(),
        adminSupabase
          .from('provider_services')
          .select('id, provider_id')
          .eq('is_active', true)
          .limit(3000)
          .returns<GazeProviderServiceRow[]>(),
        adminSupabase
          .from('provider_service_pincodes')
          .select('provider_service_id, pincode, is_enabled')
          .limit(10000)
          .returns<GazeCoverageRow[]>(),
      ]);

    if (bookingsResult.error) {
      throw bookingsResult.error;
    }

    if (providersResult.error) {
      throw providersResult.error;
    }

    // Coverage layers degrade gracefully when the mapping tables are unavailable.
    if (clinicDetailsResult.error) {
      console.warn('Unable to load provider clinic details for gaze overview', clinicDetailsResult.error);
    }

    if (providerServicesResult.error) {
      console.warn('Unable to load active provider services for gaze overview', providerServicesResult.error);
    }

    if (coverageResult.error) {
      console.warn('Unable to load provider service pincodes for gaze overview', coverageResult.error);
    }


    // Hydrate customer names and pincode/city context for the booking window.
    // Bookings carry home-visit coordinates directly, but pincode/city are
    // resolved from the customer's saved addresses (default address preferred),
    // matching the admin bookings queue behavior.
    const bookingRows = bookingsResult.data ?? [];
    const userIds = Array.from(
      new Set(
        bookingRows
          .map((row) => row.user_id?.trim())
          .filter((userId): userId is string => Boolean(userId)),
      ),
    );

    const [usersResult, userAddressesResult] = await Promise.all([
      userIds.length > 0
        ? adminSupabase
            .from('users')
            .select('id, name')
            .in('id', userIds)
            .limit(1000)
            .returns<GazeUserRow[]>()
        : Promise.resolve({ data: [] as GazeUserRow[], error: null }),
      userIds.length > 0
        ? adminSupabase
            .from('user_addresses')
            .select('user_id, pincode, city, is_default')
            .in('user_id', userIds)
            .limit(3000)
            .returns<GazeUserAddressRow[]>()
        : Promise.resolve({ data: [] as GazeUserAddressRow[], error: null }),
    ]);

    if (usersResult.error) {
      console.warn('Unable to load customer names for gaze overview', usersResult.error);
    }

    if (userAddressesResult.error) {
      if (userAddressesResult.error.code !== '42P01') {
        console.warn('Unable to load customer addresses for gaze overview', userAddressesResult.error);
      }
    }

    const customerNameByUserId = new Map<string, string | null>();

    for (const row of usersResult.data ?? []) {
      customerNameByUserId.set(row.id, row.name?.trim() || null);
    }

    const preferredAddressByUserId = new Map<string, GazeUserAddressRow>();

    for (const address of userAddressesResult.data ?? []) {
      const userId = address.user_id?.trim();

      if (!userId) {
        continue;
      }

      const existing = preferredAddressByUserId.get(userId);
      if (!existing || address.is_default === true) {
        preferredAddressByUserId.set(userId, address);
      }
    }

    const providerNameById = new Map<number, string>();

    for (const provider of providersResult.data ?? []) {
      providerNameById.set(provider.id, provider.name);
    }

    const bookingPoints: GazeBookingPoint[] = [];

    for (const row of bookingRows) {
      const effectiveStatus = normalizeBookingStatusValue(row.booking_status ?? row.status);
      const dateKey = resolveGazeDateKey({ bookingDate: row.booking_date, bookingStart: row.booking_start });

      // Precise window filtering on the resolved date key (the DB range above is
      // padded by one day on each side to be timezone-safe). "All time" skips
      // the date window entirely, so even legacy rows without a resolvable
      // date are included.
      if (range.fromDate !== null && (!dateKey || dateKey < range.fromDate)) {
        continue;
      }

      if (range.toDate !== null && (!dateKey || dateKey > range.toDate)) {
        continue;
      }

      if (statusFilter && effectiveStatus !== statusFilter) {
        continue;
      }

      const effectiveMode = normalizeBookingModeValue(row.booking_mode);

      if (modeFilter && effectiveMode !== modeFilter) {
        continue;
      }

      if (providerFilterId && row.provider_id !== providerFilterId) {
        continue;
      }

      const userId = row.user_id?.trim() || null;
      const address = userId ? preferredAddressByUserId.get(userId) : undefined;
      const amountInr =
        toFiniteNumberOrNull(row.final_price) ??
        toFiniteNumberOrNull(row.amount) ??
        toFiniteNumberOrNull(row.price_at_booking);

      bookingPoints.push({
        id: row.id,
        userId,
        latitude: toMappableCoordinateOrNull(row.latitude),
        longitude: toMappableCoordinateOrNull(row.longitude),
        pincode: normalizeGazePincode(address?.pincode),
        city: address?.city?.trim() || null,
        locationAddress: row.location_address?.trim() || null,
        bookingDate: dateKey,
        startTime: row.start_time?.trim() || null,
        status: effectiveStatus,
        bookingMode: effectiveMode,
        providerId: row.provider_id,
        providerName: providerNameById.get(row.provider_id) ?? null,
        customerName: (userId ? customerNameByUserId.get(userId) : undefined) ?? null,
        amountInr,
      });
    }


    // Provider points: prefer clinic coordinates (clinics) over the provider
    // base lat/lng (home-visit professionals).
    const clinicByProviderId = new Map<number, GazeClinicDetailRow>();

    for (const row of clinicDetailsResult.data ?? []) {
      clinicByProviderId.set(row.provider_id, row);
    }

    const providerPoints: GazeProviderPoint[] = (providersResult.data ?? []).map((row) => {
      const clinic = clinicByProviderId.get(row.id);

      return {
        id: row.id,
        name: row.name,
        providerType: row.provider_type?.trim() || null,
        accountStatus: row.account_status?.trim() || null,
        approvalStatus: row.admin_approval_status?.trim() || null,
        latitude: toMappableCoordinateOrNull(clinic?.latitude) ?? toMappableCoordinateOrNull(row.lat),
        longitude: toMappableCoordinateOrNull(clinic?.longitude) ?? toMappableCoordinateOrNull(row.lng),
        pincode: normalizeGazePincode(clinic?.pincode),
        city: clinic?.city?.trim() || null,
        serviceRadiusKm: toFiniteNumberOrNull(row.service_radius_km),
      };
    });

    // Coverage: enabled pincodes mapped through active provider services only.
    const providerIdByServiceId = new Map<string, number>();

    for (const row of providerServicesResult.data ?? []) {
      if (row.id != null && Number.isFinite(row.provider_id)) {
        providerIdByServiceId.set(String(row.id).trim(), Number(row.provider_id));
      }
    }

    const coveragePincodesByProvider = new Map<number, Set<string>>();

    for (const row of coverageResult.data ?? []) {
      if (row.is_enabled !== true) {
        continue;
      }

      const serviceKey = row.provider_service_id == null ? null : String(row.provider_service_id).trim();
      const providerId = serviceKey ? providerIdByServiceId.get(serviceKey) : undefined;

      if (providerId == null) {
        continue;
      }

      // Coverage from suspended, banned, or unapproved providers is excluded so
      // it cannot mask demand gaps on the active coverage view.
      if (!providerNameById.has(providerId)) {
        continue;
      }

      const pincode = normalizeGazePincode(row.pincode);

      if (!pincode) {
        continue;
      }

      const pincodes = coveragePincodesByProvider.get(providerId) ?? new Set<string>();
      pincodes.add(pincode);
      coveragePincodesByProvider.set(providerId, pincodes);
    }

    const coverage: GazeCoverageEntry[] = Array.from(coveragePincodesByProvider.entries())
      .map(([providerId, pincodes]) => ({
        providerId,
        providerName: providerNameById.get(providerId) ?? `Provider #${providerId}`,
        pincodes: Array.from(pincodes).sort(),
      }))
      .sort((left, right) => left.providerName.localeCompare(right.providerName));

    const pincodeStats = aggregateBookingsByPincode(bookingPoints);
    const coverageGaps = computeCoverageGaps(pincodeStats, coverage);
    const kpis = buildGazeKpis({
      bookings: bookingPoints,
      pincodeStats,
      providers: providerPoints,
      coverageGaps,
      todayKey: range.todayKey,
    });

    const response: GazeOverviewResponse = {
      bookings: bookingPoints,
      providers: providerPoints,
      pincodeStats,
      coverage,
      coverageGaps,
      kpis,
      window: {
        key: windowKey,
        fromDate: range.fromDate,
        toDate: range.toDate,
      },
      bookingsTruncated: bookingRows.length >= BOOKING_POINT_LIMIT,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const friendly = toFriendlyApiError(error, 'Unable to load the gaze overview');
    return NextResponse.json({ error: friendly.message }, { status: friendly.status });
  }
}
