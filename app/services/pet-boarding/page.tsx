import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { links, whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Safe Pet Boarding in Bangalore — Trusted Overnight Care | Dofurs',
  description:
    'Reliable pet boarding in Bangalore from ₹999/night. Your pet stays with verified caregivers in a safe, comfortable, stress-free environment. Perfect for when you travel.',
  openGraph: {
    title: 'Pet Boarding in Bangalore | Dofurs',
    description:
      'Safe overnight pet boarding in Bangalore with verified caregivers. Comfortable, stress-free stays from ₹999/night. Book now.',
    type: 'website',
    url: 'https://dofurs.in/services/pet-boarding',
  },
  keywords: [
    'pet boarding Bangalore',
    'dog boarding Bangalore',
    'cat boarding Bangalore',
    'overnight pet care Bangalore',
    'pet hostel Bangalore',
    'dog kennel Bangalore',
    'pet daycare Bangalore',
  ],
  alternates: { canonical: 'https://dofurs.in/services/pet-boarding' },
};

const bookingHref = `${links.booking}?serviceType=boarding#start-your-booking`;

const INCLUDED = [
  {
    icon: '🛏️',
    title: 'Comfortable Accommodation',
    desc: 'Clean, cozy spaces designed to feel like a home — not a cage. Your pet sleeps comfortably with bedding and familiar comforts.',
  },
  {
    icon: '🍽️',
    title: 'Meals & Fresh Water',
    desc: 'Meals provided per your pet\'s usual schedule and diet. We follow your instructions to keep routines consistent.',
  },
  {
    icon: '🚶',
    title: 'Regular Walks & Play',
    desc: 'Daily walks, outdoor time, and play sessions to keep your pet active and mentally stimulated.',
  },
  {
    icon: '📱',
    title: 'Daily Updates',
    desc: 'Regular photo and video updates so you know your pet is safe, happy, and well-cared for.',
  },
  {
    icon: '🛡️',
    title: 'Veterinary Support',
    desc: 'All boarding partners have access to an on-call vet. Any health concerns are addressed immediately.',
  },
  {
    icon: '✅',
    title: 'Verified Caregivers',
    desc: 'Every boarding host is background-checked, pet-care trained, and reviewed by other Dofurs pet parents.',
  },
];

const SAFETY = [
  {
    title: 'Background Verified Hosts',
    desc: 'All caregivers undergo identity checks and conduct verification before being listed on Dofurs.',
  },
  {
    title: 'Home Evaluation',
    desc: 'Boarding spaces are assessed for safety — no sharp edges, secure fencing, clean water access, and pet-proof environments.',
  },
  {
    title: 'Emergency Protocol',
    desc: 'Every host follows a clear emergency procedure and has access to veterinary contacts in their area.',
  },
  {
    title: 'No Multi-Pet Overcrowding',
    desc: 'We cap the number of pets per host to ensure your pet gets proper attention and space.',
  },
];

const FAQS = [
  {
    q: 'What should I pack for my pet?',
    a: 'We recommend bringing your pet\'s regular food (to avoid digestive changes), their favourite toy or blanket, and any medications they need. The caregiver will have bedding, bowls, and basic supplies.',
  },
  {
    q: 'How do I know my pet will be safe?',
    a: 'All Dofurs boarding hosts are background-verified and trained. You\'ll receive daily photo/video updates, and our support team is reachable 24/7 for any concerns.',
  },
  {
    q: 'Can you accommodate pets with medical needs?',
    a: 'Yes, for pets with specific medication schedules or health conditions, please mention this during booking. We\'ll match you with a host experienced in handling medical care routines.',
  },
  {
    q: 'What\'s the minimum boarding duration?',
    a: 'Minimum stay is 1 night. For longer stays, we offer discounted rates — contact us for custom pricing.',
  },
  {
    q: 'My pet has never been away from home. Will they be okay?',
    a: 'It\'s a common concern! Our hosts are experienced with first-time boarders. We recommend a short trial daycare session before a full overnight stay to help your pet adjust.',
  },
  {
    q: 'Do you board cats?',
    a: 'Yes! We board both dogs and cats. Cat boarding spaces are separate from dog spaces to ensure a calm, stress-free environment.',
  },
];

