import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  MessageCircle,
  PawPrint,
  ShieldCheck,
  ShowerHead,
  Sparkles,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PremiumCard from '@/components/PremiumCard';
import WelcomeOfferModal from '@/components/WelcomeOfferModal';
import MarketingSubscriptionGroupCard from '@/components/payments/MarketingSubscriptionGroupCard';
import GroomingDoorstepBenefitsSection from '@/components/services/GroomingDoorstepBenefitsSection';
import GroomingBeforeAfterReviews from '@/components/services/GroomingBeforeAfterReviews';
import {
  PET_GROOMING_CITY_PATH,
  bengaluruAreaBySlug,
  getPetGroomingAreaPath,
  isPublishedPetGroomingArea,
  publishedBengaluruPetGroomingAreas,
  type BengaluruArea,
} from '@/lib/service-areas';
import { GROOMING_PACKAGES, type GroomingPackage } from '@/lib/service-catalog/grooming-packages';
import { buildBreadcrumbSchema, buildServiceSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, supportContact, whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { marketingSubscriptionPlanGroups } from '@/lib/subscriptions/marketing-plans';

const SITE_URL = 'https://dofurs.in';
const HERO_IMAGE = '/v1.2.2/Dofurs-Grooming.webp';
const HERO_IMAGE_URL = `${SITE_URL}${HERO_IMAGE}`;

type PetGroomingLocalityPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return publishedBengaluruPetGroomingAreas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PetGroomingLocalityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = bengaluruAreaBySlug[slug];

  if (!isPublishedPetGroomingArea(area)) {
    return { title: 'Pet Grooming in Bengaluru | Dofurs' };
  }

  const canonical = `${SITE_URL}${getPetGroomingAreaPath(area)}`;
  const shortName = area.shortName ?? area.name;

  return {
    title: area.metaTitle,
    description: area.metaDescription,
    alternates: { canonical },
    keywords: [
      `pet grooming ${area.name}`,
      `pet grooming ${shortName}`,
      `dog grooming ${area.name}`,
      `cat grooming ${area.name}`,
      `home pet grooming ${area.name}`,
      `mobile dog grooming ${area.name}`,
      `Pet Grooming ${area.name}`,
      'pet grooming Bengaluru',
      'pet grooming Bangalore',
    ],
    openGraph: {
      type: 'website',
      title: `Pet Grooming in ${area.name}, Bengaluru | Dofurs`,
      description: area.metaDescription,
      url: canonical,
      siteName: 'Dofurs',
      locale: 'en_IN',
      images: [{ url: HERO_IMAGE_URL, width: 1080, height: 1080, alt: `Dofurs pet grooming in ${area.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Pet Grooming in ${area.name}, Bengaluru | Dofurs`,
      description: `Doorstep dog and cat grooming in ${area.name}, Bengaluru with pincode-aware availability.`,
      images: [HERO_IMAGE_URL],
    },
  };
}

const packageDetails: Record<string, { summary: string; bestFor: string; duration: string }> = {
  'Monthly Care': {
    summary: 'Nail clipping, paw hygiene, knot checks, eye-ear cleaning, de-shedding and light coat upkeep.',
    bestFor: 'Maintenance between full grooming sessions',
    duration: '45-75 min',
  },
  'Fur Bath Care': {
    summary: 'Anti-tick medicated bath, drying, brushing, de-shedding and de-matting support for routine coat freshness.',
    bestFor: 'Dust, odour, sweat and seasonal shedding',
    duration: '60-90 min',
  },
  'Fur Makeover': {
    summary: 'Haircut, paw hair cleaning, private-area hygiene, knot removal, brushing and coat refresh.',
    bestFor: 'Trim-focused grooming without premium styling',
    duration: '75-105 min',
  },
  'Essential Grooming': {
    summary: 'Full routine grooming with bath, ear and eye cleaning, nail care, paw care, hygiene trim and machine trim.',
    bestFor: 'Most routine dog grooming appointments',
    duration: '90-120 min',
  },
  'Complete Care': {
    summary: 'Premium spa grooming with scissor haircut, face styling, nail grinding, paw massage and nose balm.',
    bestFor: 'Full styling, long coats and special grooming days',
    duration: '120-150 min',
  },
};

const badgeClasses: Record<NonNullable<GroomingPackage['badgeVariant']>, string> = {
  popular: 'border-[#f0c89a] bg-[#fff4e6] text-[#b9692f]',
  'best-value': 'border-[#d88b45] bg-[linear-gradient(115deg,#de9158,#c7773b)] text-white shadow-[0_2px_10px_rgba(199,119,59,0.32)]',
  premium: 'border-neutral-900 bg-neutral-950 text-white',
  deal: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  special: 'border-sky-200 bg-sky-50 text-sky-700',
  'coming-soon': 'border-neutral-200 bg-neutral-100 text-neutral-600',
};

function buildLocalKeywordCards(area: BengaluruArea, shortName: string) {
  const primaryLandmark = area.landmarks[0] ?? area.name;
  const secondaryLandmark = area.landmarks[1] ?? primaryLandmark;
  const nearbyArea = area.nearbyAreas[0] ?? area.region;

  return [
    { title: `Dog Grooming ${area.name}`, body: area.content.dogGrooming },
    { title: `Cat Grooming ${area.name}`, body: area.content.catGrooming },
    { title: `Mobile Dog Grooming ${shortName}`, body: area.content.mobileGrooming },
    { title: `Home Pet Grooming ${area.name}`, body: area.content.localCoverage },
    {
      title: `Pet Grooming near ${primaryLandmark}`,
      body: `Pet parents near ${primaryLandmark} and ${secondaryLandmark} can request a pincode-aware doorstep grooming slot when provider route, pet details and package duration line up.`,
    },
    {
      title: `Pet Grooming ${nearbyArea}`,
      body: `Nearby ${nearbyArea} grooming requests are checked alongside ${area.name} so boundary addresses are handled by pincode and landmark rather than broad locality names alone.`,
    },
    {
      title: `Doorstep Pet Grooming ${area.region}`,
      body: `${area.name} is treated as part of the wider ${area.region} route, with apartment access, traffic and groomer availability checked before confirmation.`,
    },
  ];
}

function formatPriceInr(price: string | number): string {
  if (typeof price === 'number') {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  const normalized = price.trim();
  return normalized.startsWith('₹') ? normalized : `₹${normalized}`;
}

function getNumericPrice(price: string | number): number | undefined {
  if (typeof price === 'number') {
    return Number.isFinite(price) ? Math.max(0, Math.round(price)) : undefined;
  }

  const match = price.match(/(\d[\d,]*)/);
  if (!match?.[1]) return undefined;
  const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function packageBookingHref(pkg: GroomingPackage): string {
  return `${links.booking}?serviceType=${encodeURIComponent(pkg.title)}&mode=home_visit#start-your-booking`;
}

function genericBookingHref(area: BengaluruArea): string {
  return `${links.booking}?serviceType=pet-grooming&mode=home_visit&area=${encodeURIComponent(area.name)}#start-your-booking`;
}

function nearbyPublishedAreas(area: BengaluruArea) {
  const nearbyNames = new Set(area.nearbyAreas.map((nearby) => nearby.toLowerCase()));
  const preferred = publishedBengaluruPetGroomingAreas.filter(
    (candidate) => candidate.slug !== area.slug && nearbyNames.has(candidate.name.toLowerCase()),
  );

  if (preferred.length >= 4) return preferred.slice(0, 6);

  const sameRegion = publishedBengaluruPetGroomingAreas.filter(
    (candidate) => candidate.slug !== area.slug && candidate.region === area.region && !preferred.some((item) => item.slug === candidate.slug),
  );

  return [...preferred, ...sameRegion].slice(0, 6);
}

function buildLocalBusinessSchema(area: BengaluruArea) {
  const url = `${SITE_URL}${getPetGroomingAreaPath(area)}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}#localbusiness`,
    name: `Dofurs Pet Grooming in ${area.name}`,
    alternateName: [`Dofurs Pet Grooming in ${area.name}, Bangalore`, `Pet Grooming ${area.name}`],
    description: area.metaDescription,
    url,
    telephone: supportContact.whatsappDisplay.replace(/\s/g, ''),
    image: HERO_IMAGE_URL,
    priceRange: '₹699-₹1,999',
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    address: {
      '@type': 'PostalAddress',
      addressLocality: area.name,
      addressRegion: 'Karnataka',
      addressCountry: 'IN',
      postalCode: area.pincodes[0],
    },
    areaServed: [
      {
        '@type': 'Place',
        name: `${area.name}, Bengaluru`,
        alternateName: `${area.name}, Bangalore`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: area.name,
          addressRegion: 'Karnataka',
          addressCountry: 'IN',
          postalCode: area.pincodes.join(', '),
        },
      },
      ...area.nearbyAreas.map((nearby) => ({ '@type': 'Place' as const, name: `${nearby}, Bengaluru` })),
    ],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '08:00',
        closes: '21:00',
      },
    ],
  };
}

