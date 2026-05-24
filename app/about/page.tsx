import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';
import { BadgeCheck, Home, ShieldCheck } from 'lucide-react';
import { supportContact } from '@/lib/site-data';

export const metadata: Metadata = {
  title: 'About Dofurs — Trusted Pet Grooming for Bangalore Pet Parents',
  description:
    'Dofurs is a Bangalore-based doorstep pet grooming platform built around verified groomers, transparent pricing, and a safety-first approach. Meet the team behind trusted grooming experiences.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Dofurs — Trusted Pet Grooming for Bangalore',
    description:
      'Verified groomers, transparent pricing, and a safety-first approach to doorstep grooming across Bangalore.',
    url: 'https://dofurs.in/about',
    images: ['/logo/og-default.jpg'],
  },
};

export default function AboutPage() {
  return (
    <ContentPageLayout
      title="About Dofurs"
      description="Premium doorstep grooming, simplified for modern pet parents. Trusted, transparent, and built with a pet-first mindset."
      heroImageSrc="/Birthday/about%20us_new.png"
      heroImageAlt="About Dofurs"
    >
      <p className="mx-auto max-w-4xl rounded-full border border-[#f1e6da] bg-[#fffaf6] px-5 py-2.5 text-center text-[14.5px] leading-6 text-ink/80 md:text-[15px]">
        Dofurs, Bangalore, Karnataka 560100 • dofurs.in • petcare@dofurs.in
      </p>

      <section className="mx-auto mt-3 max-w-4xl rounded-3xl border border-[#f1e6da] bg-[linear-gradient(180deg,_#fffdfb_0%,_#fdf6ef_100%)] px-6 py-7 text-center shadow-soft-sm md:px-10 md:py-9">
        <h2 className="text-2xl font-semibold text-ink">Our Mission</h2>
        <p className="mx-auto mt-3 max-w-3xl text-[#666] md:text-[16px] md:leading-7">
          We are building Bangalore’s most trusted doorstep pet grooming platform where every pet parent can discover verified groomers,
          book confidently, and receive dependable support.
        </p>
      </section>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="group rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-soft-lg">
          <ShieldCheck className="h-7 w-7 text-coral transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Certified Groomers</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Verified professionals with quality and hygiene standards.</p>
        </div>
        <div className="group rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-soft-lg">
          <Home className="h-7 w-7 text-coral transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Doorstep Service</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Comfort-first care at home for stress-free pet experiences.</p>
        </div>
        <div className="group rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-soft-lg">
          <BadgeCheck className="h-7 w-7 text-coral transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Trusted Locally</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Loved by pet parents across Bengaluru for consistent quality.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="h-full rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm">
          <h2 className="text-2xl font-semibold text-ink">Who We Are</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-ink/80">
            Dofurs is a Bengaluru-based doorstep grooming platform built on a simple belief: pets deserve better, and so do
            the people who love them. We are a team of pet lovers, technologists, and grooming professionals focused on making
            trusted grooming easier to find and book.
          </p>
        </section>

        <section className="h-full rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm">
          <h2 className="text-2xl font-semibold text-ink">Our Story</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-ink/80">
            Dofurs was born from a real pet-parent experience: long waits, inconsistent hygiene, and unreliable options. We
            started in Bengaluru with a clear mission to build a platform where pet parents can book verified, premium grooming
            without chaos or compromise.
          </p>
        </section>

        <section className="h-full rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm">
          <h2 className="text-2xl font-semibold text-ink">What We Do</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7 text-ink/80">
            <li>
              <strong>Doorstep grooming:</strong> Professional grooming at home across Bangalore neighbourhoods.
            </li>
            <li>
              <strong>Transparent packages:</strong> Clear grooming inclusions, starting prices, and add-on options before booking.
            </li>
            <li>
              <strong>Verified groomers:</strong> Grooming partners reviewed for experience, hygiene, handling, and reliability.
            </li>
            <li>
              <strong>Booking support:</strong> Pincode-aware availability, reminders, receipts, and WhatsApp support.
            </li>
          </ul>
        </section>

        <section className="h-full rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm">
          <h2 className="text-2xl font-semibold text-ink">Our Values</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7 text-ink/80">
            <li>
              <strong>Trust:</strong> Verified professionals and backed bookings.
            </li>
            <li>
              <strong>Convenience:</strong> Grooming that comes home, with less travel and less stress.
            </li>
            <li>
              <strong>Pets Deserve Better:</strong> A pet-first lens behind every decision.
            </li>
          </ul>
        </section>

        <section className="h-full rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm">
          <h2 className="text-2xl font-semibold text-ink">Why Dofurs</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7 text-ink/80">
            <li>Verified professionals through structured onboarding and credential checks.</li>
            <li>Transparent booking with no hidden charges at checkout.</li>
            <li>End-to-end support from booking to completion.</li>
            <li>Built for Indian pet parents and local care realities.</li>
          </ul>
        </section>

        <section className="h-full rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm">
          <h2 className="text-2xl font-semibold text-ink">Where We Are Headed</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-ink/80">
            We launched in Bengaluru and are expanding across neighbourhoods before growing to other Indian cities. Our
            vision is to become India’s most trusted doorstep pet grooming platform.
          </p>
        </section>

        <section className="rounded-3xl border border-[#f1e6da] bg-white/80 p-6 shadow-soft-sm lg:col-span-2">
          <h2 className="text-2xl font-semibold text-ink">Get in Touch</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-ink/80">Email: petcare@dofurs.in</p>
          <p className="text-[15.5px] leading-7 text-ink/80">WhatsApp: {supportContact.whatsappDisplay}</p>
          <p className="text-[15.5px] leading-7 text-ink/80">Headquarters: Dofurs, Bangalore, Karnataka 560100</p>
        </section>
      </div>
    </ContentPageLayout>
  );
}
