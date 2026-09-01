import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  extractBundledPetIdsFromNotes,
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';
import { BOOKING_MODES, BOOKING_STATUSES, type BookingMode, type BookingStatus } from '@/lib/bookings/types';

const BOOKING_QUEUE_FILTERS = ['all', 'sla', 'high-risk', ...BOOKING_STATUSES] as const;
type BookingFilter = (typeof BOOKING_QUEUE_FILTERS)[number];

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(BOOKING_QUEUE_FILTERS).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

type BookingSearchRow = {
  id: number;
  user_id: string;
  provider_id: number;
  booking_start: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: BookingStatus;
  booking_status: BookingStatus | null;
  booking_mode: BookingMode | null;
  service_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  provider_name: string | null;
  completion_task_status: 'pending' | 'completed' | null;
  completion_due_at: string | null;
  completion_completed_at: string | null;
  admin_price_reference: number | null;
  price_at_booking: number | null;
  payment_mode: string | null;
  cash_collected: boolean;
  collected_amount_inr: number | null;
  included_services?: string[];
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  city: string | null;
  pet_names: string | null;
  pet_breed: string | null;
  discount_code: string | null;
  discount_amount: number | null;
  wallet_credits_applied_inr: number | null;
  amount: number | null;
  final_price: number | null;
  created_at: string | null;
  cancellation_reason: string | null;
};

type BookingServiceSourceRow = {
  id: number;
  service_type: string | null;
  provider_service_id: string | null;
  provider_notes: string | null;
  internal_notes: string | null;
  admin_price_reference: number | null;
  price_at_booking: number | null;
};

async function hydrateBookingEnrichmentById(
  adminSupabase: ReturnType<typeof getSupabaseAdminClient>,
  bookingIds: number[],
) {
  const includedServicesByBookingId = new Map<number, string[]>();
  const adminPriceReferenceByBookingId = new Map<number, number | null>();
  const priceAtBookingByBookingId = new Map<number, number | null>();

  if (bookingIds.length === 0) {
    return {
      includedServicesByBookingId,
      adminPriceReferenceByBookingId,
      priceAtBookingByBookingId,
    };
  }

  const { data: bookingRows, error: bookingRowsError } = await adminSupabase
    .from('bookings')
    .select(
      'id, service_type, provider_service_id, provider_notes, internal_notes, admin_price_reference, price_at_booking',
    )
    .in('id', bookingIds)
    .returns<BookingServiceSourceRow[]>();

  if (bookingRowsError) {
    console.warn('Unable to hydrate bundled service lines for admin bookings', bookingRowsError);
    return {
      includedServicesByBookingId,
      adminPriceReferenceByBookingId,
      priceAtBookingByBookingId,
    };
  }

  const referencedProviderServiceIds = new Set<string>();

  for (const booking of bookingRows ?? []) {
    const adminPriceReference = Number(booking.admin_price_reference ?? NaN);
    adminPriceReferenceByBookingId.set(
      booking.id,
      Number.isFinite(adminPriceReference) ? adminPriceReference : null,
    );

    const priceAtBooking = Number(booking.price_at_booking ?? NaN);
    priceAtBookingByBookingId.set(
      booking.id,
      Number.isFinite(priceAtBooking) ? priceAtBooking : null,
    );

    const providerServiceId = booking.provider_service_id?.trim();
    if (providerServiceId) {
      referencedProviderServiceIds.add(providerServiceId);
    }

    for (const serviceId of extractProviderServiceIdsFromNotes(booking.provider_notes)) {
      referencedProviderServiceIds.add(serviceId);
    }

    for (const serviceId of extractProviderServiceIdsFromNotes(booking.internal_notes)) {
      referencedProviderServiceIds.add(serviceId);
    }
  }

  const serviceNameByProviderServiceId = new Map<string, string>();
  const serviceBasePriceByProviderServiceId = new Map<string, number>();

  if (referencedProviderServiceIds.size > 0) {
    const { data: providerServiceRows, error: providerServiceError } = await adminSupabase
      .from('provider_services')
      .select('id, service_type, base_price')
      .in('id', Array.from(referencedProviderServiceIds))
      .returns<Array<{ id: string; service_type: string | null; base_price: number | null }>>();

    if (providerServiceError) {
      console.warn('Unable to map provider service labels for admin booking bundles', providerServiceError);
    } else {
      for (const row of providerServiceRows ?? []) {
        const serviceType = row.service_type?.trim();
        if (serviceType) {
          serviceNameByProviderServiceId.set(row.id, serviceType);
        }

        const basePrice = Number(row.base_price ?? NaN);
        if (Number.isFinite(basePrice) && basePrice > 0) {
          serviceBasePriceByProviderServiceId.set(row.id, basePrice);
        }
      }
    }
  }

  for (const booking of bookingRows ?? []) {
    includedServicesByBookingId.set(
      booking.id,
      resolveIncludedServicesForBooking(booking, {
        serviceNameByProviderServiceId,
        serviceBasePriceByProviderServiceId,
      }),
    );
  }

  return {
    includedServicesByBookingId,
    adminPriceReferenceByBookingId,
    priceAtBookingByBookingId,
  };
}

