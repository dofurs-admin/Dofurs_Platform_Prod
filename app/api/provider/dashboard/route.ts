import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderDashboard } from '@/lib/provider-management/service';
import { toFriendlyApiError } from '@/lib/api/errors';

export async function GET() {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  try {
    const dashboard = await getProviderDashboard(supabase, user.id);
    return NextResponse.json({ dashboard });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load Service Provider Dashboard');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
