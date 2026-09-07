import AdminDashboardShell from '@/components/dashboard/admin/AdminDashboardShell';
import { requireRole } from '@/lib/auth/session';
import { EMPTY_ADMIN_DASHBOARD_DATA } from '../_data';

export const metadata = { title: 'SOPs — Dofurs Admin' };

export default async function AdminSopsPage() {
  await requireRole(['admin', 'staff']);

  return (
    <AdminDashboardShell
      canManageUserAccess={false}
      view="sops"
      {...EMPTY_ADMIN_DASHBOARD_DATA}
    />
  );
}
