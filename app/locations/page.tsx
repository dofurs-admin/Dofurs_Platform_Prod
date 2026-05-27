import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import WelcomeOfferModal from '@/components/WelcomeOfferModal';
import {
  PET_GROOMING_CITY_PATH,
  getPetGroomingAreaPath,
  groupBengaluruAreasByRegion,
  publishedBengaluruPetGroomingAreas,
} from '@/lib/service-areas';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { buildBreadcrumbSchema, jsonLdScript } from '@/lib/seo/schemas';
import { links, whatsappLinks } from '@/lib/site-data';

const SITE_URL = 'https://dofurs.in';

export const metadata: Metadata = {
  title: 'Pet Grooming Across Bengaluru | Dofurs Coverage Areas',
  description:
    'Browse Dofurs pet grooming coverage across Bengaluru. Published locality pages link to canonical doorstep dog and cat grooming guides, with all other areas listed for pincode-aware availability checks.',
  alternates: { canonical: 'https://dofurs.in/locations' },
  keywords: [
    'pet grooming Bengaluru',
    'pet grooming Bangalore',
    'dog grooming Bangalore',
    'cat grooming Bangalore',
    'home pet grooming Bengaluru',
    'pet grooming Whitefield',
    'pet grooming HSR Layout',
    'pet grooming Electronic City',
  ],
  openGraph: {
    type: 'website',
    title: 'Pet Grooming Across Bengaluru | Dofurs',
    description: 'Bengaluru coverage index for Dofurs doorstep pet grooming, with canonical locality pages for priority areas.',
    url: `${SITE_URL}/locations`,
    siteName: 'Dofurs',
    locale: 'en_IN',
    images: [{ url: `${SITE_URL}/logo/og-default.jpg`, alt: 'Dofurs pet grooming across Bengaluru' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pet Grooming Across Bengaluru | Dofurs',
    description: 'Published locality pages and coverage areas for doorstep pet grooming across Bengaluru.',
    images: [`${SITE_URL}/logo/og-default.jpg`],
  },
};

const coverageGroups = groupBengaluruAreasByRegion();

const locationsItemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Dofurs Canonical Pet Grooming Locality Pages',
  alternateName: 'Dofurs Bangalore Pet Grooming Locality Pages',
  description: 'Published canonical Bengaluru locality pages for Dofurs doorstep pet grooming.',
  itemListElement: publishedBengaluruPetGroomingAreas.map((area, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `Pet Grooming in ${area.name}`,
    url: `${SITE_URL}${getPetGroomingAreaPath(area)}`,
  })),
};

const locationsBreadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: '/' },
  { name: 'Locations', url: '/locations' },
]);

export default function LocationsIndexPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');
  const bookingHref = `${links.booking}?serviceType=pet-grooming&mode=home_visit#start-your-booking`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(locationsItemListSchema)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(locationsBreadcrumbSchema)} />
      <WelcomeOfferModal />
      <ContentPageLayout
        title="Pet Grooming Across Bengaluru"
        description="Browse Dofurs grooming coverage by locality. Priority areas link to canonical pet grooming pages; the rest stay visible for coverage discovery without duplicate location pages."
        heroImageSrc="/Birthday/partners-with-dofurs.webp"
        heroImageAlt="Dofurs pet grooming across Bengaluru neighbourhoods"
        heroImageObjectPosition="center"
        belowContent={
          <FadeInSection>
            <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Need a pincode check?</p>
              <h3 className="mt-2 text-xl font-bold text-neutral-950">Start with the canonical Bengaluru grooming page.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                Dofurs confirms grooming availability by address, pincode, pet size, package and groomer route before a slot is final.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link href={bookingHref} className={primaryCtaClass}>
                  Book Pet Grooming
                </Link>
                <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className={secondaryCtaClass}>
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </FadeInSection>
        }
      >
        <h2>Canonical pet grooming locality pages</h2>
        <p>
          Dofurs now uses <Link href={PET_GROOMING_CITY_PATH}>/pet-grooming/bengaluru</Link> as the main Bengaluru pet grooming landing page. The high-demand locality pages below use canonical <strong>/pet-grooming/area</strong> URLs for pet parents searching for dog grooming, cat grooming, home pet grooming and mobile dog grooming in their neighbourhood.
        </p>
        <p>
          Coverage-only areas remain visible in this index so pet parents can recognize supported neighbourhoods without creating duplicate or thin pages. Enter your exact pincode during booking to confirm availability.
        </p>

        <h2>Published priority locality pages</h2>
        <div className="not-prose grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishedBengaluruPetGroomingAreas.map((area) => (
            <Link
              key={area.slug}
              href={getPetGroomingAreaPath(area)}
              className="group rounded-2xl border border-[#f0e4d7] bg-[#fffdfb] p-5 transition hover:-translate-y-0.5 hover:border-coral/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-bold text-neutral-950">Pet Grooming in {area.name}</p>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  Canonical
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium uppercase tracking-wider text-[#8b633f]">
                {area.pincodes.slice(0, 3).join(' · ')}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-600 line-clamp-3">
                Doorstep grooming around {area.landmarks.slice(0, 3).join(', ')} and nearby {area.nearbyAreas.slice(0, 3).join(', ')}.
              </p>
            </Link>
          ))}
        </div>

        <h2>All Bengaluru coverage areas</h2>
        <p>
          This complete coverage experience includes major Bengaluru and Bangalore localities across central, eastern, northern, southern, western and peripheral clusters. Areas marked for confirmation need an exact pincode and route check before booking.
        </p>
        <div className="not-prose grid gap-5">
          {coverageGroups.map((group) => (
            <section key={group.region} className="rounded-2xl border border-[#ead6c3] bg-[#fffaf6] p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-lg font-bold text-neutral-950">{group.region}</h3>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b633f]">{group.areas.length} areas</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.areas.map((area) => {
                  if (area.pageStatus === 'published') {
                    return (
                      <Link key={area.slug} href={getPetGroomingAreaPath(area)} className="rounded-full border border-[#e4c7ad] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#704b31] transition hover:border-coral/60 hover:text-coral">
                        {area.name}
                      </Link>
                    );
                  }

                  return (
                    <span key={area.slug} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${area.coverageTier === 'confirm' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-[#ead4bf] bg-white text-[#745238]'}`}>
                      {area.name}{area.coverageTier === 'confirm' ? ' - confirm pincode' : ''}
                    </span>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <h2>What Dofurs brings to each grooming appointment</h2>
        <ul>
          <li>
            <strong>Pet Grooming</strong> - Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming and Complete Care packages.
          </li>
          <li>
            <strong>Dog and cat care</strong> - bath, haircuts, de-shedding, de-matting, nail clipping, ear cleaning, paw hygiene and coat refreshes.
          </li>
          <li>
            <strong>Local coordination</strong> - groomers receive pincode, address, landmark and building-entry context before the appointment.
          </li>
        </ul>
      </ContentPageLayout>
    </>
  );
}
