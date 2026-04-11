import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { enableProvider, logProviderAdminAuditEvent } from '@/lib/provider-management/service';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user, supabase } = auth.context;

  const { id } = await context.params;
  const providerId = Number(id);

  if (!Number.isFinite(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  try {
    const provider = await enableProvider(supabase, providerId);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.enabled');

    logSecurityEvent('info', 'admin.action', {
      route: 'api/admin/providers/[id]/enable',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      metadata: {
        action: 'provider_enabled',
      },
    });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enable provider';

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers/[id]/enable',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      message,
      metadata: {
        action: 'provider_enabled',
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
