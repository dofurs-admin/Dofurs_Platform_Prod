'use client';

import { useEffect, useRef } from 'react';

export type BookingConversionProvider = 'google_ads' | 'meta_ads';

type TrackingPayload = {
  shouldFire?: boolean;
  eventId?: string;
  provider?: BookingConversionProvider;
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

type BookingConversionTrackerProps = {
  bookingId: number;
  providers: BookingConversionProvider[];
  source?: string;
  onComplete?: () => void;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const GOOGLE_CALLBACK_TIMEOUT_MS = 1400;

export default function BookingConversionTracker({
  bookingId,
  providers,
  source = 'booking_confirmation_page',
  onComplete,
}: BookingConversionTrackerProps) {
  const providersKey = providers.join(',');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const activeProviders = providersKey
      .split(',')
      .filter((provider): provider is BookingConversionProvider => provider === 'google_ads' || provider === 'meta_ads');

    if (bookingId <= 0 || activeProviders.length === 0) {
      onCompleteRef.current?.();
      return;
    }

    let cancelled = false;

    async function acknowledge(provider: BookingConversionProvider, status: 'fired' | 'failed', reason?: string) {
      await fetch(`/api/bookings/${bookingId}/conversion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, status, reason }),
        keepalive: true,
      }).catch(() => undefined);
    }

    async function acknowledgeGoogleFire(provider: BookingConversionProvider, reason?: string) {
      await acknowledge(provider, 'fired', reason);
    }

    async function claimAndFire(provider: BookingConversionProvider) {
      const response = await fetch(`/api/bookings/${bookingId}/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, source }),
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

        const gtagPayload = payload.gtag;

        if (typeof window.gtag !== 'function') {
          await acknowledge(provider, 'failed', 'gtag_unavailable');
          return;
        }

        await new Promise<void>((resolve) => {
          let callbackFired = false;

          const finish = (reason?: string) => {
            if (callbackFired) {
              return;
            }

            callbackFired = true;
            window.clearTimeout(fallbackTimer);
            void acknowledgeGoogleFire(provider, reason).finally(resolve);
          };

          const fallbackTimer = window.setTimeout(() => {
            finish('event_callback_timeout');
          }, GOOGLE_CALLBACK_TIMEOUT_MS);

          window.gtag?.('event', 'conversion', {
            send_to: gtagPayload.sendTo,
            value: gtagPayload.value,
            currency: gtagPayload.currency,
            transaction_id: gtagPayload.transactionId,
            event_callback: () => {
              finish();
            },
          });
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

    void Promise.allSettled(activeProviders.map((provider) => claimAndFire(provider).catch(() => undefined)))
      .finally(() => {
        if (!cancelled) {
          onCompleteRef.current?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId, providersKey, source]);

  return null;
}