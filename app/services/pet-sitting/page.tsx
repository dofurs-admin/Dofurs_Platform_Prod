import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'In-Home Pet Sitting in Bangalore — Trusted Daily Care | Dofurs',
  description:
    'Reliable in-home pet sitting in Bangalore from verified, background-checked sitters. Your pet gets personalised care in their own home while you travel or work. Coming soon to Dofurs.',
  openGraph: {
    title: 'Pet Sitting in Bangalore | Dofurs',
    description:
      'Trusted in-home pet sitting in Bangalore. Verified sitters who provide personalised daily care, feeding, walks, and companionship for your pet.',
    type: 'website',
    url: 'https://dofurs.in/services/pet-sitting',
  },
  keywords: [
    'pet sitting Bangalore',
    'dog sitter Bangalore',
    'cat sitter Bangalore',
    'in-home pet care Bangalore',
    'pet caretaker Bangalore',
    'daily dog care Bangalore',
  ],
  alternates: { canonical: 'https://dofurs.in/services/pet-sitting' },
};

const WHAT_IS_INCLUDED = [
  { icon: '🍽️', title: 'Feeding & Fresh Water', desc: 'Meals and water refills on your pet\'s regular schedule, exactly as you instruct.' },
  { icon: '🚶', title: 'Daily Walks', desc: 'Regular outdoor walks to keep your pet active, socialised, and mentally stimulated.' },
  { icon: '🎾', title: 'Playtime & Engagement', desc: 'Interactive play sessions tailored to your pet\'s energy level and preferences.' },
  { icon: '🛋️', title: 'Companionship', desc: 'Your pet is never left alone for too long — consistent company throughout the day.' },
  { icon: '📱', title: 'Regular Updates', desc: 'Photo and message updates so you know how your pet is doing throughout the day.' },
  { icon: '🏠', title: 'Home Environment', desc: 'Your pet stays in their own home — familiar smells, sounds, and surroundings.' },
];

export default function PetSittingPage() {
  const notifyCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');

  return (
    <ContentPageLayout
      title="Trusted In-Home Pet Sitting"
      description="Reliable, verified pet sitters who care for your pet in the comfort of their own home — feeding, walks, play, and companionship while you travel or work."
      heroImageSrc="/services/pet-sitting-hero.png"
      heroImageAlt="A caring pet sitter playing with a happy dog at home in Bangalore"
      heroImageObjectPosition="center"
      belowContent={
        <FadeInSection>
          <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Be the first to know</p>
            <h3 className="mt-2 text-xl font-bold text-neutral-950">Pet Sitting Is Coming Soon</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              We&apos;re building a network of verified pet sitters across Bangalore. Message us on WhatsApp to get notified when this service launches near you.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <a href={whatsappLinks.support} target="_blank" rel="noopener noreferrer" className={notifyCtaClass}>
                Notify Me on WhatsApp
              </a>
              <Link
                href="/services"
                className="inline-flex h-11 items-center rounded-full border border-[#e3c7ad] bg-white px-6 text-sm font-semibold text-[#6e4123] transition hover:border-[#d6af8b]"
              >
                View Available Services
              </Link>
            </div>
          </div>
        </FadeInSection>
      }
    >
      {/* Coming soon */}
      <div className="not-prose mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="text-lg">⏳</span>
        <div>
          <p className="text-[13px] font-semibold text-amber-800">Coming Soon</p>
          <p className="text-[12px] text-amber-700">We&apos;re onboarding verified pet sitters across Bangalore. This service will be live shortly.</p>
        </div>
      </div>

      <h2>Your Pet, Cared for at Home</h2>
      <p>
        Leaving home doesn&apos;t have to mean disrupting your pet&apos;s routine. Dofurs pet sitters come directly to your home, keeping your pet in their familiar environment — with the same food, the same schedule, and the same comfort they&apos;re used to.
      </p>
      <p>
        Unlike kennels or boarding, in-home pet sitting means zero travel stress for your pet. They stay in their territory, surrounded by familiar scents, and receive one-on-one attention from a caring, verified sitter.
      </p>

      {/* What's included */}
      <h2>What&apos;s Included</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WHAT_IS_INCLUDED.map((item) => (
          <div key={item.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="text-2xl">{item.icon}</span>
            <p className="mt-2 text-[14px] font-semibold text-neutral-900">{item.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Who it's for */}
      <h2>Who Pet Sitting Is For</h2>
      <ul>
        <li>Pet owners travelling for work or holidays</li>
        <li>Long work hours requiring midday visits and walks</li>
        <li>Elderly or mobility-limited owners who need regular help</li>
        <li>New pet owners building confidence in their pet&apos;s routine</li>
        <li>Pets who are anxious in unfamiliar environments (boarding or kennels)</li>
      </ul>

      {/* Our standards */}
      <h2>How We Vet Our Sitters</h2>
      <p>
        Every Dofurs pet sitter undergoes a thorough verification process before being matched with pet families:
      </p>
      <ul>
        <li>Government ID verification and background check</li>
        <li>Pet first aid and handling training</li>
        <li>Reference checks from previous pet-care experience</li>
        <li>A detailed onboarding assessment</li>
        <li>Ongoing reviews from pet parents after each assignment</li>
      </ul>

      {/* While you wait */}
      <h2>Available Now</h2>
      <p>Pet sitting is on its way — meanwhile, explore what Dofurs already offers in Bangalore:</p>
      <div className="not-prose grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Pet Grooming', href: '/services/grooming', desc: 'Doorstep grooming from ₹899' },
          { label: 'Pet Birthday', href: '/services/pet-birthday', desc: 'Birthday packages from ₹1,999' },
          { label: 'Pet Boarding', href: '/services/pet-boarding', desc: 'Safe boarding from ₹999/night' },
        ].map((s) => (
          <Link key={s.href} href={s.href} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 transition hover:border-coral/30 hover:shadow-sm">
            <p className="text-[14px] font-semibold text-coral">{s.label}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{s.desc}</p>
          </Link>
        ))}
      </div>

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Pet Sitting',
            provider: { '@type': 'LocalBusiness', name: 'Dofurs', url: 'https://dofurs.in', areaServed: 'Bangalore' },
            description: 'In-home pet sitting in Bangalore by verified, background-checked sitters. Feeding, walks, play, and companionship.',
            areaServed: 'Bangalore',
          }),
        }}
      />
    </ContentPageLayout>
  );
}
