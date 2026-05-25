import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { bengaluruAreas } from '@/lib/service-areas';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { buildBreadcrumbSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, whatsappLinks } from '@/lib/site-data';

const SITE_URL = 'https://dofurs.in';

export const metadata: Metadata = {
  title: 'Pet Grooming Across Bengaluru — Neighbourhood Coverage',
  description:
    'Dofurs delivers doorstep pet grooming across Bengaluru neighbourhoods with verified groomers, transparent packages, and pincode-aware availability.',
  alternates: { canonical: 'https://dofurs.in/locations' },
  keywords: [
    'pet grooming Bengaluru',
    'dog grooming Bengaluru',
    'pet grooming Bangalore',
    'dog grooming Bangalore',
    'doorstep grooming Indiranagar',
    'dog grooming Koramangala',
    'pet grooming HSR Layout',
    'pet grooming Whitefield',
    'pet grooming Electronic City',
    'pet grooming Jayanagar',
  ],
  openGraph: {
    type: 'website',
    title: 'Pet Grooming Across Bengaluru | Dofurs',
    description: 'Neighbourhood-by-neighbourhood doorstep grooming coverage across Bengaluru from verified Dofurs groomers.',
    url: `${SITE_URL}/locations`,
    siteName: 'Dofurs',
    locale: 'en_IN',
    images: [{ url: `${SITE_URL}/logo/og-default.jpg`, alt: 'Dofurs pet grooming across Bengaluru' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pet Grooming Across Bengaluru | Dofurs',
    description: 'Neighbourhood coverage for doorstep pet grooming across Bengaluru.',
    images: [`${SITE_URL}/logo/og-default.jpg`],
  },
};

const locationsItemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Dofurs Bengaluru Grooming Areas',
  alternateName: 'Dofurs Bangalore Grooming Areas',
  description: 'Bengaluru neighbourhoods where Dofurs delivers verified doorstep pet grooming.',
  itemListElement: bengaluruAreas.map((area, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `Pet grooming in ${area.name}`,
    url: `${SITE_URL}/locations/${area.slug}`,
  })),
};

const locationsBreadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: '/' },
  { name: 'Locations', url: '/locations' },
]);

export default function LocationsIndexPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');
  const bookingHref = `${links.booking}?serviceType=grooming&mode=home_visit#start-your-booking`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(locationsItemListSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(locationsBreadcrumbSchema)} />
      <ContentPageLayout
        title="Pet Grooming Across Bengaluru"
        description="Doorstep grooming, one neighbourhood at a time. Pick your area below to see local coverage, landmarks, pincodes, and grooming notes for your part of Bengaluru."
        heroImageSrc="/Birthday/partners-with-dofurs.png"
        heroImageAlt="Dofurs pet grooming across Bengaluru neighbourhoods"
        heroImageObjectPosition="center"
        belowContent={
          <FadeInSection>
            <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Your area not listed?</p>
              <h3 className="mt-2 text-xl font-bold text-neutral-950">We cover most of Bengaluru grooming demand — just ask.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                Our dedicated location pages cover our busiest grooming neighbourhoods. Start a booking or message us on WhatsApp and we&apos;ll confirm your pincode.
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
        <h2>Verified pet grooming, at your door across Bengaluru</h2>
        <p>
          Dofurs is built for the way Bengaluru actually lives: long commutes, gated-community rules, traffic that turns a salon trip into a 90-minute ordeal, and pets who would rather stay home anyway. Our grooming network covers key clusters of the city with transparent package pricing and pincode-aware availability.
        </p>
        <p>
          Below are our dedicated neighbourhood pages. Each one lays out the pincodes we serve, local landmarks our groomers know, and practical grooming notes for your part of the city.
        </p>

        <h2>Our Bengaluru Neighbourhoods</h2>
        <div className="not-prose grid gap-4 sm:grid-cols-2">
          {bengaluruAreas.map((area) => (
            <Link
              key={area.slug}
              href={`/locations/${area.slug}`}
              className="group rounded-2xl border border-[#f0e4d7] bg-[#fffdfb] p-5 transition hover:-translate-y-0.5 hover:border-coral/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold text-neutral-950">{area.name}</p>
                <span className="text-coral transition group-hover:translate-x-0.5">→</span>
              </div>
              <p className="mt-1 text-[12px] font-medium uppercase tracking-wider text-[#8b633f]">
                {area.pincodes.slice(0, 3).join(' · ')}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-600 line-clamp-3">
                Doorstep grooming coverage around {area.landmarks.slice(0, 3).join(', ')} and nearby {area.nearbyAreas.slice(0, 3).join(', ')}.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {area.nearbyAreas.slice(0, 4).map((nearby) => (
                  <span
                    key={nearby}
                    className="rounded-full border border-[#e9d3bd] bg-[#fff8f0] px-2 py-0.5 text-[11px] font-medium text-[#8b633f]"
                  >
                    {nearby}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <h2>What We Bring to Every Neighbourhood</h2>
        <p>
          Grooming is the Dofurs focus across listed Bengaluru neighbourhoods. Each location page explains coverage, local landmarks, nearby areas and practical grooming notes for pet parents.
        </p>
        <ul>
          <li>
            <strong>Pet grooming</strong> — doorstep Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming and Complete Care packages.
          </li>
          <li>
            <strong>Local coordination</strong> — groomers receive address, pincode and building-entry context before appointments.
          </li>
          <li>
            <strong>Hygiene-first setup</strong> — pet-safe products, grooming tools and calm handling for home sessions.
          </li>
        </ul>

        <h2>Why Local Matters for Grooming</h2>
        <p>
          Pet grooming is hyperlocal. A groomer who knows society entry rules, parking patterns, lift timing and neighbourhood traffic can keep the session calmer for both pet and parent.
        </p>
        <p>
          Our neighbourhood pages exist so you can check pincode coverage, see local landmarks, and understand how Dofurs handles grooming appointments where you live.
        </p>

        <div className="not-prose mt-2 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff4e6,#fffdf9)] p-5">
          <p className="text-[15px] font-semibold text-neutral-950">Don&apos;t see your neighbourhood?</p>
          <p className="mt-1 text-[13px] text-neutral-600">
            We probably still cover it. Start a grooming booking and we&apos;ll confirm availability for your pincode, or message us on WhatsApp for a quick check.
          </p>
        </div>
      </ContentPageLayout>
    </>
  );
}
