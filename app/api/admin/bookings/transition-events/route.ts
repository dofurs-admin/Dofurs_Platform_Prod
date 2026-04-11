import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { queryBookingTransitionEvents } from '@/lib/bookings/transition-events';
import { toFriendlyApiError } from '@/lib/api/errors';
const querySchema = z.object({
  bookingId: z.coerce.number().int().positive().optional(),
  bookingIds: z.string().optional().transform((v) => {
    if (!v) return undefined;
    return v.split(',').map((id) => parseInt(id, 10)).filter(Number.isFinite);
  }),
  fromStatus: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  toStatus: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  actorId: z.string().uuid().optional(),
  actorRole: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    bookingId: searchParams.get('bookingId'),
    bookingIds: searchParams.get('bookingIds'),
    fromStatus: searchParams.get('fromStatus'),
    toStatus: searchParams.get('toStatus'),
    actorId: searchParams.get('actorId'),
    actorRole: searchParams.get('actorRole'),
    fromDate: searchParams.get('fromDate'),
    toDate: searchParams.get('toDate'),
    limit: searchParams.get('limit'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const events = await queryBookingTransitionEvents(supabase, {
      bookingId: parsed.data.bookingId,
      bookingIds: parsed.data.bookingIds && parsed.data.bookingIds.length > 0 ? parsed.data.bookingIds : undefined,
      fromStatus: parsed.data.fromStatus,
      toStatus: parsed.data.toStatus,
      actorId: parsed.data.actorId,
      actorRole: parsed.data.actorRole,
      fromDate: parsed.data.fromDate,
      toDate: parsed.data.toDate,
      limit: parsed.data.limit ?? 100,
    });

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    const friendly = toFriendlyApiError(error, 'Unable to load transition events');
    return NextResponse.json({ error: friendly.message }, { status: friendly.status });
  }
}
