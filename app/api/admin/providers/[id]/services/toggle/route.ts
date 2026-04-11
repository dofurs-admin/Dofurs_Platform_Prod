import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent } from '@/lib/provider-management/service';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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
    const payload = await request.json().catch(() => null);
    const isActive = payload?.isActive === true;

    // Update all provider services
    const { data: services, error: updateError } = await supabase
      .from('provider_services')
      .update({ is_active: isActive })
      .eq('provider_id', providerId)
      .select('id, service_type, is_active');

    if (updateError) {
      throw updateError;
    }

    await logProviderAdminAuditEvent(
      supabase,
      user.id,
      providerId,
      isActive ? 'provider.services_enabled' : 'provider.services_disabled',
      {
        serviceCount: services?.length || 0,
      }
    );

    logSecurityEvent('info', 'admin.action', {
      route: 'api/admin/providers/[id]/services/toggle',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      metadata: {
        action: isActive ? 'services_enabled' : 'services_disabled',
        serviceCount: services?.length || 0,
      },
    });

    return NextResponse.json({
      success: true,
      services,
      message: `Successfully ${isActive ? 'enabled' : 'disabled'} all services for provider`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to toggle provider services';

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers/[id]/services/toggle',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
