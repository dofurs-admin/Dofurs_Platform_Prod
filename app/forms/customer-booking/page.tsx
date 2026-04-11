import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import PremiumUserBookingFlow from '@/components/forms/PremiumUserBookingFlow';
import AdminBookingFlow from '@/components/forms/AdminBookingFlow';
import BookingAnchorScroller from '@/components/forms/BookingAnchorScroller';
import GroomingServiceGrid from '@/components/forms/GroomingServiceGrid';
import SubscriptionCheckoutPanel from '@/components/payments/SubscriptionCheckoutPanel';
import { getCurrentUserRole, requireAuthenticatedUser } from '@/lib/auth/session';

type CustomerBookingFormPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerBookingFormPage({ searchParams }: CustomerBookingFormPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const currentSearch = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) currentSearch.set(key, v);
  }
  const qs = currentSearch.toString();
  const redirectTarget = `/auth/sign-in?next=${encodeURIComponent(`/forms/customer-booking${qs ? `?${qs}` : ''}`)}`;

  await requireAuthenticatedUser(redirectTarget);
  const role = await getCurrentUserRole();
  const isStaffBooking = role === 'admin' || role === 'staff' || role === 'provider';

  const rescheduleParam = resolvedSearchParams.reschedule;
  const rescheduleIdRaw = Array.isArray(rescheduleParam) ? rescheduleParam[0] : rescheduleParam;
  const rescheduleId = Number.parseInt(rescheduleIdRaw ?? '', 10);
  const isRescheduleMode = Number.isInteger(rescheduleId) && rescheduleId > 0;

  const pageTitle = isRescheduleMode ? 'Reschedule Your Booking' : 'Book Premium Pet Care in Minutes';
  const pageDescription = isRescheduleMode
    ? 'Pick a new date and time slot to update your existing booking.'
    : 'Certified groomers. Doorstep service. 100% hygiene-first protocols.';

  return (
    <ContentPageLayout
      title={pageTitle}
      description={pageDescription}
      heroImageSrc="/Birthday/book-a-service.png"
      heroImageAlt="Book pet care with Dofurs"
      heroImageFirstOnMobile
      hideHero
      belowContent={
        !isStaffBooking && !isRescheduleMode ? (
          <div className="mt-6 grid gap-6">
            <GroomingServiceGrid />
            <SubscriptionCheckoutPanel />
          </div>
        ) : undefined
      }
    >
      <BookingAnchorScroller />
      {isRescheduleMode ? (
        <div className="mb-4">
          <Link
            href={isStaffBooking ? '/dashboard/admin?view=bookings' : '/dashboard/user?section=bookings'}
            className="inline-flex items-center rounded-full border border-[#e3c7ad] bg-[#fff8f1] px-4 py-2 text-sm font-semibold text-[#8b5e3c] transition hover:bg-[#fff1e5]"
          >
            Back to bookings
          </Link>
        </div>
      ) : null}
      <FadeInSection delay={0.08}>
        <div id="start-your-booking" className="-mx-2 scroll-mt-24 sm:mx-0 md:px-1">
          {isStaffBooking ? (
            <AdminBookingFlow />
          ) : (
            <PremiumUserBookingFlow />
          )}
        </div>
      </FadeInSection>
    </ContentPageLayout>
  );
}