function buildFaqSchema(area: BengaluruArea) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: area.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

function buildLocalServiceSchema(area: BengaluruArea) {
  const url = `${SITE_URL}${getPetGroomingAreaPath(area)}`;

  return buildServiceSchema({
    name: `Pet Grooming in ${area.name}, Bengaluru`,
    alternateName: [`Pet Grooming ${area.name}`, `Dog Grooming ${area.name}`, `Cat Grooming ${area.name}`],
    description: area.metaDescription,
    url,
    serviceType: 'Pet Grooming',
    category: 'Pet Grooming',
    image: HERO_IMAGE_URL,
    offers: GROOMING_PACKAGES.map((pkg) => ({
      name: pkg.title,
      priceFrom: getNumericPrice(pkg.price),
      description: `${packageDetails[pkg.title]?.summary ?? pkg.features.join(', ')} Includes ${pkg.features.join(', ')}.`,
    })),
  });
}

function setupChecklist(area: BengaluruArea) {
  return [
    `Share the exact ${area.shortName ?? area.name} address, pincode and nearest landmark before the slot is assigned.`,
    'Keep a plug point, water access, dry towels and a quiet grooming corner ready before the groomer arrives.',
    'Mention matting, ticks, skin sensitivity, previous grooming stress and haircut expectations in the booking notes.',
    'Add apartment tower, visitor approval, service-lift rules, parking details and intercom instructions for gated communities.',
    'Let the groomer know if your dog or cat reacts to dryers, nail trimming, face handling or new people at home.',
  ];
}

