import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

export default function BookingConfirmationNotFound() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#fffcf8] px-4 pb-16 pt-28 text-ink sm:px-6 lg:px-8">
        <section className="mx-auto max-w-2xl rounded-[28px] border border-[#ecd6c2] bg-white p-6 text-center shadow-premium sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6c48]">Booking not available</p>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950 sm:text-3xl">We could not open this confirmation.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-600">
            The booking may belong to another account, or the confirmation link may be incomplete.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/dashboard/user?view=bookings" className={premiumPrimaryCtaClass('justify-center px-5 py-3 text-sm font-semibold')}>
              View bookings
            </Link>
            <Link href="/forms/customer-booking?serviceType=grooming&mode=home_visit#start-your-booking" className={premiumSecondaryCtaClass('justify-center px-5 py-3 text-sm font-semibold')}>
              Book Now
            </Link>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}