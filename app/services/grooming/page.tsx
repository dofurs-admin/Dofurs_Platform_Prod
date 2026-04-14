import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { links, whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Professional Pet Grooming in Bangalore — Doorstep & Salon | Dofurs',
  description:
    'Book expert pet grooming in Bangalore — doorstep bath, haircut, nail trimming, de-shedding, and full spa packages. Verified groomers, pet-safe products, and transparent pricing from ₹899.',
  openGraph: {
    title: 'Pet Grooming in Bangalore | Dofurs',
    description:
      'Professional doorstep pet grooming in Bangalore. Choose from Essential, Complete Care, and Summer Bonanza packages. Verified groomers, safe products.',
    type: 'website',
    url: 'https://dofurs.in/services/grooming',
  },
  keywords: [
    'pet grooming Bangalore',
    'dog grooming at home Bangalore',
    'cat grooming Bangalore',
    'doorstep pet grooming',
    'professional pet groomer Bangalore',
    'pet grooming near me',
    'dog bath at home Bangalore',
  ],
  alternates: { canonical: 'https://dofurs.in/services/grooming' },
};

const bookingHref = `${links.booking}?serviceType=grooming#start-your-booking`;

const GROOMING_PACKAGES = [
  {
    title: 'Doorstep Pet Grooming',
    price: 'Starts ₹899',
    badge: 'Popular',
    badgeColor: 'bg-[#fff4e6] text-[#c7773b] border border-[#f0c89a]',
    features: [
      'Nail Trimming',
      'Paw Hair Trimming',
      'Knot Removal & De-shedding',
      'Eye & Ear Cleaning',
    ],
    description: 'The essential grooming session — quick, clean, and done at your door.',
  },
  {
    title: 'Summer Bonanza',
    price: '₹1,199',
    badge: 'Great Deal',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    features: [
      'Bathing, Drying & Conditioning',
      'Shampoo & Conditioner',
      'Brushing & De-shedding',
      'De-matting',
      'Nail Clipping & Paw Hair Trimming',
    ],
    description: 'Perfect for the summer months — a full bath and coat refresh.',
  },
  {
    title: 'Essential Grooming',
    price: '₹1,799',
    badge: 'Best Value',
    badgeColor: 'bg-[linear-gradient(115deg,#de9158,#c7773b)] text-white shadow-[0_2px_8px_rgba(199,119,59,0.4)]',
    features: [
      'Bathing, Drying & Conditioning',
      'Nail Clipping',
      'Paw Hair Trimming',
      'Sanitary Area Hair Trimming',
      'Brushing & De-shedding',
      'De-matting',
      'Paw Massage',
      'Eye Cleaning',
    ],
    description: 'A comprehensive grooming session covering all the essentials.',
    highlight: true,
  },
  {
    title: 'Complete Care',
    price: '₹2,299',
    badge: 'Premium',
    badgeColor: 'bg-neutral-900 text-white',
    features: [
      'Bathing, Drying & Conditioning',
      'Nail Clipping & Grinding',
      'Paw Care & Massage',
      'Sanitary Area Hair Trimming',
      'Brushing & De-shedding',
      'De-matting',
      'Custom Haircut',
      'Face Styling',
      'Eye, Ear & Nose Cleaning',
    ],
    description: 'The full spa experience — for pets who deserve the best.',
  },
];

const WHY_DOFURS = [
  {
    icon: '🛡️',
    title: 'Verified Professionals',
    body: 'Every groomer is background-checked, identity-verified, and trained before joining the Dofurs network.',
  },
  {
    icon: '🧴',
    title: 'Pet-Safe Products',
    body: 'We use gentle, dermatologist-approved shampoos and conditioners suitable for all coat types and skin sensitivities.',
  },
  {
    icon: '🏠',
    title: 'Doorstep Convenience',
    body: 'Your pet is groomed in their comfort zone — no clinic queues, no travel stress, no separation anxiety.',
  },
  {
    icon: '💰',
    title: 'Transparent Pricing',
    body: 'Full pricing shown upfront. No hidden charges, no last-minute surprises.',
  },
];

const FAQS = [
  {
    q: 'How long does a grooming session take?',
    a: 'Sessions typically take 1–2 hours depending on the breed, coat condition, and package chosen. Your groomer will give you a time estimate when they arrive.',
  },
  {
    q: 'What breeds do you groom?',
    a: 'We groom all dog and cat breeds — from small breeds like Shih Tzus and Persians to large breeds like German Shepherds and Labradors. Just mention your pet\'s breed during booking.',
  },
  {
    q: 'Is grooming safe for anxious pets?',
    a: 'Yes. Our groomers are trained in calm-handling techniques and will work at your pet\'s pace. For very anxious pets, we recommend starting with the basic Doorstep package.',
  },
  {
    q: 'Do I need to provide anything for the session?',
    a: 'No. The groomer brings all equipment — brushes, shampoos, conditioners, nail clippers, and dryers. Just have a tap connection available.',
  },
  {
    q: 'What if my pet needs a breed-specific haircut?',
    a: 'The Complete Care package includes a custom haircut and face styling. You can describe the cut you want during the booking flow.',

  },
];

