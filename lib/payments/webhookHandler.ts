import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { createOrActivateSubscriptionFromPayment } from '@/lib/subscriptions/subscriptionService';
import { createSubscriptionInvoice, createServiceInvoice } from '@/lib/payments/invoiceService';
import { createBooking } from '@/lib/bookings/service';
import { createDiscountRedemption } from '@/lib/bookings/discounts';

const REPLAY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes — covers legitimate network delays

type RazorpayWebhookEvent = {
  event: string;
  created_at?: number; // Unix timestamp from Razorpay
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
        currency?: string;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
      };
    };
  };
};

async function setProcessingError(supabase: SupabaseClient, providerEventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown processing error';
  await supabase
    .from('payment_webhook_events')
    .update({ processing_error: message })
    .eq('provider', 'razorpay')
    .eq('provider_event_id', providerEventId);
}

export async function processRazorpayWebhook(
  supabase: SupabaseClient,
  rawBody: string,
  signature: string | null,
) {
  if (!signature) {
    return { accepted: false, message: 'Missing webhook signature.' };
  }

  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return { accepted: false, message: 'Invalid webhook signature.' };
  }

  const event = JSON.parse(rawBody) as RazorpayWebhookEvent;

  // Replay protection: reject events without timestamp, too old, or with future timestamps
  if (!event.created_at) {
    return { accepted: false, message: 'Webhook rejected: missing event timestamp.' };
  }

  const eventTimestampMs = event.created_at * 1000;
  const nowMs = Date.now();
  const eventAgeMs = nowMs - eventTimestampMs;

  if (eventAgeMs > REPLAY_WINDOW_MS) {
    console.warn(`[webhook] Rejected stale event: age=${Math.round(eventAgeMs / 1000)}s, id=${event.payload?.payment?.entity?.id}`);
    return { accepted: false, message: 'Webhook rejected: event timestamp too old.' };
  }

  // Reject events claiming to be more than 5 minutes in the future (clock skew protection)
  const MAX_FUTURE_MS = 5 * 60 * 1000;
  if (eventTimestampMs > nowMs + MAX_FUTURE_MS) {
    console.warn(`[webhook] Rejected future event: future_delta=${Math.round((eventTimestampMs - nowMs) / 1000)}s, id=${event.payload?.payment?.entity?.id}`);
    return { accepted: false, message: 'Webhook rejected: event timestamp is in the future.' };
  }

  const providerEventId = event.payload?.payment?.entity?.id ?? null;

  if (!providerEventId) {
    return { accepted: false, message: 'Webhook payload missing provider event id.' };
  }

  const { data: existingWebhookEvent, error: existingWebhookEventError } = await supabase
    .from('payment_webhook_events')
    .select('id, processed, processed_at')
    .eq('provider', 'razorpay')
    .eq('provider_event_id', providerEventId)
    .maybeSingle();

  if (existingWebhookEventError) {
    throw existingWebhookEventError;
  }

  if (existingWebhookEvent?.processed) {
    return { accepted: true, message: 'Duplicate webhook ignored (already processed).' };
  }

  const { error: logError } = await supabase.from('payment_webhook_events').upsert(
    {
      provider: 'razorpay',
      provider_event_id: providerEventId,
      event_type: event.event,
      signature,
      payload: event,
      processed: false,
      processing_error: null,
    },
    { onConflict: 'provider,provider_event_id' },
  );

  if (logError) {
    throw logError;
  }

  // Wrap all processing — on any failure, record the error for retry/review
  try {
    return await processWebhookEvent(supabase, event, providerEventId);
  } catch (processingError) {
    await setProcessingError(supabase, providerEventId, processingError);
    throw processingError;
  }
}

