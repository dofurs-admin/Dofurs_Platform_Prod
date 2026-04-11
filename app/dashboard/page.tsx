import { redirect } from 'next/navigation';
import { getCurrentUserRole, requireAuthenticatedUser } from '@/lib/auth/session';

export default async function DashboardEntryPage() {
  await requireAuthenticatedUser();
  const role = await getCurrentUserRole();

  if (role === 'provider') {
    redirect('/dashboard/provider');
  }

  if (role === 'admin' || role === 'staff') {
    redirect('/dashboard/admin');
  }

  redirect('/dashboard/user');
}