export default function GroomingPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');

  return (
    <ContentPageLayout
      title="Professional Pet Grooming"
      description="Doorstep grooming by verified specialists — gentle handling, pet-safe products, and transparent pricing across Bangalore."
      heroImageSrc="/services/grooming-hero.png"
      heroImageAlt="Professional pet groomer bathing a dog at home in Bangalore"
      heroImageObjectPosition="center"
      belowContent={
        <FadeInSection>
          <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Ready to book?</p>
            <h3 className="mt-2 text-xl font-bold text-neutral-950">Give Your Pet the Grooming They Deserve</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              Choose your package, pick a time, and we&apos;ll send a verified groomer straight to your door.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href={bookingHref} className={primaryCtaClass}>
                Book a Grooming Session
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
      <h2>Expert Grooming, at Your Doorstep</h2>
      <p>
        Dofurs brings professional-grade grooming directly to your home across Bangalore. Our verified groomers use pet-safe products and gentle techniques — delivering salon-quality results without the stress of a clinic visit. Whether it&apos;s a quick tidy-up or a full spa treatment, we have a package to suit every coat type and budget.
      </p>

      {/* Service modes */}
      <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
        {[
          { icon: '🏠', title: 'At Home', desc: 'The groomer comes to you — ideal for anxious pets or busy schedules. No drop-off required.' },
          { icon: '🏪', title: 'At Grooming Centers', desc: 'Prefer a full salon setup? Book at one of our partner grooming centers across Bangalore.' },
        ].map((mode) => (
          <div key={mode.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="text-2xl">{mode.icon}</span>
            <p className="mt-2 text-[15px] font-semibold text-neutral-900">{mode.title}</p>
            <p className="mt-1 text-sm text-neutral-600">{mode.desc}</p>
          </div>
        ))}
      </div>

      {/* Packages */}
      <h2>Grooming Packages</h2>
      <p>
        All packages include a trained, verified groomer with their own equipment. Prices are fixed and shown upfront — no surprises.
      </p>

      <div className="not-prose mt-4 grid items-stretch gap-4 sm:grid-cols-2">
        {GROOMING_PACKAGES.map((pkg) => (
          <div
            key={pkg.title}
            className={`relative flex flex-col rounded-2xl border p-5 transition-shadow hover:shadow-md ${
              pkg.highlight
                ? 'border-[#e4973f] bg-[linear-gradient(160deg,#fffcf8,#fff8f0)]'
                : 'border-[#f0e4d7] bg-[#fffdfb]'
            }`}
          >
            {pkg.highlight && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[#e4973f]/40" />
            )}
            <div className="mb-3 flex h-6 items-center">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${pkg.badgeColor}`}>
                {pkg.badge}
              </span>
            </div>
            <h3 className="text-[15px] font-bold text-neutral-950">{pkg.title}</h3>
            <p className="mt-0.5 text-xl font-bold text-neutral-950">{pkg.price}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">{pkg.description}</p>
            <ul className="mt-3 flex-1 space-y-1.5 border-t border-[#f0e4d7] pt-3">
              {pkg.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-700">
                  <span className="mt-0.5 text-coral">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={bookingHref}
              className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-full border border-[#e0c4a8] bg-white px-4 text-[12px] font-semibold text-[#7c5335] transition hover:border-[#c7773b] hover:text-[#c7773b]"
            >
              Book This Package
            </Link>
          </div>
        ))}
      </div>

      {/* Why Dofurs */}
      <h2>Why Pet Parents Choose Dofurs</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2">
        {WHY_DOFURS.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="mt-0.5 text-2xl">{item.icon}</span>
            <div>
              <p className="text-[14px] font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[13px] text-neutral-600">{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <h2>How It Works</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-3">
        {[
          { step: '1', title: 'Choose Your Package', desc: 'Select the grooming package that fits your pet\'s needs and your budget.' },
          { step: '2', title: 'Pick a Time Slot', desc: 'Book at a time that suits you — morning, afternoon, or evening, 7 days a week.' },
          { step: '3', title: 'We Come to You', desc: 'Your verified groomer arrives on time with all equipment. Watch or step away — your pet is in safe hands.' },
        ].map((s) => (
          <div key={s.step} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 text-center">
            <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-coral/10 text-sm font-bold text-coral">
              {s.step}
            </div>
            <p className="text-[14px] font-semibold text-neutral-900">{s.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <h2>Frequently Asked Questions</h2>
      <div className="not-prose space-y-3">
        {FAQS.map((faq) => (
          <div key={faq.q} className="rounded-2xl border border-[#f0e4d7] bg-[#fffdfb] p-4">
            <p className="text-[14px] font-semibold text-neutral-900">{faq.q}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{faq.a}</p>
          </div>
        ))}
      </div>

      {/* Schema */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Pet Grooming',
            provider: {
              '@type': 'LocalBusiness',
              name: 'Dofurs',
              url: 'https://dofurs.in',
              areaServed: 'Bangalore',
            },
            description: 'Professional doorstep and in-salon pet grooming in Bangalore. Verified groomers, pet-safe products, transparent pricing.',
            offers: [
              { '@type': 'Offer', name: 'Doorstep Pet Grooming', price: '899', priceCurrency: 'INR' },
              { '@type': 'Offer', name: 'Essential Grooming', price: '1799', priceCurrency: 'INR' },
              { '@type': 'Offer', name: 'Complete Care', price: '2299', priceCurrency: 'INR' },
            ],
            areaServed: 'Bangalore',
          }),
        }}
      />
    </ContentPageLayout>
  );
}
