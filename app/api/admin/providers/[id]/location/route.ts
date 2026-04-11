import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import {
  getAdminProviderCoverageWarnings,
  getAdminProviderLocation,
  logProviderAdminAuditEvent,
  updateAdminProviderLocation,
} from '@/lib/provider-management/service';
import { adminProviderLocationUpdateSchema } from '@/lib/provider-management/validation';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

  try {
    const location = await getAdminProviderLocation(supabase, providerId);
    const coverageWarnings = await getAdminProviderCoverageWarnings(supabase, providerId, location);
    return NextResponse.json({ location, coverageWarnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider location';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
  const parsed = adminProviderLocationUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const location = await updateAdminProviderLocation(supabase, providerId, parsed.data);
    const coverageWarnings = await getAdminProviderCoverageWarnings(supabase, providerId, location);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.location_updated', {
      updatedFields: Object.keys(parsed.data),
      coverageWarnings,
    });
    return NextResponse.json({ success: true, location, coverageWarnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider location';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
