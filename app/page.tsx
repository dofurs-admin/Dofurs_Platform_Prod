import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  ChevronDown,
  House,
  ShieldCheck,
  ShowerHead,
  Sparkles,
  Star,
} from 'lucide-react';
import BookingStepCard from '@/components/BookingStepCard';
import PremiumCard from '@/components/PremiumCard';
import FadeInSection from '@/components/FadeInSection';
import FloatingPawBackground from '@/components/FloatingPawBackground';
import Footer from '@/components/Footer';
import MarketingSubscriptionGroupCard from '@/components/payments/MarketingSubscriptionGroupCard';
import GroomingBeforeAfterReviews from '@/components/services/GroomingBeforeAfterReviews';
import GroomingDoorstepBenefitsSection from '@/components/services/GroomingDoorstepBenefitsSection';
import Navbar from '@/components/Navbar';
import ServiceCatalogRail from '@/components/ServiceCatalogRail';
import WelcomeOfferModal from '@/components/WelcomeOfferModal';
import { links } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { marketingSubscriptionPlanGroups } from '@/lib/subscriptions/marketing-plans';

export const metadata: Metadata = {
  title: 'Dofurs | Doorstep Pet Grooming in Bengaluru',
  description:
    'Book trusted doorstep pet grooming in Bengaluru. Verified groomers, transparent grooming packages from ₹699, pet-safe products, and hygiene-first care.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Dofurs | Doorstep Pet Grooming in Bengaluru',
    description:
      'Verified doorstep grooming for dogs and cats across Bengaluru, with package pricing, calm handling, and WhatsApp support.',
    type: 'website',
    url: 'https://dofurs.in',
    images: ['/logo/og-default.jpg'],
  },
};

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});


type ServiceDiscoveryVariant = 'conversion' | 'trust';

const serviceDiscoveryExperiments: Record<
  ServiceDiscoveryVariant,
  {
    heading: string;
    headerCtaLabel: string;
    headerCtaHref: string;
    panelLabel: string;
    panelBody: string;
    chips: [string, string, string, string];
    highlights: [string, string, string];
    footerTiles: [
      { title: string; description: string },
      { title: string; description: string },
      { title: string; description: string },
    ];
  }
> = {
  conversion: {
    heading: 'Doorstep Pet Grooming, From Verified Groomers Across Bengaluru',
    headerCtaLabel: 'Book Now',
    headerCtaHref: buildBookingHref(),
    panelLabel: 'Pet Grooming Packages',
    panelBody:
      'Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.',
    chips: ['Doorstep grooming', 'Background-verified', 'Safe for anxious pets', 'Pet-safe products'],
    highlights: ['All Bengaluru pincodes', '4.8 avg rating', 'Under 2-hour response'],
    footerTiles: [
      {
        title: 'Fit-Based Match',
        description: 'Filtered by pet size, coat type, matting, and comfort level.',
      },
      {
        title: 'Price Clarity',
        description: 'Base pricing visible upfront — no surprises at checkout.',
      },
      {
        title: 'Fast Booking',
        description: 'Select and move directly into a prefilled booking flow.',
      },
    ],
  },
  trust: {
    heading: 'Care Standards Built Around Your Pet\'s Safety and Comfort',
    headerCtaLabel: 'See Safety Standards',
    headerCtaHref: '#doorstep-benefits',
    panelLabel: 'Trust-First Care',
    panelBody:
      'Every groomer is vetted for safety, hygiene, tool care, and calm handling before taking Dofurs appointments.',
    chips: ['Background-verified', 'Sanitized equipment', 'Gentle handling', 'Full transparency'],
    highlights: ['All groomers vetted', 'Premium hygiene standard', 'Documented quality scores'],
    footerTiles: [
      {
        title: 'Safety-Led Grooming',
        description: 'Handlers matched to anxious or reactive pets first.',
      },
      {
        title: 'Trust Signals Upfront',
        description: 'Reliability cues and scores visible before you book.',
      },
      {
        title: 'Assisted Booking',
        description: 'Prefilled flow with fewer steps and better fit.',
      },
    ],
  },
};

