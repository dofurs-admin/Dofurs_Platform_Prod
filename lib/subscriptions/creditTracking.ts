import type { SupabaseClient } from '@supabase/supabase-js';
import { isServiceTypeMatch } from '@/lib/subscriptions/serviceTypeMatching';

export async function reserveCreditForBooking(
  supabase: SupabaseClient,
  bookingId: number,
  userId: string,
  serviceType: string,
  serviceAmount: number,
) {
  if (!Number.isFinite(serviceAmount) || serviceAmount <= 0) {
    throw new Error('Service amount must be a positive number for subscription credit reservation.');
  }
  const { data: existingLink, error: existingLinkError } = await supabase
    .from('booking_subscription_credit_links')
    .select('id, booking_id, user_subscription_id, service_type, status')
    .eq('booking_id', bookingId)
    .maybeSingle<{
      id: string;
      booking_id: number;
      user_subscription_id: string;
      service_type: string;
      status: 'reserved' | 'consumed' | 'released' | 'restored' | string;
    }>();

  if (existingLinkError) {
    throw existingLinkError;
  }

  if (existingLink) {
    const { data: existingReservedEvent, error: existingReservedEventError } = await supabase
      .from('credit_usage_events')
      .select('id')
      .eq('booking_credit_link_id', existingLink.id)
      .eq('event_type', 'reserved')
      .maybeSingle<{ id: string }>();

    if (existingReservedEventError) {
      throw existingReservedEventError;
    }

    if (existingReservedEvent) {
      return {
        id: existingLink.id,
        booking_id: existingLink.booking_id,
        user_subscription_id: existingLink.user_subscription_id,
        service_type: existingLink.service_type,
        status: existingLink.status,
      };
    }

    const { data: linkCreditRow, error: linkCreditError } = await supabase
      .from('user_service_credits')
      .select('id, available_credits, consumed_credits')
      .eq('user_subscription_id', existingLink.user_subscription_id)
      .eq('service_type', existingLink.service_type)
      .single();

    if (linkCreditError || !linkCreditRow) {
      throw linkCreditError ?? new Error('Credit row not found while repairing existing reservation.');
    }

    if (linkCreditRow.available_credits < serviceAmount) {
      throw new Error('Insufficient subscription credits for this service.');
    }

    const nextAvailableCredits = linkCreditRow.available_credits - serviceAmount;
    const nextConsumedCredits = linkCreditRow.consumed_credits + serviceAmount;

    const { error: debitExistingError } = await supabase
      .from('user_service_credits')
      .update({
        available_credits: nextAvailableCredits,
        consumed_credits: nextConsumedCredits,
      })
      .eq('id', linkCreditRow.id)
      .eq('available_credits', linkCreditRow.available_credits);

    if (debitExistingError) {
      throw debitExistingError;
    }

    if (existingLink.status !== 'reserved') {
      await supabase
        .from('booking_subscription_credit_links')
        .update({ status: 'reserved' })
        .eq('id', existingLink.id);
    }

    const { error: repairEventError } = await supabase.from('credit_usage_events').insert({
      booking_credit_link_id: existingLink.id,
      user_id: userId,
      user_subscription_id: existingLink.user_subscription_id,
      booking_id: bookingId,
      service_type: existingLink.service_type,
      event_type: 'reserved',
      notes: `Reservation event repaired during idempotent reserve (requested service: ${serviceType}, amount: ${serviceAmount})`,
    });

    if (repairEventError) {
      // Best effort rollback of repaired debit when event insert fails.
      await supabase
        .from('user_service_credits')
        .update({
          available_credits: linkCreditRow.available_credits,
          consumed_credits: linkCreditRow.consumed_credits,
        })
        .eq('id', linkCreditRow.id);

      throw repairEventError;
    }

    return {
      id: existingLink.id,
      booking_id: existingLink.booking_id,
      user_subscription_id: existingLink.user_subscription_id,
      service_type: existingLink.service_type,
      status: 'reserved',
    };
  }

  const nowMs = Date.now();
  const { data: activeSubscriptions, error: activeError } = await supabase
    .from('user_subscriptions')
    .select('id, starts_at, ends_at, user_service_credits(id, service_type, available_credits, consumed_credits)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('ends_at', { ascending: false });

  if (activeError) throw activeError;
  if (!activeSubscriptions || activeSubscriptions.length === 0) {
    throw new Error('No active subscription found.');
  }

  let matchedCreditId: string | null = null;
  let matchedServiceType: string | null = null;

  const active = activeSubscriptions.find((sub) => {
    const startsAtMs = sub.starts_at ? Date.parse(sub.starts_at) : NaN;
    const endsAtMs = sub.ends_at ? Date.parse(sub.ends_at) : NaN;
    const startsValid = Number.isNaN(startsAtMs) ? true : startsAtMs <= nowMs;
    const endsValid = Number.isNaN(endsAtMs) ? false : endsAtMs >= nowMs;
    const isWithinActiveWindow = startsValid && endsValid;
    if (!isWithinActiveWindow) {
      return false;
    }

    const credits = Array.isArray(sub.user_service_credits) ? sub.user_service_credits : [];
    const matching = credits.find((row) => isServiceTypeMatch(row.service_type, serviceType));

    if (matching && matching.available_credits >= serviceAmount) {
      matchedCreditId = String((matching as { id: unknown }).id);
      matchedServiceType = matching.service_type;
      return true;
    }

    return false;
  });

  if (!active || !matchedCreditId || !matchedServiceType) {
    throw new Error('Insufficient subscription credits for this service.');
  }

  // Debit immediately on booking creation so wallet visibility reflects reservation in real time.
  const MAX_RETRIES = 3;
  let debitApplied = false;
  let debitedSnapshot: { available_credits: number; consumed_credits: number } | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const { data: freshCredit, error: freshCreditError } = await supabase
      .from('user_service_credits')
      .select('id, available_credits, consumed_credits')
      .eq('id', matchedCreditId)
      .single();

    if (freshCreditError || !freshCredit) {
      throw freshCreditError ?? new Error('Credit row not found while reserving credit.');
    }

    if (freshCredit.available_credits < serviceAmount) {
      throw new Error('Insufficient subscription credits for this service.');
    }

    const nextAvailableCredits = freshCredit.available_credits - serviceAmount;
    const nextConsumedCredits = freshCredit.consumed_credits + serviceAmount;

    const { error: debitError } = await supabase
      .from('user_service_credits')
      .update({
        available_credits: nextAvailableCredits,
        consumed_credits: nextConsumedCredits,
      })
      .eq('id', freshCredit.id)
      .eq('available_credits', freshCredit.available_credits);

    if (!debitError) {
      const { data: verifiedRow, error: verifyError } = await supabase
        .from('user_service_credits')
        .select('id')
        .eq('id', freshCredit.id)
        .eq('available_credits', nextAvailableCredits)
        .eq('consumed_credits', nextConsumedCredits)
        .maybeSingle();

      if (verifyError) {
        throw verifyError;
      }

      if (!verifiedRow) {
        continue;
      }

      debitApplied = true;
      debitedSnapshot = {
        available_credits: freshCredit.available_credits,
        consumed_credits: freshCredit.consumed_credits,
      };
      break;
    }
  }

  if (!debitApplied || !debitedSnapshot) {
    throw new Error('Credit reservation failed: concurrent modification detected after retries.');
  }

  const { data: link, error: linkError } = await supabase
    .from('booking_subscription_credit_links')
    .upsert(
      {
        booking_id: bookingId,
        user_id: userId,
        user_subscription_id: active.id,
        service_type: matchedServiceType,
        status: 'reserved',
      },
      { onConflict: 'booking_id' },
    )
    .select('id, booking_id, user_subscription_id, service_type, status')
    .single();

  if (linkError || !link) {
    // Compensate credit debit if link creation fails.
    await supabase
      .from('user_service_credits')
      .update({
        available_credits: debitedSnapshot.available_credits,
        consumed_credits: debitedSnapshot.consumed_credits,
      })
      .eq('id', matchedCreditId);

    throw linkError ?? new Error('Unable to reserve booking credit.');
  }

  const { error: eventError } = await supabase.from('credit_usage_events').insert({
    booking_credit_link_id: link.id,
    user_id: userId,
    user_subscription_id: active.id,
    booking_id: bookingId,
    service_type: matchedServiceType,
    event_type: 'reserved',
    notes: `Booking created with subscription credit option (requested service: ${serviceType}, amount: ${serviceAmount})`,
  });

  if (eventError) {
    // Compensate both link and debit if event logging fails.
    await supabase.from('booking_subscription_credit_links').delete().eq('id', link.id);
    await supabase
      .from('user_service_credits')
      .update({
        available_credits: debitedSnapshot.available_credits,
        consumed_credits: debitedSnapshot.consumed_credits,
      })
      .eq('id', matchedCreditId);

    throw eventError;
  }

  return link;
}

