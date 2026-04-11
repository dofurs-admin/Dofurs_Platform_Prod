import type { SupabaseClient } from '@supabase/supabase-js';

export async function markBookingPaymentCollected(
  supabase: SupabaseClient,
  input: {
    bookingId: number;
    userId: string;
    providerId?: number | null;
    amountInr: number;
    collectionMode: 'cash' | 'upi' | 'other';
    markedPaidBy: string;
    notes?: string | null;
  },
) {
  const now = new Date().toISOString();

  const { data: collection, error: collectionError } = await supabase
    .from('booking_payment_collections')
    .upsert(
      {
        booking_id: input.bookingId,
        user_id: input.userId,
        provider_id: input.providerId ?? null,
        collection_mode: input.collectionMode,
        amount_inr: input.amountInr,
        status: 'paid',
        marked_paid_by: input.markedPaidBy,
        marked_paid_at: now,
        notes: input.notes ?? null,
      },
      { onConflict: 'booking_id' },
    )
    .select('id, booking_id, amount_inr, status')
    .single();

  if (collectionError || !collection) {
    throw collectionError ?? new Error('Unable to mark booking collection paid.');
  }

  const { data: existingTransaction, error: existingTransactionError } = await supabase
    .from('payment_transactions')
    .select('id, booking_id, status')
    .eq('provider', 'manual')
    .eq('transaction_type', 'service_collection')
    .eq('booking_id', input.bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTransactionError) {
    throw existingTransactionError;
  }

  if (existingTransaction) {
    return { collection, transaction: existingTransaction };
  }

  const { data: transaction, error: txError } = await supabase
    .from('payment_transactions')
    .insert({
      user_id: input.userId,
      provider: 'manual',
      transaction_type: 'service_collection',
      status: 'paid_manual',
      amount_inr: input.amountInr,
      currency: 'INR',
      booking_id: input.bookingId,
      metadata: {
        collection_mode: input.collectionMode,
        collection_id: collection.id,
      },
    })
    .select('id, booking_id, status')
    .single();

  if (txError || !transaction) {
    throw txError ?? new Error('Unable to log manual payment transaction.');
  }

  return { collection, transaction };
}
