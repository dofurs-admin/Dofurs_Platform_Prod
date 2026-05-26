import type { Metadata } from 'next';
import { CalendarCheck2, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { isBookingConversionTrackingConfigured } from '@/lib/analytics/google-ads';
import { isMetaBookingConversionTrackingConfigured } from '@/lib/analytics/meta-ads';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { BOOKING_THANK_YOU_PATH } from '@/lib/bookings/thank-you-session';
import type { BookingConversionProvider } from '@/components/forms/BookingConversionTracker';
import BookingThankYouRedirectController from './BookingThankYouRedirectController';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Thank You for Booking',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BookingThankYouPage() {
  await requireAuthenticatedUser(`/auth/sign-in?next=${encodeURIComponent(BOOKING_THANK_YOU_PATH)}`);

  const conversionProviders: BookingConversionProvider[] = [
    isBookingConversionTrackingConfigured() ? 'google_ads' : null,
    isMetaBookingConversionTrackingConfigured() ? 'meta_ads' : null,
  ].filter((provider): provider is BookingConversionProvider => provider !== null);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fff7ef_46%,#fffcf9_100%)] px-4 pb-20 pt-28 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1100px]">
          <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="max-w-3xl">
              <BrandMark compact />
              <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Booking received
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-tight text-neutral-950 sm:text-5xl">
                Thank you for booking
              </h1>
              <p className="mt-4 max-w-2xl text-lg font-semibold text-[#7a5437]">
                Your Dofurs visit is locked in.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
                Opening your booking details...
              </p>
            </div>

            <BookingThankYouRedirectController providers={conversionProviders} />
          </section>

          <section className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-[#ead3bf] bg-white/82 px-5 py-4 shadow-[0_14px_30px_rgba(132,95,61,0.08)]">
              <CalendarCheck2 className="h-5 w-5 text-[#a96533]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-neutral-950">Schedule saved</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">Your selected date and slot are attached to the booking.</p>
            </div>
            <div className="rounded-[24px] border border-[#ead3bf] bg-white/82 px-5 py-4 shadow-[0_14px_30px_rgba(132,95,61,0.08)]">
              <ShieldCheck className="h-5 w-5 text-[#a96533]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-neutral-950">Team notified</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">Dofurs support can find your service from the confirmation page.</p>
            </div>
            <div className="rounded-[24px] border border-[#ead3bf] bg-white/82 px-5 py-4 shadow-[0_14px_30px_rgba(132,95,61,0.08)]">
              <Clock3 className="h-5 w-5 text-[#a96533]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-neutral-950">Details next</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">You will be redirected in a moment.</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}