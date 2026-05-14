import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import {
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';
import { isSlotConflictMessage, logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const reassignSchema = z.object({
  providerId: z.number().int().positive(),
});

type ReassignBooking = {
  id: number;
  service_type: string | null;
  provider_service_id: string | null;
  provider_notes: string | null;
  internal_notes: string | null;
  admin_price_reference: number | null;
  price_at_booking: number | null;
};

type ProviderServiceMatch = {
  id: string;
  service_type: string;
};

function normalizeServiceType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function uniqueServiceTypes(values: ReadonlyArray<string | null | undefined>) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const key = normalizeServiceType(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

function replaceProviderServiceIdsInNotes(
  noteValue: string | null,
  replacements: ReadonlyMap<string, string>,
) {
  if (!noteValue || replacements.size === 0) {
    return noteValue;
  }

  let nextNoteValue = noteValue;
  for (const [oldId, newId] of replacements) {
    nextNoteValue = nextNoteValue.replaceAll(oldId, newId);
  }

  return nextNoteValue;
}

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
    .select('id, service_type, provider_service_id, provider_notes, internal_notes, admin_price_reference, price_at_booking')
    .eq('id', bookingId)
    .maybeSingle<ReassignBooking>();

  if (bookingLookupError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const bundledProviderServiceIds = Array.from(
    new Set([
      ...extractProviderServiceIdsFromNotes(booking.provider_notes),
      ...extractProviderServiceIdsFromNotes(booking.internal_notes),
    ]),
  );

  const serviceNameByProviderServiceId = new Map<string, string>();

  if (bundledProviderServiceIds.length > 0) {
    const { data: currentProviderServices, error: currentProviderServicesError } = await writeSupabase
      .from('provider_services')
      .select('id, service_type')
      .in('id', bundledProviderServiceIds);

    if (currentProviderServicesError) {
      return NextResponse.json({ error: currentProviderServicesError.message }, { status: 500 });
    }

    for (const service of currentProviderServices ?? []) {
      if (service.id && service.service_type) {
        serviceNameByProviderServiceId.set(service.id, service.service_type);
      }
    }
  }

  const requiredServiceTypes = uniqueServiceTypes([
    ...resolveIncludedServicesForBooking(booking, { serviceNameByProviderServiceId }),
    booking.service_type,
  ]);

  if (requiredServiceTypes.length === 0) {
    return NextResponse.json({ error: 'Booking service type is missing. Unable to reassign safely.' }, { status: 400 });
  }

  const targetProviderServiceByType = new Map<string, ProviderServiceMatch>();

  for (const requiredServiceType of requiredServiceTypes) {
    const { data: targetProviderService, error: providerServiceLookupError } = await writeSupabase
      .from('provider_services')
      .select('id, service_type')
      .eq('provider_id', parsed.data.providerId)
      .eq('is_active', true)
      .ilike('service_type', requiredServiceType)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle<ProviderServiceMatch>();

    if (providerServiceLookupError) {
      return NextResponse.json({ error: providerServiceLookupError.message }, { status: 500 });
    }

    if (!targetProviderService) {
      return NextResponse.json(
        { error: `Selected provider does not support ${requiredServiceType}.` },
        { status: 409 },
      );
    }

    targetProviderServiceByType.set(normalizeServiceType(requiredServiceType), targetProviderService);
  }

  const primaryServiceType = booking.service_type?.trim() || requiredServiceTypes[0];
  const targetPrimaryProviderService = targetProviderServiceByType.get(normalizeServiceType(primaryServiceType));

  if (!targetPrimaryProviderService) {
    return NextResponse.json(
      { error: `Selected provider does not support ${primaryServiceType}.` },
      { status: 409 },
    );
  }

  const noteServiceIdReplacements = new Map<string, string>();

  for (const oldProviderServiceId of bundledProviderServiceIds) {
    const oldServiceType = serviceNameByProviderServiceId.get(oldProviderServiceId);
    const targetProviderService = targetProviderServiceByType.get(normalizeServiceType(oldServiceType));

    if (targetProviderService) {
      noteServiceIdReplacements.set(oldProviderServiceId, targetProviderService.id);
    }
  }

  const nextProviderNotes = replaceProviderServiceIdsInNotes(booking.provider_notes, noteServiceIdReplacements);
  const nextInternalNotes = replaceProviderServiceIdsInNotes(booking.internal_notes, noteServiceIdReplacements);

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

  const updatePayload: Record<string, unknown> = {
    provider_id: parsed.data.providerId,
    provider_service_id: targetPrimaryProviderService.id,
    service_type: targetPrimaryProviderService.service_type,
  };

  if (nextProviderNotes !== booking.provider_notes) {
    updatePayload.provider_notes = nextProviderNotes;
  }

  if (nextInternalNotes !== booking.internal_notes) {
    updatePayload.internal_notes = nextInternalNotes;
  }

  const { data, error } = await writeSupabase
    .from('bookings')
    .update(updatePayload)
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
