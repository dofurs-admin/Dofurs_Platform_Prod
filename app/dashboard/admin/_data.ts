import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAdminServiceModerationSummary,
  getPlatformDiscountAnalytics,
  listAdminProviderModerationItems,
  listPlatformDiscounts,
} from '@/lib/provider-management/service';
import { listServiceProviderApplications } from '@/lib/provider-applications/service';

export async function loadAdminDashboardData(supabase: SupabaseClient) {
  const [
    bookingsResult,
    providersResult,
    moderationProviders,
    providerApplications,
    serviceCategoriesResult,
    catalogServicesResult,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, user_id, provider_id, booking_start, booking_date, start_time, end_time, status, booking_status, booking_mode, service_type')
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
    serviceModerationSummary,
    platformDiscounts,
    discountAnalytics,
  };
}
