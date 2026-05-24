import type { BookingConfirmationData } from '@/lib/bookings/confirmation';

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
export const META_BOOKING_CONVERSION_EVENT_NAME =
  process.env.NEXT_PUBLIC_META_BOOKING_CONVERSION_EVENT_NAME || 'Purchase';
export const META_CONVERSIONS_API_ACCESS_TOKEN = process.env.META_CONVERSIONS_API_ACCESS_TOKEN || '';
export const META_CONVERSIONS_API_VERSION = process.env.META_CONVERSIONS_API_VERSION || 'v20.0';

export const META_BOOKING_CONVERSION_TRACKING_ENABLED =
  process.env.META_BOOKING_CONVERSION_TRACKING_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_META_BOOKING_CONVERSION_TRACKING_ENABLED === 'true';

type MetaConversionsApiResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

function sanitizeEventName(value: string) {
  const normalized = value.trim();
  return normalized || 'Purchase';
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  for (const part of cookieHeader?.split(';') ?? []) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    const name = rawName?.trim();
    const value = rawValueParts.join('=').trim();

    if (name && value) {
      try {
        cookies.set(name, decodeURIComponent(value));
      } catch {
        cookies.set(name, value);
      }
    }
  }

  return cookies;
}

function compactRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  );
}

export function isMetaBookingConversionTrackingConfigured() {
  return META_BOOKING_CONVERSION_TRACKING_ENABLED && META_PIXEL_ID.trim().length > 0;
}

export function isMetaConversionsApiConfigured() {
  return isMetaBookingConversionTrackingConfigured() && META_CONVERSIONS_API_ACCESS_TOKEN.trim().length > 0;
}

export function getMetaBookingEventName() {
  return sanitizeEventName(META_BOOKING_CONVERSION_EVENT_NAME);
}

export function buildMetaBookingConversionLabel() {
  const pixelId = META_PIXEL_ID.trim();
  const eventName = getMetaBookingEventName();
  return pixelId ? `${pixelId}:${eventName}` : null;
}

export function buildMetaBookingEventId(transactionId: string) {
  const eventName = getMetaBookingEventName().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${transactionId}_meta_ads_${eventName}`;
}

export async function sendMetaBookingConversionsApiEvent({
  request,
  confirmation,
  eventId,
}: {
  request: Request;
  confirmation: BookingConfirmationData;
  eventId: string;
}): Promise<MetaConversionsApiResult | null> {
  if (!isMetaConversionsApiConfigured()) {
    return null;
  }

  const pixelId = META_PIXEL_ID.trim();
  const accessToken = META_CONVERSIONS_API_ACCESS_TOKEN.trim();
  const eventName = getMetaBookingEventName();
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const userData = compactRecord({
    client_user_agent: request.headers.get('user-agent'),
    fbp: cookies.get('_fbp'),
    fbc: cookies.get('_fbc'),
  });
  const eventSourceUrl = request.headers.get('referer') ??
    `https://dofurs.in/forms/customer-booking/confirmation/${confirmation.booking.id}`;

  const endpoint = new URL(`https://graph.facebook.com/${META_CONVERSIONS_API_VERSION}/${pixelId}/events`);
  endpoint.searchParams.set('access_token', accessToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: eventSourceUrl,
          user_data: userData,
          custom_data: {
            currency: confirmation.conversion.currency,
            value: confirmation.conversion.valueInr,
            order_id: confirmation.conversion.transactionId,
            content_name: 'Dofurs booking',
            content_category: 'Pet Grooming',
          },
        },
      ],
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.json().catch(() => null),
  };
}