import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { cancelBookingAsProvider, confirmBooking, completeBooking, markNoShow } from '@/lib/bookings/service';
import { completeProviderBookingCompletionTask } from '@/lib/bookings/completion-tasks';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { restoreCredits } from '@/lib/credits/wallet';
import { processReferrerRewardOnFirstBooking } from '@/lib/referrals/service';

type CompletionTaskStatusRow = {
  task_status: 'pending' | 'completed' | null;
};

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 40,
};

const payloadSchema = z.object({
  status: z.enum(['confirmed', 'in_progress', 'completed', 'no_show', 'cancelled']),
  providerNotes: z.string().trim().max(2000).optional(),
  completionFeedback: z.string().trim().max(4000).optional(),
  cancellationReason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['provider']);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;

  const rate = await isRateLimited(supabase, getRateLimitKey('provider:bookings:status:patch', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const writeSupabase = getSupabaseAdminClient();

    if (parsed.data.status === 'confirmed') {
      const booking = await confirmBooking(writeSupabase, user.id, bookingId, parsed.data.providerNotes);
      return NextResponse.json({ success: true, booking });
    }

    if (parsed.data.status === 'completed') {
      const completionFeedback = parsed.data.completionFeedback?.trim() ?? parsed.data.providerNotes?.trim() ?? '';

      const { data: completionTask, error: completionTaskError } = await writeSupabase
        .from('provider_booking_completion_tasks')
        .select('task_status')
        .eq('booking_id', bookingId)
        .maybeSingle<CompletionTaskStatusRow>();

      if (completionTaskError) {
        throw completionTaskError;
      }

      const requiresCompletionFeedback = completionTask?.task_status === 'pending';

      if (requiresCompletionFeedback && !completionFeedback) {
        return NextResponse.json(
          { error: 'Completion feedback is required before marking booking complete.' },
          { status: 400 },
        );
      }

      // Cash payment gate: direct_to_provider bookings require cash to be marked received
      const { data: bookingPaymentCheck } = await writeSupabase
        .from('bookings')
        .select('payment_mode')
        .eq('id', bookingId)
        .single<{ payment_mode: string | null }>();

      if (bookingPaymentCheck?.payment_mode === 'direct_to_provider') {
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

      const booking = await completeBooking(writeSupabase, user.id, bookingId, parsed.data.providerNotes);

      if (completionFeedback) {
        await completeProviderBookingCompletionTask(writeSupabase, {
          bookingId,
          providerId: booking.provider_id,
          feedbackText: completionFeedback,
        });
      }

      // Trigger referral reward on first booking completion (matching user-facing route)
      processReferrerRewardOnFirstBooking(booking.user_id, bookingId).catch((err) =>
        console.error('[provider/status] referral reward failed (non-fatal):', err),
      );

      return NextResponse.json({ success: true, booking });
    }

    if (parsed.data.status === 'no_show') {
      const booking = await markNoShow(writeSupabase, user.id, bookingId, parsed.data.providerNotes);
      return NextResponse.json({ success: true, booking });
    }

    const booking = await cancelBookingAsProvider(
      writeSupabase,
      user.id,
      bookingId,
      parsed.data.cancellationReason,
      parsed.data.providerNotes,
    );

    // Restore wallet credits on provider cancellation (matching user-facing route)
    const walletCredits = Number(booking.wallet_credits_applied_inr ?? 0);
    if (walletCredits > 0) {
      restoreCredits(booking.user_id, walletCredits, bookingId).catch((err) =>
        console.error('[provider/status] credit restore failed (non-fatal):', err),
      );
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update booking status');
    const message = error instanceof Error ? error.message : String(error);

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/provider/bookings/[id]/status',
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
