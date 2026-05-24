'use client';

import { useEffect } from 'react';

type ConversionProvider = 'google_ads' | 'meta_ads';

type TrackingPayload = {
  shouldFire?: boolean;
  eventId?: string;
  provider?: ConversionProvider;
  gtag?: {
    sendTo: string;
    value: number;
    currency: 'INR';
    transactionId: string;
  };
  meta?: {
    eventName: string;
    eventId: string;
    value: number;
    currency: 'INR';
  };
};

type BookingConfirmationTrackerProps = {
  bookingId: number;
  providers: ConversionProvider[];
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export default function BookingConfirmationTracker({ bookingId, providers }: BookingConfirmationTrackerProps) {
  const providersKey = providers.join(',');

  useEffect(() => {
    const activeProviders = providersKey
      .split(',')
      .filter((provider): provider is ConversionProvider => provider === 'google_ads' || provider === 'meta_ads');

    if (activeProviders.length === 0) {
      return;
    }

    let cancelled = false;

    async function acknowledge(provider: ConversionProvider, status: 'fired' | 'failed', reason?: string) {
      await fetch(`/api/bookings/${bookingId}/conversion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, status, reason }),
        keepalive: true,
      }).catch(() => undefined);
    }

    async function claimAndFire(provider: ConversionProvider) {
      const response = await fetch(`/api/bookings/${bookingId}/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, source: 'booking_confirmation_page' }),
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as TrackingPayload | null;
      if (cancelled || !response.ok || !payload?.shouldFire) {
        return;
      }

      if (provider === 'google_ads') {
        if (!payload.gtag) {
          return;
        }

        if (typeof window.gtag !== 'function') {
          await acknowledge(provider, 'failed', 'gtag_unavailable');
          return;
        }

        let callbackFired = false;
        const fallbackTimer = window.setTimeout(() => {
          if (callbackFired || cancelled) {
            return;
          }

          callbackFired = true;
          void acknowledge(provider, 'fired', 'event_callback_timeout');
        }, 1400);

        window.gtag('event', 'conversion', {
          send_to: payload.gtag.sendTo,
          value: payload.gtag.value,
          currency: payload.gtag.currency,
          transaction_id: payload.gtag.transactionId,
          event_callback: () => {
            if (callbackFired || cancelled) {
              return;
            }

            callbackFired = true;
            window.clearTimeout(fallbackTimer);
            void acknowledge(provider, 'fired');
          },
        });
        return;
      }

      if (!payload.meta) {
        return;
      }

      if (typeof window.fbq !== 'function') {
        await acknowledge(provider, 'failed', 'fbq_unavailable');
        return;
      }

      try {
        window.fbq(
          'track',
          payload.meta.eventName,
          {
            value: payload.meta.value,
            currency: payload.meta.currency,
          },
          { eventID: payload.meta.eventId },
        );
        await acknowledge(provider, 'fired');
      } catch {
        await acknowledge(provider, 'failed', 'fbq_throw');
      }
    }

    for (const provider of activeProviders) {
      void claimAndFire(provider).catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [bookingId, providersKey]);

  return null;
}