async function processWebhookEvent(
  supabase: SupabaseClient,
  event: RazorpayWebhookEvent,
  providerEventId: string,
) {
  const isRefundEvent = event.event === 'payment.refunded' || event.event === 'refund.created';

  if (isRefundEvent) {
    await processRefundEvent(supabase, event);

    await supabase
      .from('payment_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq('provider', 'razorpay')
      .eq('provider_event_id', providerEventId);

    return { accepted: true, message: `Refund event ${event.event} processed.` };
  }

  if (event.event === 'payment.failed') {
    await processPaymentFailedEvent(supabase, event);

    await supabase
      .from('payment_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq('provider', 'razorpay')
      .eq('provider_event_id', providerEventId);

    return { accepted: true, message: 'payment.failed event processed.' };
  }

  if (event.event !== 'payment.captured') {
    await supabase
      .from('payment_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq('provider', 'razorpay')
      .eq('provider_event_id', providerEventId);

    return { accepted: true, message: `Ignored event type ${event.event}.` };
  }

  const payment = event.payload?.payment?.entity;
  const providerOrderId = payment?.order_id;
  const providerPaymentId = payment?.id;

  if (!providerOrderId || !providerPaymentId) {
    throw new Error('Webhook missing order/payment identifiers.');
  }

  const { data: order, error: orderError } = await supabase
    .from('subscription_payment_orders')
    .select('id, user_id, plan_id, amount_inr, status')
    .eq('provider', 'razorpay')
    .eq('provider_order_id', providerOrderId)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  // No subscription order found — try booking payment recovery.
  if (!order) {
    return await processBookingPaymentCapture(supabase, event, providerOrderId, providerPaymentId, providerEventId);
  }

  const { data: tx, error: txError } = await supabase
    .from('payment_transactions')
    .upsert(
      {
        user_id: order.user_id,
        payment_order_id: order.id,
        provider: 'razorpay',
        transaction_type: 'subscription_purchase',
        status: 'captured',
        amount_inr: Number(order.amount_inr),
        currency: payment?.currency ?? 'INR',
        provider_payment_id: providerPaymentId,
        metadata: { webhook_event: event.event },
      },
      { onConflict: 'provider,provider_payment_id' },
    )
    .select('id, user_id, status')
    .single();

  if (txError || !tx) {
    throw txError ?? new Error('Unable to upsert payment transaction.');
  }

  await supabase.from('payment_events').insert({
    transaction_id: tx.id,
    event_type: event.event,
    event_status: payment?.status ?? 'captured',
    provider: 'razorpay',
    provider_event_id: providerPaymentId,
    payload: event,
  });

  await supabase
    .from('subscription_payment_orders')
    .update({ status: 'paid' })
    .eq('id', order.id);

  const subscription = await createOrActivateSubscriptionFromPayment(supabase, order.user_id, order.plan_id, tx.id);

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name')
    .eq('id', order.plan_id)
    .maybeSingle();

  try {
    await createSubscriptionInvoice(supabase, {
      userId: order.user_id,
      userSubscriptionId: subscription.id,
      paymentTransactionId: tx.id,
      planName: plan?.name ?? 'Subscription Plan',
      amountInr: Number(order.amount_inr),
    });
  } catch (invoiceError) {
    console.error('[webhook] Invoice generation failed (non-fatal):', invoiceError);
  }

  await supabase
    .from('payment_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
    .eq('provider', 'razorpay')
    .eq('provider_event_id', providerEventId);

  return { accepted: true, message: 'Webhook processed and subscription activated.' };
}

// Processes refund with compensating logic for atomicity:
// If credits cannot be zeroed after subscription cancel, restores subscription to active.
async function processRefundEvent(supabase: SupabaseClient, event: RazorpayWebhookEvent) {
  const refundPaymentId = event.payload?.refund?.entity?.payment_id ?? event.payload?.payment?.entity?.id;
  if (!refundPaymentId) return;

  const { data: tx } = await supabase
    .from('payment_transactions')
    .select('id, user_id')
    .eq('provider_payment_id', refundPaymentId)
    .maybeSingle();

  if (!tx) return;

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('payment_transaction_id', tx.id)
    .maybeSingle();

  if (!sub) return;

  const { error: cancelError } = await supabase
    .from('user_subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', sub.id);

  if (cancelError) throw cancelError;

  const { data: credits } = await supabase
    .from('user_service_credits')
    .select('id, available_credits, consumed_credits')
    .eq('user_subscription_id', sub.id);

  if (credits && credits.length > 0) {
    for (const credit of credits) {
      if (credit.consumed_credits > 0) {
        console.warn(
          `[webhook] Refund on subscription ${sub.id}: ${credit.consumed_credits} credits already consumed for credit row ${credit.id}.`,
        );
        // Escalate to payment_events for admin review — credits were consumed before the refund.
        await supabase.from('payment_events').insert({
          transaction_id: tx.id,
          event_type: 'refund.credits_consumed_warning',
          event_status: 'warning',
          provider: 'razorpay',
          provider_event_id: tx.id,
          payload: {
            subscription_id: sub.id,
            credit_row_id: credit.id,
            consumed_credits: credit.consumed_credits,
            message: `Refund issued but ${credit.consumed_credits} credits already consumed — manual review may be required.`,
          },
        }).then(({ error: warnInsertError }) => {
          if (warnInsertError) {
            console.error('[webhook] Failed to log consumed-credits warning event:', warnInsertError.message);
          }
        });
      }

      const { error: creditError } = await supabase
        .from('user_service_credits')
        .update({ available_credits: 0 })
        .eq('id', credit.id);

      if (creditError) {
        // Compensate: restore subscription since credits could not be zeroed
        await supabase.from('user_subscriptions').update({ status: 'active' }).eq('id', sub.id);
        throw creditError;
      }
    }
  }
}

// Marks subscription orders and pending transactions as failed when Razorpay reports payment failure.
async function processPaymentFailedEvent(supabase: SupabaseClient, event: RazorpayWebhookEvent) {
  const failedOrderId = event.payload?.payment?.entity?.order_id;
  const failedPaymentId = event.payload?.payment?.entity?.id;

  if (failedOrderId) {
    await supabase
      .from('subscription_payment_orders')
      .update({ status: 'failed' })
      .eq('provider', 'razorpay')
      .eq('provider_order_id', failedOrderId)
      .neq('status', 'paid'); // never downgrade a paid order
  }

  if (failedPaymentId) {
    await supabase
      .from('payment_transactions')
      .update({ status: 'failed', metadata: { webhook_event: 'payment.failed' } })
      .eq('provider', 'razorpay')
      .eq('provider_payment_id', failedPaymentId)
      .in('status', ['initiated', 'authorized']); // only downgrade pending statuses
  } else if (failedOrderId) {
    // No provider_payment_id yet (failed before Razorpay assigned one).
    // Update the initiated booking transaction matched by stored provider_order_id.
    await supabase
      .from('payment_transactions')
      .update({ status: 'failed' })
      .eq('provider', 'razorpay')
      .filter('metadata->>provider_order_id', 'eq', failedOrderId)
      .in('status', ['initiated', 'authorized']);
  }

  // Defensive compensation: if a failed payment is already linked to a booking,
  // cancel the booking and mark the transaction failed.
  let linkedTx:
    | {
        id: string;
        booking_id: number | null;
      }
    | null = null;

  if (failedPaymentId) {
    const { data } = await supabase
      .from('payment_transactions')
      .select('id, booking_id')
      .eq('provider', 'razorpay')
      .eq('provider_payment_id', failedPaymentId)
      .maybeSingle<{ id: string; booking_id: number | null }>();
    linkedTx = data ?? null;
  } else if (failedOrderId) {
    const { data } = await supabase
      .from('payment_transactions')
      .select('id, booking_id')
      .eq('provider', 'razorpay')
      .filter('metadata->>provider_order_id', 'eq', failedOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; booking_id: number | null }>();
    linkedTx = data ?? null;
  }

  if (linkedTx?.booking_id) {
    await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        cancellation_reason: 'Payment failed in Razorpay',
      })
      .eq('id', linkedTx.booking_id)
      .neq('booking_status', 'cancelled');

    await supabase
      .from('payment_transactions')
      .update({ status: 'failed', metadata: { webhook_event: 'payment.failed', booking_auto_cancelled: true } })
      .eq('id', linkedTx.id)
      .neq('status', 'failed');
  }
}

type BookingCheckoutMetadata = {
  checkout_context?: string;
  provider_order_id?: string;
  booking_payload?: unknown;
  price_breakdown?: {
    discountId?: string | null;
    discountAmount?: number;
    finalAmount?: number;
    baseAmount?: number;
  };
  [key: string]: unknown;
};

// Recovery path: handles payment.captured for pre-paid bookings when the browser
// did not call /verify in time (e.g. connectivity loss after Razorpay captured).
// Recreates the booking from the stored metadata so no paid user is left without a booking.
async function processBookingPaymentCapture(
  supabase: SupabaseClient,
  event: RazorpayWebhookEvent,
  providerOrderId: string,
  providerPaymentId: string,
  providerEventId: string,
) {
  const payment = event.payload?.payment?.entity;

  // Find the pending booking transaction by the stored provider_order_id in metadata.
  const { data: bookingTx, error: txLookupError } = await supabase
    .from('payment_transactions')
    .select('id, user_id, amount_inr, currency, status, metadata, booking_id')
    .eq('provider', 'razorpay')
    .eq('transaction_type', 'service_collection')
    .filter('metadata->>provider_order_id', 'eq', providerOrderId)
    .maybeSingle();

  if (txLookupError) {
    throw txLookupError;
  }

  if (!bookingTx) {
    // Unknown order — log and accept to prevent Razorpay retry storm.
    console.warn(`[webhook] payment.captured for unknown order ${providerOrderId} — acknowledged without action.`);
    await supabase
      .from('payment_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq('provider', 'razorpay')
      .eq('provider_event_id', providerEventId);
    return { accepted: true, message: 'Unknown booking order — acknowledged.' };
  }

  const metadata = (bookingTx.metadata ?? {}) as BookingCheckoutMetadata;

  // If booking already created (verify ran first), just update transaction status and finish.
  if (bookingTx.booking_id) {
    await supabase
      .from('payment_transactions')
      .update({ status: 'captured', provider_payment_id: providerPaymentId })
      .eq('id', bookingTx.id);

    await supabase
      .from('payment_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq('provider', 'razorpay')
      .eq('provider_event_id', providerEventId);

    return { accepted: true, message: 'Booking payment already verified — transaction updated.' };
  }

  // Validate stored booking payload before attempting recovery.
  const rawPayload = metadata.booking_payload ?? null;
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Booking webhook recovery failed: stored booking_payload is missing or malformed.');
  }

  // Re-check booking_id right before creating booking to minimize race window with /verify.
  // This avoids creating an orphan booking that must immediately be cancelled.
  const { data: freshTx } = await supabase
    .from('payment_transactions')
    .select('booking_id')
    .eq('id', bookingTx.id)
    .single();

  if (freshTx?.booking_id) {
    // /verify won the race — just update the transaction status
    await supabase
      .from('payment_transactions')
      .update({ status: 'captured', provider_payment_id: providerPaymentId })
      .eq('id', bookingTx.id);

    await supabase
      .from('payment_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq('provider', 'razorpay')
      .eq('provider_event_id', providerEventId);

    return { accepted: true, message: 'Booking already created by /verify — transaction updated.' };
  }

  // Strip null discountCode to match validation schema expectations.
  const normalized = { ...(rawPayload as Record<string, unknown>) };
  if (normalized.discountCode === null) {
    delete normalized.discountCode;
  }

  const { bookingCreateSchema } = await import('@/lib/flows/validation');
  const parsed = bookingCreateSchema.safeParse(normalized);

  if (!parsed.success) {
    throw new Error(`Booking webhook recovery failed: invalid stored payload. ${JSON.stringify(parsed.error.flatten())}`);
  }

  let booking: { id: number };

  try {
    booking = await createBooking(supabase, bookingTx.user_id, {
      petId: parsed.data.petId,
      providerId: parsed.data.providerId,
      providerServiceId: parsed.data.providerServiceId,
      bookingDate: parsed.data.bookingDate,
      startTime: parsed.data.startTime,
      bookingMode: parsed.data.bookingMode,
      locationAddress: parsed.data.locationAddress,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      providerNotes: parsed.data.providerNotes,
      discountCode: parsed.data.discountCode,
      addOns: parsed.data.addOns,
      useSubscriptionCredit: false,
    });
  } catch (bookingError) {
    throw new Error(
      `Booking webhook recovery: booking creation failed. ${bookingError instanceof Error ? bookingError.message : String(bookingError)}`,
    );
  }

  // Guard: only set booking_id if it was still null (verify may have raced us).
  const { data: updatedTx } = await supabase
    .from('payment_transactions')
    .update({
      status: 'captured',
      provider_payment_id: providerPaymentId,
      booking_id: booking.id,
      metadata: {
        ...metadata,
        provider_order_id: providerOrderId,
        webhook_recovery_at: new Date().toISOString(),
      },
    })
    .eq('id', bookingTx.id)
    .is('booking_id', null) // concurrency guard — only wins if verify has not already won
    .select('id')
    .maybeSingle();

  if (!updatedTx) {
    // Verify route already set booking_id — this booking is a duplicate orphan. Cancel it.
    console.warn(`[webhook] Booking ${booking.id} created as redundant during race with /verify for tx ${bookingTx.id}. Cancelling orphan.`);
    await supabase
      .from('bookings')
      .update({ booking_status: 'cancelled', cancellation_reason: 'Duplicate booking from webhook/verify race — auto-cancelled' })
      .eq('id', booking.id);
  } else {
    await supabase.from('payment_events').insert({
      transaction_id: bookingTx.id,
      event_type: 'webhook.payment.captured',
      event_status: payment?.status ?? 'captured',
      provider: 'razorpay',
      provider_event_id: providerPaymentId,
      payload: event,
    });

    // Create invoice for recovered booking payment.
    try {
      const serviceType = parsed.data.bookingMode.replace(/_/g, ' ');
      await createServiceInvoice(supabase, {
        userId: bookingTx.user_id,
        bookingId: booking.id,
        paymentTransactionId: bookingTx.id,
        description: `${serviceType} service booking — Razorpay (webhook recovery)`,
        amountInr: Number(bookingTx.amount_inr),
        status: 'paid',
      });
    } catch (invoiceError) {
      console.error('[webhook] Booking invoice creation failed (non-fatal):', invoiceError);
    }

    // Record discount redemption so usage limits are accurately tracked.
    const priceBreakdown = metadata.price_breakdown;
    if (priceBreakdown?.discountId && (priceBreakdown.discountAmount ?? 0) > 0) {
      try {
        await createDiscountRedemption(supabase, {
          discountId: priceBreakdown.discountId,
          bookingId: booking.id,
          userId: bookingTx.user_id,
          discountAmount: priceBreakdown.discountAmount!,
        });
      } catch (redemptionError) {
        console.error('[webhook] CRITICAL: Discount redemption creation failed — usage limit may be bypassed. BookingId:', booking.id, 'DiscountId:', priceBreakdown.discountId, redemptionError);
      }
    }
  }

  await supabase
    .from('payment_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
    .eq('provider', 'razorpay')
    .eq('provider_event_id', providerEventId);

  return { accepted: true, message: 'Booking payment captured and booking recovered via webhook.' };
}
