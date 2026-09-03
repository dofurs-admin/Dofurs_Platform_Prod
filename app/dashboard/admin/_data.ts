import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAdminServiceModerationSummary,
  getPlatformDiscountAnalytics,
  listAdminProviderModerationItems,
  listPlatformDiscounts,
} from '@/lib/provider-management/service';
import type { PlatformDiscountAnalyticsSummary } from '@/lib/provider-management/types';
import { listServiceProviderApplications } from '@/lib/provider-applications/service';
import { loadAdminDashboardBusinessStats } from '@/lib/admin/dashboard-stats';

/**
 * D2: views that render self-fetching tabs (CRM, Gaze, Health, Audit, Users,
 * Payments, Subscriptions, Billing, Access, Blog) need none of the shared
 * dashboard dataset — they spread these empty props instead of paying for
 * ~10 queries on every admin navigation.
 */
export const EMPTY_ADMIN_DASHBOARD_DATA = {
  initialBookings: [],
  providers: [],
  moderationProviders: [],
  initialProviderApplications: [],
  initialServiceSummary: [],
  initialDiscounts: [],
  initialDiscountAnalytics: {
    total_discounts: 0,
    total_active_discounts: 0,
    total_redemptions: 0,
    total_discount_amount: 0,
    total_bookings: 0,
    booking_redemption_rate: 0,
    top_discounts: [],
  } satisfies PlatformDiscountAnalyticsSummary,
  initialServiceCategories: [],
  initialCatalogServices: [],
};

type LoadAdminDashboardDataOptions = {
  includeBusinessStats?: boolean;
};

export async function loadAdminDashboardData(
  supabase: SupabaseClient,
  options: LoadAdminDashboardDataOptions = {},
) {
  const businessStatsPromise = options.includeBusinessStats
    ? loadAdminDashboardBusinessStats(supabase)
    : Promise.resolve(null);

  const [
    bookingsResult,
    providersResult,
    moderationProviders,
    providerApplications,
    serviceCategoriesResult,
    catalogServicesResult,
    businessStats,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, user_id, provider_id, booking_start, booking_date, start_time, end_time, status, booking_status, booking_mode, service_type, provider_service_id, provider_notes, internal_notes, admin_price_reference, price_at_booking')
      .order('booking_start', { ascending: false })
      .limit(200),
    supabase.from('providers').select('id, name').order('name', { ascending: true }).limit(200),
    listAdminProviderModerationItems(supabase),
    listServiceProviderApplications(supabase),
    supabase
      .from('service_categories')
      .select('*')
      .order('display_order', { ascending: true }),
    supabase
      .from('provider_services')
      .select('*')
      .is('provider_id', null)
      .order('display_order', { ascending: true }),
    businessStatsPromise,
  ]);

  const [serviceModerationSummary, platformDiscounts, discountAnalytics] = await Promise.all([
    getAdminServiceModerationSummary(supabase),
    listPlatformDiscounts(supabase),
    getPlatformDiscountAnalytics(supabase),
  ]);

  return {
    bookings: bookingsResult.data ?? [],
    providers: providersResult.data ?? [],
    moderationProviders,
    providerApplications,
    serviceCategories: serviceCategoriesResult.data ?? [],
    catalogServices: catalogServicesResult.data ?? [],
    businessStats,
    serviceModerationSummary,
    platformDiscounts,
    discountAnalytics,
  };
}
