import ProviderDashboardClient from '@/components/dashboard/ProviderDashboardClient';
import { requireRole, requireAuthenticatedUser } from '@/lib/auth/session';
import { getProviderDashboard } from '@/lib/provider-management/service';

type ProviderDashboardView =
  | 'overview'
  | 'operations'
  | 'profile';

type ProviderDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveProviderDashboardView(value: string | string[] | undefined): ProviderDashboardView {
  const resolvedValue = Array.isArray(value) ? value[0] : value;

  switch (resolvedValue) {
    case 'operations':
    case 'profile':
      return resolvedValue;
    default:
      return 'overview';
  }
}

export default async function ProviderDashboardPage({ searchParams }: ProviderDashboardPageProps) {
  await requireRole(['provider']);

  const { supabase, user } = await requireAuthenticatedUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolveProviderDashboardView(resolvedSearchParams?.view);
  const dashboard = await getProviderDashboard(supabase, user.id);

  return <ProviderDashboardClient initialDashboard={dashboard} view={view} />;
}