export async function consumeOrRestoreCreditForBookingTransition(
  supabase: SupabaseClient,
  bookingId: number,
  nextStatus: 'completed' | 'cancelled',
) {
  const { data: link, error: linkError } = await supabase
    .from('booking_subscription_credit_links')
    .select('id, user_id, user_subscription_id, service_type, status')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link) return;

  // Look up the booking's price to know how many credits to restore on cancellation.
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('price_at_booking')
    .eq('id', bookingId)
    .single<{ price_at_booking: number | null }>();

  if (bookingError || !booking) {
    throw bookingError ?? new Error('Booking not found for credit transition.');
  }

  const serviceAmount = Number(booking.price_at_booking ?? 0);
  if (!Number.isFinite(serviceAmount) || serviceAmount <= 0) {
    throw new Error('Booking price is invalid for credit transition.');
  }

  const { data: creditRow, error: creditError } = await supabase
    .from('user_service_credits')
    .select('id, total_credits, available_credits, consumed_credits')
    .eq('user_subscription_id', link.user_subscription_id)
    .eq('service_type', link.service_type)
    .single();

  if (creditError || !creditRow) throw creditError ?? new Error('Credit row not found.');

  if (nextStatus === 'completed' && link.status === 'reserved') {
    const { error: linkUpdateError } = await supabase
      .from('booking_subscription_credit_links')
      .update({ status: 'consumed' })
      .eq('id', link.id);

    if (linkUpdateError) throw linkUpdateError;

    await supabase.from('credit_usage_events').insert({
      booking_credit_link_id: link.id,
      user_id: link.user_id,
      user_subscription_id: link.user_subscription_id,
      booking_id: bookingId,
      service_type: link.service_type,
      event_type: 'consumed',
      notes: 'Credit consumed on booking completion',
    });

    return;
  }

  if (nextStatus === 'cancelled') {
    if (link.status === 'reserved') {
      const nextAvailableCredits = Math.min(creditRow.total_credits, creditRow.available_credits + serviceAmount);
      const nextConsumedCredits = Math.max(0, creditRow.total_credits - nextAvailableCredits);

      const { error: restoreReservedError } = await supabase
        .from('user_service_credits')
        .update({
          available_credits: nextAvailableCredits,
          consumed_credits: nextConsumedCredits,
        })
        .eq('id', creditRow.id);

      if (restoreReservedError) throw restoreReservedError;

      await supabase.from('booking_subscription_credit_links').update({ status: 'released' }).eq('id', link.id);
      await supabase.from('credit_usage_events').insert({
        booking_credit_link_id: link.id,
        user_id: link.user_id,
        user_subscription_id: link.user_subscription_id,
        booking_id: bookingId,
        service_type: link.service_type,
        event_type: 'released',
        notes: `Reserved credit released after cancellation (amount: ${serviceAmount})`,
      });
      return;
    }

    if (link.status === 'consumed') {
      const nextAvailableCredits = Math.min(creditRow.total_credits, creditRow.available_credits + serviceAmount);
      const nextConsumedCredits = Math.max(0, creditRow.total_credits - nextAvailableCredits);

      const { error: restoreCreditError } = await supabase
        .from('user_service_credits')
        .update({
          available_credits: nextAvailableCredits,
          consumed_credits: nextConsumedCredits,
        })
        .eq('id', creditRow.id);

      if (restoreCreditError) throw restoreCreditError;

      await supabase.from('booking_subscription_credit_links').update({ status: 'restored' }).eq('id', link.id);
      await supabase.from('credit_usage_events').insert({
        booking_credit_link_id: link.id,
        user_id: link.user_id,
        user_subscription_id: link.user_subscription_id,
        booking_id: bookingId,
        service_type: link.service_type,
        event_type: 'restored',
        notes: `Consumed credit restored after cancellation (amount: ${serviceAmount})`,
      });
    }
  }
}
