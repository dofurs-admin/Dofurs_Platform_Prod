import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { links, whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Pet Birthday Celebrations in Bangalore — Dofurs',
  description:
    'Make your pet\'s birthday unforgettable with Dofurs! Custom party setups, pet-safe treats, festive decorations, and photoshoots — delivered to your door across Bangalore. Packages from ₹1,999.',
  openGraph: {
    title: 'Pet Birthday Packages in Bangalore | Dofurs',
    description:
      'Celebrate your pet\'s birthday with custom party setups, pet-safe treats, decor, and photoshoots. Premium birthday experiences delivered to your home in Bangalore.',
    type: 'website',
    url: 'https://dofurs.in/services/pet-birthday',
  },
  keywords: [
    'pet birthday party Bangalore',
    'dog birthday celebration Bangalore',
    'cat birthday party Bangalore',
    'pet birthday package',
    'dog birthday cake Bangalore',
    'pet party Bangalore',
  ],
  alternates: { canonical: 'https://dofurs.in/services/pet-birthday' },
};

const bookingHref = `${links.booking}?serviceType=Birthday#start-your-booking`;

const INCLUDED = [
  {
    icon: '🎨',
    title: 'Custom Party Setup',
    desc: 'Festive decorations tailored to your pet\'s personality — banners, balloons, and themed setups designed to delight.',
  },
  {
    icon: '🎂',
    title: 'Pet-Safe Treats & Cake',
    desc: 'Birthday cakes and treats made from pet-safe ingredients. No artificial sweeteners, no harmful ingredients — just delicious.',
  },
  {
    icon: '📸',
    title: 'Photoshoot',
    desc: 'Capture the magic with a dedicated photoshoot session. Beautiful memories to treasure every year.',
  },
  {
    icon: '🎁',
    title: 'Birthday Goodies',
    desc: 'A curated birthday hamper with toys, treats, and surprises — everything your pet needs to feel extra special.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Booked the birthday package for my Golden Retriever\'s 3rd birthday. The setup was beautiful and my dog absolutely loved the treats. Worth every rupee!',
    name: 'Priya S.',
    pet: 'Golden Retriever parent, Indiranagar',
  },
  {
    quote: 'I was worried the decorations would stress my cat out, but everything was calm and tasteful. The photoshoot photos are our new favourites!',
    name: 'Kiran M.',
    pet: 'Cat parent, Koramangala',
  },
];

const FAQS = [
  {
    q: 'How far in advance should I book?',
    a: 'We recommend booking at least 3–5 days in advance to ensure we can arrange the right setup and treats for your pet. Last-minute bookings may be available — contact us on WhatsApp to check.',
  },
  {
    q: 'Are the decorations and treats safe for pets?',
    a: 'Absolutely. Every decoration and edible item is selected specifically for pet safety. No artificial sweeteners (like xylitol), no toxic flowers, and no small choking hazards.',
  },
  {
    q: 'Can I invite guests to the birthday party?',
    a: 'Of course! Our setup is designed for small gatherings. Just let us know the number of guests when booking so we can plan accordingly.',
  },
  {
    q: 'Is the birthday package available for cats too?',
    a: 'Yes! We celebrate all pets — dogs, cats, and more. We customise the setup and treats to suit your pet\'s species and preferences.',
  },
  {
    q: 'What\'s the delivery area?',
    a: 'We currently serve all major areas across Bangalore. Specify your pincode during booking and we\'ll confirm availability.',
  },
];

export default function PetBirthdayPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');

  return (
    <ContentPageLayout
      title="Pet Birthday Celebrations"
      description="Make your pet's birthday unforgettable — custom setups, pet-safe treats, decor, and photoshoots delivered to your home across Bangalore."
      heroImageSrc="/services/birthday-hero.png"
      heroImageAlt="A joyful pet birthday setup with festive decorations, cake, and a happy dog in Bangalore"
      heroImageObjectPosition="center"
      belowContent={
        <FadeInSection>
          <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Ready to celebrate?</p>
            <h3 className="mt-2 text-xl font-bold text-neutral-950">Book Their Special Day Today</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              Tell us your pet&apos;s name, breed, and the date — we&apos;ll handle everything else.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href={bookingHref} className={primaryCtaClass}>
                Book Birthday Celebration
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
      <h2>Celebrate Their Day in Style</h2>
      <p>
        Your pet&apos;s birthday is a special milestone — and it deserves a proper celebration. Dofurs brings a complete, stress-free birthday experience to your home in Bangalore. From a custom party setup to pet-safe cakes and a dedicated photoshoot, every detail is handled with care so you can focus on making memories with your furry family member.
      </p>
      <p>
        Our birthday specialists bring everything needed — no shopping, no setup hassle. Just arrive, celebrate, and let us take care of the rest.
      </p>

      {/* Package card */}
      <h2>The Birthday Package — ₹1,999</h2>
      <div className="not-prose overflow-hidden rounded-2xl border border-[#e7c4a7] bg-[linear-gradient(140deg,#fff4e4_0%,#fffdf9_46%,#ffe9d2_100%)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700">Birthday Special</span>
          <span className="text-2xl font-bold text-neutral-950">₹1,999</span>
          <span className="text-sm text-neutral-500">per celebration</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="mt-0.5 text-xl">{item.icon}</span>
              <div>
                <p className="text-[14px] font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-0.5 text-[13px] text-neutral-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-[#f0d9c4] pt-4">
          <Link
            href={bookingHref}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-6 text-sm font-semibold text-white transition hover:brightness-105"
          >
            Book This Package
          </Link>
        </div>
      </div>

      {/* How it works */}
      <h2>How It Works</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-4">
        {[
          { step: '1', title: 'Book Online', desc: 'Select the date and share your pet\'s details.' },
          { step: '2', title: 'We Confirm', desc: 'Our team confirms within 24 hours and discusses preferences.' },
          { step: '3', title: 'We Set Up', desc: 'We arrive early to set up the decorations and arrange everything.' },
          { step: '4', title: 'You Celebrate', desc: 'Enjoy the party while we handle photos and treats.' },
        ].map((s) => (
          <div key={s.step} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 text-center">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">
              {s.step}
            </div>
            <p className="text-[13px] font-semibold text-neutral-900">{s.title}</p>
            <p className="mt-1 text-[12px] text-neutral-600">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Testimonials */}
      <h2>What Pet Parents Are Saying</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="rounded-2xl border border-[#f0e4d7] bg-[#fffdfb] p-5">
            <p className="text-[14px] italic leading-relaxed text-neutral-700">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-3 border-t border-[#f0e4d7] pt-3">
              <p className="text-[13px] font-semibold text-neutral-900">{t.name}</p>
              <p className="text-[12px] text-neutral-500">{t.pet}</p>
            </div>
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

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Pet Birthday Celebration',
            provider: { '@type': 'LocalBusiness', name: 'Dofurs', url: 'https://dofurs.in', areaServed: 'Bangalore' },
            description: 'Premium pet birthday celebration packages in Bangalore — custom party setups, pet-safe cakes, treats, decor, and photoshoots.',
            offers: [{ '@type': 'Offer', name: 'Pet Birthday Package', price: '1999', priceCurrency: 'INR' }],
            areaServed: 'Bangalore',
          }),
        }}
      />
    </ContentPageLayout>
  );
}
