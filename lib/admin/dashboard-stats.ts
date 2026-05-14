import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { countServiceUnitsForBooking } from '@/lib/bookings/included-services';

const CUSTOMER_COUNT_PAGE_SIZE = 1000;
const SERVICE_UNIT_COUNT_PAGE_SIZE = 1000;

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type AdminDashboardBookingRiskSummary = {
  pending: number;
  inProgress: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

export type AdminDashboardBusinessStats = {
  bookingCount: number;
  bookingServiceUnitCount: number;
  bookingRiskSummary: AdminDashboardBookingRiskSummary;
  providerCount: number;
  serviceCount: number;
  customerCount: number;
  activeDiscountCount: number;
};

type CountResult = {
  count: number | null;
  error: PostgrestError | null;
};

type BookingCustomerRow = {
  user_id: string | null;
};

type BookingServiceUnitRow = {
  service_type: string | null;
  provider_service_id: string | null;
  provider_notes: string | null;
  internal_notes: string | null;
  admin_price_reference: number | null;
  price_at_booking: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function isMissingFunctionError(error: PostgrestError) {
  return error.code === '42883' || error.code === 'PGRST202';
}

function isMissingTableError(error: PostgrestError) {
  return error.code === '42P01';
}

function readCount(result: CountResult, options?: { missingTableAsZero?: boolean }) {
  if (result.error) {
    if (options?.missingTableAsZero && isMissingTableError(result.error)) {
      return 0;
    }
    throw result.error;
  }

  return result.count ?? 0;
}

export function normalizeAdminDashboardBusinessStats(value: unknown): AdminDashboardBusinessStats | null {
  const payload = Array.isArray(value) ? value[0] : value;

  if (!isRecord(payload) || (!('bookingCount' in payload) && !('booking_count' in payload))) {
    return null;
  }

  const riskSummary = isRecord(payload.bookingRiskSummary)
    ? payload.bookingRiskSummary
    : isRecord(payload.booking_risk_summary)
      ? payload.booking_risk_summary
      : payload;

  const pending = toCount(riskSummary.pending ?? riskSummary.pending_bookings);
  const confirmed = toCount(riskSummary.confirmed ?? riskSummary.confirmed_bookings);

  const bookingCount = toCount(payload.bookingCount ?? payload.booking_count);
  const bookingServiceUnitCount = toCount(
    payload.bookingServiceUnitCount ?? payload.booking_service_unit_count,
  );

  return {
    bookingCount,
    bookingServiceUnitCount: bookingServiceUnitCount || bookingCount,
    bookingRiskSummary: {
      pending,
      inProgress: toCount(riskSummary.inProgress ?? riskSummary.in_progress ?? riskSummary.in_progress_bookings) || pending + confirmed,
      completed: toCount(riskSummary.completed ?? riskSummary.completed_bookings),
      noShow: toCount(riskSummary.noShow ?? riskSummary.no_show ?? riskSummary.no_show_bookings),
      cancelled: toCount(riskSummary.cancelled ?? riskSummary.cancelled_bookings),
    },
    providerCount: toCount(payload.providerCount ?? payload.provider_count),
    serviceCount: toCount(payload.serviceCount ?? payload.service_count),
    customerCount: toCount(payload.customerCount ?? payload.customer_count),
    activeDiscountCount: toCount(payload.activeDiscountCount ?? payload.active_discount_count),
  };
}

async function countBookingServiceUnits(supabase: SupabaseClient) {
  let total = 0;

  for (let from = 0; ; from += SERVICE_UNIT_COUNT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('bookings')
      .select('service_type, provider_service_id, provider_notes, internal_notes, admin_price_reference, price_at_booking')
      .order('id', { ascending: true })
      .range(from, from + SERVICE_UNIT_COUNT_PAGE_SIZE - 1)
      .returns<BookingServiceUnitRow[]>();

    if (error) {
      throw error;
    }

    for (const booking of data ?? []) {
      total += countServiceUnitsForBooking(booking);
    }

    if (!data || data.length < SERVICE_UNIT_COUNT_PAGE_SIZE) {
      break;
    }
  }

  return total;
}

async function countEffectiveBookingStatus(supabase: SupabaseClient, status: BookingStatus) {
  const [bookingStatusResult, legacyStatusResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('booking_status', status),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .is('booking_status', null)
      .eq('status', status),
  ]);

  return readCount(bookingStatusResult) + readCount(legacyStatusResult);
}

async function countDistinctBookingCustomers(supabase: SupabaseClient) {
  const customerIds = new Set<string>();

  for (let from = 0; ; from += CUSTOMER_COUNT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('bookings')
      .select('user_id')
      .not('user_id', 'is', null)
      .range(from, from + CUSTOMER_COUNT_PAGE_SIZE - 1)
      .returns<BookingCustomerRow[]>();

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const customerId = row.user_id?.trim().toLowerCase();
      if (customerId) {
        customerIds.add(customerId);
      }
    }

    if (!data || data.length < CUSTOMER_COUNT_PAGE_SIZE) {
      break;
    }
  }

  return customerIds.size;
}

async function loadAdminDashboardBusinessStatsFallback(supabase: SupabaseClient): Promise<AdminDashboardBusinessStats> {
  const [
    bookingCountResult,
    pending,
    confirmed,
    completed,
    cancelled,
    noShow,
    providerCountResult,
    serviceCountResult,
    customerCount,
    bookingServiceUnitCount,
    activeDiscountCountResult,
  ] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
    countEffectiveBookingStatus(supabase, 'pending'),
    countEffectiveBookingStatus(supabase, 'confirmed'),
    countEffectiveBookingStatus(supabase, 'completed'),
    countEffectiveBookingStatus(supabase, 'cancelled'),
    countEffectiveBookingStatus(supabase, 'no_show'),
    supabase.from('providers').select('id', { count: 'exact', head: true }),
    supabase
      .from('provider_services')
      .select('id', { count: 'exact', head: true })
      .is('provider_id', null),
    countDistinctBookingCustomers(supabase),
    countBookingServiceUnits(supabase),
    supabase
      .from('platform_discounts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ]);

  return {
    bookingCount: readCount(bookingCountResult),
    bookingServiceUnitCount,
    bookingRiskSummary: {
      pending,
      inProgress: pending + confirmed,
      completed,
      noShow,
      cancelled,
    },
    providerCount: readCount(providerCountResult),
    serviceCount: readCount(serviceCountResult),
    customerCount,
    activeDiscountCount: readCount(activeDiscountCountResult, { missingTableAsZero: true }),
  };
}

export async function loadAdminDashboardBusinessStats(supabase: SupabaseClient): Promise<AdminDashboardBusinessStats> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_business_stats');

  if (!error) {
    const stats = normalizeAdminDashboardBusinessStats(data);
    if (stats) {
      try {
        return {
          ...stats,
          bookingServiceUnitCount: await countBookingServiceUnits(supabase),
        };
      } catch {
        return stats;
      }
    }
  } else if (!isMissingFunctionError(error)) {
    throw error;
  }

  return loadAdminDashboardBusinessStatsFallback(supabase);
}
