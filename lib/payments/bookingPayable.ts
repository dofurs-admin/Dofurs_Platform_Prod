import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingPayableRow = {
  id: number;
  user_id: string;
  provider_id: number | null;
  payment_mode: string | null;
  booking_status: string;
  final_price: number | null;
  wallet_credits_applied_inr: number | null;
};

export type BookingOutstandingSummary = {
  booking: BookingPayableRow;
  payableBeforeCapturedInr: number;
  capturedOnlineInr: number;
  settledManualInr: number;
  settledTotalInr: number;
  outstandingInr: number;
};

export async function getCapturedOnlineAmountForBooking(
  supabase: SupabaseClient,
  bookingId: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('amount_inr')
    .eq('booking_id', bookingId)
    .eq('provider', 'razorpay')
    .eq('transaction_type', 'service_collection')
    .eq('status', 'captured');

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount_inr ?? 0)), 0);
}

export async function getSettledManualAmountForBooking(
  supabase: SupabaseClient,
  bookingId: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('amount_inr')
    .eq('booking_id', bookingId)
    .eq('provider', 'manual')
    .eq('transaction_type', 'service_collection')
    .eq('status', 'paid_manual');

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount_inr ?? 0)), 0);
}

export function computeBookingOutstandingInr(input: {
  finalPriceInr: number;
  walletCreditsAppliedInr: number;
  settledInr: number;
}): {
  payableBeforeCapturedInr: number;
  outstandingInr: number;
} {
  const finalPriceInr = Math.max(0, Number(input.finalPriceInr ?? 0));
  const walletCreditsAppliedInr = Math.max(0, Number(input.walletCreditsAppliedInr ?? 0));
  const settledInr = Math.max(0, Number(input.settledInr ?? 0));

  const payableBeforeCapturedInr = Math.max(0, finalPriceInr - walletCreditsAppliedInr);
  const outstandingInr = Math.max(0, payableBeforeCapturedInr - settledInr);

  return { payableBeforeCapturedInr, outstandingInr };
}

export async function getBookingOutstandingSummary(
  supabase: SupabaseClient,
  bookingId: number,
): Promise<BookingOutstandingSummary> {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, provider_id, payment_mode, booking_status, final_price, wallet_credits_applied_inr')
    .eq('id', bookingId)
    .single<BookingPayableRow>();

  if (bookingError || !booking) {
    throw bookingError ?? new Error('Booking not found.');
  }

  const capturedOnlineInr = await getCapturedOnlineAmountForBooking(supabase, bookingId);
  const settledManualInr = await getSettledManualAmountForBooking(supabase, bookingId);
  const settledTotalInr = capturedOnlineInr + settledManualInr;

  const { payableBeforeCapturedInr, outstandingInr } = computeBookingOutstandingInr({
    finalPriceInr: Number(booking.final_price ?? 0),
    walletCreditsAppliedInr: Number(booking.wallet_credits_applied_inr ?? 0),
    settledInr: settledTotalInr,
  });

  return {
    booking,
    payableBeforeCapturedInr,
    capturedOnlineInr,
    settledManualInr,
    settledTotalInr,
    outstandingInr,
  };
}
