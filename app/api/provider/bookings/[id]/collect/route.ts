import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { markBookingPaymentCollected } from '@/lib/payments/payAfterService';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
import { buildServiceInvoiceLineItemsForBooking } from '@/lib/payments/serviceInvoiceItems';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';
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
      .select('id, user_id, provider_id, service_type, provider_service_id, provider_notes, internal_notes, booking_status, payment_mode, price_at_booking, admin_price_reference, discount_amount, final_price, wallet_credits_applied_inr')
      .eq('id', bookingId)
      .eq('provider_id', providerId)
      .single<{
        id: number;
        user_id: string;
        provider_id: number;
        service_type: string | null;
        provider_service_id: string | null;
        provider_notes: string | null;
        internal_notes: string | null;
        booking_status: string;
        payment_mode: string | null;
        price_at_booking: number | null;
        admin_price_reference: number | null;
        discount_amount: number | null;
        final_price: number | null;
        wallet_credits_applied_inr: number | null;
      }>();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.payment_mode !== 'direct_to_provider' && booking.payment_mode !== 'mixed') {
      return NextResponse.json(
        { error: 'This booking has no cash-payable component to collect manually.' },
        { status: 400 },
      );
    }

    if (booking.booking_status === 'cancelled' || booking.booking_status === 'no_show') {
      return NextResponse.json(
        { error: 'Cannot mark payment for a cancelled or no-show booking.' },
        { status: 400 },
      );
    }

    const outstanding = await getBookingOutstandingSummary(admin, bookingId);
    const amountInr = outstanding.outstandingInr;

    if (amountInr <= 0) {
      return NextResponse.json(
        { error: 'Booking has no pending cash amount to collect.' },
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

    const serviceLineItems = await buildServiceInvoiceLineItemsForBooking(admin, booking, amountInr);

    await createServiceInvoice(admin, {
      userId: booking.user_id,
      bookingId,
      paymentTransactionId: transaction.id,
      description: `${booking.service_type ?? 'Service'} booking payment (${collectionMode})`,
      amountInr,
      discountInr: 0,
      walletCreditsAppliedInr: 0,
      serviceLineItems,
      status: 'paid',
    });

    return NextResponse.json({ success: true, collection, transaction });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to record payment collection');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
