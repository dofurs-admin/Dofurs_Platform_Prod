import AdminDashboardShell from '@/components/dashboard/admin/AdminDashboardShell';
import { requireRole } from '@/lib/auth/session';
import { EMPTY_ADMIN_DASHBOARD_DATA } from '../_data';

export const metadata = { title: 'Gaze — Dofurs Admin' };

export default async function AdminGazePage() {
  const role = await requireRole(['admin', 'staff']);

  return (
    <AdminDashboardShell
      canManageUserAccess={role === 'admin'}
      view='gaze'
      {...EMPTY_ADMIN_DASHBOARD_DATA}
    />
  );
}
