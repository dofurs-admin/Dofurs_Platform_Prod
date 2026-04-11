import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getAvailability, logProviderAdminAuditEvent, setAvailability } from '@/lib/provider-management/service';
import { providerAvailabilitySchema } from '@/lib/provider-management/validation';

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
    const availability = await getAvailability(supabase, providerId);
    return NextResponse.json({ availability });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load availability';
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
  const parsed = providerAvailabilitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const availability = await setAvailability(supabase, providerId, parsed.data, 'admin');
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.availability_updated', {
      updatedRows: parsed.data.length,
    });
    return NextResponse.json({ success: true, availability });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
