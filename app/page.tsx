import type { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  BadgeCheck,
  Building2,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  House,
  HeartHandshake,
  ShieldCheck,
  Star,
  Video,
  Wallet,
} from 'lucide-react';
import BirthdayBannerSection from '@/components/BirthdayBannerSection';
import BookingStepCard from '@/components/BookingStepCard';
import PremiumCard from '@/components/PremiumCard';
import FadeInSection from '@/components/FadeInSection';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import WelcomeOfferModal from '@/components/WelcomeOfferModal';
import SubscriptionPlanCard from '@/components/payments/SubscriptionPlanCard';
import { links } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Dofurs | Premium Pet Services, Simplified',
  description: 'Book trusted, verified pet care professionals for grooming, veterinary, training, walking, and sitting services in Bangalore. Quality pet care at your doorstep.',
  openGraph: {
    title: 'Dofurs | Premium Pet Services, Simplified',
    description: 'Book trusted, verified pet care professionals in Bangalore.',
    type: 'website',
    url: 'https://dofurs.in',
  },
};

// Lazy-load client components
const FloatingPawBackground = dynamic(() => import('@/components/FloatingPawBackground'));
const ServiceCatalogRail = dynamic(() => import('@/components/ServiceCatalogRail'));
const AutoScrollRail = dynamic(() => import('@/components/AutoScrollRail'));

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
    heading: 'Premium Pet Care, From Verified Specialists Across Bangalore',
    headerCtaLabel: 'Book a Service',
    headerCtaHref: buildBookingHref(),
    panelLabel: 'Service Explorer',
    panelBody:
      'Trusted by 100+ pet parents. Browse verified services, compare options, and book confidently — all in one place.',
    chips: ['At-home specialists', 'Background-verified', 'Safe for anxious pets', 'Premium products'],
    highlights: ['All Bangalore pincodes', '4.8 avg rating', 'Under 2-hour response'],
    footerTiles: [
      {
        title: 'Fit-Based Match',
        description: 'Filtered by pet size, coat type, and specific needs.',
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
    headerCtaHref: '#trust-safety',
    panelLabel: 'Trust-First Care',
    panelBody:
      'Every provider is vetted for safety, hygiene, and calm handling before appearing in your feed. Browse with full confidence.',
    chips: ['Background-verified', 'Sanitized equipment', 'Gentle handling', 'Full transparency'],
    highlights: ['All providers vetted', 'Premium hygiene standard', 'Documented quality scores'],
    footerTiles: [
      {
        title: 'Safety-Led Match',
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

const providers = [
  {
    name: 'Pawsome Grooming Studio',
    initials: 'PG',
    avatarGradient: 'from-[#de9158] to-[#c7773b]',
    type: 'Grooming Center',
    location: 'Indiranagar, Bangalore',
    rating: '4.9',
    reviews: '212 reviews',
    services: 'Full grooming, spa, de-shedding',
    serviceType: 'Grooming',
  },
  {
    name: 'VetCare Clinic',
    initials: 'VC',
    avatarGradient: 'from-[#5b8fd4] to-[#3a6db5]',
    type: 'Veterinary Clinic',
    location: 'Koramangala, Bangalore',
    rating: '4.8',
    reviews: '184 reviews',
    services: 'Consultations, vaccinations, surgery',
    serviceType: 'Vet Visits',
  },
  {
    name: 'Happy Tails Pet Resort',
    initials: 'HT',
    avatarGradient: 'from-[#7ab87a] to-[#4e9e4e]',
    type: 'Pet Boarding & Daycare',
    location: 'Whitefield, Bangalore',
    rating: '4.9',
    reviews: '167 reviews',
    services: 'Boarding, daycare, training',
    serviceType: 'Pet Sitting',
  },
];

const subscriptionPacks = [
  {
    title: 'Essential Grooming Pack 6M',
    badge: 'Starter Value',
    duration: '180 days',
    price: '₹8,999',
    worth: '₹10,794',
    sessions: '6 essential grooming sessions',
    serviceType: 'Grooming',
  },
  {
    title: 'Premium Grooming Pack 6M',
    badge: 'Most Chosen',
    duration: '180 days',
    price: '₹10,999',
    worth: '₹13,794',
    sessions: '6 premium grooming sessions',
    serviceType: 'Grooming',
  },
  {
    title: 'Premium Grooming Pack 12M',
    badge: 'Elite Annual',
    duration: '360 days',
    price: '₹19,999',
    worth: '₹27,588',
    sessions: '12 premium grooming sessions',
    serviceType: 'Grooming',
  },
] as const;

const bookingSteps = [
  {
    title: 'Tell Us About Your Pet',
    description:
      "Share your pet's breed and size, pick the service that fits, and see the price before you commit. No hidden costs.",
    icon: BriefcaseBusiness,
    image: '/Birthday/chose%20service_card.png',
  },
  {
    title: 'Pick a Time That Works',
    description:
      "Choose a slot, confirm your address, and you're done. We come to your home — no dropping off, no waiting in queues.",
    icon: CalendarClock,
    image: '/Birthday/book%20instantly_card.png',
  },
  {
    title: 'We Handle the Rest',
    description:
      "Your specialist arrives on time with everything they need. Watch your pet get cared for, or step away and trust us to handle it.",
    icon: ShieldCheck,
    image: '/Birthday/relax%20%26%20enjoy%20_card.png',
  },
];

const trustPoints = [
  {
    title: 'Verified Professionals',
    description: 'Every provider is vetted before joining the Dofurs network.',
    icon: BadgeCheck,
    backgroundImage: '/Birthday/varifiedProfessionals_card.png',
  },
  {
    title: 'Background Checks',
    description: 'All service professionals pass identity and conduct verification.',
    icon: ShieldCheck,
    backgroundImage: '/Birthday/backgroundCheck_card.jpeg',
  },
  {
    title: 'Transparent Pricing',
    description: 'See full pricing before you confirm — no surprises at checkout.',
    icon: Wallet,
    backgroundImage: '/Birthday/transparentPricing_card.png',
  },
  {
    title: 'Pet Safety Guarantee',
    description: 'Gentle handling protocols and hygiene-first standards on every visit.',
    icon: HeartHandshake,
    backgroundImage: '/Birthday/patSafetyGuarantee_card.jpeg',
  },
];

const socialStats = [
  { value: '100+', label: 'Pet Parents Served' },
  { value: '4.8', label: 'Average Rating' },
  { value: 'Bangalore', label: 'Primary Service Area' },
];

const testimonials = [
  {
    quote:
      "Bruno came back looking fresh and smelling great. The groomer was so patient with him - he's usually a nightmare with strangers.",
    attribution: 'Riya M. - Golden Retriever parent, Bangalore',
    initials: 'RM',
  },
  {
    quote:
      'Showed up exactly when they said they would. My dog was relaxed through the whole thing, which honestly surprised me.',
    attribution: 'Arjun K. - Dog parent, Phase 2',
    initials: 'AK',
  },
  {
    quote:
      "My cat hates being touched by anyone outside the family. Somehow the groomer had her purring by the end of it. That's not easy to do.",
    attribution: 'Sneha P. - Cat parent, Neeladri Nagar',
    initials: 'SP',
  },
];

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Dofurs',
  image: 'https://dofurs.in/logo/brand-logo.png',
  url: 'https://dofurs.in',
  areaServed: ['Bangalore'],
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bangalore',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
  makesOffer: [
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pet Grooming' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Veterinary Home Visits' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pet Sitting' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pet Training' } },
  ],
};

const aggregateRatingSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Dofurs Premium Pet Care',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '100',
  },
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
            aria-label="Dog being groomed at home by a professional groomer in Bangalore"
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
                    Premium Pet Care,
                    <span className="block text-[#6d3d1f]">Delivered with Precision</span>
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4a392d]/90 sm:text-[15px]">
                    Concierge standards, vetted specialists, transparent pricing, and punctual at-home appointments.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#e8cfb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.6)_100%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7a5a45] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">Verified</span>
                    <span className="rounded-full border border-[#e8cfb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.6)_100%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7a5a45] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">On-Time</span>
                    <span className="rounded-full border border-[#e8cfb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.6)_100%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7a5a45] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">Hygiene-First</span>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <Link href={buildBookingHref()} className={heroPrimaryCtaClassName}>
                      Book a Service
                    </Link>
                    <Link href="#service-discovery" className={heroSecondaryCtaClassName}>
                      Review Service Lines
                    </Link>
                  </div>

                  <div className="mt-3.5 rounded-xl border border-[#e6c9af] bg-white/72 p-3 lg:hidden">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#925229]">Service Modes</p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <PremiumCard as="article" className="rounded-lg border border-[#ead1bb] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.72)_100%)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                        <House className="mx-auto h-3.5 w-3.5 text-coral" />
                        <p className="mt-1 text-[11px] font-semibold text-[#3a2c22]">At Home</p>
                      </PremiumCard>
                      <PremiumCard as="article" className="rounded-lg border border-[#ead1bb] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.72)_100%)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                        <Building2 className="mx-auto h-3.5 w-3.5 text-coral" />
                        <p className="mt-1 text-[11px] font-semibold text-[#3a2c22]">Clinic / Center</p>
                      </PremiumCard>
                      <PremiumCard as="article" className="rounded-lg border border-[#ead1bb] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.72)_100%)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                        <Video className="mx-auto h-3.5 w-3.5 text-coral" />
                        <p className="mt-1 text-[11px] font-semibold text-[#3a2c22]">Teleconsult</p>
                      </PremiumCard>
                    </div>
                    <Link
                      href={buildBookingHref()}
                      className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg border border-[#e5c8af] bg-white/84 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a5a45]"
                    >
                      Start Booking
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
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#925229]">Service Modes</p>
                  <p className="mt-1.5 text-base font-semibold leading-tight text-[#35271f]">Care Wherever You Need It</p>
                  <p className="mt-1 text-xs text-[#6a5648]">Flexible delivery model for home, partner clinics, and remote expert guidance.</p>

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
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <p className="text-xs font-semibold text-[#3a2c22]">At Clinics / Grooming Centers</p>
                        <p className="text-[11px] text-[#7a6252]">Structured care at partner facilities.</p>
                      </span>
                    </PremiumCard>

                    <PremiumCard as="article" className="flex items-start gap-2.5 rounded-xl border border-[#e8cdb6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.64)_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[22%] bg-[linear-gradient(150deg,#fff8f0_0%,#fde3c8_100%)] text-coral shadow-[0_1px_5px_rgba(228,153,90,0.14),inset_0_1px_0_rgba(255,255,255,1)]">
                        <Video className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <p className="text-xs font-semibold text-[#3a2c22]">Teleconsultancy</p>
                        <p className="text-[11px] text-[#7a6252]">Remote guidance for follow-ups and quick advice.</p>
                      </span>
                    </PremiumCard>
                  </div>

                  <Link
                    href={buildBookingHref()}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#e5c8af] bg-white/78 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#7a5a45] transition hover:border-coral/45 hover:text-[#5f3a21]"
                  >
                    Start Booking
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

              <div className="mt-6 rounded-[22px] border border-[#ead5c0] bg-[linear-gradient(140deg,#fff9f4_0%,#fffefc_55%,#fff8f1_100%)] p-4 shadow-gloss-premium sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral">Subscription Services</p>
                    <h3 className="mt-1 text-xl font-semibold leading-tight text-[#2d221a] sm:text-2xl">
                      Premium Grooming Plans
                    </h3>
                  </div>
                  <p className="rounded-full border border-[#ead6c2] bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a5a45]">
                    Fixed pricing. Priority booking.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {subscriptionPacks.map((pack) => (
                    <SubscriptionPlanCard
                      key={pack.title}
                      badge={pack.badge}
                      durationLabel={pack.duration}
                      title={pack.title}
                      priceLabel={pack.price}
                      includedSummary={pack.sessions}
                      worthLabel={pack.worth}
                      serviceType={pack.serviceType}
                      cta={(
                        <Link
                          href="/dashboard/user/subscriptions"
                          className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-4 text-[13px] font-semibold text-white transition hover:border-[#c7773b] hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] group-hover:shadow-[0_12px_22px_rgba(199,119,59,0.28)]"
                        >
                          Choose Plan
                        </Link>
                      )}
                    />
                  ))}
                </div>
              </div>


            </section>
          </FadeInSection>

          <BirthdayBannerSection />

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
                    Share your unique Dofurs referral code with pet parents. Your friend gets ₹500 credits instantly on sign-up. You earn ₹500 when they complete their first booking — usable on any service.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-medium text-[#7a4a2a]">
                    <li>✔ ₹500 for your friend on sign-up</li>
                    <li>✔ ₹500 for you after their first booking</li>
                    <li>✔ Valid for all services</li>
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
              <h2 className="relative z-10 mt-2 text-3xl font-semibold leading-[1.16] tracking-[-0.008em] text-[#2d221a] sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.012em]">Three Steps to Exceptional Pet Care</h2>

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
                  Book a Service -&gt;
                </Link>
                <Link
                  href={buildBookingHref()}
                    className={bookingSecondaryCtaClassName}
                >
                  Explore Services
                </Link>
              </div>
            </section>
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.16}>
              <section
                id="trust-safety"
                className="relative overflow-hidden grid gap-5 rounded-[28px] border border-[#e2c2a4] bg-[linear-gradient(140deg,#fff8f1_0%,#fffdfb_50%,#fff4e9_100%)] p-6 shadow-premium sm:grid-cols-2 lg:grid-cols-4 sm:p-8"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.22)_52%,rgba(255,255,255,0)_100%)]" aria-hidden="true" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(228,153,90,0.14),transparent_40%),radial-gradient(circle_at_86%_84%,rgba(154,122,87,0.1),transparent_40%)]" aria-hidden="true" />
                <div className="pointer-events-none absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.02)_50%,transparent_100%)]" aria-hidden="true" />

                <div className="relative z-10 sm:col-span-2 lg:col-span-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Trust & Safety</p>
                <h2 className="mt-2 text-3xl font-semibold leading-[1.16] tracking-[-0.008em] text-[#2d221a] sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.012em]">Why Pet Parents Trust Dofurs</h2>
              </div>
              {trustPoints.map((item) => {
                const Icon = item.icon;

                return (
                    <PremiumCard
                      key={item.title}
                      as="article"
                      className="group relative z-10 overflow-hidden rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.28)_52%,rgba(255,255,255,0.18)_100%)] p-5 shadow-gloss-warm backdrop-blur-[1px]"
                    >
                      <div
                        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-[0.8] [filter:saturate(0.72)_brightness(1.08)_contrast(0.9)]"
                        style={{ backgroundImage: `url(${item.backgroundImage})` }}
                        aria-hidden="true"
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.14)_46%,rgba(255,255,255,0.2)_100%)]"
                        aria-hidden="true"
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_16%_14%,rgba(255,255,255,0.08),transparent_42%),radial-gradient(circle_at_84%_86%,rgba(255,255,255,0.04),transparent_44%)]"
                        aria-hidden="true"
                      />
                      <div className="relative z-10">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[22%] bg-[linear-gradient(150deg,#fff8f0_0%,#fde3c8_100%)] text-coral shadow-[0_2px_8px_rgba(228,153,90,0.16),inset_0_1px_0_rgba(255,255,255,1)] transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.08] group-hover:shadow-[0_8px_18px_rgba(228,153,90,0.3),inset_0_1px_0_rgba(255,255,255,1)] motion-reduce:transform-none">
                          <Icon className="h-5 w-5 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6 motion-reduce:transform-none" />
                        </span>
                        <p className="mt-4 text-base font-semibold text-[#2f231a] [text-shadow:0_1px_0_rgba(255,255,255,0.35)]">{item.title}</p>
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#5f4a3d] [text-shadow:0_1px_0_rgba(255,255,255,0.3)]">{item.description}</p>
                      </div>
                    </PremiumCard>
                );
              })}
            </section>
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.18}>
            <section className="relative overflow-clip rounded-[28px] border border-[#e2c2a4] bg-[linear-gradient(140deg,#fff8f1_0%,#fffdfb_50%,#fff4e9_100%)] p-6 shadow-premium-lg sm:p-8 lg:p-10">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.22)_52%,rgba(255,255,255,0)_100%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(228,153,90,0.14),transparent_40%),radial-gradient(circle_at_86%_84%,rgba(154,122,87,0.1),transparent_40%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.02)_50%,transparent_100%)]" aria-hidden="true" />

              <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Partner Marketplace</p>
                  <h2 className="mt-2 max-w-3xl text-3xl font-semibold leading-[1.16] tracking-[-0.008em] text-[#2d221a] sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.012em]">Trusted Clinics & Grooming Centers Near You</h2>
                </div>
                <Link
                  href={links.provider}
                  className="inline-flex items-center rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-5 py-2.5 text-sm font-semibold text-[#4a392d] shadow-[0_8px_20px_rgba(145,92,54,0.12)] transition hover:-translate-y-0.5 hover:border-coral/50 hover:text-coral"
                >
                  Become a Partner
                </Link>
              </div>

              <AutoScrollRail className="relative z-10 mt-7 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 scrollbar-hide lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0" intervalMs={4000}>
                {providers.map((provider) => (
                  <PremiumCard
                    key={provider.name}
                    as="article"
                    className="group flex h-full w-full shrink-0 snap-start flex-col rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.08)_52%,rgba(255,250,244,0.05)_100%)] p-5 shadow-gloss-premium backdrop-blur-[2px] sm:w-[60vw] lg:w-auto lg:shrink"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br ${provider.avatarGradient} text-sm font-bold text-white shadow-[0_4px_10px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.32)]`}>
                          {provider.initials}
                        </span>
                        <div className="min-h-[4.5rem]">
                          <h3 className="line-clamp-1 text-lg font-semibold text-[#3a2c22]">{provider.name}</h3>
                          <p className="mt-0.5 line-clamp-1 text-sm font-medium text-coral">{provider.type}</p>
                        </div>
                      </div>
                      <p className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-3 py-1 text-sm font-semibold text-coral shadow-sm">
                        <Star className="h-3.5 w-3.5 fill-coral text-coral" />
                        {provider.rating}
                      </p>
                    </div>

                    <div className="mt-4 grid auto-rows-fr gap-2 text-sm text-[#816b5d]">
                      <p className="flex min-h-10 items-center rounded-lg bg-[#fff8f0] px-2.5 py-1.5">{provider.location}</p>
                      <p className="flex min-h-10 items-center rounded-lg bg-[#fff8f0] px-2.5 py-1.5">{provider.reviews}</p>
                      <p className="flex min-h-10 items-center rounded-lg bg-[#fff2e2] px-2.5 py-1.5 font-semibold text-[#3a2c22]">{provider.services}</p>
                    </div>

                    <div className="mt-auto pt-5">
                      <Link
                        href={buildBookingHref({ providerName: provider.name, serviceType: provider.serviceType })}
                        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-4 text-sm font-semibold text-white transition hover:border-[#c7773b] hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] group-hover:shadow-[0_12px_22px_rgba(199,119,59,0.28)]"
                      >
                        View Details
                      </Link>
                    </div>
                  </PremiumCard>
                ))}
              </AutoScrollRail>
            </section>
          </FadeInSection>

          <FadeInSection className="mt-16" delay={0.22}>
            <section className="relative overflow-hidden rounded-[30px] border border-[#3b2d22] bg-[linear-gradient(135deg,#17120e_0%,#22170f_52%,#15110d_100%)] p-8 text-white shadow-premium-lg sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(228,153,90,0.24),transparent_38%),radial-gradient(circle_at_86%_86%,rgba(122,163,99,0.18),transparent_36%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),rgba(255,255,255,0))]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[29px] bg-[linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" aria-hidden="true" />

              <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-300">Partner With Dofurs</p>
                  <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Are You a Groomer, Vet, Trainer, or Pet Sitter?</h2>
                  <p className="mt-3 text-base text-white/78">
                    Join a premium provider network built for trusted pet professionals. We support verified experts across grooming, veterinary care, training, and pet sitting while you focus on excellent care.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={links.provider}
                    className={bookingPrimaryCtaClassName}
                  >
                    Join as a Service Partner -&gt;
                  </Link>
                </div>
              </div>

              <div className="relative z-10 mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Groomer', description: 'Home and studio grooming professionals with safety-first handling.' },
                  { label: 'Vet', description: 'Licensed veterinarians offering consultations and ongoing pet wellness support.' },
                  { label: 'Trainer', description: 'Certified trainers focused on behavior, obedience, and positive reinforcement.' },
                  { label: 'Pet Sitter', description: 'Reliable sitters delivering calm, loving, and consistent day-to-day care.' },
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
            <section className="relative overflow-clip rounded-[28px] border border-[#e2c2a4] bg-[linear-gradient(140deg,#fff8f1_0%,#fffdfb_50%,#fff4e9_100%)] p-6 shadow-premium backdrop-blur-[2px] sm:p-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.22)_52%,rgba(255,255,255,0)_100%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(228,153,90,0.14),transparent_40%),radial-gradient(circle_at_86%_84%,rgba(154,122,87,0.1),transparent_40%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.02)_50%,transparent_100%)]" aria-hidden="true" />

              <p className="relative z-10 text-sm font-semibold uppercase tracking-[0.16em] text-coral">What Pet Parents Say</p>
              <h2 className="relative z-10 mt-2 text-3xl font-semibold leading-[1.16] tracking-[-0.008em] text-[#2d221a] sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.012em]">Do Not Take Our Word for It</h2>
              <p className="relative z-10 mt-3 text-sm text-[#675245] sm:text-base">Here is what a few of the 100+ families we have served had to say.</p>

              <AutoScrollRail className="relative z-10 -mx-1 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 scrollbar-hide lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0" intervalMs={5000}>
                {testimonials.map((item) => (
                  <PremiumCard
                    key={item.attribution}
                    as="article"
                    className="flex w-[75vw] shrink-0 snap-start flex-col rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.08)_52%,rgba(255,250,244,0.05)_100%)] p-5 shadow-gloss-warm backdrop-blur-[2px] sm:w-[60vw] lg:w-auto lg:shrink"
                  >
                    <div className="mb-3 flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-[#d4a73b] text-[#d4a73b]" aria-hidden="true" />
                      ))}
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-[#675245]">&ldquo;{item.quote}&rdquo;</p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#de9158,#c7773b)] text-[11px] font-bold text-white">
                        {item.initials}
                      </span>
                      <p className="text-sm font-semibold text-[#3a2c22]">{item.attribution}</p>
                    </div>
                  </PremiumCard>
                ))}
              </AutoScrollRail>
            </section>
          </FadeInSection>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateRatingSchema) }} />
      </main>
      <Footer />
    </>
  );
}
