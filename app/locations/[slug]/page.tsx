import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { bangaloreAreas, bangaloreAreaBySlug, type BangaloreArea } from '@/lib/service-areas';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { buildBreadcrumbSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, whatsappLinks } from '@/lib/site-data';

const SITE_URL = 'https://dofurs.in';

type LocationPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return bangaloreAreas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = bangaloreAreaBySlug[slug];

  if (!area) {
    return { title: 'Pet Grooming in Bangalore | Dofurs' };
  }

  const canonical = `/locations/${area.slug}`;

  return {
    title: `Pet Grooming in ${area.name}, Bangalore — Doorstep Groomers`,
    description: `Book verified doorstep pet grooming in ${area.name}, Bangalore. Dofurs serves ${area.pincodes.join(', ')} and nearby areas with transparent grooming packages from ₹699.`,
    alternates: { canonical },
    keywords: [
      `dog grooming ${area.name}`,
      `pet grooming ${area.name}`,
      `cat grooming ${area.name}`,
      `doorstep grooming ${area.name}`,
      'pet grooming Bangalore',
    ],
    openGraph: {
      type: 'website',
      title: `Pet Grooming in ${area.name}, Bangalore | Dofurs`,
      description: `Doorstep dog and cat grooming in ${area.name}, Bangalore from verified Dofurs groomers.`,
      url: `${SITE_URL}${canonical}`,
      siteName: 'Dofurs',
      locale: 'en_IN',
      images: [{ url: `${SITE_URL}/logo/og-default.jpg`, alt: `Dofurs pet grooming in ${area.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Pet Grooming in ${area.name}, Bangalore | Dofurs`,
      description: `Doorstep grooming packages for dogs and cats in ${area.name}, Bangalore.`,
      images: [`${SITE_URL}/logo/og-default.jpg`],
    },
  };
}

function buildLocationLocalBusinessSchema(area: BangaloreArea) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/locations/${area.slug}#localbusiness`,
    name: `Dofurs — Pet Grooming in ${area.name}`,
    description: `Verified doorstep pet grooming in ${area.name}, Bangalore with transparent package pricing and hygiene-first handling.`,
    url: `${SITE_URL}/locations/${area.slug}`,
    telephone: '+91-70083-65175',
    image: `${SITE_URL}/logo/og-default.jpg`,
    priceRange: '₹₹',
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
        address: {
          '@type': 'PostalAddress',
          addressLocality: area.name,
          addressRegion: 'Karnataka',
          addressCountry: 'IN',
          postalCode: area.pincodes.join(', '),
        },
      },
      ...area.nearbyAreas.map((nearby) => ({
        '@type': 'Place' as const,
        name: `${nearby}, Bengaluru`,
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
}

function buildLocationFaqSchema(area: BangaloreArea) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: buildLocationGroomingFaqs(area).map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

function buildLocationGroomingFaqs(area: BangaloreArea) {
  const shortName = area.shortName ?? area.name;

  return [
    {
      question: `Do you provide pet grooming in ${area.name}?`,
      answer: `Yes. Dofurs provides doorstep pet grooming in ${area.name} and nearby areas including ${area.nearbyAreas.slice(0, 4).join(', ')}.`,
    },
    {
      question: `Which pincodes do you cover in ${shortName}?`,
      answer: `Our standard ${shortName} grooming coverage includes ${area.pincodes.join(', ')}. Share your exact pincode in the booking flow so we can confirm provider availability.`,
    },
    {
      question: `What grooming packages are available in ${area.name}?`,
      answer: 'Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming and Complete Care are the main Dofurs grooming packages available where provider slots are open.',
    },
    {
      question: `Can I book same-day grooming in ${area.name}?`,
      answer: 'Same-day grooming depends on groomer availability and slot timing. Weekdays are usually easier; weekend haircut and full grooming sessions should be booked early.',
    },
  ];
}

function buildLocalGroomingNotes(area: BangaloreArea) {
  return [
    `Keep water access, a plug point and a safe grooming corner ready before the groomer reaches ${area.name}.`,
    `If your building has visitor rules near ${area.landmarks[0] ?? area.name}, share access instructions during booking so entry is smooth.`,
    `For anxious pets, choose a quieter slot and mention triggers in the notes before your ${area.shortName ?? area.name} grooming appointment.`,
  ];
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const area = bangaloreAreaBySlug[slug];

  if (!area) {
    notFound();
  }

  const bookingHref = `${links.booking}?serviceType=grooming&mode=home_visit#start-your-booking`;
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');

  const localBusinessSchema = buildLocationLocalBusinessSchema(area);
  const faqSchema = buildLocationFaqSchema(area);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Locations', url: '/locations' },
    { name: area.name, url: `/locations/${area.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusinessSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqSchema)} />
      <ContentPageLayout
        title={`Pet Grooming in ${area.name}`}
        description={`Doorstep dog and cat grooming across ${area.name}, ${area.pincodes.join(', ')}, and nearby Bangalore neighbourhoods.`}
        heroImageSrc="/Birthday/partners-with-dofurs.png"
        heroImageAlt={`Dofurs pet grooming in ${area.name}, Bangalore`}
        heroImageObjectPosition="center"
        belowContent={
          <FadeInSection>
            <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Serving {area.name}</p>
              <h3 className="mt-2 text-xl font-bold text-neutral-950">
                Book Verified Grooming in {area.shortName ?? area.name}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                Book a grooming package for your pet at home, with pincode-aware availability and WhatsApp support.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link href={bookingHref} className={primaryCtaClass}>
                  Book Now
                </Link>
                <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className={secondaryCtaClass}>
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </FadeInSection>
        }
      >
        {/* Serving banner */}
        <div className="not-prose mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#e9d3bd] bg-[#fff8f0] px-4 py-3">
          <span className="text-lg">📍</span>
          <div>
            <p className="text-[13px] font-semibold text-[#8b633f]">Serving {area.name} & nearby</p>
            <p className="text-[12px] text-neutral-600">
              Pincodes: {area.pincodes.join(', ')} • Coverage includes {area.nearbyAreas.slice(0, 4).join(', ')}
              {area.nearbyAreas.length > 4 ? ' and more.' : '.'}
            </p>
          </div>
        </div>

        {/* Intro */}
        <h2>Doorstep grooming across {area.name}</h2>
        <p>
          Dofurs focuses on verified pet grooming in {area.name}, helping pet parents skip traffic, salon queues and stressful travel. Our groomers bring the tools, pet-safe products and appointment context needed for bath care, haircuts, de-shedding, nail care, ear cleaning and hygiene trims at home.
        </p>

        {/* Grooming available */}
        <h2>Grooming Available in {area.name}</h2>
        <p>
          Grooming is the live Dofurs service across {area.name}. Choose a package based on coat condition, comfort level and the amount of styling or hygiene care your pet needs.
        </p>
        <div className="not-prose mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Monthly Care', desc: 'Nails, paws, knots, eye-ear hygiene and de-shedding upkeep.' },
            { label: 'Fur Bath Care', desc: 'Bath, drying, brushing, de-shedding and de-matting support.' },
            { label: 'Fur Makeover', desc: 'Haircut, paw hair cleaning, hygiene areas, brushing and coat refresh.' },
            { label: 'Essential Grooming', desc: 'Full routine grooming with bath, hygiene trim, coat care and machine trim.' },
            { label: 'Complete Care', desc: 'Premium spa grooming with scissor haircut, styling and advanced paw/nail care.' },
          ].map((service) => (
            <Link
              key={service.label}
              href={`${links.booking}?serviceType=${encodeURIComponent(service.label)}&mode=home_visit#start-your-booking`}
              className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 transition hover:border-coral/30 hover:shadow-sm"
            >
              <div className="mt-2 flex items-start justify-between gap-2">
                <p className="text-[14px] font-semibold text-coral">{service.label}</p>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Available
                </span>
              </div>
              <p className="mt-1 text-[13px] text-neutral-600">{service.desc}</p>
            </Link>
          ))}
        </div>

        <h2>Why {area.name} pet parents prefer home grooming</h2>
        <p>
          {area.name} routines are shaped by landmarks like {area.landmarks.slice(0, 3).join(', ')} and nearby areas such as {area.nearbyAreas.slice(0, 3).join(', ')}. Doorstep grooming keeps your pet in a familiar space while avoiding cab rides, parking trouble and waiting rooms.
        </p>
        <p>
          Share coat condition, temperament notes and building entry instructions during booking. The grooming team uses that context to prepare the right products, tools and timing for your appointment.
        </p>

        {/* Landmarks */}
        <h2>Landmarks & Localities We Cover in {area.name}</h2>
        <p>
          Our groomers navigate {area.name} daily. These landmarks and stretches help us coordinate arrival windows and local coverage:
        </p>
        <div className="not-prose mt-3 flex flex-wrap gap-2">
          {area.landmarks.map((landmark) => (
            <span
              key={landmark}
              className="rounded-full border border-[#e9d3bd] bg-white px-3 py-1 text-[12px] font-medium text-[#8b633f]"
            >
              {landmark}
            </span>
          ))}
        </div>

        {/* Local notes */}
        {area.localNotes.length > 0 && (
          <>
            <h2>Local Grooming Notes</h2>
            <p>A few grooming-specific details that make appointments smoother across {area.name}:</p>
            <ul>
              {buildLocalGroomingNotes(area).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </>
        )}

        {/* Nearby areas */}
        <h2>Nearby Areas Also Covered</h2>
        <p>
          If you&apos;re just outside {area.name}, we likely still serve you. Our coverage extends to{' '}
          {area.nearbyAreas.join(', ')}.
        </p>

        {/* Why Dofurs */}
        <h2>Why Pet Parents in {area.name} Choose Dofurs Grooming</h2>
        <div className="not-prose grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: '🛡️',
              title: 'Verified groomers only',
              body: 'Every groomer is identity-checked and reviewed before taking Dofurs appointments.',
            },
            {
              icon: '💸',
              title: 'Transparent pricing',
              body: 'Package prices are shown upfront, with inclusions visible before you confirm.',
            },
            {
              icon: '⚡',
              title: 'Same-day & next-day slots',
              body: 'Weekday grooming usually has more availability. Weekend full grooming slots fill up fast.',
            },
            {
              icon: '🧾',
              title: 'Digital receipts',
              body: 'Appointment details, support and receipts are handled through the Dofurs flow.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
              <span className="text-2xl">{item.icon}</span>
              <p className="mt-2 text-[14px] font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[13px] text-neutral-600">{item.body}</p>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <h2>FAQs — Pet Grooming in {area.name}</h2>
        <div className="not-prose space-y-3">
          {buildLocationGroomingFaqs(area).map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-[#f0e4d7] bg-[#fffdfb] p-4">
              <p className="text-[14px] font-semibold text-neutral-900">{faq.question}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{faq.answer}</p>
            </div>
          ))}
        </div>

        {/* Other locations */}
        <h2>Other Bangalore Locations</h2>
        <p>Dofurs also serves these neighbourhoods with grooming-focused local coverage pages.</p>
        <div className="not-prose mt-3 flex flex-wrap gap-2">
          {bangaloreAreas
            .filter((other) => other.slug !== area.slug)
            .map((other) => (
              <Link
                key={other.slug}
                href={`/locations/${other.slug}`}
                className="rounded-full border border-[#e9d3bd] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#8b633f] transition hover:border-coral/40 hover:text-coral"
              >
                Pet grooming in {other.name}
              </Link>
            ))}
        </div>
      </ContentPageLayout>
    </>
  );
}
