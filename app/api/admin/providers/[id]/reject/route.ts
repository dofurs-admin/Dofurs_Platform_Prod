import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent, rejectProvider } from '@/lib/provider-management/service';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { logAdminAction } from '@/lib/admin/audit';

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
    const provider = await rejectProvider(supabase, providerId);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.rejected');
    void logAdminAction({ adminUserId: user.id, action: 'provider.rejected', entityType: 'provider', entityId: String(providerId), request: _request });

    logSecurityEvent('warn', 'provider.rejection', {
      route: 'api/admin/providers/[id]/reject',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      metadata: {
        action: 'provider_rejected',
      },
    });

    logSecurityEvent('info', 'admin.action', {
      route: 'api/admin/providers/[id]/reject',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      metadata: {
        action: 'provider_rejected',
      },
    });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject provider';

    logSecurityEvent('error', 'provider.rejection', {
      route: 'api/admin/providers/[id]/reject',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      message,
      metadata: {
        action: 'provider_rejected',
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
