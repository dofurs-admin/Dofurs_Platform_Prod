import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { markBookingPaymentCollected } from '@/lib/payments/payAfterService';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
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
  const amountInr = Number(payload?.amountInr ?? 0);
  const collectionMode = payload?.collectionMode as 'cash' | 'upi' | 'other';
  const notes = typeof payload?.notes === 'string' ? payload.notes : null;

  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return NextResponse.json({ error: 'amountInr must be greater than zero.' }, { status: 400 });
  }

  if (!['cash', 'upi', 'other'].includes(collectionMode)) {
    return NextResponse.json({ error: 'collectionMode must be cash, upi or other.' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, provider_id, service_type')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
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

  await createServiceInvoice(admin, {
    userId: booking.user_id,
    bookingId,
    paymentTransactionId: transaction.id,
    description: `${booking.service_type ?? 'Service'} booking payment (${collectionMode})`,
    amountInr,
    status: 'paid',
  });

  return NextResponse.json({
    success: true,
    collection,
    transaction,
  });
}