export default function PetBoardingPage() {
  const primaryCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');
  const secondaryCtaClass = premiumSecondaryCtaClass('h-11 px-6 text-sm font-semibold tracking-[0.01em]');

  return (
    <ContentPageLayout
      title="Safe & Comfortable Pet Boarding"
      description="Your pet stays with verified, caring hosts in a home-like environment while you travel — daily updates, full care, and peace of mind from ₹999 per night."
      heroImageSrc="/services/boarding-hero.png"
      heroImageAlt="A relaxed pet in a comfortable, safe boarding environment in Bangalore"
      heroImageObjectPosition="center"
      belowContent={
        <FadeInSection>
          <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Travel without worry</p>
            <h3 className="mt-2 text-xl font-bold text-neutral-950">Book a Boarding Stay for Your Pet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              Share your travel dates and your pet&apos;s details — we&apos;ll match you with the best caregiver nearby.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href={bookingHref} className={primaryCtaClass}>
                Book Pet Boarding
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
      <h2>A Home Away From Home</h2>
      <p>
        Travelling is easier when you know your pet is in good hands. Dofurs connects you with verified boarding hosts across Bangalore who provide genuine home-like care — not kennels, not cages. Your pet gets a comfortable space, regular meals, daily walks, and plenty of love.
      </p>
      <p>
        Every boarding host is background-verified and reviewed by other Dofurs pet parents. You&apos;ll receive daily photo and video updates throughout the stay, so you can travel knowing your furry family member is thriving.
      </p>

      {/* Pricing */}
      <h2>Boarding Package — ₹999 per night</h2>
      <div className="not-prose overflow-hidden rounded-2xl border border-[#e7c4a7] bg-[linear-gradient(140deg,#fff8f0,#fffdf9)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200">
            Safe Stay
          </span>
          <span className="text-2xl font-bold text-neutral-950">₹999</span>
          <span className="text-sm text-neutral-500">per night</span>
        </div>
        <p className="text-sm text-neutral-600">All-inclusive stay. Ask about multi-night discounts.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="mt-0.5 text-xl">{item.icon}</span>
              <div>
                <p className="text-[13px] font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-0.5 text-[12px] text-neutral-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-[#f0d9c4] pt-4">
          <Link
            href={bookingHref}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-6 text-sm font-semibold text-white transition hover:brightness-105"
          >
            Book a Stay
          </Link>
        </div>
      </div>

      {/* Safety standards */}
      <h2>Our Safety Standards</h2>
      <p>
        We take pet safety seriously. Every boarding placement goes through a multi-step verification process to ensure your pet is in a genuinely safe, caring environment.
      </p>
      <div className="not-prose grid gap-3 sm:grid-cols-2">
        {SAFETY.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="mt-0.5 text-coral">✓</span>
            <div>
              <p className="text-[14px] font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[13px] text-neutral-600">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <h2>How to Book</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-3">
        {[
          { step: '1', title: 'Share Your Dates', desc: 'Tell us when you\'re travelling and your pet\'s breed, size, and any special requirements.' },
          { step: '2', title: 'We Match You', desc: 'We\'ll suggest verified boarding hosts near you with the best fit for your pet.' },
          { step: '3', title: 'Drop Off & Travel', desc: 'Drop your pet with the host — and travel with full peace of mind.' },
        ].map((s) => (
          <div key={s.step} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 text-center">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700 border border-teal-200">
              {s.step}
            </div>
            <p className="text-[13px] font-semibold text-neutral-900">{s.title}</p>
            <p className="mt-1 text-[12px] text-neutral-600">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Ideal for */}
      <h2>Ideal For</h2>
      <ul>
        <li>Business trips and vacations where pets cannot come along</li>
        <li>Pets who get anxious in kennels or traditional boarding facilities</li>
        <li>Owners who want a home-like environment with a personal caregiver</li>
        <li>Short-term stays — even a single overnight</li>
        <li>Pets with special dietary or medical routines that need careful handling</li>
      </ul>

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
            name: 'Pet Boarding',
            provider: { '@type': 'LocalBusiness', name: 'Dofurs', url: 'https://dofurs.in', areaServed: 'Bangalore' },
            description: 'Safe overnight pet boarding in Bangalore with verified caregivers. Home-like environment, daily updates, and complete care.',
            offers: [{ '@type': 'Offer', name: 'Pet Boarding Stay', price: '999', priceCurrency: 'INR', unitCode: 'DAY' }],
            areaServed: 'Bangalore',
          }),
        }}
      />
    </ContentPageLayout>
  );
}
