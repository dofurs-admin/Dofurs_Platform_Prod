import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { isSlotConflictMessage, logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const reassignSchema = z.object({
  providerId: z.number().int().positive(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user } = auth.context;
  const writeSupabase = getSupabaseAdminClient();

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = reassignSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: provider } = await writeSupabase.from('providers').select('id').eq('id', parsed.data.providerId).single();

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const { data: booking, error: bookingLookupError } = await writeSupabase
    .from('bookings')
    .select('id, service_type')
    .eq('id', bookingId)
    .maybeSingle<{ id: number; service_type: string | null }>();

  if (bookingLookupError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (!booking.service_type) {
    return NextResponse.json({ error: 'Booking service type is missing. Unable to reassign safely.' }, { status: 400 });
  }

  const { data: targetProviderService, error: providerServiceLookupError } = await writeSupabase
    .from('provider_services')
    .select('id, service_type')
    .eq('provider_id', parsed.data.providerId)
    .eq('is_active', true)
    .ilike('service_type', booking.service_type)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; service_type: string }>();

  if (providerServiceLookupError) {
    return NextResponse.json({ error: providerServiceLookupError.message }, { status: 500 });
  }

  if (!targetProviderService) {
    return NextResponse.json(
      { error: `Selected provider does not support ${booking.service_type}.` },
      { status: 409 },
    );
  }

  // Check if the target provider has conflicting bookings at the same date/time
  const { data: bookingDetails } = await writeSupabase
    .from('bookings')
    .select('booking_date, start_time, end_time')
    .eq('id', bookingId)
    .single<{ booking_date: string; start_time: string; end_time: string }>();

  if (bookingDetails) {
    const { data: conflicting } = await writeSupabase
      .from('bookings')
      .select('id')
      .eq('provider_id', parsed.data.providerId)
      .eq('booking_date', bookingDetails.booking_date)
      .in('booking_status', ['pending', 'confirmed', 'in_progress'])
      .neq('id', bookingId)
      .lt('start_time', bookingDetails.end_time)
      .gt('end_time', bookingDetails.start_time)
      .limit(1)
      .maybeSingle();

    if (conflicting) {
      return NextResponse.json(
        { error: 'Target provider has a conflicting booking at this time slot.' },
        { status: 409 },
      );
    }
  }

  const { data, error } = await writeSupabase
    .from('bookings')
    .update({
      provider_id: parsed.data.providerId,
      provider_service_id: targetProviderService.id,
      service_type: targetProviderService.service_type,
    })
    .eq('id', bookingId)
    .select('*')
    .single();

  if (error) {
    if (isSlotConflictMessage(error.message)) {
      logSecurityEvent('warn', 'booking.slot_conflict', {
        route: 'api/admin/bookings/[id]/reassign',
        actorId: user.id,
        actorRole: role,
        targetId: bookingId,
        message: error.message,
        metadata: {
          providerId: parsed.data.providerId,
        },
      });

      return NextResponse.json({ error: 'Provider is unavailable for this slot' }, { status: 409 });
    }

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/admin/bookings/[id]/reassign',
      actorId: user.id,
      actorRole: role,
      targetId: bookingId,
      message: error.message,
      metadata: {
        providerId: parsed.data.providerId,
      },
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logSecurityEvent('info', 'admin.action', {
    route: 'api/admin/bookings/[id]/reassign',
    actorId: user.id,
    actorRole: role,
    targetId: bookingId,
    metadata: {
      action: 'booking_reassigned',
      providerId: parsed.data.providerId,
    },
  });

  return NextResponse.json({ success: true, booking: data });
}
