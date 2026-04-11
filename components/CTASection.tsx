import Link from 'next/link';
import Image from 'next/image';
import { PawPrint, ShieldCheck, Star } from 'lucide-react';
import { links } from '@/lib/site-data';
import FadeInSection from './FadeInSection';
import { premiumPrimaryCtaClass } from '@/lib/styles/premium-cta';

export default function CTASection() {
  const premiumBookingCtaClassName = premiumPrimaryCtaClass('h-11 w-full justify-center px-8 text-sm font-semibold tracking-[0.01em] sm:w-auto');

  return (
    <section id="book" className="scroll-mt-24 bg-white py-20">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] px-6 py-10 shadow-soft sm:px-8 md:px-10 md:py-12 lg:px-14 lg:py-14">
            <PawPrint className="absolute left-8 top-8 h-7 w-7 text-[#e9c7ad]/25" aria-hidden="true" />
            <PawPrint className="absolute right-8 top-14 h-6 w-6 -rotate-12 text-[#e9c7ad]/20" aria-hidden="true" />
            <PawPrint className="absolute bottom-8 left-1/3 h-6 w-6 rotate-12 text-[#e9c7ad]/20" aria-hidden="true" />

            <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="text-center lg:text-left">
                <div className="mb-4 inline-flex items-center justify-center gap-2 text-[#e89a5e] lg:justify-start">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  <span className="text-sm font-medium">Premium Care Promise</span>
                </div>

                <h2 className="text-4xl font-bold tracking-tight text-ink sm:text-[42px] lg:text-5xl">
                  Book Premium Pet Care in Minutes
                </h2>

                <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-base text-[#6b6b6b] sm:text-lg lg:mx-0">
                  {'Certified groomers. Doorstep service.\n100% hygiene-first protocols.'}
                </p>

                <div className="mt-8 flex flex-col items-center gap-4 lg:items-start">
                  <Link
                    href={links.booking}
                    className={premiumBookingCtaClassName}
                    aria-label="Book Now"
                  >
                    Book Now
                  </Link>

                  <p className="inline-flex items-center justify-center gap-2 text-sm text-[#7a7a7a] lg:justify-start">
                    <Star className="h-4 w-4 fill-[#d4a73b] text-[#d4a73b]" aria-hidden="true" />
                    Trusted by 1,000+ Pet Parents in Bangalore
                  </p>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-xl">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] shadow-xl">
                  <Image
                    src="/Birthday/book-a-service.png"
                    alt="Professional pet grooming service"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-[#f6efe9]/65 via-[#f6efe9]/20 to-transparent"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
