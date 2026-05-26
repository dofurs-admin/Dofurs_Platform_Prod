'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, LayoutDashboard, Loader2 } from 'lucide-react';
import BookingConversionTracker, { type BookingConversionProvider } from '@/components/forms/BookingConversionTracker';
import {
  BOOKING_THANK_YOU_SESSION_KEY,
  parseBookingThankYouSession,
  type BookingThankYouSession,
} from '@/lib/bookings/thank-you-session';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

type BookingThankYouRedirectControllerProps = {
  providers: BookingConversionProvider[];
};

type RedirectStatus = 'checking' | 'redirecting' | 'fallback';

const MIN_REDIRECT_DELAY_MS = 1600;
const MAX_REDIRECT_DELAY_MS = 3200;

function clearPendingSession() {
  try {
    window.sessionStorage.removeItem(BOOKING_THANK_YOU_SESSION_KEY);
  } catch {
    // Session storage can be disabled in hardened browser modes.
  }
}

function readPendingSession() {
  try {
    return parseBookingThankYouSession(window.sessionStorage.getItem(BOOKING_THANK_YOU_SESSION_KEY));
  } catch {
    return null;
  }
}

export default function BookingThankYouRedirectController({ providers }: BookingThankYouRedirectControllerProps) {
  const router = useRouter();
  const [pendingSession, setPendingSession] = useState<BookingThankYouSession | null>(null);
  const [status, setStatus] = useState<RedirectStatus>('checking');
  const pendingSessionRef = useRef<BookingThankYouSession | null>(null);
  const minDelayElapsedRef = useRef(false);
  const trackingCompleteRef = useRef(false);
  const didRedirectRef = useRef(false);

  const redirectToConfirmation = useCallback(() => {
    const session = pendingSessionRef.current;
    if (!session || didRedirectRef.current) {
      return;
    }

    didRedirectRef.current = true;
    clearPendingSession();
    router.replace(session.confirmationPath);
  }, [router]);

  const maybeRedirect = useCallback(() => {
    if (minDelayElapsedRef.current && trackingCompleteRef.current) {
      redirectToConfirmation();
    }
  }, [redirectToConfirmation]);

  const handleTrackingComplete = useCallback(() => {
    trackingCompleteRef.current = true;
    maybeRedirect();
  }, [maybeRedirect]);

  useEffect(() => {
    const session = readPendingSession();
    if (!session) {
      clearPendingSession();
      setStatus('fallback');
      return;
    }

    pendingSessionRef.current = session;
    trackingCompleteRef.current = providers.length === 0;
    minDelayElapsedRef.current = false;
    didRedirectRef.current = false;
    setPendingSession(session);
    setStatus('redirecting');

    const minDelayTimer = window.setTimeout(() => {
      minDelayElapsedRef.current = true;
      maybeRedirect();
    }, MIN_REDIRECT_DELAY_MS);
    const maxDelayTimer = window.setTimeout(() => {
      redirectToConfirmation();
    }, MAX_REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(minDelayTimer);
      window.clearTimeout(maxDelayTimer);
    };
  }, [maybeRedirect, providers.length, redirectToConfirmation]);

  return (
    <div className="rounded-[24px] border border-[#ead3bf] bg-white/92 p-5 shadow-[0_18px_42px_rgba(132,95,61,0.10)] sm:p-6">
      {pendingSession ? (
        <BookingConversionTracker
          bookingId={pendingSession.bookingId}
          providers={providers}
          source="booking_thank_you_page"
          onComplete={handleTrackingComplete}
        />
      ) : null}

      {status === 'fallback' ? (
        <div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-neutral-950">We could not find a recent booking to open</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Your confirmed bookings are still available in your dashboard.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard/user?view=bookings" className={premiumPrimaryCtaClass('justify-center gap-2 px-5 py-3 text-sm font-semibold')}>
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              View bookings
            </Link>
            <Link href="/forms/customer-booking" className={premiumSecondaryCtaClass('justify-center gap-2 px-5 py-3 text-sm font-semibold')}>
              Book again
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ead3bf] bg-[#fff6ec] text-[#a96533]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-neutral-950">
            {status === 'checking' ? 'Finding your booking' : 'Opening your booking details'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            We are preparing your confirmation page now.
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#f3dfcc]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#d88b4f]" />
          </div>
        </div>
      )}
    </div>
  );
}