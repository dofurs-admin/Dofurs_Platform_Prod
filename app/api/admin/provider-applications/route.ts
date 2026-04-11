import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { listServiceProviderApplications } from '@/lib/provider-applications/service';

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const applications = await listServiceProviderApplications(auth.context.supabase);
    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load provider applications' },
      { status: 500 },
    );
  }
}