export default async function PetGroomingLocalityPage({ params }: PetGroomingLocalityPageProps) {
  const { slug } = await params;
  const area = bengaluruAreaBySlug[slug];

  if (!isPublishedPetGroomingArea(area)) {
    notFound();
  }

  const shortName = area.shortName ?? area.name;
  const localPath = getPetGroomingAreaPath(area);
  const bookingHref = genericBookingHref(area);
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 gap-2 px-5 text-sm font-semibold sm:h-12 sm:px-7');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 gap-2 px-5 text-sm font-semibold sm:h-12 sm:px-6');
  const heroPrimaryCtaClass = premiumPrimaryCtaClass('h-9 gap-1.5 px-3.5 text-[12px] font-semibold sm:h-10 sm:px-4');
  const heroSecondaryCtaClass = premiumSecondaryCtaClass('h-9 gap-1.5 px-3.5 text-[12px] font-semibold sm:h-10 sm:px-4');
  const keywordCards = buildLocalKeywordCards(area, shortName);
  const relatedAreas = nearbyPublishedAreas(area);
  const localBusinessSchema = buildLocalBusinessSchema(area);
  const faqSchema = buildFaqSchema(area);
  const serviceSchema = buildLocalServiceSchema(area);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Pet Grooming', url: PET_GROOMING_CITY_PATH },
    { name: area.name, url: localPath },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusinessSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(serviceSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqSchema)} />
      <Navbar />
      <WelcomeOfferModal />
      <main className="dofurs-mobile-main relative flex flex-col overflow-hidden bg-white text-ink">
        <section className="relative isolate overflow-hidden bg-[linear-gradient(102deg,#fff3ec_0%,#fffaf6_52%,#f7faf5_100%)] px-4 pb-6 pt-24 sm:px-6 sm:pt-28 lg:min-h-[560px] lg:px-12 lg:pb-0 lg:pt-28 xl:px-[92px]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#fffaf6_100%)]" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-[1280px] items-start gap-8 lg:grid-cols-2 lg:gap-8 xl:gap-10">
            <div className="relative z-10 max-w-[480px] pb-4 lg:flex lg:min-h-[500px] lg:flex-col lg:justify-center lg:pb-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5c4a8] bg-white/86 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-normal text-[#7f5a3d] shadow-[0_8px_22px_rgba(115,77,43,0.1)]">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                Pet grooming in {area.name}, Bengaluru
              </span>
              <h1 className="mt-4 max-w-[460px] text-[30px] font-bold leading-[1.08] text-neutral-950 sm:text-[38px] lg:text-[44px] xl:text-[48px]">
                Pet Grooming in {area.name}
              </h1>
              <p className="mt-3 max-w-[470px] text-[13px] leading-6 text-[#4a4a4a] sm:text-[14px] sm:leading-7">
                Book doorstep Pet Grooming {area.name} for dog grooming, cat grooming, home pet grooming and mobile grooming requests. Dofurs checks your address, pet details and package before confirming the slot.
              </p>

              <div className="mt-4 flex max-w-[460px] flex-wrap gap-2">
                {[
                  { icon: BadgeCheck, label: 'Verified groomers' },
                  { icon: Home, label: 'Doorstep setup' },
                  { icon: ShieldCheck, label: 'Pet-safe products' },
                  { icon: MessageCircle, label: 'WhatsApp support' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-[#ead4bf] bg-white/92 px-2.5 py-1.5 text-[10px] font-semibold text-[#745238] shadow-[0_8px_18px_rgba(115,77,43,0.08)]">
                      <Icon className="h-3 w-3 text-coral" aria-hidden="true" />
                      {item.label}
                    </span>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Link href={bookingHref} className={heroPrimaryCtaClass}>
                  <CalendarCheck2 className="h-3 w-3" aria-hidden="true" />
                  Book Pet Grooming
                </Link>
                <Link href="#packages" className={heroSecondaryCtaClass}>
                  <PawPrint className="h-3 w-3" aria-hidden="true" />
                  View Packages
                </Link>
                <Link href="#local-coverage" className={heroSecondaryCtaClass}>
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  Check Coverage
                </Link>
              </div>

              <p className="mt-3 max-w-[460px] text-[11px] font-semibold leading-[1.55] text-neutral-500">
                Coverage checks include {area.pincodes.join(', ')} and nearby {area.nearbyAreas.slice(0, 3).join(', ')}. Availability depends on pincode, pet size and package.
              </p>
            </div>

            <div className="relative z-0 min-h-[280px] sm:min-h-[380px] md:min-h-[460px] lg:min-h-[500px] xl:min-h-[500px]">
              <Image
                src={HERO_IMAGE}
                alt={`Professional pet grooming at home in ${area.name}`}
                fill
                priority
                sizes="(max-width: 1024px) 94vw, 54vw"
                className="object-contain object-bottom drop-shadow-[0_24px_34px_rgba(111,78,47,0.16)] lg:object-right"
              />
            </div>
          </div>
        </section>

        <section id="packages" className="relative scroll-mt-28 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase text-coral">Pet grooming packages</p>
                <h2 className="mt-2 text-2xl font-bold text-neutral-950 md:text-3xl">Choose the right grooming session for {shortName}</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-neutral-600">
                  Compare pricing, session length and included grooming steps before booking. Package-level service types stay unchanged for booking, pricing, subscription credits and provider matching.
                </p>
              </div>
              <Link href={bookingHref} className="text-sm font-semibold text-coral underline-offset-4 hover:underline">
                Start a pet grooming booking
              </Link>
            </div>

            <div className="mt-5 grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5">
              {GROOMING_PACKAGES.map((pkg, index) => {
                const details = packageDetails[pkg.title];
                const badgeClass = pkg.badgeVariant ? badgeClasses[pkg.badgeVariant] : badgeClasses.popular;
                const centeredBottomCardClass = index === 3 ? 'lg:col-start-2 xl:col-start-auto' : '';

                return (
                  <div key={pkg.title} id={pkg.title === 'Fur Makeover' ? 'fur-makeover' : undefined} className={`min-w-0 self-stretch lg:col-span-2 xl:col-span-1 ${centeredBottomCardClass}`}>
                    <PremiumCard className={`flex h-full flex-col rounded-2xl border p-4 shadow-[0_4px_16px_rgba(79,47,25,0.06)] sm:p-3.5 xl:min-h-[420px] ${
                      pkg.highlighted
                        ? 'border-[#dc8f47] bg-[linear-gradient(165deg,#fffdfb_0%,#fff3e8_100%)]'
                        : 'border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f4_100%)]'
                    }`}
                    >
                      <div className="mb-2.5 flex h-[22px] items-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}>
                          {pkg.badge ?? 'Available'}
                        </span>
                      </div>

                      <h3 className="min-h-[34px] text-[13px] font-semibold leading-snug text-neutral-950">{pkg.title}</h3>

                      <div className="mt-1.5 space-y-1">
                        {pkg.mrp ? (
                          <p className="text-[10px] font-medium leading-none text-[#9a7258]">
                            MRP <span className="line-through decoration-[#b78258]/70 decoration-1">{formatPriceInr(pkg.mrp)}</span>
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          {pkg.mrp ? <span className="text-[10px] font-semibold uppercase text-[#c7773b]">Now</span> : null}
                          <span className="text-[19px] font-bold leading-none text-neutral-950">{formatPriceInr(pkg.price)}</span>
                          <span className="text-[10px] text-[#9a7258]">/ session</span>
                        </div>
                      </div>

                      <div className="my-2 border-t border-[#f0e4d6]" />

                      <div className="flex items-start gap-1.5 rounded-xl border border-[#f1dfcf] bg-white/70 px-2.5 py-1.5 text-[10px] font-semibold leading-4 text-[#7a5a45]">
                        <PawPrint className="mt-0.5 h-3 w-3 shrink-0 text-coral" aria-hidden="true" />
                        <span>{details?.bestFor ?? 'Routine coat and hygiene care'}</span>
                      </div>

                      <ul className="mt-2 flex-1 space-y-1.5">
                        {pkg.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#c7773b]" aria-hidden="true" />
                            <span className="text-[11px] leading-snug text-[#5c3d22]">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-[#f1dfcf] bg-white/70 px-2.5 py-1.5 text-[10px] font-semibold text-[#7a5a45]">
                        <Clock3 className="h-3 w-3 shrink-0 text-coral" aria-hidden="true" />
                        {details?.duration ?? '60-120 min'}
                      </div>

                      <Link href={packageBookingHref(pkg)} className="mt-2.5 inline-flex h-11 w-full items-center justify-center rounded-full border border-[#e0c4a8] bg-white px-3 text-center text-[12px] font-semibold text-[#7c5335] transition hover:-translate-y-0.5 hover:border-[#c7773b] hover:bg-[#fffaf5] hover:text-[#c7773b] xl:h-9">
                        Book {pkg.title}
                      </Link>
                    </PremiumCard>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="local-coverage" className="order-last scroll-mt-28 bg-[linear-gradient(180deg,#fffaf6_0%,#fff3ea_56%,#fffaf6_100%)] px-4 py-10 sm:px-6 lg:px-8">
          <details className="group mx-auto w-full max-w-[1200px] overflow-hidden rounded-[24px] border border-[#e4c3a6] bg-white/88 shadow-[0_14px_34px_rgba(93,57,28,0.08)]">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-xs font-semibold uppercase text-coral">Coverage checker</span>
                <span className="mt-1 block text-2xl font-bold text-neutral-950 md:text-3xl">Check pet grooming coverage in {shortName}</span>
                <span className="mt-2 block max-w-2xl text-sm leading-6 text-neutral-600">
                  Open local pincode, landmark, apartment-access and nearby-area details before booking a doorstep session.
                </span>
              </span>
              <span className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#de9158] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(199,119,59,0.2)] transition group-open:bg-[linear-gradient(135deg,#c7773b,#a85d28)]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Check Coverage
              </span>
            </summary>

            <div className="border-t border-[#ead6c3] px-4 pb-5 pt-5 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase text-coral">{shortName} search coverage</p>
                <h2 className="mt-2 text-2xl font-bold text-neutral-950 md:text-3xl">Useful local grooming searches, handled carefully</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
                  These are common ways pet parents search for doorstep grooming in and around {area.name}. Each request is still confirmed by pincode, address, groomer route, pet details and package duration before appointment assignment.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {keywordCards.map((card) => (
                  <article key={card.title} className="rounded-2xl border border-[#ead6c3] bg-white p-4 shadow-[0_8px_20px_rgba(93,57,28,0.06)]">
                    <h3 className="text-sm font-bold text-neutral-950">{card.title}</h3>
                    <p className="mt-2 text-[12px] leading-5 text-neutral-600">{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase text-coral">Local coverage context</p>
                  <h2 className="mt-2 text-3xl font-bold text-neutral-950">Pincode-aware grooming in {area.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">
                    {area.content.localCoverage} Final confirmation still depends on provider route, pet size, coat condition, package duration and available slots.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#ead6c3] bg-white/82 p-4 text-sm leading-6 text-neutral-700 shadow-sm">
                  <p className="font-semibold text-neutral-950">Appointment notes</p>
                  <ul className="mt-2 space-y-2">
                    {area.localNotes.map((note) => (
                      <li key={note} className="flex gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {[`Pincodes ${area.pincodes.join(', ')}`, area.region, ...area.landmarks.slice(0, 4)].map((item) => (
                  <span key={item} className="rounded-full border border-[#dfbea0] bg-white px-3 py-1.5 text-[12px] font-bold text-[#7a4f31] shadow-sm">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 grid gap-5">
                <section className="rounded-2xl border border-[#ead6c3] bg-white/88 p-4 shadow-[0_10px_24px_rgba(93,57,28,0.07)] sm:p-5">
                  <h3 className="text-lg font-bold text-neutral-950">Why doorstep grooming fits {shortName}</h3>
                  <div className="mt-3 space-y-3 text-[13px] leading-6 text-neutral-650">
                    <p>
                      Pet grooming in {area.name} has to work with real neighbourhood conditions, not just a generic city promise. Families near {area.landmarks.slice(0, 3).join(', ')} may deal with parking limits, society access, lift timing, compact bathrooms, weekend traffic or pets who become restless in a car.
                    </p>
                    <p>
                      A doorstep session is useful when your pet needs bath care, de-shedding, nail trimming, paw cleaning, ear cleaning, eye cleaning, de-matting, hygiene trimming or a coat haircut but does not enjoy a salon environment.
                    </p>
                    <p>
                      Dofurs also treats {area.name} as part of a wider grooming route across {area.region}. Requests from {area.nearbyAreas.slice(0, 5).join(', ')} are evaluated by exact pincode instead of broad neighbourhood naming alone.
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#ead6c3] bg-white/88 p-4 shadow-[0_10px_24px_rgba(93,57,28,0.07)] sm:p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-[#f0dfcf] bg-[#fffaf6] p-3">
                      <p className="text-[12px] font-bold uppercase text-[#8b633f]">Pincodes</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950">{area.pincodes.join(', ')}</p>
                    </div>
                    <div className="rounded-xl border border-[#f0dfcf] bg-[#fffaf6] p-3">
                      <p className="text-[12px] font-bold uppercase text-[#8b633f]">Landmarks</p>
                      <p className="mt-1 text-sm text-neutral-700">{area.landmarks.join(', ')}</p>
                    </div>
                    <div className="rounded-xl border border-[#f0dfcf] bg-[#fffaf6] p-3">
                      <p className="text-[12px] font-bold uppercase text-[#8b633f]">Nearby</p>
                      <p className="mt-1 text-sm text-neutral-700">{area.nearbyAreas.join(', ')}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#ead6c3] bg-white/88 p-4 shadow-[0_10px_24px_rgba(93,57,28,0.07)] sm:p-5">
                  <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-950">Make the {area.name} visit smoother</h3>
                      <p className="mt-3 text-[13px] leading-6 text-neutral-650">
                        {area.content.setupTip} {area.content.apartmentAccess} {area.content.travelNote} These details help the groomer spend more time on your pet and less time coordinating entry, parking or drying space.
                      </p>
                    </div>
                    <ul className="space-y-2">
                      {setupChecklist(area).map((item) => (
                        <li key={item} className="flex gap-2 rounded-xl border border-[#f0dfcf] bg-[#fffaf6] px-3 py-2 text-[13px] leading-6 text-neutral-700">
                          <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {area.sections?.map((section) => (
                  <section key={section.heading} className="rounded-2xl border border-[#ead6c3] bg-white/88 p-4 shadow-[0_10px_24px_rgba(93,57,28,0.07)] sm:p-5">
                    <h3 className="text-lg font-bold text-neutral-950">{section.heading}</h3>
                    <div className="mt-3 space-y-3 text-[13px] leading-6 text-neutral-650">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ))}

                {relatedAreas.length > 0 ? (
                  <section className="rounded-2xl border border-[#ead6c3] bg-white/88 p-4 shadow-[0_10px_24px_rgba(93,57,28,0.07)] sm:p-5">
                    <h3 className="text-lg font-bold text-neutral-950">Nearby canonical locality pages</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {relatedAreas.map((relatedArea) => (
                        <Link key={relatedArea.slug} href={getPetGroomingAreaPath(relatedArea)} className="rounded-full border border-[#e4c7ad] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#704b31] transition hover:border-coral/60 hover:text-coral">
                          Pet Grooming {relatedArea.name}
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </details>
        </section>

        <section id="subscriptions" className="scroll-mt-28 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] rounded-[22px] border border-[#ead5c0] bg-[linear-gradient(140deg,#fff9f4_0%,#fffefc_55%,#fff8f1_100%)] p-4 shadow-premium sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral">Subscription services</p>
                <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-neutral-950 md:text-3xl">
                  Pet Grooming Subscription Packs in {shortName}
                </h2>
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

        <GroomingDoorstepBenefitsSection locationName={shortName} />

        <GroomingBeforeAfterReviews bookingHref={bookingHref} locationName={shortName} />

        <section id="questions-before-booking" className="relative scroll-mt-40 overflow-hidden bg-[linear-gradient(180deg,#fffaf6_0%,#fff4eb_46%,#ffffff_100%)] px-4 py-10 sm:px-6 lg:px-8">
          <div className="relative mx-auto grid w-full max-w-[1200px] gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-7">
            <div className="lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ead7c5] bg-white/86 px-3 py-1.5 text-[11px] font-semibold uppercase text-[#8a6549] shadow-[0_8px_22px_rgba(93,57,28,0.08)]">
                <MessageCircle className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                Questions before booking
              </span>
              <h2 className="mt-3 max-w-xl text-[28px] font-bold leading-[1.08] text-[#2f261f] md:text-[32px]">
                Clear answers for {shortName} pet grooming
              </h2>
              <p className="mt-3 max-w-xl text-[13px] font-normal leading-6 text-[#6b5a4e]">
                Practical details about doorstep grooming, package pricing, same-day slot expectations and home setup before you confirm a session in {area.name}.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={bookingHref} className={primaryCtaClass}>
                  <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                  Book Pet Grooming
                </Link>
                <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className={secondaryCtaClass}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Us
                </a>
              </div>
            </div>

            <div className="grid gap-2">
              {area.faqs.map((faq, index) => (
                <details key={faq.question} className="group rounded-[14px] border border-[#ead6c3] bg-white/92 shadow-[0_10px_22px_rgba(93,57,28,0.07)] transition duration-300 open:border-[#e3b07c] open:shadow-[0_14px_28px_rgba(93,57,28,0.1)]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 marker:hidden sm:px-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#f59a18,#dc790f)] text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(220,121,15,0.2)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-[#49372c] sm:text-[14px]">
                      {faq.question}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ead6c3] bg-[#fff7ef] text-base font-semibold leading-none text-[#b56b24] transition duration-300 group-open:rotate-45 group-open:border-[#de9158] group-open:bg-[#fff1e4]">
                      +
                    </span>
                  </summary>
                  <p className="border-t border-[#f0dfcf] px-3 pb-3 pt-3 text-[12px] font-normal leading-5 text-[#6f6259] sm:ml-[48px] sm:px-4">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-[1.75rem] border border-[#dca977] bg-[linear-gradient(135deg,#2b211a,#7b4d2e)] p-6 text-white shadow-premium-xl md:p-8">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f9cba7]">Book with pincode-aware availability</p>
                <h2 className="mt-2 text-2xl font-semibold text-white/94 md:text-3xl">Ready to book Pet Grooming {area.name}?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                  Choose a grooming package, add your pet details and confirm a slot for your exact {shortName} address. Dofurs will match the request to available grooming professionals when the pincode and route work.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={bookingHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#684126] transition hover:bg-[#fff3e7]">
                  <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                  Book Now
                </Link>
                <Link href={PET_GROOMING_CITY_PATH} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/35 px-5 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Bengaluru Coverage
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}