import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { loadAdminDashboardBusinessStats } from '@/lib/admin/dashboard-stats';

export const revalidate = 0;

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth.context;

  try {
    const businessStats = await loadAdminDashboardBusinessStats(supabase);

    return NextResponse.json(
      { businessStats },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load admin dashboard statistics');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
