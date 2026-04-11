import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { updateBookingStatus } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';
import { notifyBookingStatusChanged } from '@/lib/notifications/service';
import { restoreCredits } from '@/lib/credits/wallet';
import { processReferrerRewardOnFirstBooking } from '@/lib/referrals/service';

const payloadSchema = z.object({
  bookingIds: z.array(z.number().int().positive()).min(1).max(100),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  cancellationReason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user } = auth.context;
  const writeSupabase = getSupabaseAdminClient();

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const results: Array<{ bookingId: number; success: boolean; error?: string }> = [];

  // Type assertion is safe here because requireApiRole ensures admin/staff access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorRole = (role ?? undefined) as any;

  for (const bookingId of parsed.data.bookingIds) {
    try {
      const { data: bookingBeforeUpdate, error: bookingLookupError } = await writeSupabase
        .from('bookings')
        .select('id, user_id, provider_id, booking_status, status, payment_mode, wallet_credits_applied_inr')
        .eq('id', bookingId)
        .single<{
          id: number;
          user_id: string;
          provider_id: number;
          booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | null;
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
          payment_mode: string | null;
          wallet_credits_applied_inr: number | null;
        }>();

      if (bookingLookupError || !bookingBeforeUpdate) {
        throw bookingLookupError ?? new Error('Booking not found');
      }

      const previousStatus = bookingBeforeUpdate.booking_status ?? bookingBeforeUpdate.status;

      if (parsed.data.status === 'completed' && bookingBeforeUpdate.payment_mode === 'direct_to_provider') {
        const { data: cashCollection } = await writeSupabase
          .from('booking_payment_collections')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('status', 'paid')
          .maybeSingle();

        if (!cashCollection) {
          throw new Error('Cash payment must be marked as received before completing this booking.');
        }
      }

      await updateBookingStatus(writeSupabase, bookingId, parsed.data.status, {
        cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
        cancellationReason: parsed.data.cancellationReason,
        actorId: user.id,
        actorRole,
        source: 'api/admin/bookings/bulk-status',
      });

      // Restore wallet credits on cancellation (matching single-booking status route)
      if (parsed.data.status === 'cancelled') {
        const walletCredits = Number(bookingBeforeUpdate.wallet_credits_applied_inr ?? 0);
        if (walletCredits > 0) {
          restoreCredits(bookingBeforeUpdate.user_id, walletCredits, bookingId).catch((err) =>
            console.error('[bulk-status] credit restore failed (non-fatal):', err),
          );
        }
      }

      // Trigger referral reward on completion (matching single-booking status route)
      if (parsed.data.status === 'completed') {
        processReferrerRewardOnFirstBooking(bookingBeforeUpdate.user_id, bookingId).catch((err) =>
          console.error('[bulk-status] referral reward failed (non-fatal):', err),
        );
      }

      notifyBookingStatusChanged(
        writeSupabase,
        {
          id: bookingBeforeUpdate.id,
          user_id: bookingBeforeUpdate.user_id,
          provider_id: bookingBeforeUpdate.provider_id,
          service_type: null,
        },
        previousStatus,
        parsed.data.status,
        role === 'staff' ? 'staff' : 'admin',
      ).catch((notifyError) => {
        console.error('Notification hook failed (bulk booking status change)', notifyError);
      });

      void logAdminAction({
        adminUserId: user.id,
        action: 'booking.status_override',
        entityType: 'booking',
        entityId: String(bookingId),
        newValue: { status: parsed.data.status },
        metadata: { source: 'bulk', cancellationReason: parsed.data.cancellationReason ?? null },
        request,
      });
      results.push({ bookingId, success: true });
    } catch (error) {
      const mapped = toFriendlyApiError(error, 'Unable to update booking');

      logSecurityEvent('error', 'booking.failure', {
        route: 'api/admin/bookings/bulk-status',
        actorId: user.id,
        actorRole: role,
        targetId: bookingId,
        message: error instanceof Error ? error.message : String(error),
        metadata: {
          requestedStatus: parsed.data.status,
          responseStatus: mapped.status,
        },
      });

      results.push({
        bookingId,
        success: false,
        error: mapped.message,
      });
    }
  }

  logSecurityEvent('info', 'admin.action', {
    route: 'api/admin/bookings/bulk-status',
    actorId: user.id,
    actorRole: role,
    metadata: {
      action: 'bulk_booking_status_update',
      status: parsed.data.status,
      total: parsed.data.bookingIds.length,
      updated: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
    },
  });

  return NextResponse.json({
    success: true,
    status: parsed.data.status,
    updated: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  });
}
