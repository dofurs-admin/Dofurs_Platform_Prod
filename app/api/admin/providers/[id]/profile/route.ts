import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent, updateAdminProviderProfile } from '@/lib/provider-management/service';
import { adminProviderProfileUpdateSchema } from '@/lib/provider-management/validation';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const { id } = await context.params;
  const providerId = Number(id);

  if (!Number.isFinite(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = adminProviderProfileUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const provider = await updateAdminProviderProfile(supabase, providerId, parsed.data);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.profile_updated', {
      updatedFields: Object.keys(parsed.data),
    });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