const bookingSteps = [
  {
    title: 'Tell Us About Your Pet',
    description:
      "Share your pet's breed and size, pick the grooming package that fits, and see the price before you commit. No hidden costs.",
    icon: BriefcaseBusiness,
    image: '/Birthday/chose%20service_card.webp',
  },
  {
    title: 'Pick a Time That Works',
    description:
      "Choose a slot, confirm your address, and you're done. We come to your home — no dropping off, no waiting in queues.",
    icon: CalendarClock,
    image: '/Birthday/book%20instantly_card.webp',
  },
  {
    title: 'We Handle the Rest',
    description:
      "Your specialist arrives on time with everything they need. Watch your pet get cared for, or step away and trust us to handle it.",
    icon: ShieldCheck,
    image: '/Birthday/relax%20%26%20enjoy%20_card.webp',
  },
];

const socialStats = [
  { value: '100+', label: 'Pet Parents Served' },
  { value: '4.8', label: 'Average Rating' },
  { value: 'Bengaluru', label: 'Primary Service Area' },
];

// Enriches the LocalBusiness defined in the root layout with an AggregateRating
// and representative Review entities so Google can render review stars in the SERP.
const businessRatingSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://dofurs.in/#localbusiness',
  name: 'Dofurs',
  url: 'https://dofurs.in',
  image: 'https://dofurs.in/logo/og-default.jpg',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '127',
    bestRating: '5',
    worstRating: '1',
  },
  review: [
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Harshita P N' },
      reviewBody:
        'Booked grooming in minutes. Clear updates and a calm, happy pup after the session. The Dofurs team genuinely cares about the pets.',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
    },
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Shreyas' },
      reviewBody:
        'The groomer was punctual, gentle, and professional. The booking experience felt truly seamless.',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
    },
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Shalini Sharma' },
      reviewBody:
        'Fast confirmation, transparent package details, and excellent grooming quality. Dofurs made life easier for me and my cat.',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
    },
  ],
};

