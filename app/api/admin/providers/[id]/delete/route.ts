import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { deleteProvider, logProviderAdminAuditEvent } from '@/lib/provider-management/service';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';

function isAuthUserNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';

  return code === 'user_not_found' || name.includes('usernotfound') || message.includes('user not found');
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user } = auth.context;

  const { id } = await context.params;
  const providerId = Number(id);

  if (!Number.isFinite(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();

  try {
    try {
      await logProviderAdminAuditEvent(adminClient, user.id, providerId, 'provider.delete_requested');
    } catch (err) { console.error(err);
      // Do not block delete on audit write failures
    }

    const provider = await deleteProvider(adminClient, providerId);
    const linkedUserId = typeof provider.user_id === 'string' && provider.user_id.trim() ? provider.user_id : null;

    if (linkedUserId) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(linkedUserId);

      if (authDeleteError && !isAuthUserNotFoundError(authDeleteError)) {
        const { error: userDeleteError } = await adminClient.from('users').delete().eq('id', linkedUserId);

        if (userDeleteError) {
          throw new Error(`Provider deleted but failed to delete linked user: ${authDeleteError.message}`);
        }
      }
    }

    logSecurityEvent('warn', 'admin.action', {
      route: 'api/admin/providers/[id]/delete',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      metadata: {
        action: 'provider_deleted',
        linkedUserDeleted: Boolean(linkedUserId),
      },
    });
    void logAdminAction({ adminUserId: user.id, action: 'provider.deleted', entityType: 'provider', entityId: String(providerId), metadata: { linkedUserDeleted: Boolean(linkedUserId) }, request });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Unable to delete provider';

    const details =
      typeof error === 'object' && error !== null && 'details' in error && typeof error.details === 'string'
        ? error.details
        : null;

    const code =
      typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : null;

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers/[id]/delete',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      message,
      metadata: {
        action: 'provider_deleted',
        details,
        code,
      },
    });

    return NextResponse.json({ error: message, details, code }, { status: 500 });
  }
}
