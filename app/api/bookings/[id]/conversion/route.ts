import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { loadBookingConfirmationData, type BookingConfirmationData } from '@/lib/bookings/confirmation';
import {
  buildGoogleAdsBookingSendTo,
  GOOGLE_ADS_BOOKING_CONVERSION_LABEL,
  isBookingConversionTrackingConfigured,
} from '@/lib/analytics/google-ads';
import {
  buildMetaBookingConversionLabel,
  buildMetaBookingEventId,
  getMetaBookingEventName,
  isMetaBookingConversionTrackingConfigured,
  sendMetaBookingConversionsApiEvent,
} from '@/lib/analytics/meta-ads';

type RouteContext = { params: Promise<{ id: string }> };

type ConversionEventRow = {
  id: string;
  status: 'claimed' | 'fired' | 'skipped' | 'failed';
  attempt_count: number;
  last_attempt_at: string;
};

type ConversionProvider = 'google_ads' | 'meta_ads';

const EVENT_NAME = 'booking_confirmed';
const CLAIM_RETRY_AFTER_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const conversionProviderSchema = z.enum(['google_ads', 'meta_ads']);

const claimSchema = z.object({
  provider: conversionProviderSchema.default('google_ads'),
  source: z.string().trim().max(80).optional(),
});

const ackSchema = z.object({
  provider: conversionProviderSchema.default('google_ads'),
  status: z.enum(['fired', 'failed']),
  reason: z.string().trim().max(160).optional(),
});

const CLAIM_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 12,
};

const ACK_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 24,
};

function parseBookingId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function canRetryClaim(row: ConversionEventRow) {
  if (row.status === 'fired' || row.status === 'skipped') {
    return false;
  }

  if (row.attempt_count >= MAX_ATTEMPTS) {
    return false;
  }

  const lastAttemptAt = new Date(row.last_attempt_at).getTime();
  if (!Number.isFinite(lastAttemptAt)) {
    return true;
  }

  return Date.now() - lastAttemptAt >= CLAIM_RETRY_AFTER_MS;
}

async function loadOwnedConfirmation(bookingId: number, userId: string) {
  const admin = getSupabaseAdminClient();
  return loadBookingConfirmationData(admin, bookingId, userId);
}