type BookingLocationPricingSourceRow = {
  id: number;
  user_id: string | null;
  pet_id: number | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  discount_code?: string | null;
  discount_amount?: number | null;
  wallet_credits_applied_inr?: number | null;
  amount?: number | null;
  final_price?: number | null;
  created_at?: string | null;
  cancellation_reason?: string | null;
  provider_notes?: string | null;
  internal_notes?: string | null;
};

type PetSourceRow = {
  id: number;
  name: string | null;
  breed: string | null;
};

type UserAddressSourceRow = {
  user_id: string;
  city: string | null;
  pincode: string | null;
  is_default: boolean | null;
};

type BookingLocationPetPricingHydration = {
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  city: string | null;
  pet_names: string | null;
  pet_breed: string | null;
  discount_code: string | null;
  discount_amount: number | null;
  wallet_credits_applied_inr: number | null;
  amount: number | null;
  final_price: number | null;
  created_at: string | null;
  cancellation_reason: string | null;
};

const BOOKING_LOCATION_PET_PRICING_SELECT =
  'id, user_id, pet_id, location_address, latitude, longitude, discount_code, discount_amount, wallet_credits_applied_inr, amount, final_price, created_at, cancellation_reason, provider_notes, internal_notes';

// Columns that have existed on bookings since the initial schema; used when the
// full select fails because a legacy database is missing the newer columns.
const BOOKING_LOCATION_PET_PRICING_SELECT_CORE = 'id, user_id, pet_id, amount, created_at';

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
}

function isMissingColumnError(error: unknown) {
  const code = getErrorCode(error);
  if (code === '42703' || code === 'PGRST204') {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('column') && (message.includes('does not exist') || message.includes('could not find'))
  );
}

