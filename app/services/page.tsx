import type { Metadata } from 'next';
import Link from 'next/link';
import { Bath, CheckCircle2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { GROOMING_PACKAGES } from '@/lib/service-catalog/grooming-packages';
import { links } from '@/lib/site-data';

const SITE_URL = 'https://dofurs.in';
const GROOMING_URL = `${SITE_URL}/services/grooming/bangalore`;

export const metadata: Metadata = {
  title: 'Doorstep Pet Grooming Services in Bangalore',
  description:
    'Explore Dofurs grooming packages in Bangalore: Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming, and Complete Care from verified doorstep groomers.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Doorstep Pet Grooming Services in Bangalore | Dofurs',
    description:
      'Compare grooming packages, transparent prices, package inclusions, and doorstep grooming support across Bangalore.',
    url: `${SITE_URL}/services`,
    images: ['/logo/og-default.jpg'],
  },
  keywords: [
    'pet grooming services Bangalore',
    'dog grooming at home Bangalore',
    'cat grooming Bangalore',
    'doorstep pet grooming Bangalore',
    'Dofurs grooming packages',
  ],
};

function formatPriceInr(price: string | number): string {
  if (typeof price === 'number') {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  const normalized = price.trim();
  return normalized.startsWith('₹') ? normalized : `₹${normalized}`;
}

const servicesItemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  '@id': `${SITE_URL}/services#list`,
  name: 'Dofurs Grooming Packages in Bangalore',
  description: 'Doorstep pet grooming packages in Bangalore from verified Dofurs groomers.',
  url: `${SITE_URL}/services`,
  itemListElement: GROOMING_PACKAGES.map((pkg, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: GROOMING_URL,
    name: pkg.title,
  })),
};

const servicesBreadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Grooming Services', item: `${SITE_URL}/services` },
  ],
};

export default function ServicesPage() {
  const bookingHref = `${links.booking}?serviceType=grooming&mode=home_visit#start-your-booking`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesItemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesBreadcrumbSchema) }}
      />
      <Navbar />
      <main className="dofurs-mobile-main min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_42%,#fffcf9_100%)] pt-20">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <section className="grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Dofurs Grooming</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-0.01em] text-neutral-950 sm:text-5xl">
                Doorstep Pet Grooming Services in Bangalore
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
                Dofurs now focuses on grooming only: verified groomers, transparent package pricing, pet-safe products,
                and home appointments built for Bangalore apartments and neighbourhoods.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={bookingHref}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Book Now
                </Link>
                <Link
                  href="/services/grooming/bangalore#packages"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-[#e2c2a4] bg-white px-6 text-sm font-semibold text-[#6e4123] transition hover:border-coral/50 hover:text-coral"
                >
                  View Packages
                </Link>
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-[#ead5c0] bg-white/82 p-5 shadow-premium">
              {[
                { icon: Bath, title: 'Full grooming packages', body: 'Bath, haircut, de-shedding, nail care, ear cleaning, hygiene trims and paw care.' },
                { icon: ShieldCheck, title: 'Verified groomers', body: 'Identity-checked professionals with hygiene-first handling standards.' },
                { icon: MapPin, title: 'Bangalore coverage', body: 'Serving key neighbourhoods with pincode-aware availability.' },
                { icon: Sparkles, title: 'Transparent pricing', body: 'Package inclusions and prices are visible before booking.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-3 rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-coral">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-neutral-950">{item.title}</p>
                      <p className="mt-1 text-[13px] leading-5 text-neutral-600">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-coral">Packages & pricing</p>
                <h2 className="mt-2 text-3xl font-bold text-neutral-950">Choose the grooming session your pet needs</h2>
              </div>
              <Link href="/services/grooming/bangalore" className="text-sm font-semibold text-coral underline-offset-4 hover:underline">
                Open full grooming page
              </Link>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {GROOMING_PACKAGES.map((pkg) => (
                <article
                  key={pkg.title}
                  className="flex min-h-[360px] flex-col rounded-3xl border border-[#f0e0d1] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-coral/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                        Available
                      </span>
                      <h3 className="mt-3 text-lg font-bold text-neutral-950">{pkg.title}</h3>
                    </div>
                    <div className="text-right">
                      {pkg.mrp ? (
                        <p className="text-[12px] text-neutral-500 line-through">{formatPriceInr(pkg.mrp)}</p>
                      ) : null}
                      <p className="text-2xl font-bold text-neutral-950">{formatPriceInr(pkg.price)}</p>
                    </div>
                  </div>

                  <ul className="mt-4 flex-1 space-y-2 border-t border-[#f0e4d7] pt-4">
                    {pkg.features.slice(0, 6).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-neutral-700">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`${links.booking}?serviceType=${encodeURIComponent(pkg.title)}&mode=home_visit#start-your-booking`}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-[#dfbea0] bg-white px-4 text-[12px] font-semibold text-[#765136] transition hover:border-coral hover:text-coral"
                  >
                    Book {pkg.title}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-14 rounded-3xl border border-brand-200 bg-[linear-gradient(135deg,#fff8f0_0%,#fffcf8_100%)] p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-neutral-900">Ready to book grooming?</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Start the booking flow to select your grooming package, pet, address, time slot, and payment preference.
            </p>
            <Link
              href={bookingHref}
              className="mt-5 inline-block rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Book Now
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
