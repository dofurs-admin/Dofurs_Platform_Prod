import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { bangaloreAreas } from '@/lib/service-areas';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { buildBreadcrumbSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, whatsappLinks } from '@/lib/site-data';

const SITE_URL = 'https://dofurs.in';

export const metadata: Metadata = {
  title: 'Pet Services Across Bangalore — Neighbourhood Coverage | Dofurs',
  description:
    'Dofurs delivers doorstep pet grooming, vet home visits, boarding, sitting and training across Bangalore — Indiranagar, Koramangala, HSR Layout, Whitefield, Electronic City, Jayanagar and more.',
  alternates: { canonical: 'https://dofurs.in/locations' },
  keywords: [
    'pet services Bangalore',
    'dog grooming Bangalore',
    'vet home visit Bangalore',
    'pet care Indiranagar',
    'pet care Koramangala',
    'pet care HSR Layout',
    'pet care Whitefield',
    'pet care Electronic City',
    'pet care Jayanagar',
  ],
  openGraph: {
    type: 'website',
    title: 'Pet Services Across Bangalore | Dofurs',
    description:
      'Neighbourhood-by-neighbourhood pet care coverage across Bangalore. Doorstep grooming, vet visits, boarding, sitting and training from verified professionals.',
    url: `${SITE_URL}/locations`,
    siteName: 'Dofurs',
    locale: 'en_IN',
    images: [{ url: `${SITE_URL}/logo/og-default.jpg`, alt: 'Dofurs pet services across Bangalore' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pet Services Across Bangalore | Dofurs',
    description: 'Neighbourhood coverage for pet grooming, vet visits, boarding, sitting and training across Bangalore.',
    images: [`${SITE_URL}/logo/og-default.jpg`],
  },
};

const locationsItemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Dofurs Bangalore Service Areas',
  description: 'Bangalore neighbourhoods where Dofurs delivers verified pet services at your doorstep.',
  itemListElement: bangaloreAreas.map((area, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `Pet services in ${area.name}`,
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
  const bookingHref = `${links.booking}#start-your-booking`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(locationsItemListSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(locationsBreadcrumbSchema)} />
      <ContentPageLayout
        title="Pet Services Across Bangalore"
        description="Doorstep pet care, one neighbourhood at a time. Pick your area below to see local coverage, landmarks, and what Dofurs provides in your part of Bangalore."
        heroImageSrc="/Birthday/partners-with-dofurs.png"
        heroImageAlt="Dofurs pet services across Bangalore neighbourhoods"
        heroImageObjectPosition="center"
        belowContent={
          <FadeInSection>
            <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Your area not listed?</p>
              <h3 className="mt-2 text-xl font-bold text-neutral-950">We cover most of Bangalore — just ask.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                Our dedicated location pages cover our busiest neighbourhoods, but we service across Bangalore. Start a booking
                or message us on WhatsApp and we&apos;ll confirm your pincode.
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
        {/* Intro */}
        <h2>Verified pet care, at your door across Bangalore</h2>
        <p>
          Dofurs is built for the way Bangalore actually lives — long commutes, gated-community rules, traffic that turns a
          salon trip into a 90-minute ordeal, and pets who&apos;d rather stay home anyway. Our providers cover every major
          cluster of the city, bringing grooming, vet care, boarding, sitting and training directly to your doorstep.
        </p>
        <p>
          Below are our dedicated neighbourhood pages. Each one lays out the pincodes we serve, local landmarks our providers
          know, and specific notes about caring for pets in that part of the city.
        </p>

        {/* Area cards */}
        <h2>Our Bangalore Neighbourhoods</h2>
        <div className="not-prose grid gap-4 sm:grid-cols-2">
          {bangaloreAreas.map((area) => (
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
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-600 line-clamp-3">{area.heroTagline}</p>
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

        {/* Services overview */}
        <h2>What We Bring to Every Neighbourhood</h2>
        <p>
          Every one of these service lines is live across all listed Bangalore neighbourhoods. You can combine multiple
          services in a single booking — for example, a grooming session followed by a vet wellness check.
        </p>
        <ul>
          <li>
            <strong>Pet grooming</strong> — doorstep bath, haircut, nail trimming, de-shedding and full spa packages from ₹899.
          </li>
          <li>
            <strong>Vet home visits</strong> — wellness checkups, vaccinations, preventive care and teleconsult from licensed
            vets.
          </li>
          <li>
            <strong>Pet boarding</strong> — safe overnight stays at verified partner homes from ₹999/night.
          </li>
          <li>
            <strong>Pet sitting</strong> — feeding, walks, companionship and photo updates while you&apos;re away.
          </li>
          <li>
            <strong>Pet training</strong> — obedience, behaviour correction, leash reactivity and puppy basics.
          </li>
          <li>
            <strong>Pet birthday</strong> — decor, cake, photography and memorable celebrations from ₹1,999.
          </li>
        </ul>

        {/* Why we built location pages */}
        <h2>Why Local Matters for Pet Care</h2>
        <p>
          Pet care is hyperlocal. A groomer who knows Koramangala&apos;s apartment society rules, a vet who understands the
          tick load around Agara Lake in July, a sitter who knows which Whitefield gate is fastest at 7 AM — these small
          details decide whether a service goes smoothly or stressfully.
        </p>
        <p>
          Our neighbourhood pages exist so you can see what we&apos;ve learned from operating in your area, check our pincode
          coverage, and read genuine details about pet parenting where you live — not generic copy.
        </p>

        {/* CTA block */}
        <div className="not-prose mt-2 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff4e6,#fffdf9)] p-5">
          <p className="text-[15px] font-semibold text-neutral-950">Don&apos;t see your neighbourhood?</p>
          <p className="mt-1 text-[13px] text-neutral-600">
            We probably still cover it. Start a booking — if we can&apos;t serve your pincode, you won&apos;t be charged. Or
            message us on WhatsApp for a quick confirmation.
          </p>
        </div>
      </ContentPageLayout>
    </>
  );
}
