import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getMyBookings } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

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
      const admin = getSupabaseAdminClient();
      const bookingIds = bookings.map((booking) => booking.id);

      let pendingMap = new Map<number, { amountInr: number; status: string }>();

      if (bookingIds.length > 0) {
        const { data: collections } = await admin
          .from('booking_payment_collections')
          .select('booking_id, amount_inr, status')
          .in('booking_id', bookingIds)
          .returns<Array<{ booking_id: number; amount_inr: number | null; status: string }>>();

        pendingMap = new Map(
          (collections ?? []).map((row) => [
            row.booking_id,
            {
              amountInr: Math.max(0, Number(row.amount_inr ?? 0)),
              status: row.status,
            },
          ]),
        );
      }

      let capturedByBookingId = new Map<number, number>();

      if (bookingIds.length > 0) {
        const { data: capturedRows } = await admin
          .from('payment_transactions')
          .select('booking_id, amount_inr, status')
          .in('booking_id', bookingIds)
          .eq('status', 'captured')
          .returns<Array<{ booking_id: number | null; amount_inr: number | null; status: string | null }>>();

        capturedByBookingId = (capturedRows ?? []).reduce((map, row) => {
          if (!row.booking_id) {
            return map;
          }

          const existing = map.get(row.booking_id) ?? 0;
          map.set(row.booking_id, existing + Math.max(0, Number(row.amount_inr ?? 0)));
          return map;
        }, new Map<number, number>());
      }

      const resolvePendingForBooking = (booking: {
        id: number;
        payment_mode?: string | null;
        amount?: number | null;
        final_price?: number | null;
        price_at_booking?: number | null;
      }) => {
        const totalAmount = Math.max(
          0,
          Number(booking.amount ?? booking.final_price ?? booking.price_at_booking ?? 0),
        );
        const capturedOnline = capturedByBookingId.get(booking.id) ?? 0;
        const computedPending = Math.max(0, totalAmount - capturedOnline);

        const explicitPending = pendingMap.get(booking.id);
        if (explicitPending) {
          if (explicitPending.status === 'paid') {
            return 0;
          }

          // Explicit non-paid collection rows are authoritative even when payment mode is stale.
          if (explicitPending.amountInr > 0) {
            return Math.max(0, explicitPending.amountInr);
          }

          // Some legacy rows store 0 while booking totals remain outstanding.
          // Trust computed outstanding when collection amount is missing/zero.
          return computedPending;
        }

        const paymentMode = String(booking.payment_mode ?? '').trim().toLowerCase();
        const isCashCollectionMode =
          paymentMode === 'direct_to_provider' ||
          paymentMode === 'mixed' ||
          paymentMode === 'cash';

        if (!isCashCollectionMode) {
          return 0;
        }

        return computedPending;
      };

      const enriched = bookings.map((booking) => ({
        ...booking,
        pending_payable_inr: resolvePendingForBooking(booking),
      }));

      return NextResponse.json({ bookings: enriched });
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