function resolveTrackingConfig(provider: ConversionProvider, confirmation: BookingConfirmationData) {
  if (provider === 'google_ads') {
    if (!isBookingConversionTrackingConfigured()) {
      return { ok: false as const, reason: 'tracking_not_configured' };
    }

    const sendTo = buildGoogleAdsBookingSendTo();
    const conversionLabel = GOOGLE_ADS_BOOKING_CONVERSION_LABEL.trim();
    if (!sendTo || !conversionLabel) {
      return { ok: false as const, reason: 'conversion_label_missing' };
    }

    return {
      ok: true as const,
      provider,
      conversionLabel,
      transactionId: confirmation.conversion.transactionId,
      metadata: {
        serviceLabel: confirmation.booking.serviceLabel,
        paymentLabel: confirmation.payment.label,
      },
      responsePayload: {
        gtag: {
          sendTo,
          value: confirmation.conversion.valueInr,
          currency: confirmation.conversion.currency,
          transactionId: confirmation.conversion.transactionId,
        },
      },
    };
  }

  if (!isMetaBookingConversionTrackingConfigured()) {
    return { ok: false as const, reason: 'tracking_not_configured' };
  }

  const conversionLabel = buildMetaBookingConversionLabel();
  if (!conversionLabel) {
    return { ok: false as const, reason: 'conversion_label_missing' };
  }

  const eventName = getMetaBookingEventName();
  const eventId = buildMetaBookingEventId(confirmation.conversion.transactionId);

  return {
    ok: true as const,
    provider,
    conversionLabel,
    transactionId: confirmation.conversion.transactionId,
    metadata: {
      serviceLabel: confirmation.booking.serviceLabel,
      paymentLabel: confirmation.payment.label,
      metaEventName: eventName,
      metaEventId: eventId,
    },
    responsePayload: {
      meta: {
        eventName,
        eventId,
        value: confirmation.conversion.valueInr,
        currency: confirmation.conversion.currency,
      },
    },
  };
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(['user']);

  if (auth.response) {
    return auth.response;
  }

  const { user, supabase } = auth.context;
  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:conversion:claim', user.id), CLAIM_RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ shouldFire: false, reason: 'rate_limited' }, { status: 429 });
  }

  const { id } = await context.params;
  const bookingId = parseBookingId(id);
  if (!bookingId) {
    return NextResponse.json({ shouldFire: false, error: 'Invalid booking id' }, { status: 400 });
  }

  const parsed = claimSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ shouldFire: false, error: 'Invalid payload' }, { status: 400 });
  }

  const confirmation = await loadOwnedConfirmation(bookingId, user.id);
  if (!confirmation) {
    return NextResponse.json({ shouldFire: false, error: 'Booking not found' }, { status: 404 });
  }

  if (!confirmation.conversion.eligible) {
    return NextResponse.json({ shouldFire: false, reason: 'booking_not_eligible' });
  }

  const trackingConfig = resolveTrackingConfig(parsed.data.provider, confirmation);
  if (!trackingConfig.ok) {
    return NextResponse.json({ shouldFire: false, reason: trackingConfig.reason });
  }

  const admin = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from('booking_conversion_events')
    .select('id, status, attempt_count, last_attempt_at')
    .eq('provider', trackingConfig.provider)
    .eq('event_name', EVENT_NAME)
    .eq('booking_id', bookingId)
    .eq('conversion_label', trackingConfig.conversionLabel)
    .maybeSingle<ConversionEventRow>();

  if (existingError) {
    return NextResponse.json({ shouldFire: false, error: 'Unable to claim conversion event' }, { status: 500 });
  }

  const metadata = {
    source: parsed.data.source ?? 'booking_confirmation_page',
    ...trackingConfig.metadata,
  };

  let eventId = existing?.id ?? null;

  if (existing) {
    if (!canRetryClaim(existing)) {
      return NextResponse.json({ shouldFire: false, eventId: existing.id, status: existing.status });
    }

    const { data: updated, error: updateError } = await admin
      .from('booking_conversion_events')
      .update({
        status: 'claimed',
        attempt_count: existing.attempt_count + 1,
        claimed_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        value_inr: confirmation.conversion.valueInr,
        currency: confirmation.conversion.currency,
        metadata,
      })
      .eq('id', existing.id)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (updateError || !updated) {
      return NextResponse.json({ shouldFire: false, error: 'Unable to refresh conversion claim' }, { status: 500 });
    }

    eventId = updated.id;
  } else {
    const { data: inserted, error: insertError } = await admin
      .from('booking_conversion_events')
      .insert({
        booking_id: bookingId,
        user_id: user.id,
        provider: trackingConfig.provider,
        event_name: EVENT_NAME,
        conversion_label: trackingConfig.conversionLabel,
        transaction_id: trackingConfig.transactionId,
        status: 'claimed',
        attempt_count: 1,
        value_inr: confirmation.conversion.valueInr,
        currency: confirmation.conversion.currency,
        metadata,
        claimed_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (insertError || !inserted) {
      return NextResponse.json({ shouldFire: false, error: 'Unable to create conversion claim' }, { status: 500 });
    }

    eventId = inserted.id;
  }

  if (trackingConfig.provider === 'meta_ads' && 'meta' in trackingConfig.responsePayload) {
    const metaCapiResult = await sendMetaBookingConversionsApiEvent({
      request,
      confirmation,
      eventId: trackingConfig.responsePayload.meta.eventId,
    }).catch((error) => {
      console.error('[bookings/conversion] Meta CAPI dispatch failed', error);
      return null;
    });

    if (metaCapiResult && !metaCapiResult.ok) {
      console.warn('[bookings/conversion] Meta CAPI returned non-success status', {
        bookingId,
        status: metaCapiResult.status,
      });
    }
  }

  return NextResponse.json({
    shouldFire: true,
    eventId,
    provider: trackingConfig.provider,
    ...trackingConfig.responsePayload,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(['user']);

  if (auth.response) {
    return auth.response;
  }

  const { user, supabase } = auth.context;
  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:conversion:ack', user.id), ACK_RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { id } = await context.params;
  const bookingId = parseBookingId(id);
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Invalid booking id' }, { status: 400 });
  }

  const parsed = ackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const confirmation = await loadOwnedConfirmation(bookingId, user.id);
  if (!confirmation) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }

  const trackingConfig = resolveTrackingConfig(parsed.data.provider, confirmation);
  if (!trackingConfig.ok) {
    return NextResponse.json({ success: true, skipped: true, reason: trackingConfig.reason });
  }

  const admin = getSupabaseAdminClient();
  const patch = parsed.data.status === 'fired'
    ? {
        status: 'fired',
        fired_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        metadata: { ackReason: parsed.data.reason ?? null },
      }
    : {
        status: 'failed',
        last_attempt_at: new Date().toISOString(),
        metadata: { failureReason: parsed.data.reason ?? 'unknown' },
      };

  const { error } = await admin
    .from('booking_conversion_events')
    .update(patch)
    .eq('provider', trackingConfig.provider)
    .eq('event_name', EVENT_NAME)
    .eq('booking_id', bookingId)
    .eq('user_id', user.id)
    .eq('conversion_label', trackingConfig.conversionLabel);

  if (error) {
    return NextResponse.json({ success: false, error: 'Unable to acknowledge conversion event' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}