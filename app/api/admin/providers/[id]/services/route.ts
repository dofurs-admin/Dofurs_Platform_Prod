import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import {
  deleteProviderServiceRolloutEntry,
  getProviderServicesWithPincodes,
  logProviderAdminAuditEvent,
  updateProviderServiceRollout,
} from '@/lib/provider-management/service';
import { adminProviderServiceRolloutSchema } from '@/lib/provider-management/validation';

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
    const services = await getProviderServicesWithPincodes(supabase, providerId);
    return NextResponse.json({ services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider services';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
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
  const parsed = adminProviderServiceRolloutSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const normalizedRollout = parsed.data.map((item) => ({
      id: item.id,
      service_type: item.service_type,
      base_price: item.base_price,
      surge_price: item.surge_price ?? null,
      commission_percentage: item.commission_percentage ?? null,
      service_duration_minutes: item.service_duration_minutes ?? null,
      is_active: item.is_active ?? true,
      service_pincodes: item.service_pincodes,
    }));

    const services = await updateProviderServiceRollout(supabase, providerId, normalizedRollout);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.services_rollout_updated', {
      updatedRows: normalizedRollout.length,
    });
    return NextResponse.json({ success: true, services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider services';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
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
  const serviceId = typeof payload?.serviceId === 'string' ? payload.serviceId.trim() : '';

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
  }

  try {
    const services = await deleteProviderServiceRolloutEntry(supabase, providerId, serviceId);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.service_rollout_deleted', {
      serviceId,
      remainingRows: services.length,
    });

    return NextResponse.json({ success: true, services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete provider service rollout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
