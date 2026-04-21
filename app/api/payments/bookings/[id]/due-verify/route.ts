import { NextResponse } from 'next/server';
import { requireApiRole, forbidden } from '@/lib/auth/api-auth';
import { fetchRazorpayPayment, verifyPaymentSignature } from '@/lib/payments/razorpay';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { user, role } = auth.context;
  const admin = getSupabaseAdminClient();
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const providerOrderId = typeof body?.providerOrderId === 'string' ? body.providerOrderId : '';
  const providerPaymentId = typeof body?.providerPaymentId === 'string' ? body.providerPaymentId : '';
  const providerSignature = typeof body?.providerSignature === 'string' ? body.providerSignature : '';

  if (!providerOrderId || !providerPaymentId || !providerSignature) {
    return NextResponse.json({ error: 'Missing payment verification fields.' }, { status: 400 });
  }

  const signatureValid = verifyPaymentSignature({
    providerOrderId,
    providerPaymentId,
    providerSignature,
  });

  if (!signatureValid) {
    return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
  }

  const { data: tx, error: txError } = await admin
    .from('payment_transactions')
    .select('id, user_id, booking_id, amount_inr, currency, status, metadata')
    .eq('provider', 'razorpay')
    .eq('transaction_type', 'service_collection')
    .eq('booking_id', bookingId)
    .filter('metadata->>provider_order_id', 'eq', providerOrderId)
    .filter('metadata->>checkout_context', 'eq', 'booking_due')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      user_id: string;
      booking_id: number | null;
      amount_inr: number;
      currency: string;
      status: string;
      metadata: Record<string, unknown> | null;
    }>();

  if (txError) {
    return NextResponse.json({ error: 'Unable to validate payment transaction.' }, { status: 500 });
  }

  if (!tx) {
    return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
  }

  if ((role === 'user' || role === 'provider') && tx.user_id !== user.id) {
    return forbidden();
  }

  if (tx.status === 'captured') {
    return NextResponse.json({ success: true, booking: { id: bookingId }, message: 'Payment already verified.' });
  }

  if (!['initiated', 'authorized'].includes(tx.status)) {
    return NextResponse.json({ error: `Payment transaction is in invalid state (${tx.status}).` }, { status: 409 });
  }

  let razorpayPayment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
  try {
    razorpayPayment = await fetchRazorpayPayment(providerPaymentId);
  } catch (error) {
    console.error('[bookings/due-verify] failed to fetch Razorpay payment status:', error);
    return NextResponse.json({ error: 'Unable to confirm payment status with Razorpay.' }, { status: 503 });
  }

  if (razorpayPayment.order_id !== providerOrderId) {
    return NextResponse.json({ error: 'Payment does not belong to this order.' }, { status: 409 });
  }

  if (razorpayPayment.status !== 'captured') {
    return NextResponse.json({ error: 'Payment is not captured yet. Please retry verification.' }, { status: 409 });
  }

  const { error: txUpdateError } = await admin
    .from('payment_transactions')
    .update({
      status: 'captured',
      provider_payment_id: providerPaymentId,
      provider_signature: providerSignature,
      metadata: {
        ...(tx.metadata ?? {}),
        verified_at: getISTTimestamp(),
      },
    })
    .eq('id', tx.id);

  if (txUpdateError) {
    return NextResponse.json({ error: txUpdateError.message ?? 'Unable to finalize payment transaction.' }, { status: 500 });
  }

  const summary = await getBookingOutstandingSummary(admin, bookingId);

  if (summary.outstandingInr > 0) {
    await admin
      .from('bookings')
      .update({ payment_mode: 'mixed' })
      .eq('id', bookingId);

    await admin
      .from('booking_payment_collections')
      .upsert(
        {
          booking_id: bookingId,
          user_id: summary.booking.user_id,
          provider_id: summary.booking.provider_id,
          amount_inr: summary.outstandingInr,
          collection_mode: 'cash',
          status: 'pending',
          marked_paid_by: null,
          marked_paid_at: null,
        },
        { onConflict: 'booking_id' },
      );
  } else {
    await admin
      .from('bookings')
      .update({ payment_mode: 'platform' })
      .eq('id', bookingId);

    await admin
      .from('booking_payment_collections')
      .upsert(
        {
          booking_id: bookingId,
          user_id: summary.booking.user_id,
          provider_id: summary.booking.provider_id,
          amount_inr: 0,
          collection_mode: 'online',
          status: 'paid',
          marked_paid_by: user.id,
          marked_paid_at: getISTTimestamp(),
        },
        { onConflict: 'booking_id' },
      );
  }

  try {
    await createServiceInvoice(admin, {
      userId: tx.user_id,
      bookingId,
      paymentTransactionId: tx.id,
      description: 'Booking pending amount paid via Razorpay',
      amountInr: Number(tx.amount_inr ?? 0),
      discountInr: 0,
      walletCreditsAppliedInr: 0,
      status: 'paid',
    });
  } catch (error) {
    console.error('[bookings/due-verify] invoice creation failed (non-blocking):', error);
  }

  await admin.from('payment_events').insert({
    transaction_id: tx.id,
    event_type: 'checkout.payment.verified',
    event_status: 'captured',
    provider: 'razorpay',
    provider_event_id: providerPaymentId,
    payload: {
      providerOrderId,
      providerPaymentId,
      verifiedAt: getISTTimestamp(),
      bookingId,
      checkoutContext: 'booking_due',
    },
  });

  return NextResponse.json({
    success: true,
    booking: { id: bookingId },
    pendingCashAmountInr: summary.outstandingInr,
    message: 'Payment verified successfully.',
  });
}
