import AdminDashboardShell from '@/components/dashboard/admin/AdminDashboardShell';
import { requireRole } from '@/lib/auth/session';
import { EMPTY_ADMIN_DASHBOARD_DATA } from '../_data';

export default async function AdminSubscriptionsPage() {
  const role = await requireRole(['admin', 'staff']);

  return (
    <AdminDashboardShell
      canManageUserAccess={role === 'admin'}
      view='subscriptions'
      {...EMPTY_ADMIN_DASHBOARD_DATA}
    />
  );
}
