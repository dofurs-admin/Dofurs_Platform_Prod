import AdminDashboardShell from '@/components/dashboard/admin/AdminDashboardShell';
import { requireRole } from '@/lib/auth/session';
import { EMPTY_ADMIN_DASHBOARD_DATA } from '../_data';

export default async function AdminAccessPage() {
  const role = await requireRole(['admin', 'staff']);

  return (
    <AdminDashboardShell
      canManageUserAccess={role === 'admin'}
      view='access'
      {...EMPTY_ADMIN_DASHBOARD_DATA}
    />
  );
}
