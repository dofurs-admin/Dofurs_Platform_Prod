import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { razorpay } from '@/lib/payments/razorpay';
import { reverseDiscountRedemptionForBooking } from '@/lib/bookings/discounts';
import { getISTTimestamp } from '@/lib/utils/date';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { id: bookingIdRaw } = await params;
  const bookingId = Number.parseInt(bookingIdRaw, 10);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Admin-initiated refund';

  const admin = getSupabaseAdminClient();

  // Fetch the booking to confirm it exists and is in a refundable state.
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, booking_status, price_at_booking, discount_code')
    .eq('id', bookingId)
    .maybeSingle<{
      id: number;
      user_id: string;
      booking_status: string;
      price_at_booking: number | null;
      discount_code: string | null;
    }>();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  // Find the captured payment transaction linked to this booking.
  const { data: tx, error: txError } = await admin
    .from('payment_transactions')
    .select('id, provider_payment_id, amount_inr, status')
    .eq('booking_id', bookingId)
    .eq('provider', 'razorpay')
    .eq('transaction_type', 'service_collection')
    .eq('status', 'captured')
    .maybeSingle<{
      id: string;
      provider_payment_id: string | null;
      amount_inr: number | string;
      status: string;
    }>();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  if (!tx || !tx.provider_payment_id) {
    return NextResponse.json(
      { error: 'No captured Razorpay payment found for this booking.' },
      { status: 404 },
    );
  }

  const amountInPaise = Math.round(Number(tx.amount_inr) * 100);
  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    return NextResponse.json({ error: 'Booking amount is not valid for refund.' }, { status: 400 });
  }

  // Issue refund via Razorpay.
  let refundResponse: { id: string };
  try {
    refundResponse = await razorpay.payments.refund(tx.provider_payment_id, {
      amount: amountInPaise,
      notes: { reason },
    }) as { id: string };
  } catch (razorpayError) {
    console.error('[bookings/refund] Razorpay refund failed:', razorpayError);
    return NextResponse.json(
      {
        error:
          razorpayError instanceof Error
            ? razorpayError.message
            : 'Razorpay refund request failed. Please try again.',
      },
      { status: 502 },
    );
  }

  // Mark transaction as refunded.
  await admin
    .from('payment_transactions')
    .update({
      status: 'refunded',
      metadata: { refund_id: refundResponse.id, refund_reason: reason, refunded_at: getISTTimestamp() },
    })
    .eq('id', tx.id);

  // Record the adjustment event for audit trail.
  await admin.from('booking_adjustment_events').insert({
    booking_id: bookingId,
    actor_id: auth.context.user.id,
    adjustment_amount: Number(tx.amount_inr),
    adjustment_type: 'refund',
    reason,
    metadata: { razorpay_refund_id: refundResponse.id, payment_transaction_id: tx.id },
  });

  // Reverse any discount redemption so usage counts are restored.
  if (booking.discount_code) {
    try {
      await reverseDiscountRedemptionForBooking(bookingId, reason);
    } catch (redemptionError) {
      console.error('[bookings/refund] Discount redemption reversal failed (non-fatal):', redemptionError);
    }
  }

  return NextResponse.json({
    success: true,
    refundId: refundResponse.id,
    amountInr: Number(tx.amount_inr),
    message: 'Refund issued successfully.',
  });
}
