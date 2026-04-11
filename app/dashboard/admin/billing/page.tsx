import AdminDashboardShell from '@/components/dashboard/admin/AdminDashboardShell';
import { requireAuthenticatedUser, requireRole } from '@/lib/auth/session';
import { loadAdminDashboardData } from '../_data';

export default async function AdminBillingPage() {
  const role = await requireRole(['admin', 'staff']);
  const { supabase } = await requireAuthenticatedUser();
  const data = await loadAdminDashboardData(supabase);

  return (
    <AdminDashboardShell
      canManageUserAccess={role === 'admin'}
      view="billing"
      initialBookings={data.bookings}
      providers={data.providers}
      moderationProviders={data.moderationProviders}
      initialProviderApplications={data.providerApplications}
      initialServiceSummary={data.serviceModerationSummary}
      initialDiscounts={data.platformDiscounts}
      initialDiscountAnalytics={data.discountAnalytics}
      initialServiceCategories={data.serviceCategories}
      initialCatalogServices={data.catalogServices}
    />
  );
}
