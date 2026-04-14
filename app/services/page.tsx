import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Pet Services in Bangalore — Grooming, Boarding, Birthday & More | Dofurs',
  description:
    'Explore premium pet services in Bangalore — professional grooming, pet boarding, birthday celebrations, vet visits, pet sitting, and training from verified specialists.',
  openGraph: {
    title: 'Pet Services in Bangalore — Dofurs',
    description:
      'Professional grooming, boarding, birthday packages, vet visits and more from verified pet care specialists across Bangalore.',
  },
  keywords: [
    'pet services Bangalore',
    'pet grooming Bangalore',
    'pet boarding Bangalore',
    'pet birthday party Bangalore',
    'vet home visit Bangalore',
    'dog training Bangalore',
  ],
};

const SERVICE_CATEGORIES = [
  {
    slug: 'grooming',
    label: 'Pet Grooming',
    description:
      'Professional doorstep baths, haircuts, nail trimming, and full grooming sessions. Verified groomers, safe products, at-home convenience.',
    icon: '✂️',
    color: 'border-orange-200 bg-orange-50/60',
    iconBg: 'bg-orange-100',
    isActive: true,
    priceFrom: '₹899',
  },
  {
    slug: 'pet-birthday',
    label: 'Pet Birthday',
    description:
      'Celebrate your pet\'s special day with custom party setups, pet-safe treats, festive decor, and photoshoots. Unforgettable memories made easy.',
    icon: '🎂',
    color: 'border-pink-200 bg-pink-50/60',
    iconBg: 'bg-pink-100',
    isActive: true,
    priceFrom: '₹1,999',
  },
  {
    slug: 'pet-boarding',
    label: 'Pet Boarding',
    description:
      'Safe, comfortable overnight stays with vetted caregivers. Your pet gets a stress-free home away from home while you travel.',
    icon: '🏡',
    color: 'border-teal-200 bg-teal-50/60',
    iconBg: 'bg-teal-100',
    isActive: true,
    priceFrom: '₹999',
  },
  {
    slug: 'vet-visits',
    label: 'Vet Visits',
    description:
      'Trusted vets for wellness checkups, vaccinations, preventive care, and health consultations — at home or at partner clinics.',
    icon: '🩺',
    color: 'border-blue-200 bg-blue-50/60',
    iconBg: 'bg-blue-100',
    isActive: false,
    priceFrom: null,
  },
  {
    slug: 'pet-sitting',
    label: 'Pet Sitting',
    description:
      'Reliable sitters who provide personalized in-home care for your pet while you travel or work. Trusted, background-verified.',
    icon: '🐾',
    color: 'border-emerald-200 bg-emerald-50/60',
    iconBg: 'bg-emerald-100',
    isActive: false,
    priceFrom: null,
  },
  {
    slug: 'training',
    label: 'Dog Training',
    description:
      'Positive reinforcement training to improve behavior, build confidence, and strengthen the bond between you and your dog.',
    icon: '🎓',
    color: 'border-amber-200 bg-amber-50/60',
    iconBg: 'bg-amber-100',
    isActive: false,
    priceFrom: null,
  },
];

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main className="dofurs-mobile-main min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_40%,#fffcf9_100%)] pt-20">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {/* Page header */}
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Dofurs Services</p>
            <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">
              Premium Pet Care for Every Need
            </h1>
            <p className="mx-auto max-w-xl text-base text-neutral-600">
              From everyday grooming to birthday celebrations — browse our full range of verified pet services across Bangalore.
            </p>
          </div>

          {/* Active services */}
          <div className="mt-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e7c4a7]" />
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Currently Available
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e7c4a7]" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_CATEGORIES.filter((c) => c.isActive).map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/services/${cat.slug}`}
                  className={`group flex flex-col gap-4 rounded-3xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${cat.color}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${cat.iconBg}`}>
                      {cat.icon}
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      Available
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 group-hover:text-coral">{cat.label}</h2>
                    <p className="mt-1 text-sm text-neutral-600">{cat.description}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    {cat.priceFrom && (
                      <span className="text-sm font-semibold text-neutral-700">
                        From {cat.priceFrom}
                      </span>
                    )}
                    <span className="ml-auto text-sm font-semibold text-coral group-hover:translate-x-0.5 transition-transform">
                      Explore →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Coming soon services */}
          <div className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e7c4a7]" />
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Coming Soon
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e7c4a7]" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_CATEGORIES.filter((c) => !c.isActive).map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/services/${cat.slug}`}
                  className={`group flex flex-col gap-4 rounded-3xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${cat.color} opacity-85`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${cat.iconBg}`}>
                      {cat.icon}
                    </div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
                      Coming Soon
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 group-hover:text-coral">{cat.label}</h2>
                    <p className="mt-1 text-sm text-neutral-600">{cat.description}</p>
                  </div>
                  <span className="mt-auto text-sm font-semibold text-coral">
                    Learn More →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Booking CTA */}
          <div className="mt-14 rounded-3xl border border-brand-200 bg-[linear-gradient(135deg,#fff8f0_0%,#fffcf8_100%)] p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-neutral-900">Ready to book?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Start the booking flow to select your service, time slot, and care specialist in one seamless experience.
            </p>
            <Link
              href="/forms/customer-booking"
              className="mt-5 inline-block rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Book a Service
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
