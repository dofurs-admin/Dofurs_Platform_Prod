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
    return { title: 'Pet Services in Bangalore | Dofurs' };
  }

  const canonical = `/locations/${area.slug}`;

  return {
    title: area.metaTitle,
    description: area.metaDescription,
    alternates: { canonical },
    keywords: [
      `pet services ${area.name}`,
      `dog grooming ${area.name}`,
      `vet home visit ${area.name}`,
      `pet boarding ${area.name}`,
      `pet sitter ${area.name}`,
      'pet care Bangalore',
    ],
    openGraph: {
      type: 'website',
      title: area.metaTitle,
      description: area.metaDescription,
      url: `${SITE_URL}${canonical}`,
      siteName: 'Dofurs',
      locale: 'en_IN',
      images: [{ url: `${SITE_URL}/logo/og-default.jpg`, alt: `Dofurs pet services in ${area.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: area.metaTitle,
      description: area.metaDescription,
      images: [`${SITE_URL}/logo/og-default.jpg`],
    },
  };
}

function buildLocationLocalBusinessSchema(area: BangaloreArea) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/locations/${area.slug}#localbusiness`,
    name: `Dofurs — Pet Services in ${area.name}`,
    description: area.metaDescription,
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
    mainEntity: area.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

const SERVICES_FOR_AREA = [
  { label: 'Pet Grooming', href: '/services/grooming', desc: 'Doorstep grooming from ₹899', icon: '✂️' },
  { label: 'Vet Home Visits', href: '/services/vet-visits', desc: 'Wellness, vaccinations & teleconsult', icon: '🩺' },
  { label: 'Pet Boarding', href: '/services/pet-boarding', desc: 'Safe stays from ₹999/night', icon: '🏡' },
  { label: 'Pet Sitting', href: '/services/pet-sitting', desc: 'Feeding, walks & companionship', icon: '🐾' },
  { label: 'Pet Training', href: '/services/training', desc: 'Behaviour & obedience training', icon: '🎓' },
  { label: 'Pet Birthday', href: '/services/pet-birthday', desc: 'Birthday packages from ₹1,999', icon: '🎂' },
];

export default async function LocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const area = bangaloreAreaBySlug[slug];

  if (!area) {
    notFound();
  }

  const bookingHref = `${links.booking}#start-your-booking`;
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
        title={`Pet Services in ${area.name}`}
        description={area.heroTagline}
        heroImageSrc="/Birthday/partners-with-dofurs.png"
        heroImageAlt={`Dofurs pet services in ${area.name}, Bangalore`}
        heroImageObjectPosition="center"
        belowContent={
          <FadeInSection>
            <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Serving {area.name}</p>
              <h3 className="mt-2 text-xl font-bold text-neutral-950">
                Book Verified Pet Care in {area.shortName ?? area.name}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                Pick your service, choose a time, and we&apos;ll dispatch a verified Dofurs professional to your door.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link href={bookingHref} className={primaryCtaClass}>
                  Start Your Booking
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
        <h2>{area.heroTagline}</h2>
        <p>{area.intro}</p>

        {/* Services available */}
        <h2>Pet Services Available in {area.name}</h2>
        <p>
          All six Dofurs services are available across {area.name} and nearby areas. Pick the one that fits your pet&apos;s need
          today — or combine services into a single visit to save time.
        </p>
        <div className="not-prose mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES_FOR_AREA.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 transition hover:border-coral/30 hover:shadow-sm"
            >
              <span className="text-2xl">{service.icon}</span>
              <p className="mt-2 text-[14px] font-semibold text-coral">{service.label}</p>
              <p className="mt-1 text-[13px] text-neutral-600">{service.desc}</p>
            </Link>
          ))}
        </div>

        {/* Area-specific sections */}
        {area.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        {/* Landmarks */}
        <h2>Landmarks & Localities We Cover in {area.name}</h2>
        <p>
          Our providers navigate {area.name} daily — here are some of the landmarks and stretches within our standard service
          area:
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
            <h2>Local Notes for Pet Parents</h2>
            <p>A few things we&apos;ve learned from operating across {area.name}:</p>
            <ul>
              {area.localNotes.map((note) => (
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
        <h2>Why Pet Parents in {area.name} Choose Dofurs</h2>
        <div className="not-prose grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: '🛡️',
              title: 'Verified providers only',
              body: 'Every groomer, vet, trainer, and sitter is background-verified and trained before onboarding.',
            },
            {
              icon: '💸',
              title: 'Transparent pricing',
              body: 'Fixed prices shown upfront — no distance fees, no surprise add-ons after the session.',
            },
            {
              icon: '⚡',
              title: 'Same-day & next-day slots',
              body: 'Weekday grooming usually confirms within 2–3 hours. Weekend slots fill up fast — book early.',
            },
            {
              icon: '🧾',
              title: 'Digital receipts',
              body: 'GST-compliant invoices delivered to email and WhatsApp after every service.',
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
        <h2>FAQs — Pet Services in {area.name}</h2>
        <div className="not-prose space-y-3">
          {area.faqs.map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-[#f0e4d7] bg-[#fffdfb] p-4">
              <p className="text-[14px] font-semibold text-neutral-900">{faq.question}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{faq.answer}</p>
            </div>
          ))}
        </div>

        {/* Other locations */}
        <h2>Other Bangalore Locations</h2>
        <p>Dofurs also serves these neighbourhoods — each with a dedicated page listing local coverage.</p>
        <div className="not-prose mt-3 flex flex-wrap gap-2">
          {bangaloreAreas
            .filter((other) => other.slug !== area.slug)
            .map((other) => (
              <Link
                key={other.slug}
                href={`/locations/${other.slug}`}
                className="rounded-full border border-[#e9d3bd] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#8b633f] transition hover:border-coral/40 hover:text-coral"
              >
                Pet services in {other.name}
              </Link>
            ))}
        </div>
      </ContentPageLayout>
    </>
  );
}