function buildBookingHref(options?: { serviceType?: string; providerName?: string; mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' }) {
  const params = new URLSearchParams();

  if (options?.serviceType) {
    params.set('serviceType', options.serviceType);
  }

  if (options?.providerName) {
    params.set('providerName', options.providerName);
  }

  if (options?.mode) {
    params.set('mode', options.mode);
  }

  const query = params.toString();
  return `${links.booking}${query ? `?${query}` : ''}#start-your-booking`;
}

type HomePageSearchParams = { [key: string]: string | string[] | undefined };

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<HomePageSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sdvValue = resolvedSearchParams?.sdv;
  const sdvParam = Array.isArray(sdvValue) ? sdvValue[0] : sdvValue;
  const serviceDiscoveryVariant: ServiceDiscoveryVariant = sdvParam === 'trust' ? 'trust' : 'conversion';
  const discoveryContent = serviceDiscoveryExperiments[serviceDiscoveryVariant];
  const serviceDiscoveryHeaderCtaClassName = premiumPrimaryCtaClass('h-10 px-5 text-sm font-semibold tracking-[0.01em] whitespace-nowrap');
  const heroPrimaryCtaClassName = premiumPrimaryCtaClass('h-12 px-7 text-base font-bold tracking-[0.01em] shadow-lg shadow-orange-500/20');
  const heroSecondaryCtaClassName = premiumSecondaryCtaClass('h-10 px-5 text-sm font-semibold tracking-[0.01em]');
  const bookingPrimaryCtaClassName = premiumPrimaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');
  const bookingSecondaryCtaClassName = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');
  return (
    <>
      <Navbar />
      <WelcomeOfferModal />
      <main className={`${plusJakarta.className} dofurs-mobile-main relative overflow-x-hidden bg-[linear-gradient(180deg,#fffcf8_0%,#fffdfa_38%,#fffcf9_100%)] text-ink`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_14%_0%,rgba(228,153,90,0.14),transparent_52%),radial-gradient(circle_at_86%_8%,rgba(154,122,87,0.08),transparent_48%),linear-gradient(to_bottom,rgba(255,248,240,0.62),rgba(255,255,255,0))]"
          aria-hidden="true"
        />

        <FloatingPawBackground />

        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_10%_12%,rgba(228,153,90,0.22),transparent_38%),radial-gradient(circle_at_90%_82%,rgba(154,122,87,0.12),transparent_40%)]" aria-hidden="true" />
          <video
            className="absolute inset-0 z-0 h-full w-full object-cover object-center opacity-65 saturate-[1.08] contrast-[1.04]"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/Birthday/dofurs-desk-converted.webp"
            aria-label="Dog being groomed at home by a professional groomer in Bengaluru"
          >
            <source src="/Birthday/dofurs.cover.video.mp4" type="video/mp4" />
          </video>
          <div
            className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(108deg,rgba(255,252,248,0.84)_0%,rgba(255,248,240,0.67)_44%,rgba(255,245,235,0.5)_100%)]"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeInSection className="pb-10 pt-20 sm:pb-12 sm:pt-24 lg:pb-14 lg:pt-28">
              <div className="grid gap-4 lg:grid-cols-[1.45fr_0.9fr] lg:items-center lg:gap-6">
                <div>
                  <h1 className="max-w-3xl text-balance text-[1.95rem] font-bold leading-[1.08] tracking-[-0.015em] text-[#2d221a] sm:text-[2.35rem] sm:leading-[1.04] lg:text-[2.65rem]">
                    Doorstep Pet Grooming,
                    <span className="block text-[#6d3d1f]">Handled with Precision</span>
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4a392d]/90 sm:text-[15px]">
                    Verified groomers, transparent package pricing, pet-safe products, and punctual at-home appointments across Bengaluru.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#e8cfb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.6)_100%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7a5a45] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">Verified</span>
                    <span className="rounded-full border border-[#e8cfb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.6)_100%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7a5a45] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">On-Time</span>
                    <span className="rounded-full border border-[#e8cfb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.6)_100%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7a5a45] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">Hygiene-First</span>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <Link href={buildBookingHref()} className={heroPrimaryCtaClassName}>
                      Book Now
                    </Link>
                    <Link href="#service-discovery" className={heroSecondaryCtaClassName}>
                      View Pet Grooming Packages
                    </Link>
                  </div>

                  <div className="mt-3.5 rounded-xl border border-[#e6c9af] bg-white/72 p-3 lg:hidden">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#925229]">Pet Grooming Care</p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <PremiumCard as="article" className="rounded-lg border border-[#ead1bb] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.72)_100%)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                        <House className="mx-auto h-3.5 w-3.5 text-coral" />
                        <p className="mt-1 text-[11px] font-semibold text-[#3a2c22]">At Home</p>
                      </PremiumCard>
                      <PremiumCard as="article" className="rounded-lg border border-[#ead1bb] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.72)_100%)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                        <ShieldCheck className="mx-auto h-3.5 w-3.5 text-coral" />
                        <p className="mt-1 text-[11px] font-semibold text-[#3a2c22]">Hygiene</p>
                      </PremiumCard>
                      <PremiumCard as="article" className="rounded-lg border border-[#ead1bb] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.72)_100%)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                        <Star className="mx-auto h-3.5 w-3.5 text-coral" />
                        <p className="mt-1 text-[11px] font-semibold text-[#3a2c22]">Coat Care</p>
                      </PremiumCard>
                    </div>
                    <Link
                      href={buildBookingHref()}
                      className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg border border-[#e5c8af] bg-white/84 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a5a45]"
                    >
                      Book Now
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6c5748] sm:mt-6">
                    {socialStats.map((stat) => {
                      const shortLabel = stat.label === 'Pet Parents Served'
                        ? 'Served'
                        : stat.label === 'Average Rating'
                          ? 'Rating'
                          : 'Coverage';

                      return (
                        <span key={stat.label} className="inline-flex items-center gap-1">
                          <span className="text-sm font-extrabold leading-none text-[#2d221a]">{stat.value}</span>
                          <span>{shortLabel}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <aside className="hidden rounded-[22px] border border-[#e5c3a6] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.82)_50%,rgba(255,250,244,0.65)_100%)] p-4 shadow-gloss-premium backdrop-blur-sm lg:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#925229]">Grooming Care</p>
                  <p className="mt-1.5 text-base font-semibold leading-tight text-[#35271f]">Everything Needed for a Home Session</p>
                  <p className="mt-1 text-xs text-[#6a5648]">Doorstep grooming with tools, pet-safe products, package clarity, and calm handling.</p>

                  <div className="mt-3 grid gap-2">
                    <PremiumCard as="article" className="flex items-start gap-2.5 rounded-xl border border-[#e8cdb6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.64)_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[22%] bg-[linear-gradient(150deg,#fff8f0_0%,#fde3c8_100%)] text-coral shadow-[0_1px_5px_rgba(228,153,90,0.14),inset_0_1px_0_rgba(255,255,255,1)]">
                        <House className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <p className="text-xs font-semibold text-[#3a2c22]">At Home</p>
                        <p className="text-[11px] text-[#7a6252]">Doorstep care in your pet&apos;s comfort zone.</p>
                      </span>
                    </PremiumCard>

                    <PremiumCard as="article" className="flex items-start gap-2.5 rounded-xl border border-[#e8cdb6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.64)_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[22%] bg-[linear-gradient(150deg,#fff8f0_0%,#fde3c8_100%)] text-coral shadow-[0_1px_5px_rgba(228,153,90,0.14),inset_0_1px_0_rgba(255,255,255,1)]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <p className="text-xs font-semibold text-[#3a2c22]">Hygiene-First</p>
                        <p className="text-[11px] text-[#7a6252]">Sanitized tools and pet-safe grooming products.</p>
                      </span>
                    </PremiumCard>

                    <PremiumCard as="article" className="flex items-start gap-2.5 rounded-xl border border-[#e8cdb6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.64)_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[22%] bg-[linear-gradient(150deg,#fff8f0_0%,#fde3c8_100%)] text-coral shadow-[0_1px_5px_rgba(228,153,90,0.14),inset_0_1px_0_rgba(255,255,255,1)]">
                        <Star className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <p className="text-xs font-semibold text-[#3a2c22]">Coat-Focused</p>
                        <p className="text-[11px] text-[#7a6252]">Bath, haircut, de-shedding, nails, ears and paws.</p>
                      </span>
                    </PremiumCard>
                  </div>

                  <Link
                    href={buildBookingHref()}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#e5c8af] bg-white/78 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#7a5a45] transition hover:border-coral/45 hover:text-[#5f3a21]"
                  >
                    Book Now
                  </Link>
                </aside>
              </div>
            </FadeInSection>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-16 bg-gradient-to-b from-transparent to-[#fffcf8]" />
        </section>

        <div className="relative z-[2] mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <FadeInSection className="mt-14" delay={0.1}>
            <section id="service-discovery">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Service Discovery</p>
                  <h2 className="mt-2 max-w-3xl text-3xl font-bold leading-[1.16] tracking-[-0.008em] text-[#2d221a] sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.014em]">
                    {discoveryContent.heading}
                  </h2>
                </div>
                <Link
                  href={discoveryContent.headerCtaHref}
                  className={serviceDiscoveryHeaderCtaClassName}
                >
                  {discoveryContent.headerCtaLabel}
                </Link>
              </div>

              <div className="mt-5">
                <article className="relative overflow-hidden rounded-[24px] border border-[#e8d1bc] bg-[linear-gradient(140deg,#fff9f4_0%,#fffefc_55%,#fff8f1_100%)] p-4 shadow-gloss-premium-lg sm:p-6">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(227,154,93,0.12),transparent_42%),radial-gradient(circle_at_88%_82%,rgba(122,163,99,0.08),transparent_38%)]" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[24px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.14)_55%,rgba(255,255,255,0)_100%)]" aria-hidden="true" />
                  <div className="relative z-10">
                    <p className="inline-flex items-center rounded-full border border-[#e7cdb5] bg-white/82 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#9f5524]">
                      {discoveryContent.panelLabel}
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#675245] sm:mt-4 sm:text-base">
                      {discoveryContent.panelBody}
                    </p>

                    <div className="mt-4 hidden flex-wrap gap-2.5 sm:flex">
                      {discoveryContent.chips.map((chip) => (
                        <span
                          key={chip}
                          className="inline-flex items-center rounded-full border border-[#ecd9c8] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.72)_100%)] px-3 py-1.5 text-xs font-semibold text-[#4a392d] shadow-[inset_0_1px_0_rgba(255,255,255,1)]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>

                    {/* Mobile: compact inline stats strip */}
                    <div className="mt-4 grid grid-cols-3 rounded-2xl border border-[#efdece] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.76)_100%)] py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,1)] sm:hidden">
                      {[
                        { label: 'Coverage', value: discoveryContent.highlights[0] },
                        { label: 'Rating', value: discoveryContent.highlights[1] },
                        { label: 'Response', value: discoveryContent.highlights[2] },
                      ].map((h, i) => (
                        <div key={h.label} className={`text-center ${i > 0 ? 'border-l border-[#efdece]/70' : ''}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{h.label}</p>
                          <p className="mt-0.5 text-xs font-bold text-[#3a2c22]">{h.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Desktop: card-style stats */}
                    <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-3">
                      {[
                        { label: 'Coverage', value: discoveryContent.highlights[0] },
                        { label: 'Average Rating', value: discoveryContent.highlights[1] },
                        { label: 'Response', value: discoveryContent.highlights[2] },
                      ].map((h) => (
                        <PremiumCard key={h.label} className="rounded-2xl border border-[#efdece] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.76)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{h.label}</p>
                          <p className="mt-1 text-sm font-bold text-[#3a2c22]">{h.value}</p>
                        </PremiumCard>
                      ))}
                    </div>

                    <div className="mt-5 hidden border-t border-[#efdece]/60 pt-4 sm:block">
                      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                        {discoveryContent.footerTiles.map((tile) => (
                          <div key={tile.title} className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#de9158,#c7773b)] shadow-[0_2px_6px_rgba(199,119,59,0.25)]">
                              <BadgeCheck className="h-3 w-3 text-white" />
                            </span>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">{tile.title}</p>
                              <p className="mt-0.5 text-[13px] leading-snug text-[#675245]">{tile.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <ServiceCatalogRail />

              <div className="mt-6 scroll-mt-28 rounded-[22px] border border-[#ead5c0] bg-[linear-gradient(140deg,#fff9f4_0%,#fffefc_55%,#fff8f1_100%)] p-4 shadow-premium sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral">Subscription Services</p>
                    <h3 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-neutral-950 md:text-3xl">
                      Pet Grooming Subscription Packs in Bengaluru
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#675245]">
                      Buy a grooming pack, receive subscription credit value after purchase, and use it to book eligible doorstep grooming services at your preferred date and time.
                    </p>
                  </div>
                  <p className="rounded-full border border-[#ead6c2] bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a5a45]">
                    Credit value after purchase. Flexible booking.
                  </p>
                </div>

                <ul className="mt-4 grid gap-2 text-[12px] font-semibold text-[#5d4739] sm:grid-cols-3">
                  <li className="flex items-center gap-2 rounded-xl border border-[#f0dfcf] bg-white/78 px-3 py-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                    Pay for 2 or 5 services and unlock extra grooming value.
                  </li>
                  <li className="flex items-center gap-2 rounded-xl border border-[#f0dfcf] bg-white/78 px-3 py-2">
                    <CalendarCheck2 className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                    Book eligible grooming services for your chosen slot.
                  </li>
                  <li className="flex items-center gap-2 rounded-xl border border-[#f0dfcf] bg-white/78 px-3 py-2">
                    <ShowerHead className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                    6M packs include herbal shampoo on the final service.
                  </li>
                </ul>

                <div className="mx-auto mt-5 grid max-w-[980px] items-stretch gap-4 lg:grid-cols-2">
                  {marketingSubscriptionPlanGroups.map((group) => (
                    <MarketingSubscriptionGroupCard key={group.title} group={group} />
                  ))}
                </div>
              </div>


            </section>
          </FadeInSection>

          {/* REFER & EARN BANNER */}
          <FadeInSection className="mt-16" delay={0.18}>
            <section className="relative overflow-hidden rounded-[28px] border border-[#e7c4a7] bg-[linear-gradient(135deg,#fff8ef_0%,#fff2e2_100%)] p-8 shadow-premium sm:p-10">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(228,153,90,0.2),transparent_50%)]"
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a05a2c]">Refer &amp; Earn</p>
                  <h2 className="mt-2 text-2xl font-bold leading-snug text-neutral-950 sm:text-3xl">
                    Invite a Friend. Both of You Earn ₹500.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#5a3d2a]">
                    Share your unique Dofurs referral code with pet parents. Your friend gets ₹500 credits instantly on sign-up. You earn ₹500 when they complete their first grooming booking.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-medium text-[#7a4a2a]">
                    <li>✔ ₹500 for your friend on sign-up</li>
                    <li>✔ ₹500 for you after their first booking</li>
                    <li>✔ Valid for grooming bookings</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3 sm:flex-shrink-0">
                  <Link
                    href="/refer-and-earn"
                    className={premiumPrimaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]')}
                  >
                    Get your referral code →
                  </Link>
                  <Link
                    href="/refer-and-earn"
                    className={premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]')}
                  >
                    Learn more
                  </Link>
                </div>
              </div>
            </section>
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.14}>
            <section className="relative overflow-hidden rounded-[28px] border border-[#e2c2a4] bg-[linear-gradient(140deg,#fff8f1_0%,#fffdfb_50%,#fff4e9_100%)] p-6 shadow-premium sm:p-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.22)_52%,rgba(255,255,255,0)_100%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(228,153,90,0.14),transparent_40%),radial-gradient(circle_at_86%_84%,rgba(154,122,87,0.1),transparent_40%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.02)_50%,transparent_100%)]" aria-hidden="true" />

              <p className="relative z-10 text-sm font-semibold uppercase tracking-[0.16em] text-coral">Booking Experience</p>
              <h2 className="relative z-10 mt-2 text-3xl font-semibold leading-[1.16] tracking-[-0.008em] text-[#2d221a] sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.012em]">Three Steps to a Fresh Pet Grooming Session</h2>

              <div className="relative z-10 mt-8 grid gap-4 lg:grid-cols-3">
                {bookingSteps.map((step, index) => (
                  <div key={step.title} className="contents">
                    <BookingStepCard
                      index={index}
                      title={step.title}
                      description={step.description}
                      image={step.image}
                    />
                    {index < bookingSteps.length - 1 && (
                      <div className="flex items-center justify-center lg:hidden" aria-hidden="true">
                        <ChevronDown className="h-5 w-5 text-coral/50" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

                <div className="relative z-10 mt-8 flex flex-wrap gap-3">
                <Link
                  href={buildBookingHref()}
                    className={bookingPrimaryCtaClassName}
                >
                  Book Now -&gt;
                </Link>
                <Link
                  href={buildBookingHref()}
                    className={bookingSecondaryCtaClassName}
                >
                  View Pet Grooming Packages
                </Link>
              </div>
            </section>
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.16}>
            <GroomingDoorstepBenefitsSection locationName="Bengaluru" />
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.22}>
            <section className="relative overflow-hidden rounded-[30px] border border-[#3b2d22] bg-[linear-gradient(135deg,#17120e_0%,#22170f_52%,#15110d_100%)] p-8 text-white shadow-premium-lg sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(228,153,90,0.24),transparent_38%),radial-gradient(circle_at_86%_86%,rgba(122,163,99,0.18),transparent_36%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),rgba(255,255,255,0))]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[29px] bg-[linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" aria-hidden="true" />

              <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-300">Partner With Dofurs</p>
                  <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Are You a Professional Pet Groomer?</h2>
                  <p className="mt-3 text-base text-white/78">
                    Join a premium grooming network built for trusted professionals. We support verified groomers with demand, booking tools, customer context, and quality standards.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={links.provider}
                    className={bookingPrimaryCtaClassName}
                  >
                    Join as a Grooming Partner -&gt;
                  </Link>
                </div>
              </div>

              <div className="relative z-10 mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Doorstep Groomers', description: 'Professionals comfortable with home setups, apartment access, and pet-parent communication.' },
                  { label: 'Salon Teams', description: 'Established grooming studios looking for verified demand and better booking operations.' },
                  { label: 'Coat Specialists', description: 'Experts in de-shedding, de-matting, hygiene trims, and breed-aware coat care.' },
                  { label: 'Cat Groomers', description: 'Calm handlers who understand feline temperament, safety, and low-stress grooming.' },
                ].map((item) => (
                  <PremiumCard
                    key={item.label}
                    as="article"
                    variant="dark"
                    className="rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.02)_100%)] p-4 shadow-gloss-dark backdrop-blur-[2px]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-300">{item.label}</p>
                    <p className="mt-2 text-sm text-white/80">{item.description}</p>
                  </PremiumCard>
                ))}
              </div>

            </section>
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.24}>
            <GroomingBeforeAfterReviews
              bookingHref={buildBookingHref({ serviceType: 'pet-grooming', mode: 'home_visit' })}
              locationName="Bengaluru"
              questionsHref="/faqs"
              compact
            />
          </FadeInSection>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessRatingSchema) }} />
      </main>
      <Footer />
    </>
  );
}
