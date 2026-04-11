import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getMyBookings } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiRole(['user', ...ADMIN_ROLES]);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const targetUserId = role === 'admin' || role === 'staff' ? parsed.data.userId ?? user.id : user.id;

  try {
    if (targetUserId === user.id) {
      const bookings = await getMyBookings(supabase, targetUserId);
      return NextResponse.json({ bookings });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', targetUserId)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load user bookings');

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/user/bookings',
      actorId: user.id,
      actorRole: role,
      targetId: targetUserId,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
