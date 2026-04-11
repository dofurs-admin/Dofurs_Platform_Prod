import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { listAdminProviderModerationItems } from '@/lib/provider-management/service';

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;

  try {
    const providers = await listAdminProviderModerationItems(supabase);
    return NextResponse.json({ providers });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load providers');

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers',
      actorId: user.id,
      actorRole: role,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        action: 'list_admin_providers',
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
