import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { markBookingPaymentCollected } from '@/lib/payments/payAfterService';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
import { buildServiceInvoiceLineItemsForBooking } from '@/lib/payments/serviceInvoiceItems';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  // Use admin client — session client cannot write booking_payment_collections or
  // payment_transactions (RLS only allows owned SELECTs for non-service-role).
  const admin = getSupabaseAdminClient();
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID.' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const collectionMode = payload?.collectionMode as 'cash' | 'upi' | 'other';
  const notes = typeof payload?.notes === 'string' ? payload.notes : null;

  if (!['cash', 'upi', 'other'].includes(collectionMode)) {
    return NextResponse.json({ error: 'collectionMode must be cash, upi or other.' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, provider_id, service_type, provider_service_id, provider_notes, internal_notes, booking_status, payment_mode, price_at_booking, admin_price_reference, discount_amount, final_price, wallet_credits_applied_inr')
    .eq('id', bookingId)
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

  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return NextResponse.json({ error: 'Booking has no pending cash amount to collect.' }, { status: 400 });
  }

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
    collectionMode,
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

  return NextResponse.json({
    success: true,
    collection,
    transaction,
  });
}
