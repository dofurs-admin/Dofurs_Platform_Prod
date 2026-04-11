import { NextResponse } from 'next/server';
import { forbidden, requireApiRole } from '@/lib/auth/api-auth';
import {
  cancelBooking,
  cancelBookingAsProvider,
  confirmBooking,
  completeBooking,
  markNoShow,
  updateBookingStatus,
} from '@/lib/bookings/service';
import { type BookingStatus } from '@/lib/flows/contracts';
import { bookingStatusUpdateSchema } from '@/lib/flows/validation';
import { assertRoleCanSetBookingStatus, type BookingActorRole } from '@/lib/bookings/state-transition-guard';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { notifyBookingStatusChanged } from '@/lib/notifications/service';
import { restoreCredits } from '@/lib/credits/wallet';
import { processReferrerRewardOnFirstBooking } from '@/lib/referrals/service';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

function fireNotification(
  bookingMeta: { id: number; user_id: string; provider_id: number; booking_status: string },
  previousStatus: string,
  newStatus: string,
  changedBy: 'user' | 'provider' | 'admin' | 'staff',
) {
  const admin = getSupabaseAdminClient();
  notifyBookingStatusChanged(
    admin,
    {
      id: bookingMeta.id,
      user_id: bookingMeta.user_id,
      provider_id: bookingMeta.provider_id,
      service_type: null,
    },
    previousStatus,
    newStatus,
    changedBy,
  ).catch((err) => console.error('Notification hook failed (booking_status_changed)', err));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { role, supabase, user } = auth.context;

  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:status:patch', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bookingStatusUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const lookupSupabase = role === 'admin' || role === 'staff' ? getSupabaseAdminClient() : supabase;

  const { data: booking, error: bookingError } = await lookupSupabase
    .from('bookings')
    .select('id, user_id, provider_id, booking_status, payment_mode, wallet_credits_applied_inr')
    .eq('id', bookingId)
    .single<{ id: number; user_id: string; provider_id: number; booking_status: string; payment_mode: string | null; wallet_credits_applied_inr: number }>();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (role === 'user' && booking.user_id !== user.id) {
    return forbidden();
  }

  const effectiveRole = role as BookingActorRole;

  const nextStatus = parsed.data.status as BookingStatus;

  try {
    assertRoleCanSetBookingStatus(effectiveRole, nextStatus);

    const writeSupabase = role === 'user' || role === 'admin' || role === 'staff' ? getSupabaseAdminClient() : supabase;

    if (role === 'user') {
      if (parsed.data.status !== 'cancelled') {
        return NextResponse.json({ error: 'Users can only cancel their own bookings' }, { status: 403 });
      }

      const data = await cancelBooking(writeSupabase, user.id, bookingId, parsed.data.cancellationReason, {
        actorId: user.id,
        actorRole: 'user',
        source: 'api/bookings/[id]/status:user',
      });
      // Restore wallet credits if any were applied
      if (booking.wallet_credits_applied_inr > 0) {
        restoreCredits(booking.user_id, booking.wallet_credits_applied_inr, bookingId).catch((err) =>
          console.error('[status] credit restore failed (non-fatal):', err),
        );
      }
      fireNotification(booking, booking.booking_status, 'cancelled', 'user');
      return NextResponse.json({ success: true, booking: data });
    }

    if (role === 'provider') {
      if (parsed.data.status === 'confirmed') {
        const data = await confirmBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
        fireNotification(booking, booking.booking_status, 'confirmed', 'provider');
        return NextResponse.json({ success: true, booking: data });
      }

      if (parsed.data.status === 'completed') {
        if (booking.payment_mode === 'direct_to_provider') {
          const { data: cashCollection } = await getSupabaseAdminClient()
            .from('booking_payment_collections')
            .select('id')
            .eq('booking_id', bookingId)
            .eq('status', 'paid')
            .maybeSingle();

          if (!cashCollection) {
            return NextResponse.json(
              { error: 'Cash payment must be marked as received before completing this booking.' },
              { status: 400 },
            );
          }
        }

        const data = await completeBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
        // Trigger referrer reward if this is the referee's first completed booking
        processReferrerRewardOnFirstBooking(booking.user_id, bookingId).catch((err) =>
          console.error('[status] referrer reward on completion failed (non-fatal):', err),
        );
        fireNotification(booking, booking.booking_status, 'completed', 'provider');
        return NextResponse.json({ success: true, booking: data });
      }

      if (parsed.data.status === 'no_show') {
        const data = await markNoShow(supabase, user.id, bookingId, parsed.data.providerNotes);
        fireNotification(booking, booking.booking_status, 'no_show', 'provider');
        return NextResponse.json({ success: true, booking: data });
      }

      if (parsed.data.status === 'cancelled') {
        const data = await cancelBookingAsProvider(
          supabase,
          user.id,
          bookingId,
          parsed.data.cancellationReason,
          parsed.data.providerNotes,
        );
        // Restore wallet credits to the customer
        if (booking.wallet_credits_applied_inr > 0) {
          restoreCredits(booking.user_id, booking.wallet_credits_applied_inr, bookingId).catch((err) =>
            console.error('[status] provider-cancel credit restore failed (non-fatal):', err),
          );
        }
        fireNotification(booking, booking.booking_status, 'cancelled', 'provider');
        return NextResponse.json({ success: true, booking: data });
      }

      return NextResponse.json({ error: 'Providers can set only confirmed/completed/no_show/cancelled.' }, { status: 403 });
    }

    if (role === 'admin' || role === 'staff') {
      if (parsed.data.status === 'completed' && booking.payment_mode === 'direct_to_provider') {
        const { data: cashCollection } = await writeSupabase
          .from('booking_payment_collections')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('status', 'paid')
          .maybeSingle();

        if (!cashCollection) {
          return NextResponse.json(
            { error: 'Cash payment must be marked as received before completing this booking.' },
            { status: 400 },
          );
        }
      }

      const data = await updateBookingStatus(writeSupabase, bookingId, parsed.data.status, {
        cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
        cancellationReason: parsed.data.cancellationReason,
        actorId: user.id,
        actorRole: role,
        source: 'api/bookings/[id]/status',
      });
      // Restore wallet credits to the customer on any admin/staff cancellation
      if (parsed.data.status === 'cancelled' && booking.wallet_credits_applied_inr > 0) {
        restoreCredits(booking.user_id, booking.wallet_credits_applied_inr, bookingId).catch((err) =>
          console.error('[status] admin-cancel credit restore failed (non-fatal):', err),
        );
      }
      // Trigger referrer reward on admin/staff-marked completion
      if (parsed.data.status === 'completed') {
        processReferrerRewardOnFirstBooking(booking.user_id, bookingId).catch((err) =>
          console.error('[status] referrer reward on completion failed (non-fatal):', err),
        );
      }
      fireNotification(booking, booking.booking_status, parsed.data.status, role as 'admin' | 'staff');
      return NextResponse.json({ success: true, booking: data });
    }

    return forbidden();
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update booking');
    const message = error instanceof Error ? error.message : String(error);

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/bookings/[id]/status',
      actorId: user.id,
      actorRole: role,
      targetId: bookingId,
      message,
      metadata: {
        requestedStatus: parsed.data.status,
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
