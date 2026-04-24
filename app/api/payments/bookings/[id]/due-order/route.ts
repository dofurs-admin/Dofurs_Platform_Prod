import { NextResponse } from 'next/server';
import { requireApiRole, forbidden } from '@/lib/auth/api-auth';
import { createRazorpayOrder, getRazorpayPublicConfig } from '@/lib/payments/razorpay';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { user, role } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID.' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const summary = await getBookingOutstandingSummary(admin, bookingId).catch(() => null);

  if (!summary) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  if (role === 'user' && summary.booking.user_id !== user.id) {
    return forbidden();
  }

  if (role === 'provider') {
    const { data: providerBooking } = await admin
      .from('bookings')
      .select('id, providers!inner(user_id)')
      .eq('id', bookingId)
      .maybeSingle<{ id: number; providers: { user_id: string } | Array<{ user_id: string }> }>();

    const providerUserId = (Array.isArray(providerBooking?.providers)
      ? providerBooking?.providers[0]
      : providerBooking?.providers)?.user_id;

    if (!providerUserId || providerUserId !== user.id) {
      return forbidden();
    }
  }

  if (!['pending', 'confirmed', 'in_progress'].includes(summary.booking.booking_status)) {
    return NextResponse.json({ error: 'Online payment is available only before service completion.' }, { status: 400 });
  }

  if (summary.outstandingInr <= 0) {
    return NextResponse.json({ error: 'Booking has no pending payable amount.' }, { status: 400 });
  }

  const amountInPaise = Math.round(summary.outstandingInr * 100);
  const receipt = `due_${bookingId}_${Date.now()}`;

  let order: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    order = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: summary.booking.user_id,
        bookingId: String(bookingId),
      },
    });
  } catch (error) {
    console.error('[bookings/due-order] Razorpay order creation failed:', error);
    return NextResponse.json({ error: 'Payment gateway is temporarily unavailable.' }, { status: 503 });
  }

  const { data: transaction, error: txError } = await admin
    .from('payment_transactions')
    .insert({
      user_id: summary.booking.user_id,
      provider: 'razorpay',
      transaction_type: 'service_collection',
      status: 'initiated',
      amount_inr: summary.outstandingInr,
      currency: order.currency,
      booking_id: bookingId,
      metadata: {
        checkout_context: 'booking_due',
        provider_order_id: order.id,
        receipt,
      },
    })
    .select('id, amount_inr, currency, status')
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: txError?.message ?? 'Unable to start payment.' }, { status: 500 });
  }

  return NextResponse.json({
    transaction,
    razorpay: {
      keyId: getRazorpayPublicConfig().keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      name: 'Dofurs',
      description: 'Booking Pending Payment',
      prefill: {
        email: user.email,
      },
      notes: {
        bookingId: String(bookingId),
      },
    },
  });
}
