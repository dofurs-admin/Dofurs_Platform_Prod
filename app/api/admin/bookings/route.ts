import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
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
  included_services?: string[];
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
        admin_price_reference: null,
        price_at_booking: null,
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
            .select('booking_id')
            .in('booking_id', bookingIds)
            .eq('status', 'paid'),
        ]);

        const paymentModeByBookingId = new Map<number, string | null>();
        for (const row of paymentModes ?? []) {
          paymentModeByBookingId.set(Number(row.id), row.payment_mode ?? null);
        }

        const paidBookingIds = new Set<number>((paidCollections ?? []).map((row) => Number(row.booking_id)));

        for (const booking of filteredBookings) {
          booking.payment_mode = paymentModeByBookingId.get(booking.id) ?? booking.payment_mode ?? null;
          booking.cash_collected = paidBookingIds.has(booking.id);
        }

        const {
          includedServicesByBookingId,
          adminPriceReferenceByBookingId,
          priceAtBookingByBookingId,
        } = await hydrateBookingEnrichmentById(
          adminSupabase,
          bookingIds,
        );

        for (const booking of filteredBookings) {
          booking.included_services = includedServicesByBookingId.get(booking.id) ?? [];
          booking.admin_price_reference = adminPriceReferenceByBookingId.get(booking.id) ?? null;
          booking.price_at_booking = priceAtBookingByBookingId.get(booking.id) ?? null;
        }
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
        .select('booking_id')
        .in('booking_id', bookingIds)
        .eq('status', 'paid');

      const paidBookingIds = new Set<number>((paidCollections ?? []).map((row) => Number(row.booking_id)));
      for (const booking of bookings) {
        booking.cash_collected = paidBookingIds.has(booking.id);
      }

      const {
        includedServicesByBookingId,
        adminPriceReferenceByBookingId,
        priceAtBookingByBookingId,
      } = await hydrateBookingEnrichmentById(
        adminSupabase,
        bookingIds,
      );

      for (const booking of bookings) {
        booking.included_services = includedServicesByBookingId.get(booking.id) ?? [];
        booking.admin_price_reference = adminPriceReferenceByBookingId.get(booking.id) ?? null;
        booking.price_at_booking = priceAtBookingByBookingId.get(booking.id) ?? null;
      }
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