function isMissingRelationError(error: unknown) {
  const code = getErrorCode(error);
  if (code === '42P01') {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes('relation') && message.includes('does not exist');
}

function toFiniteNumberOrNull(value: unknown): number | null {
  const parsed = Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function joinDistinctLabels(values: ReadonlyArray<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    labels.push(trimmed);
  }

  return labels.length > 0 ? labels.join('; ') : null;
}

/**
 * Hydrates admin booking rows with location, pet, and pricing fields that the
 * admin_search_bookings RPC does not return. Fetches are batched by booking ID
 * and degrade gracefully (returning nulls) when legacy databases are missing
 * the underlying columns or tables.
 *
 * Pincode/city are best-effort values resolved from the customer's saved
 * addresses (preferring the default address) because bookings has no pincode
 * column.
 */
async function hydrateBookingLocationPetAndPricingById(
  adminSupabase: ReturnType<typeof getSupabaseAdminClient>,
  bookingIds: number[],
) {
  const hydrationByBookingId = new Map<number, BookingLocationPetPricingHydration>();

  if (bookingIds.length === 0) {
    return hydrationByBookingId;
  }

  const fullSelect = await adminSupabase
    .from('bookings')
    .select(BOOKING_LOCATION_PET_PRICING_SELECT)
    .in('id', bookingIds)
    .returns<BookingLocationPricingSourceRow[]>();

  let bookingRows: BookingLocationPricingSourceRow[] = [];

  if (fullSelect.error) {
    if (!isMissingColumnError(fullSelect.error)) {
      console.warn('Unable to hydrate booking location/pet/pricing fields', fullSelect.error);
      return hydrationByBookingId;
    }

    const coreSelect = await adminSupabase
      .from('bookings')
      .select(BOOKING_LOCATION_PET_PRICING_SELECT_CORE)
      .in('id', bookingIds)
      .returns<BookingLocationPricingSourceRow[]>();

    if (coreSelect.error) {
      console.warn('Unable to hydrate booking location/pet/pricing fields (core fallback)', coreSelect.error);
      return hydrationByBookingId;
    }

    bookingRows = coreSelect.data ?? [];
  } else {
    bookingRows = fullSelect.data ?? [];
  }

  const petIds = new Set<number>();
  for (const row of bookingRows) {
    const primaryPetId = toFiniteNumberOrNull(row.pet_id);
    if (primaryPetId != null) {
      petIds.add(primaryPetId);
    }

    for (const bundledPetId of extractBundledPetIdsFromNotes(row.provider_notes)) {
      petIds.add(bundledPetId);
    }

    for (const bundledPetId of extractBundledPetIdsFromNotes(row.internal_notes)) {
      petIds.add(bundledPetId);
    }
  }

  const petById = new Map<number, PetSourceRow>();

  if (petIds.size > 0) {
    const { data: petRows, error: petError } = await adminSupabase
      .from('pets')
      .select('id, name, breed')
      .in('id', Array.from(petIds))
      .returns<PetSourceRow[]>();

    if (petError) {
      console.warn('Unable to hydrate pet details for admin bookings', petError);
    } else {
      for (const pet of petRows ?? []) {
        petById.set(Number(pet.id), pet);
      }
    }
  }

  const userIds = Array.from(
    new Set(
      bookingRows
        .map((row) => row.user_id?.trim())
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  const preferredAddressByUserId = new Map<string, UserAddressSourceRow>();

  if (userIds.length > 0) {
    const { data: addressRows, error: addressError } = await adminSupabase
      .from('user_addresses')
      .select('user_id, city, pincode, is_default')
      .in('user_id', userIds)
      .returns<UserAddressSourceRow[]>();

    if (addressError) {
      if (!isMissingRelationError(addressError)) {
        console.warn('Unable to hydrate customer addresses for admin bookings', addressError);
      }
    } else {
      for (const address of addressRows ?? []) {
        const userId = address.user_id?.trim();
        if (!userId) {
          continue;
        }

        const existing = preferredAddressByUserId.get(userId);
        if (!existing || address.is_default === true) {
          preferredAddressByUserId.set(userId, address);
        }
      }
    }
  }

  for (const row of bookingRows) {
    const orderedPetIds: number[] = [];

    const primaryPetId = toFiniteNumberOrNull(row.pet_id);
    if (primaryPetId != null) {
      orderedPetIds.push(primaryPetId);
    }

    for (const bundledPetId of [
      ...extractBundledPetIdsFromNotes(row.provider_notes),
      ...extractBundledPetIdsFromNotes(row.internal_notes),
    ]) {
      if (!orderedPetIds.includes(bundledPetId)) {
        orderedPetIds.push(bundledPetId);
      }
    }

    const petsForBooking = orderedPetIds
      .map((petId) => petById.get(petId))
      .filter((pet): pet is PetSourceRow => pet != null);

    const addressUserId = row.user_id?.trim();
    const address = addressUserId ? preferredAddressByUserId.get(addressUserId) : undefined;

    hydrationByBookingId.set(Number(row.id), {
      location_address: row.location_address?.trim() || null,
      latitude: toFiniteNumberOrNull(row.latitude),
      longitude: toFiniteNumberOrNull(row.longitude),
      pincode: address?.pincode?.trim() || null,
      city: address?.city?.trim() || null,
      pet_names: joinDistinctLabels(petsForBooking.map((pet) => pet.name)),
      pet_breed: joinDistinctLabels(petsForBooking.map((pet) => pet.breed)),
      discount_code: row.discount_code?.trim() || null,
      discount_amount: toFiniteNumberOrNull(row.discount_amount),
      wallet_credits_applied_inr: toFiniteNumberOrNull(row.wallet_credits_applied_inr),
      amount: toFiniteNumberOrNull(row.amount),
      final_price: toFiniteNumberOrNull(row.final_price),
      created_at: row.created_at ?? null,
      cancellation_reason: row.cancellation_reason?.trim() || null,
    });
  }

  return hydrationByBookingId;
}

function applyBookingLocationPetPricingHydration(
  bookings: BookingSearchRow[],
  hydrationByBookingId: ReadonlyMap<number, BookingLocationPetPricingHydration>,
) {
  for (const booking of bookings) {
    const hydration = hydrationByBookingId.get(booking.id);
    booking.location_address = hydration?.location_address ?? null;
    booking.latitude = hydration?.latitude ?? null;
    booking.longitude = hydration?.longitude ?? null;
    booking.pincode = hydration?.pincode ?? null;
    booking.city = hydration?.city ?? null;
    booking.pet_names = hydration?.pet_names ?? null;
    booking.pet_breed = hydration?.pet_breed ?? null;
    booking.discount_code = hydration?.discount_code ?? null;
    booking.discount_amount = hydration?.discount_amount ?? null;
    booking.wallet_credits_applied_inr = hydration?.wallet_credits_applied_inr ?? null;
    booking.amount = hydration?.amount ?? null;
    booking.final_price = hydration?.final_price ?? null;
    booking.created_at = hydration?.created_at ?? null;
    booking.cancellation_reason = hydration?.cancellation_reason ?? null;
  }
}

function normalizeBookingStatus(value: unknown): BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : 'pending';
}

function normalizeNullableBookingStatus(value: unknown): BookingStatus | null {
  if (value == null) return null;
  return BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : null;
}

function normalizeNullableBookingMode(value: unknown): BookingMode | null {
  if (value == null) return null;
  return BOOKING_MODES.includes(value as BookingMode) ? (value as BookingMode) : null;
}

function getEffectiveBookingStatus(booking: Pick<BookingSearchRow, 'booking_status' | 'status'>): BookingStatus {
  return booking.booking_status ?? booking.status;
}

function matchesBookingFilter(booking: Pick<BookingSearchRow, 'booking_status' | 'status'>, filter: BookingFilter) {
  const effectiveStatus = getEffectiveBookingStatus(booking);

  if (filter === 'all') {
    return true;
  }

  if (filter === 'sla') {
    return effectiveStatus === 'pending';
  }

  if (filter === 'high-risk') {
    return effectiveStatus === 'cancelled' || effectiveStatus === 'no_show';
  }

  return effectiveStatus === filter;
}

function resolveBookingDateKey(booking: Pick<BookingSearchRow, 'booking_date' | 'booking_start'>): string | null {
  const normalizedBookingDate = booking.booking_date?.trim();
  if (normalizedBookingDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedBookingDate)) {
    return normalizedBookingDate;
  }

  const normalizedBookingStart = booking.booking_start?.trim();
  if (!normalizedBookingStart) {
    return null;
  }

  const bookingStartDate = normalizedBookingStart.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(bookingStartDate)) {
    return bookingStartDate;
  }

  const parsedDate = new Date(normalizedBookingStart);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function matchesBookingDateRange(
  booking: Pick<BookingSearchRow, 'booking_date' | 'booking_start'>,
  fromDate?: string,
  toDate?: string,
) {
  if (!fromDate && !toDate) {
    return true;
  }

  const bookingDateKey = resolveBookingDateKey(booking);
  if (!bookingDateKey) {
    return false;
  }

  if (fromDate && bookingDateKey < fromDate) {
    return false;
  }

  if (toDate && bookingDateKey > toDate) {
    return false;
  }

  return true;
}

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user, role } = auth.context;
  const adminSupabase = getSupabaseAdminClient();
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    filter: url.searchParams.get('filter') ?? undefined,
    fromDate: url.searchParams.get('fromDate') ?? undefined,
    toDate: url.searchParams.get('toDate') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data.q?.trim() || undefined;
  const filter = parsed.data.filter ?? 'all';
  const fromDate = parsed.data.fromDate;
  const toDate = parsed.data.toDate;
  const limit = parsed.data.limit ?? 200;

  if (fromDate && toDate && fromDate > toDate) {
    return NextResponse.json({ error: 'fromDate cannot be after toDate' }, { status: 400 });
  }

  try {
    const { data, error } = await adminSupabase.rpc('admin_search_bookings', {
      p_query: query,
      p_filter: filter,
      p_limit: limit,
    });

    if (!error) {
      const bookings = ((data ?? []) as Array<Partial<BookingSearchRow>>).map((row) => ({
        ...row,
        status: normalizeBookingStatus(row.status),
        booking_status: normalizeNullableBookingStatus(row.booking_status),
        booking_mode: normalizeNullableBookingMode(row.booking_mode),
        payment_mode: row.payment_mode ?? null,
        cash_collected: Boolean(row.cash_collected ?? false),
        collected_amount_inr: null,
        admin_price_reference: null,
        price_at_booking: null,
        location_address: null,
        latitude: null,
        longitude: null,
        pincode: null,
        city: null,
        pet_names: null,
        pet_breed: null,
        discount_code: null,
        discount_amount: null,
        wallet_credits_applied_inr: null,
        amount: null,
        final_price: null,
        created_at: null,
        cancellation_reason: null,
      })) as BookingSearchRow[];
      const filteredBookings = bookings.filter((booking) => (
        matchesBookingDateRange(booking, fromDate, toDate)
        && matchesBookingFilter(booking, filter)
      ));

      const bookingIds = filteredBookings.map((booking) => booking.id).filter((id): id is number => Number.isFinite(id));

      if (bookingIds.length > 0) {
        const [{ data: paymentModes }, { data: paidCollections }] = await Promise.all([
          adminSupabase
            .from('bookings')
            .select('id, payment_mode')
            .in('id', bookingIds),
          adminSupabase
            .from('booking_payment_collections')
            .select('booking_id, amount_inr')
            .in('booking_id', bookingIds)
            .eq('status', 'paid'),
        ]);

        const paymentModeByBookingId = new Map<number, string | null>();
        for (const row of paymentModes ?? []) {
          paymentModeByBookingId.set(Number(row.id), row.payment_mode ?? null);
        }

        const paidBookingIds = new Set<number>((paidCollections ?? []).map((row) => Number(row.booking_id)));
        const collectedAmountByBookingId = new Map<number, number>();

        for (const row of paidCollections ?? []) {
          const amount = Number(row.amount_inr ?? NaN);
          if (Number.isFinite(amount)) {
            collectedAmountByBookingId.set(Number(row.booking_id), amount);
          }
        }

        for (const booking of filteredBookings) {
          booking.payment_mode = paymentModeByBookingId.get(booking.id) ?? booking.payment_mode ?? null;
          booking.cash_collected = paidBookingIds.has(booking.id);
          booking.collected_amount_inr = collectedAmountByBookingId.get(booking.id) ?? null;
        }

        const [
          enrichmentResult,
          locationPetPricingByBookingId,
        ] = await Promise.all([
          hydrateBookingEnrichmentById(
            adminSupabase,
            bookingIds,
          ),
          hydrateBookingLocationPetAndPricingById(
            adminSupabase,
            bookingIds,
          ),
        ]);

        const {
          includedServicesByBookingId,
          adminPriceReferenceByBookingId,
          priceAtBookingByBookingId,
        } = enrichmentResult;

        for (const booking of filteredBookings) {
          booking.included_services = includedServicesByBookingId.get(booking.id) ?? [];
          booking.admin_price_reference = adminPriceReferenceByBookingId.get(booking.id) ?? null;
          booking.price_at_booking = priceAtBookingByBookingId.get(booking.id) ?? null;
        }

        applyBookingLocationPetPricingHydration(filteredBookings, locationPetPricingByBookingId);
      }

      return NextResponse.json({ bookings: filteredBookings });
    }

    if (error.code !== '42883') {
      throw error;
    }

    const fallback = await adminSupabase
      .from('bookings')
      .select('id, user_id, provider_id, booking_start, booking_date, start_time, end_time, status, booking_status, booking_mode, service_type, payment_mode, users(name, email, phone), providers(name), provider_booking_completion_tasks(task_status, due_at, completed_at)')
      .order('booking_start', { ascending: false })
      .limit(limit);

    if (fallback.error) {
      throw fallback.error;
    }

    const normalizedQuery = query?.toLowerCase() ?? '';

    const bookings: BookingSearchRow[] = (fallback.data ?? [])
      .map((row) => {
        const userData = (Array.isArray(row.users) ? row.users[0] : row.users) as
          | { name: string | null; email: string | null; phone: string | null }
          | null;
        const providerData = (Array.isArray(row.providers) ? row.providers[0] : row.providers) as { name: string | null } | null;
        const taskData = (
          Array.isArray(row.provider_booking_completion_tasks)
            ? row.provider_booking_completion_tasks[0]
            : row.provider_booking_completion_tasks
        ) as { task_status: 'pending' | 'completed' | null; due_at: string | null; completed_at: string | null } | null;

        return {
          id: row.id,
          user_id: row.user_id,
          provider_id: row.provider_id,
          booking_start: row.booking_start,
          booking_date: row.booking_date,
          start_time: row.start_time,
          end_time: row.end_time,
          status: normalizeBookingStatus(row.status),
          booking_status: normalizeNullableBookingStatus(row.booking_status),
          booking_mode: normalizeNullableBookingMode(row.booking_mode),
          service_type: row.service_type,
          customer_name: userData?.name ?? null,
          customer_email: userData?.email ?? null,
          customer_phone: userData?.phone ?? null,
          provider_name: providerData?.name ?? null,
          completion_task_status: taskData?.task_status ?? null,
          completion_due_at: taskData?.due_at ?? null,
          completion_completed_at: taskData?.completed_at ?? null,
          admin_price_reference: null,
          price_at_booking: null,
          payment_mode: row.payment_mode ?? null,
          cash_collected: false,
          collected_amount_inr: null,
          location_address: null,
          latitude: null,
          longitude: null,
          pincode: null,
          city: null,
          pet_names: null,
          pet_breed: null,
          discount_code: null,
          discount_amount: null,
          wallet_credits_applied_inr: null,
          amount: null,
          final_price: null,
          created_at: null,
          cancellation_reason: null,
        };
      })
      .filter((booking) => {
        const effectiveStatus = booking.booking_status ?? booking.status;

        if (!matchesBookingDateRange(booking, fromDate, toDate)) {
          return false;
        }

        if (!matchesBookingFilter(booking, filter)) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          booking.id.toString(),
          booking.user_id,
          booking.provider_id.toString(),
          booking.customer_name ?? '',
          booking.customer_email ?? '',
          booking.customer_phone ?? '',
          booking.provider_name ?? '',
          booking.service_type ?? '',
          effectiveStatus,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      });

    const bookingIds = bookings.map((booking) => booking.id);
    if (bookingIds.length > 0) {
      const { data: paidCollections } = await adminSupabase
        .from('booking_payment_collections')
        .select('booking_id, amount_inr')
        .in('booking_id', bookingIds)
        .eq('status', 'paid');

      const paidBookingIds = new Set<number>((paidCollections ?? []).map((row) => Number(row.booking_id)));
      const collectedAmountByBookingId = new Map<number, number>();

      for (const row of paidCollections ?? []) {
        const amount = Number(row.amount_inr ?? NaN);
        if (Number.isFinite(amount)) {
          collectedAmountByBookingId.set(Number(row.booking_id), amount);
        }
      }

      for (const booking of bookings) {
        booking.cash_collected = paidBookingIds.has(booking.id);
        booking.collected_amount_inr = collectedAmountByBookingId.get(booking.id) ?? null;
      }

      const [
        enrichmentResult,
        locationPetPricingByBookingId,
      ] = await Promise.all([
        hydrateBookingEnrichmentById(
          adminSupabase,
          bookingIds,
        ),
        hydrateBookingLocationPetAndPricingById(
          adminSupabase,
          bookingIds,
        ),
      ]);

      const {
        includedServicesByBookingId,
        adminPriceReferenceByBookingId,
        priceAtBookingByBookingId,
      } = enrichmentResult;

      for (const booking of bookings) {
        booking.included_services = includedServicesByBookingId.get(booking.id) ?? [];
        booking.admin_price_reference = adminPriceReferenceByBookingId.get(booking.id) ?? null;
        booking.price_at_booking = priceAtBookingByBookingId.get(booking.id) ?? null;
      }

      applyBookingLocationPetPricingHydration(bookings, locationPetPricingByBookingId);
    }

    return NextResponse.json({ bookings });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load admin bookings');

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/bookings',
      actorId: user.id,
      actorRole: role,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        action: 'list_admin_bookings',
        q: query,
        filter,
        fromDate,
        toDate,
        limit,
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
