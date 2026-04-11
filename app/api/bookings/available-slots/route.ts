/**
 * Available Slots API
 *
 * Returns available appointment slots for a provider on a specific date.
 * This is the ONLY endpoint for fetching slots - all slot logic must be centralized here.
 * Do NOT call get_available_slots RPC directly from UI components.
 *
 * Architecture:
 * UI Component -> API Route -> Service Layer -> Slot Engine -> SQL RPC
 *
 * Automated Filtering:
 * - Provider blocked dates (provider_blocked_dates table)
 * - Provider timestamp-based blocks (provider_blocks table)
 * - Existing bookings (pending/confirmed status)
 * - Overlapping slots
 * - Service duration requirements
 *
 * Query Parameters:
 * - providerId (required, number): Provider ID
 * - date (required, string): Booking date in YYYY-MM-DD format
 * - serviceDurationMinutes (optional, number): Service duration in minutes
 * - providerServiceId (optional, uuid): Provider service to auto-determine duration
 *
 * Response:
 * {
 *   "slots": [
 *     { "start_time": "09:00", "end_time": "09:30", "is_available": true },
 *     { "start_time": "09:30", "end_time": "10:00", "is_available": true }
 *   ]
 * }
 *
 * Error Response:
 * - 400: Invalid query parameters
 * - 401: Unauthorized
 * - 404: Provider service not found
 * - 500: Server error
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getAvailableSlots } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { isSlotConflictMessage, logSecurityEvent } from '@/lib/monitoring/security-log';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';

const slotsSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceDurationMinutes: z.coerce.number().int().positive().optional(),
  providerServiceId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('available-slots', user.id), { windowMs: 60_000, maxRequests: 60 });
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const url = new URL(request.url);

  const parsed = slotsSchema.safeParse({
    providerId: url.searchParams.get('providerId'),
    date: url.searchParams.get('date'),
    serviceDurationMinutes: url.searchParams.get('serviceDurationMinutes') ?? undefined,
    providerServiceId: url.searchParams.get('providerServiceId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    let duration = parsed.data.serviceDurationMinutes;

    if (!duration && parsed.data.providerServiceId) {
      const { data: providerService, error: providerServiceError } = await supabase
        .from('provider_services')
        .select('id, provider_id, service_duration_minutes')
        .eq('id', parsed.data.providerServiceId)
        .eq('provider_id', parsed.data.providerId)
        .single<{ id: string; provider_id: number; service_duration_minutes: number | null }>();

      if (providerServiceError || !providerService) {
        return NextResponse.json({ error: 'Provider service not found' }, { status: 404 });
      }

      duration = providerService.service_duration_minutes ?? 30;
    }

    const slots = await getAvailableSlots(supabase, {
      providerId: parsed.data.providerId,
      bookingDate: parsed.data.date,
      serviceDurationMinutes: duration,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    const friendly = toFriendlyApiError(error, 'Failed to load available slots');

    const message = error instanceof Error ? error.message : String(error);
    if (friendly.status === 409 || isSlotConflictMessage(message)) {
      logSecurityEvent('warn', 'booking.slot_conflict', {
        route: 'api/bookings/available-slots',
        actorId: user.id,
        targetId: parsed.data.providerId,
        message,
        metadata: {
          bookingDate: parsed.data.date,
        },
      });
    }

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/bookings/available-slots',
      actorId: user.id,
      targetId: parsed.data.providerId,
      message,
      metadata: {
        responseStatus: friendly.status,
      },
    });

    return NextResponse.json({ error: friendly.message }, { status: friendly.status });
  }
}
