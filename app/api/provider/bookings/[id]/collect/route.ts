import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { markBookingPaymentCollected } from '@/lib/payments/payAfterService';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['provider']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID.' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const collectionMode = payload?.collectionMode as string | undefined;
  const notes = typeof payload?.notes === 'string' ? payload.notes : null;

  if (!collectionMode || !['cash', 'upi', 'other'].includes(collectionMode)) {
    return NextResponse.json(
      { error: 'collectionMode must be cash, upi, or other.' },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseAdminClient();

    const providerId = await getProviderIdByUserId(admin, user.id);
    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile not found.' }, { status: 403 });
    }

    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select('id, user_id, provider_id, service_type, booking_status, payment_mode, price_at_booking, discount_amount, final_price, wallet_credits_applied_inr')
      .eq('id', bookingId)
      .eq('provider_id', providerId)
      .single<{
        id: number;
        user_id: string;
        provider_id: number;
        service_type: string | null;
        booking_status: string;
        payment_mode: string | null;
        price_at_booking: number | null;
        discount_amount: number | null;
        final_price: number | null;
        wallet_credits_applied_inr: number | null;
      }>();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.payment_mode !== 'direct_to_provider') {
      return NextResponse.json(
        { error: 'This booking was paid online. Manual collection is not applicable.' },
        { status: 400 },
      );
    }

    if (booking.booking_status === 'cancelled' || booking.booking_status === 'no_show') {
      return NextResponse.json(
        { error: 'Cannot mark payment for a cancelled or no-show booking.' },
        { status: 400 },
      );
    }

    const walletCreditsAppliedInr = Math.max(0, Number(booking.wallet_credits_applied_inr ?? 0));
    const subtotalInr = Math.max(0, Number(booking.price_at_booking ?? booking.final_price ?? 0));
    const discountInr = Math.max(0, Number(booking.discount_amount ?? 0));
    const amountInr = Math.max(0, subtotalInr - discountInr - walletCreditsAppliedInr);

    if (amountInr <= 0) {
      return NextResponse.json(
        { error: 'Booking has no payable amount recorded.' },
        { status: 400 },
      );
    }

    // Idempotency: check if payment was already collected for this booking
    const { data: existingCollection } = await admin
      .from('booking_payment_collections')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('status', 'paid')
      .maybeSingle();

    if (existingCollection) {
      return NextResponse.json({ success: true, message: 'Payment already collected.', collection: existingCollection });
    }

    const { collection, transaction } = await markBookingPaymentCollected(admin, {
      bookingId,
      userId: booking.user_id,
      providerId: booking.provider_id,
      amountInr,
      collectionMode: collectionMode as 'cash' | 'upi' | 'other',
      markedPaidBy: user.id,
      notes,
    });

    await createServiceInvoice(admin, {
      userId: booking.user_id,
      bookingId,
      paymentTransactionId: transaction.id,
      description: `${booking.service_type ?? 'Service'} booking payment (${collectionMode})`,
      amountInr: subtotalInr,
      discountInr,
      walletCreditsAppliedInr,
      status: 'paid',
    });

    return NextResponse.json({ success: true, collection, transaction });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to record payment collection');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
