import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  PawPrint,
  ShieldCheck,
  ShowerHead,
  Sparkles,
  Star,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PremiumCard from '@/components/PremiumCard';
import SubscriptionPlanCard from '@/components/payments/SubscriptionPlanCard';
import { bengaluruAreas } from '@/lib/service-areas';
import { GROOMING_PACKAGES, type GroomingPackage } from '@/lib/service-catalog/grooming-packages';
import { buildBreadcrumbSchema, buildServiceSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, supportContact, whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { marketingSubscriptionPlanGroups } from '@/lib/subscriptions/marketing-plans';

const SITE_URL = 'https://dofurs.in';
const PAGE_PATH = '/services/grooming/bengaluru';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const HERO_IMAGE = '/v1.2.2/Dofurs-Grooming.png';
const HERO_IMAGE_URL = `${SITE_URL}${HERO_IMAGE}`;
const genericBookingHref = `${links.booking}?serviceType=grooming&mode=home_visit#start-your-booking`;

export const metadata: Metadata = {
  title: 'Pet Grooming in Bengaluru — Doorstep Dog & Cat Grooming',
  description:
    'Book doorstep pet grooming in Bengaluru from ₹699. Verified Dofurs groomers for baths, haircuts, de-shedding, nail trimming, ear cleaning, hygiene trims and full grooming packages.',
  alternates: { canonical: PAGE_URL },
  keywords: [
    'pet grooming Bengaluru',
    'dog grooming at home Bengaluru',
    'doorstep pet grooming Bengaluru',
    'cat grooming Bengaluru',
    'dog bath at home Bengaluru',
    'pet groomer near me Bengaluru',
    'Dofurs grooming Bengaluru',
    'pet grooming Bangalore',
    'dog grooming at home Bangalore',
    'doorstep pet grooming Bangalore',
    'cat grooming Bangalore',
  ],
  openGraph: {
    title: 'Pet Grooming in Bengaluru | Dofurs',
    description:
      'Verified doorstep pet groomers across Bengaluru. Packages from ₹699 with pet-safe products, transparent pricing and WhatsApp support.',
    type: 'website',
    url: PAGE_URL,
    siteName: 'Dofurs',
    locale: 'en_IN',
    images: [{ url: HERO_IMAGE_URL, width: 1080, height: 1080, alt: 'Dofurs pet grooming in Bengaluru' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pet Grooming in Bengaluru | Dofurs',
    description: 'Doorstep dog and cat grooming in Bengaluru from verified Dofurs professionals.',
    images: [HERO_IMAGE_URL],
  },
};

const packageDetails: Record<string, { description: string; bestFor: string; duration: string }> = {
  'Monthly Care': {
    description: 'A quick hygiene upkeep session for pets who need regular nail, paw, knot, eye, ear and coat care.',
    bestFor: 'Monthly maintenance between full baths',
    duration: '45-75 min',
  },
  'Fur Bath Care': {
    description: 'A bath-and-coat refresh with anti-tick medicated shampoo, drying, brushing and de-matting support.',
    bestFor: 'Dust, odour, ticks and seasonal shedding',
    duration: '60-90 min',
  },
  'Fur Makeover': {
    description: 'A trim-focused refresh for coat shape, paw hair, hygiene areas, knots and shedding.',
    bestFor: 'Pets who need a haircut without full spa care',
    duration: '75-105 min',
  },
  'Essential Grooming': {
    description: 'The most balanced full grooming package covering bath, hygiene trim, coat care, paw care and machine trim.',
    bestFor: 'Routine full grooming for most dogs',
    duration: '90-120 min',
  },
  'Complete Care': {
    description: 'A full spa grooming session with scissor haircut, face styling, smooth nail finish, paw massage and nose care.',
    bestFor: 'Premium grooming, styling and heavy coat care',
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

const trustSignals = [
  { icon: BadgeCheck, label: 'Verified groomers' },
  { icon: Home, label: 'Doorstep setup' },
  { icon: ShieldCheck, label: 'Pet-safe products' },
  { icon: MessageCircle, label: 'WhatsApp support' },
];

const stressFreeCards = [
  {
    step: '01',
    image: '/v1.2.2/travel - 1 .png',
    icon: MapPin,
    title: 'Relief from Bengaluru travel',
    body: 'No long drives through traffic or summer heat. We come to your doorstep with the grooming setup.',
    badge: 'We come to your home',
  },
  {
    step: '02',
    image: '/v1.2.2/waiting time.png',
    icon: Clock3,
    title: 'Save waiting time',
    body: 'No queues. No salon delays. Pick a convenient slot and keep the day moving.',
    badge: 'Your time is precious',
  },
  {
    step: '03',
    image: '/v1.2.2/Stress Free for pets.png',
    icon: Heart,
    title: 'Stress-free for pets',
    body: 'Pets stay comfortable in their familiar environment while grooming happens at their pace.',
    badge: 'Less stress. More comfort.',
  },
  {
    step: '04',
    image: '/v1.2.2/vacuum trim.png',
    icon: Sparkles,
    title: 'Clean and modern grooming',
    body: 'Grooms, trims and vacuum support help reduce mess during coat care at home.',
    badge: 'No mess. No cleanup.',
  },
];

const coverageStats = [
  { icon: PawPrint, value: '5000+', label: 'Happy pets groomed' },
  { icon: Star, value: '4.9', label: 'Average customer rating' },
  { icon: Home, value: '100%', label: 'Home service convenience' },
];

const faqs = [
  {
    q: 'How much does pet grooming cost in Bengaluru?',
    a: 'Dofurs grooming packages start at ₹699 for Monthly Care. Full grooming packages currently range up to ₹1,999 before optional add-ons or special handling needs.',
  },
  {
    q: 'Do you provide dog grooming at home in Bengaluru?',
    a: 'Yes. Doorstep grooming is the primary booking mode for grooming packages. The booking flow checks your pet, address, pincode and available provider slots.',
  },
  {
    q: 'Is Bengaluru coverage the same as Bangalore coverage?',
    a: 'Yes. Bengaluru is the official city name, and Dofurs doorstep grooming coverage applies to supported 560-series pincodes that many pet parents still search for as Bangalore.',
  },
  {
    q: 'Do you groom cats?',
    a: 'Cat grooming depends on temperament, coat condition and provider availability. Share the pet details during booking or WhatsApp us before selecting a full package.',
  },
  {
    q: 'Can I book same-day grooming?',
    a: 'Same-day slots are possible when groomers are available in your area. Weekends fill faster, so next-day booking is safer for full grooming or haircut packages.',
  },
  {
    q: 'What if my pet has ticks, fleas or heavy matting?',
    a: 'Choose a bath or full grooming package and mention the condition in notes. Severe matting, skin wounds or infestation may need extra time or vet advice first.',
  },
  {
    q: 'What do I need to provide at home?',
    a: 'Please keep water access, a plug point and a safe grooming area ready. The groomer brings the grooming tools and pet-safe products.',
  },
];

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

const groomingServiceSchema = buildServiceSchema({
  name: 'Pet Grooming in Bengaluru',
  alternateName: ['Pet Grooming in Bangalore', 'Doorstep Dog Grooming in Bangalore'],
  description:
    'Doorstep dog and cat grooming in Bengaluru by verified Dofurs groomers, including bath care, haircuts, nail trimming, de-shedding, de-matting, ear cleaning, paw care and full grooming packages.',
  url: PAGE_URL,
  serviceType: 'Pet Grooming',
  category: 'Pet Grooming',
  image: HERO_IMAGE_URL,
  offers: GROOMING_PACKAGES.map((pkg) => ({
    name: pkg.title,
    priceFrom: getNumericPrice(pkg.price),
    description: `${packageDetails[pkg.title]?.description ?? pkg.features.join(', ')} Includes ${pkg.features.join(', ')}.`,
  })),
});

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${PAGE_URL}#localbusiness`,
  name: 'Dofurs Pet Grooming in Bengaluru',
  alternateName: 'Dofurs Pet Grooming in Bangalore',
  description: metadata.description,
  url: PAGE_URL,
  telephone: supportContact.whatsappDisplay.replace(/\s/g, ''),
  image: HERO_IMAGE_URL,
  priceRange: '₹699-₹1,999',
  parentOrganization: { '@id': `${SITE_URL}/#organization` },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bengaluru',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  areaServed: [
    { '@type': 'City', name: 'Bengaluru', alternateName: 'Bangalore' },
    ...bengaluruAreas.map((area) => ({
      '@type': 'Place' as const,
      name: `${area.name}, Bengaluru`,
    })),
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

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: '/' },
  { name: 'Services', url: '/services' },
  { name: 'Grooming', url: '/services/grooming' },
  { name: 'Bengaluru', url: PAGE_PATH },
]);

export default function BengaluruGroomingLandingPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 gap-2 px-5 text-sm font-semibold sm:h-12 sm:px-7');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 gap-2 px-5 text-sm font-semibold sm:h-12 sm:px-6');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(groomingServiceSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusinessSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)} />
      <Navbar />
      <main className="dofurs-mobile-main relative overflow-hidden bg-white text-ink">
        <section className="relative isolate overflow-hidden bg-[linear-gradient(102deg,#fff3ec_0%,#fffaf6_50%,#f7faf5_100%)] px-4 pb-8 pt-32 sm:px-6 sm:pt-36 md:pb-10 lg:min-h-[760px] lg:px-12 lg:pb-0 lg:pt-36 xl:px-[92px]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#fffaf6_100%)]" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-[1280px] items-start gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-2">
            <div className="relative z-10 max-w-[660px] pb-4 lg:pb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e5c4a8] bg-white/86 px-4 py-2 text-[11px] font-semibold uppercase tracking-normal text-[#7f5a3d] shadow-[0_8px_22px_rgba(115,77,43,0.1)]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Doorstep grooming across Bengaluru
              </span>
              <h1 className="mt-5 max-w-[640px] text-[42px] font-bold leading-[1.02] text-neutral-950 sm:text-[56px] lg:text-[64px] xl:text-[68px]">
                Pet Grooming in Bengaluru
              </h1>
              <p className="mt-4 max-w-[690px] text-[17px] leading-8 text-[#4a4a4a] sm:text-[18px] sm:leading-9">
                Book verified groomers for baths, haircuts, de-shedding, nail trimming, ear cleaning and hygiene care at home. Packages start from ₹699 with transparent inclusions and pet-safe products.
              </p>

              <div className="mt-5 flex max-w-[580px] flex-wrap gap-3">
                {trustSignals.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[#ead4bf] bg-white/92 px-4 py-2 text-[12px] font-semibold text-[#745238] shadow-[0_8px_18px_rgba(115,77,43,0.08)]">
                      <Icon className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                      {item.label}
                    </span>
                  );
                })}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={genericBookingHref} className={primaryCtaClass}>
                  <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                  Book Now
                </Link>
                <Link href="#packages" className={secondaryCtaClass}>
                  <PawPrint className="h-4 w-4" aria-hidden="true" />
                  View Packages
                </Link>
              </div>

              <p className="mt-4 max-w-[650px] text-[13px] font-semibold leading-5 text-neutral-500">
                Available in Indiranagar, Koramangala, HSR Layout, Whitefield, Electronic City, Jayanagar and nearby Bengaluru areas.
              </p>
            </div>

            <div className="relative z-0 min-h-[320px] sm:min-h-[500px] md:min-h-[560px] lg:-mt-24 lg:min-h-[740px] xl:-mt-28 xl:min-h-[780px]">
              <Image
                src={HERO_IMAGE}
                alt="Professional pet grooming at home in Bengaluru"
                fill
                priority
                sizes="(max-width: 1024px) 94vw, 54vw"
                className="object-contain object-bottom drop-shadow-[0_24px_34px_rgba(111,78,47,0.16)] lg:object-right"
              />
            </div>
          </div>
        </section>

        <section id="packages" className="relative scroll-mt-28 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase text-coral">Grooming packages</p>
                <h2 className="mt-2 text-2xl font-bold text-neutral-950 md:text-3xl">Choose the right grooming session</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-neutral-600">
                  Compare pricing, session length and included grooming steps before booking.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {GROOMING_PACKAGES.map((pkg) => {
                  const details = packageDetails[pkg.title];
                  const badgeClass = pkg.badgeVariant ? badgeClasses[pkg.badgeVariant] : badgeClasses.popular;

                  return (
                    <div key={pkg.title} id={pkg.title === 'Fur Makeover' ? 'fur-makeover' : undefined} className="min-w-0 self-stretch">
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
                          <span className="line-clamp-2">{details?.bestFor ?? 'Routine coat and hygiene care'}</span>
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
                          Book Now
                        </Link>
                      </PremiumCard>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>

        <section id="subscriptions" className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] rounded-[22px] border border-[#ead5c0] bg-[linear-gradient(140deg,#fff9f4_0%,#fffefc_55%,#fff8f1_100%)] p-4 shadow-premium sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral">Subscription Services</p>
                <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-neutral-950 md:text-3xl">
                  Grooming Subscription Packs in Bengaluru
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

            <div className="mt-5 space-y-6">
              {marketingSubscriptionPlanGroups.map((group) => (
                <div key={group.title}>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-[#3a2c22]">{group.title}</h3>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6f594a]">{group.summary}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {group.plans.map((pack) => (
                        <div key={pack.title} className="min-w-0">
                          <SubscriptionPlanCard
                            badge={pack.badge}
                            durationLabel={pack.duration}
                            title={pack.title}
                            priceLabel={pack.price}
                            originalPriceLabel={pack.worth}
                            dealLabel={group.dealLabel}
                            descriptionLabel={pack.description}
                            includedSummary={pack.sessions}
                            worthLabel={pack.worth}
                            serviceType={pack.serviceType}
                            bonusLabel={'bonus' in pack ? pack.bonus : undefined}
                            footerLabel="Pick date & time"
                            highlight={'highlight' in pack ? pack.highlight : false}
                            cta={(
                              <Link
                                href="/dashboard/user/subscriptions"
                                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-4 text-[13px] font-semibold text-white transition hover:border-[#c7773b] hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] group-hover:shadow-[0_12px_22px_rgba(199,119,59,0.28)] sm:h-10"
                              >
                                Choose Plan
                              </Link>
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="bengaluru-coverage" className="relative scroll-mt-28 overflow-hidden bg-[linear-gradient(180deg,#fffaf6_0%,#fff3ea_52%,#fffaf6_100%)] px-4 py-10 sm:px-6 md:py-12 lg:px-8">
          <div className="pointer-events-none absolute left-0 top-10 h-40 w-40 rounded-full border border-[#efd9c7]/60 opacity-40" aria-hidden="true" />
          <Heart className="pointer-events-none absolute right-6 top-12 h-16 w-16 text-[#ead4bf]/35" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[1320px]">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ead7c5] bg-white/82 px-5 py-2 text-[12px] font-bold uppercase text-[#2b211a] shadow-[0_8px_22px_rgba(93,57,28,0.08)]">
                <PawPrint className="h-4 w-4 text-coral" aria-hidden="true" />
                Professional pet grooming
              </span>
              <h2 className="mt-3 text-[34px] font-black uppercase leading-[1.02] text-neutral-950 sm:text-[52px] lg:text-[60px] xl:text-[66px]">
                At home. <span className="text-[#de7d16]">Stress-free</span>
              </h2>
              <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-[#24160d] px-5 py-2 text-center text-[14px] font-bold text-white shadow-[0_12px_24px_rgba(36,22,13,0.16)] sm:text-[17px]">
                Convenience for you | Comfort for your pet
              </p>
            </div>

            <div id="how-it-works" className="mt-7 grid scroll-mt-28 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stressFreeCards.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.step} className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-[#ead6c3] bg-white shadow-[0_14px_32px_rgba(93,57,28,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(93,57,28,0.16)]">
                    <div className="relative aspect-[16/9] overflow-hidden border-b border-[#ead6c3] bg-[#f8efe7]">
                      <Image
                        src={item.image}
                        alt={`${item.title} for Dofurs grooming in Bengaluru`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                      <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,#f59a18,#dc790f)] text-[15px] font-black text-white shadow-[0_8px_18px_rgba(220,121,15,0.3)]">
                        {item.step}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="grid flex-1 grid-cols-[40px_1fr] gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff3e8] text-[#d47a1b]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="min-h-[2.5em] text-[16px] font-black leading-tight text-neutral-950 xl:text-[18px]">{item.title}</h3>
                          <p className="mt-2 min-h-[60px] text-[12px] font-medium leading-5 text-neutral-600">{item.body}</p>
                        </div>
                      </div>
                      <p className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-[#fff1e4] px-3 py-2 text-[12px] font-bold text-[#c47522]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {item.badge}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mx-auto mt-6 grid max-w-[1080px] overflow-hidden rounded-[20px] border border-[#ead6c3] bg-white/92 shadow-[0_14px_30px_rgba(93,57,28,0.1)] md:grid-cols-3">
              {coverageStats.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-center gap-4 border-b border-[#ead6c3] px-5 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                    <Icon className="h-10 w-10 shrink-0 text-[#d47a1b]" aria-hidden="true" />
                    <div>
                      <p className="text-[30px] font-black leading-none text-neutral-950">{item.value}</p>
                      <p className="mt-1 text-[12px] font-semibold text-neutral-600">{item.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mx-auto mt-6 flex max-w-[1120px] flex-wrap justify-center gap-2.5">
              {bengaluruAreas.map((area) => (
                <Link
                  key={area.slug}
                  href={`/locations/${area.slug}`}
                  className="rounded-full border border-[#ead4bf] bg-white/88 px-3 py-1.5 text-[12px] font-bold text-[#745238] shadow-sm transition hover:border-coral/50 hover:text-coral"
                >
                  {area.name}
                </Link>
              ))}
              {['Marathahalli', 'Bellandur', 'JP Nagar', 'Hebbal'].map((area) => (
                <span key={area} className="rounded-full border border-[#ead4bf] bg-[#fff8f0] px-3 py-1.5 text-[12px] font-bold text-[#745238] shadow-sm">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="questions-before-booking" className="relative scroll-mt-40 overflow-hidden bg-[linear-gradient(180deg,#fffaf6_0%,#fff4eb_46%,#ffffff_100%)] px-4 py-10 sm:px-6 lg:px-8">
          <div className="relative mx-auto grid w-full max-w-[1200px] gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-7">
            <div className="lg:sticky lg:top-28">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ead7c5] bg-white/86 px-3 py-1.5 text-[11px] font-bold uppercase text-[#7a4c2a] shadow-[0_8px_22px_rgba(93,57,28,0.08)]">
                <MessageCircle className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                Questions before booking
              </span>
              <h2 className="mt-3 max-w-xl text-[28px] font-black leading-[1.05] text-neutral-950 md:text-[32px]">
                Clear answers for Bengaluru grooming bookings
              </h2>
              <p className="mt-3 max-w-xl text-[13px] font-medium leading-6 text-neutral-600">
                Practical details about doorstep grooming, package pricing, same-day slots and home setup before you confirm a session.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                <div className="grid grid-cols-[30px_1fr] gap-2 rounded-[14px] border border-[#ead6c3] bg-white/88 p-3 shadow-[0_10px_20px_rgba(93,57,28,0.07)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1e4] text-coral">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[12px] font-black leading-4 text-neutral-950">Transparent before you book</h3>
                    <p className="mt-1 text-[11px] font-medium leading-4 text-neutral-600">
                      Pricing, inclusions and slot availability are confirmed first.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[30px_1fr] gap-2 rounded-[14px] border border-[#ead6c3] bg-white/88 p-3 shadow-[0_10px_20px_rgba(93,57,28,0.07)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1e4] text-coral">
                    <PawPrint className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[12px] font-black leading-4 text-neutral-950">Unsure which package fits?</h3>
                    <p className="mt-1 text-[11px] font-medium leading-4 text-neutral-600">
                      Share coat, breed and temperament for package guidance.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={genericBookingHref} className={primaryCtaClass}>
                  <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                  Book Now
                </Link>
                <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className={secondaryCtaClass}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Us
                </a>
              </div>
            </div>

            <div className="grid gap-2">
              {faqs.map((faq, index) => (
                <details key={faq.q} className="group rounded-[14px] border border-[#ead6c3] bg-white/92 shadow-[0_10px_22px_rgba(93,57,28,0.07)] transition duration-300 open:border-[#e3b07c] open:shadow-[0_14px_28px_rgba(93,57,28,0.1)]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 marker:hidden sm:px-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#f59a18,#dc790f)] text-[12px] font-black text-white shadow-[0_8px_18px_rgba(220,121,15,0.2)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-black leading-5 text-neutral-950 sm:text-[14px]">
                      {faq.q}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ead6c3] bg-[#fff7ef] text-base font-black leading-none text-[#c47522] transition duration-300 group-open:rotate-45 group-open:border-[#de9158] group-open:bg-[#fff1e4]">
                      +
                    </span>
                  </summary>
                  <p className="border-t border-[#f0dfcf] px-3 pb-3 pt-3 text-[12px] font-medium leading-5 text-neutral-600 sm:ml-[48px] sm:px-4">
                    {faq.a}
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffd8b7]">Ready for a cleaner, calmer pet?</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.01em] md:text-3xl">Book pet grooming in Bengaluru today</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/76">
                  Pick a package, choose your pet and confirm a slot. We will match you with available Dofurs grooming professionals for your address.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={genericBookingHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#684126] transition hover:bg-[#fff3e7]">
                  <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                  Book Now
                </Link>
                <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/35 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}