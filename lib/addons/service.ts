import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import type { AppRole } from '@/lib/auth/api-auth';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';

export const BOOKING_ADDON_MUTABLE_STATUSES = new Set(['pending', 'confirmed', 'in_progress']);

export function normalizeSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'addon';
}

export function canUserMutateBookingAddons(role: AppRole | null, bookingUserId: string, actorUserId: string) {
  if (!role) {
    return false;
  }

  if (role === 'admin' || role === 'staff') {
    return true;
  }

  if (role === 'user') {
    return bookingUserId === actorUserId;
  }

  return role === 'provider';
}

export async function isProviderOwnerForBooking(supabase: SupabaseClient, actorUserId: string, bookingId: string) {
  const { data } = await supabase
    .from('bookings')
    .select('id, providers!inner(user_id)')
    .eq('id', bookingId)
    .maybeSingle<{ id: string; providers: { user_id: string } | Array<{ user_id: string }> }>();

  const ownerUserId = (Array.isArray(data?.providers) ? data?.providers[0] : data?.providers)?.user_id;
  return ownerUserId === actorUserId;
}

export async function recalculateBookingAddonTotals(supabase: SupabaseClient, bookingId: string) {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, provider_id, payment_mode, admin_price_reference, price_at_booking, discount_amount, wallet_credits_applied_inr')
    .eq('id', bookingId)
    .single<{
      id: string;
      user_id: string;
      provider_id: number | null;
      payment_mode: string | null;
      admin_price_reference: number | null;
      price_at_booking: number | null;
      discount_amount: number | null;
      wallet_credits_applied_inr: number | null;
    }>();

  if (bookingError || !booking) {
    throw bookingError ?? new Error('Booking not found');
  }

  const { data: addonRows, error: addonError } = await supabase
    .from('booking_addon_items')
    .select('total_price_snapshot, status')
    .eq('booking_id', bookingId)
    .in('status', ['selected', 'confirmed', 'fulfilled'])
    .returns<Array<{ total_price_snapshot: number; status: string }>>();

  if (addonError) {
    throw addonError;
  }

  const addonTotal = (addonRows ?? []).reduce((sum, row) => sum + Number(row.total_price_snapshot ?? 0), 0);
  const baseAmount = Number(booking.admin_price_reference ?? booking.price_at_booking ?? 0);
  const discount = Number(booking.discount_amount ?? 0);
  const final = Math.max(baseAmount + addonTotal - discount, 0);

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ final_price: final, amount: final })
    .eq('id', bookingId);

  if (updateError) {
    throw updateError;
  }

  const payableSummary = await getBookingOutstandingSummary(supabase, Number(bookingId));
  const payableBeforeCapturedInr = payableSummary.payableBeforeCapturedInr;
  const capturedOnlineInr = payableSummary.capturedOnlineInr;
  const settledManualInr = payableSummary.settledManualInr;
  const settledTotalInr = payableSummary.settledTotalInr;
  const outstandingInr = payableSummary.outstandingInr;

  const hasOnlineSettlements = capturedOnlineInr > 0;
  const hasManualSettlements = settledManualInr > 0;

  const nextPaymentMode = (() => {
    if (outstandingInr > 0) {
      if (hasOnlineSettlements || booking.payment_mode === 'platform' || booking.payment_mode === 'mixed') {
        return 'mixed';
      }

      return 'direct_to_provider';
    }

    if (hasOnlineSettlements && hasManualSettlements) {
      return 'mixed';
    }

    if (hasOnlineSettlements) {
      return 'platform';
    }

    if (hasManualSettlements) {
      return 'direct_to_provider';
    }

    return booking.payment_mode;
  })();

  if (nextPaymentMode !== booking.payment_mode) {
    const { error: paymentModeError } = await supabase
      .from('bookings')
      .update({ payment_mode: nextPaymentMode })
      .eq('id', bookingId);

    if (paymentModeError) {
      throw paymentModeError;
    }
  }

  const { data: existingCollection, error: collectionReadError } = await supabase
    .from('booking_payment_collections')
    .select('booking_id, collection_mode, status')
    .eq('booking_id', Number(bookingId))
    .maybeSingle<{ booking_id: number; collection_mode: string | null; status: string | null }>();

  if (collectionReadError) {
    throw collectionReadError;
  }

  if (outstandingInr > 0) {
    const collectionModeForOutstanding = existingCollection?.status === 'pending'
      ? existingCollection.collection_mode ?? 'cash'
      : 'cash';

    const { error: collectionUpsertError } = await supabase
      .from('booking_payment_collections')
      .upsert(
        {
          booking_id: Number(bookingId),
          user_id: booking.user_id,
          provider_id: booking.provider_id,
          amount_inr: outstandingInr,
          collection_mode: collectionModeForOutstanding,
          status: 'pending',
          marked_paid_by: null,
          marked_paid_at: null,
        },
        { onConflict: 'booking_id' },
      );

    if (collectionUpsertError) {
      throw collectionUpsertError;
    }
  } else if (existingCollection && existingCollection.status !== 'paid') {
    const { error: collectionCloseError } = await supabase
      .from('booking_payment_collections')
      .update({ amount_inr: 0, status: 'paid' })
      .eq('booking_id', Number(bookingId));

    if (collectionCloseError) {
      throw collectionCloseError;
    }
  }

  return {
    baseAmount,
    addonTotal,
    discount,
    final,
    payableBeforeCapturedInr,
    capturedOnlineInr,
    settledManualInr,
    settledTotalInr,
    outstandingInr,
    paymentMode: nextPaymentMode,
  };
}

export function getAddonEffectivePrice(priceOverride: number | null, defaultPrice: number) {
  if (typeof priceOverride === 'number' && Number.isFinite(priceOverride)) {
    return priceOverride;
  }

  return Number(defaultPrice ?? 0);
}

export function getAddonAdminClient() {
  return getSupabaseAdminClient();
}
