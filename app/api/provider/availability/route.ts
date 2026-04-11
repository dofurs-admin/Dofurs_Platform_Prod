import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getAvailability, setAvailability } from '@/lib/provider-management/service';
import { providerAvailabilitySchema } from '@/lib/provider-management/validation';

export async function GET() {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const availability = await getAvailability(supabase, providerId);
    return NextResponse.json({ availability });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerAvailabilitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const availability = await setAvailability(supabase, providerId, parsed.data, 'provider');

    // Warn about pending/confirmed bookings in reduced/removed windows
    const { data: affectedBookings } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, booking_status')
      .eq('provider_id', providerId)
      .in('booking_status', ['pending', 'confirmed', 'in_progress'])
      .gte('booking_date', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

    const warnings = (affectedBookings ?? []).length > 0
      ? [`${affectedBookings!.length} active booking(s) may be affected by this availability change. Please review.`]
      : [];

    return NextResponse.json({ success: true, availability, warnings });
  } catch (error) {
    console.error('[provider/availability PUT]', error);
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? 'Unable to save availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
