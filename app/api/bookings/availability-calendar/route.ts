/**
 * Availability Calendar API
 *
 * Returns multi-day provider availability with day information.
 * Use this endpoint for calendar/scheduling UIs showing availability across multiple days.
 *
 * Query Parameters:
 * - providerId (required, number): Provider ID
 * - fromDate (required, string): Start date in YYYY-MM-DD format
 * - toDate (required, string): End date in YYYY-MM-DD format (inclusive)
 * - serviceDurationMinutes (optional, number): Service duration in minutes (default: 30)
 *
 * Response:
 * {
 *   "availability": [
 *     {
 *       "date": "2026-03-05",
 *       "dayOfWeek": 3,
 *       "dayName": "Wednesday",
 *       "is_blocked": false,
 *       "slots": [
 *         { "start_time": "09:00", "end_time": "09:30", "is_available": true },
 *         { "start_time": "09:30", "end_time": "10:00", "is_available": true }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 *
 * Error Response:
 * - 400: Invalid query parameters or date range
 * - 401: Unauthorized
 * - 500: Server error
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getAvailableSlotsMultiDay } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';

const availabilityCalendarSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceDurationMinutes: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('availability-calendar', user.id), { windowMs: 60_000, maxRequests: 10 });
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const url = new URL(request.url);

  const parsed = availabilityCalendarSchema.safeParse({
    providerId: url.searchParams.get('providerId'),
    fromDate: url.searchParams.get('fromDate'),
    toDate: url.searchParams.get('toDate'),
    serviceDurationMinutes: url.searchParams.get('serviceDurationMinutes') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  // Validate date range
  const fromDate = new Date(`${parsed.data.fromDate}T00:00:00`);
  const toDate = new Date(`${parsed.data.toDate}T23:59:59`);

  if (fromDate > toDate) {
    return NextResponse.json({ error: 'fromDate must be before or equal to toDate' }, { status: 400 });
  }

  // Limit date range to 90 days for performance
  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    return NextResponse.json({ error: 'Date range cannot exceed 90 days' }, { status: 400 });
  }

  try {
    const availability = await getAvailableSlotsMultiDay(supabase, {
      providerId: parsed.data.providerId,
      fromDate: parsed.data.fromDate,
      toDate: parsed.data.toDate,
      serviceDurationMinutes: parsed.data.serviceDurationMinutes,
    });

    return NextResponse.json({ availability });
  } catch (error) {
    console.error('Error fetching availability calendar:', error);
    const friendly = toFriendlyApiError(error, 'Failed to load availability calendar');
    return NextResponse.json({ error: friendly.message }, { status: friendly.status });
  }
}
