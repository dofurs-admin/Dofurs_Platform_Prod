import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
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
  Stethoscope,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { bangaloreAreas } from '@/lib/service-areas';
import { GROOMING_PACKAGES, type GroomingPackage } from '@/lib/service-catalog/grooming-packages';
import { buildBreadcrumbSchema, buildServiceSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, supportContact, whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

const SITE_URL = 'https://dofurs.in';
const PAGE_PATH = '/services/grooming/bangalore';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const HERO_IMAGE = '/services/grooming-hero.png';
const HERO_IMAGE_URL = `${SITE_URL}${HERO_IMAGE}`;
const genericBookingHref = `${links.booking}?serviceType=grooming&mode=home_visit#start-your-booking`;

export const metadata: Metadata = {
  title: 'Pet Grooming in Bangalore — Doorstep Dog & Cat Grooming',
  description:
    'Book doorstep pet grooming in Bangalore from ₹699. Verified Dofurs groomers for baths, haircuts, de-shedding, nail trimming, ear cleaning, hygiene trims and full grooming packages.',
  alternates: { canonical: PAGE_URL },
  keywords: [
    'pet grooming Bangalore',
    'dog grooming at home Bangalore',
    'doorstep pet grooming Bangalore',
    'cat grooming Bangalore',
    'dog bath at home Bangalore',
    'pet groomer near me Bangalore',
    'Dofurs grooming Bangalore',
  ],
  openGraph: {
    title: 'Pet Grooming in Bangalore | Dofurs',
    description:
      'Verified doorstep pet groomers across Bangalore. Packages from ₹699 with pet-safe products, transparent pricing and WhatsApp support.',
    type: 'website',
    url: PAGE_URL,
    siteName: 'Dofurs',
    locale: 'en_IN',
    images: [{ url: HERO_IMAGE_URL, width: 1200, height: 900, alt: 'Dofurs pet grooming in Bangalore' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pet Grooming in Bangalore | Dofurs',
    description: 'Doorstep dog and cat grooming in Bangalore from verified Dofurs professionals.',
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

const bangaloreTrust = [
  {
    icon: Home,
    title: 'Apartment-friendly grooming',
    body: 'Our groomers are used to Bangalore apartment entries, visitor approvals, lift timing and compact home setups.',
  },
  {
    icon: ShowerHead,
    title: 'Equipment comes with us',
    body: 'The groomer brings shampoo, conditioner, brushes, clippers, nail tools, towels and dryers. You only need water access and a safe corner.',
  },
  {
    icon: Sparkles,
    title: 'Coat care for local weather',
    body: 'Bangalore dust, monsoon dampness, ticks and summer shedding are factored into package recommendations.',
  },
  {
    icon: Stethoscope,
    title: 'Calm handling first',
    body: 'Anxious pets are handled at their pace. If a pet needs medical attention, we guide you toward vet support before grooming proceeds.',
  },
];

const processSteps = [
  {
    title: 'Choose a package',
    body: 'Pick Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming or Complete Care based on coat condition and comfort level.',
  },
  {
    title: 'Confirm your slot',
    body: 'Use the booking flow to select your pet, address, pincode and preferred time. Grooming defaults to home visit where available.',
  },
  {
    title: 'Groomer arrives prepared',
    body: 'Your verified groomer reaches your Bangalore address with tools, products and appointment context.',
  },
];

const faqs = [
  {
    q: 'How much does pet grooming cost in Bangalore?',
    a: 'Dofurs grooming packages start at ₹699 for Monthly Care. Full grooming packages currently range up to ₹1,999 before optional add-ons or special handling needs.',
  },
  {
    q: 'Do you provide dog grooming at home in Bangalore?',
    a: 'Yes. Doorstep grooming is the primary booking mode for grooming packages. The booking flow checks your pet, address, pincode and available provider slots.',
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
  name: 'Pet Grooming in Bangalore',
  description:
    'Doorstep dog and cat grooming in Bangalore by verified Dofurs groomers, including bath care, haircuts, nail trimming, de-shedding, de-matting, ear cleaning, paw care and full grooming packages.',
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
  name: 'Dofurs Pet Grooming in Bangalore',
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
    { '@type': 'City', name: 'Bengaluru' },
    ...bangaloreAreas.map((area) => ({
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
  { name: 'Bangalore', url: PAGE_PATH },
]);

export default function BangaloreGroomingLandingPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 gap-2 px-6 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 gap-2 px-5 text-sm font-semibold tracking-[0.01em]');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(groomingServiceSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusinessSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)} />
      <Navbar />
      <main className="dofurs-mobile-main relative overflow-hidden bg-[linear-gradient(180deg,#fffcf8_0%,#fff8f0_34%,#ffffff_100%)] text-ink">
        <section className="relative px-4 pb-10 pt-32 sm:px-6 sm:pt-36 md:pb-14 lg:px-8 lg:pb-16 lg:pt-40">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_12%_14%,rgba(227,154,93,0.18),transparent_46%),radial-gradient(circle_at_88%_20%,rgba(70,136,120,0.12),transparent_44%)]" />
          <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e5c4a8] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b633f] shadow-sm">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Doorstep grooming across Bangalore
              </span>
              <h1 className="mt-5 max-w-3xl text-[38px] font-bold leading-[1.04] tracking-[-0.01em] text-neutral-950 sm:text-5xl lg:text-[64px]">
                Pet Grooming in Bangalore
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-7 text-neutral-700 sm:text-lg sm:leading-8">
                Book verified groomers for baths, haircuts, de-shedding, nail trimming, ear cleaning and hygiene care at home. Packages start from ₹699 with transparent inclusions and pet-safe products.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {trustSignals.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[#ead4bf] bg-white px-3 py-2 text-[12px] font-semibold text-[#745238] shadow-sm">
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

              <p className="mt-4 text-[13px] font-medium text-neutral-500">
                Available in Indiranagar, Koramangala, HSR Layout, Whitefield, Electronic City, Jayanagar and nearby Bangalore areas.
              </p>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[1.75rem] border border-[#e7c4a7] bg-white shadow-premium-xl">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={HERO_IMAGE}
                    alt="Professional pet grooming at home in Bangalore"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 44vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" aria-hidden="true" />
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/45 bg-white/90 p-4 shadow-lg backdrop-blur-md">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-coral">Most booked</p>
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-neutral-950">Essential Grooming</p>
                        <p className="mt-1 text-[13px] text-neutral-600">Full bath, hygiene trim, coat care and paw care.</p>
                      </div>
                      <Link href={`${links.booking}?serviceType=${encodeURIComponent('Essential Grooming')}&mode=home_visit#start-your-booking`} className="inline-flex h-10 items-center justify-center rounded-full bg-neutral-950 px-4 text-[12px] font-semibold text-white transition hover:bg-neutral-800">
                        Book This
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="packages" className="relative px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Grooming packages</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-neutral-950 md:text-4xl">Choose the right grooming session</h2>
              <p className="mt-3 text-[15px] leading-7 text-neutral-600">
                Each package includes a trained groomer, grooming equipment and clear pricing before the appointment. Final suitability can depend on breed, coat condition and pet temperament.
              </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {GROOMING_PACKAGES.map((pkg) => {
                const details = packageDetails[pkg.title];
                const badgeClass = pkg.badgeVariant ? badgeClasses[pkg.badgeVariant] : badgeClasses.popular;
                return (
                  <article
                    key={pkg.title}
                    id={pkg.title === 'Fur Makeover' ? 'fur-makeover' : undefined}
                    className={`flex min-h-[420px] flex-col rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      pkg.highlighted
                        ? 'border-[#dc8f47] bg-[linear-gradient(160deg,#fffdf8,#fff3e8)]'
                        : 'border-[#f0e0d1] bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${badgeClass}`}>
                          {pkg.badge ?? 'Available'}
                        </span>
                        <h3 className="mt-3 text-lg font-bold text-neutral-950">{pkg.title}</h3>
                      </div>
                      <div className="text-right">
                        {pkg.mrp ? (
                          <p className="text-[12px] font-medium text-[#9a7258]">
                            MRP <span className="line-through decoration-[#b78258]/70 decoration-1">{formatPriceInr(pkg.mrp)}</span>
                          </p>
                        ) : null}
                        <p className="text-2xl font-bold text-neutral-950">{formatPriceInr(pkg.price)}</p>
                        <p className="text-[11px] text-neutral-500">per session</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-neutral-600">{details?.description ?? pkg.features.join(', ')}</p>
                    <div className="mt-3 grid gap-2 rounded-xl border border-[#f1dfcf] bg-[#fffaf6] p-3 text-[12px] text-neutral-700">
                      <span className="inline-flex items-center gap-2">
                        <PawPrint className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                        {details?.bestFor ?? 'Routine coat and hygiene care'}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                        Approx. {details?.duration ?? '60-120 min'}
                      </span>
                    </div>

                    <ul className="mt-4 flex-1 space-y-2 border-t border-[#f0e4d7] pt-4">
                      {pkg.features.slice(0, 7).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-neutral-700">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                      {pkg.features.length > 7 ? (
                        <li>
                          <details className="group rounded-xl border border-[#ead4bf] bg-[#fffaf6] px-3 py-2">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-semibold text-[#8b633f] marker:hidden [&::-webkit-details-marker]:hidden">
                              <span>+ {pkg.features.length - 7} more inclusions</span>
                              <span className="text-coral transition group-open:rotate-45" aria-hidden="true">+</span>
                            </summary>
                            <ul className="mt-3 space-y-2 border-t border-[#ead4bf] pt-3">
                              {pkg.features.slice(7).map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-neutral-700">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      ) : null}
                    </ul>

                    <Link href={packageBookingHref(pkg)} className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-[#dfbea0] bg-white px-4 text-[12px] font-semibold text-[#765136] transition hover:border-coral hover:text-coral">
                      Book {pkg.title}
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-[1200px] gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Bangalore coverage</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-neutral-950 md:text-4xl">Built for local pet-parent routines</h2>
              <p className="mt-3 text-[15px] leading-7 text-neutral-600">
                Grooming a pet in Bangalore should not mean traffic, clinic queues or a stressful cab ride. Dofurs routes verified groomers to homes across key neighbourhoods, with WhatsApp coordination before the visit.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {bangaloreAreas.map((area) => (
                  <Link
                    key={area.slug}
                    href={`/locations/${area.slug}`}
                    className="rounded-full border border-[#ead4bf] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#745238] transition hover:border-coral/50 hover:text-coral"
                  >
                    {area.name}
                  </Link>
                ))}
                {['Marathahalli', 'Bellandur', 'JP Nagar', 'Hebbal'].map((area) => (
                  <span key={area} className="rounded-full border border-[#ead4bf] bg-[#fff8f0] px-3 py-1.5 text-[12px] font-semibold text-[#745238]">
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {bangaloreTrust.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-[#f0e0d1] bg-white p-5 shadow-sm">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff4e8] text-coral">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-[15px] font-bold text-neutral-950">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-neutral-600">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] rounded-[1.75rem] border border-[#e8ccb3] bg-[linear-gradient(135deg,#fff7ee,#ffffff)] p-5 shadow-premium md:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">How it works</p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-neutral-950 md:text-4xl">Book grooming without disrupting your day</h2>
                <p className="mt-3 text-[15px] leading-7 text-neutral-600">
                  The landing page sends customers into the existing Dofurs booking flow with grooming and home-visit intent already set, then the backend checks catalog, address coverage, slots and provider availability.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {processSteps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-[#f0e0d1] bg-white p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-coral/10 text-sm font-bold text-coral">{index + 1}</span>
                    <h3 className="mt-3 text-[14px] font-bold text-neutral-950">{step.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-neutral-600">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-[1200px] gap-7 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Questions before booking</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-neutral-950 md:text-4xl">Clear answers for Bangalore grooming bookings</h2>
              <p className="mt-3 text-[15px] leading-7 text-neutral-600">
                These are the practical details pet parents usually need before booking a home grooming session.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
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

            <div className="space-y-3">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-2xl border border-[#f0e0d1] bg-white p-4 shadow-sm">
                  <h3 className="text-[14px] font-bold text-neutral-950">{faq.q}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-neutral-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-[1.75rem] border border-[#dca977] bg-[linear-gradient(135deg,#2b211a,#7b4d2e)] p-6 text-white shadow-premium-xl md:p-8">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffd8b7]">Ready for a cleaner, calmer pet?</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.01em] md:text-3xl">Book pet grooming in Bangalore today</h2>
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

        <div className="fixed inset-x-3 bottom-[calc(var(--dofurs-mobile-nav-height)+var(--dofurs-mobile-safe-bottom)+0.85rem)] z-40 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-[#e6c6aa] bg-white/94 p-2 shadow-[0_14px_32px_rgba(93,57,28,0.22)] backdrop-blur-md">
            <Link href={genericBookingHref} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-4 text-sm font-semibold text-white shadow-sm">
              <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
              Book Now
            </Link>
            <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-12 items-center justify-center rounded-xl border border-[#e5c4a8] bg-[#fff8f0] text-[#745238]" aria-label="Chat on WhatsApp about grooming">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}