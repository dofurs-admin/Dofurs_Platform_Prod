import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Dog Training in Bangalore — Positive Reinforcement | Dofurs',
  description:
    'Professional dog training in Bangalore using positive reinforcement techniques. Obedience, behaviour correction, puppy training, and agility from certified trainers. Coming soon to Dofurs.',
  openGraph: {
    title: 'Dog Training in Bangalore | Dofurs',
    description:
      'Certified dog trainers in Bangalore using positive reinforcement. Obedience, puppy training, behaviour correction, and agility — at home or in group sessions.',
    type: 'website',
    url: 'https://dofurs.in/services/training',
  },
  keywords: [
    'dog training Bangalore',
    'puppy training Bangalore',
    'dog obedience training Bangalore',
    'dog trainer at home Bangalore',
    'positive reinforcement dog training Bangalore',
    'dog behaviour correction Bangalore',
  ],
  alternates: { canonical: 'https://dofurs.in/services/training' },
};

const TRAINING_TYPES = [
  {
    icon: '🐶',
    title: 'Puppy Foundation',
    desc: 'Start right — basic commands, socialisation, bite inhibition, and house training for puppies aged 8 weeks to 6 months.',
  },
  {
    icon: '🎯',
    title: 'Basic Obedience',
    desc: 'Sit, stay, come, heel, and leave it. The core commands every dog should know for a safe and enjoyable relationship.',
  },
  {
    icon: '🧠',
    title: 'Behaviour Correction',
    desc: 'Address specific problem behaviours — excessive barking, aggression, leash pulling, separation anxiety, and more.',
  },
  {
    icon: '⚡',
    title: 'Advanced Training',
    desc: 'Off-leash reliability, complex commands, and advanced tricks for dogs who&apos;ve mastered the basics.',
  },
  {
    icon: '🏆',
    title: 'Agility & Sport',
    desc: 'Fun, physically engaging agility training — great for high-energy breeds and owners looking for an active hobby.',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Family & Kids',
    desc: 'Teaching dogs to interact safely and calmly with children — important for multi-child households.',
  },
];

const APPROACH = [
  {
    title: 'Positive Reinforcement Only',
    desc: 'We never use punishment, fear, or force. Every lesson is built on reward, encouragement, and clear communication.',
  },
  {
    title: 'Breed-Specific Techniques',
    desc: 'Different breeds respond to different approaches. Our trainers adapt their methods to suit your dog\'s temperament and instincts.',
  },
  {
    title: 'Owner Education',
    desc: 'We don\'t just train your dog — we train you. You\'ll leave every session knowing how to reinforce what was taught.',
  },
  {
    title: 'Progress Tracking',
    desc: 'Clear milestones and session notes so you can see measurable improvement over time.',
  },
];

export default function TrainingPage() {
  const notifyCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');

  return (
    <ContentPageLayout
      title="Professional Dog Training"
      description="Positive reinforcement training to build better behaviour, confidence, and a stronger bond between you and your dog — from certified trainers across Bangalore."
      heroImageSrc="/services/training-hero.png"
      heroImageAlt="A certified dog trainer working with a focused, happy dog in Bangalore"
      heroImageObjectPosition="center"
      belowContent={
        <FadeInSection>
          <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Be the first to know</p>
            <h3 className="mt-2 text-xl font-bold text-neutral-950">Dog Training Is Coming Soon</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              We&apos;re onboarding certified trainers across Bangalore. Message us on WhatsApp to get notified when training goes live in your area.
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
          <p className="text-[12px] text-amber-700">We&apos;re onboarding certified dog trainers across Bangalore. This service will be live shortly.</p>
        </div>
      </div>

      <h2>Training That Builds Trust</h2>
      <p>
        A well-trained dog is a happier, safer, and more confident dog. Dofurs is building a network of certified trainers across Bangalore who use exclusively positive reinforcement methods — no choke chains, no fear, no force.
      </p>
      <p>
        Whether you have a new puppy who needs to learn the basics, or a dog with specific behaviour challenges, our trainers will work with both you and your dog to create lasting change. Every session comes with clear progress notes and homework so you can continue building skills between visits.
      </p>

      {/* Training types */}
      <h2>Training Services We&apos;ll Offer</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRAINING_TYPES.map((item) => (
          <div key={item.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="text-2xl">{item.icon}</span>
            <p className="mt-2 text-[14px] font-semibold text-neutral-900">{item.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Our approach */}
      <h2>Our Training Philosophy</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-2">
        {APPROACH.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="mt-0.5 text-coral font-bold">✓</span>
            <div>
              <p className="text-[14px] font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[13px] text-neutral-600">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Trainer standards */}
      <h2>Our Trainer Standards</h2>
      <p>Only certified, experienced trainers join the Dofurs network:</p>
      <ul>
        <li>Certification from a recognised animal training institution</li>
        <li>Minimum 2 years of professional training experience</li>
        <li>Expertise in positive reinforcement and force-free methods</li>
        <li>Background verification and conduct checks</li>
        <li>Continuous performance reviews based on owner feedback</li>
      </ul>

      {/* Delivery formats */}
      <h2>How Training Will Be Delivered</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-3">
        {[
          { icon: '🏠', title: 'In-Home Sessions', desc: 'Training in your own space — ideal for behaviour issues that are environment-specific.' },
          { icon: '🏞️', title: 'Outdoor Sessions', desc: 'Park and outdoor training to build focus and reliability in distracting environments.' },
          { icon: '👥', title: 'Group Classes', desc: 'Socialisation and obedience in a structured group setting with other dogs.' },
        ].map((mode) => (
          <div key={mode.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 text-center">
            <span className="text-2xl">{mode.icon}</span>
            <p className="mt-2 text-[14px] font-semibold text-neutral-900">{mode.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{mode.desc}</p>
          </div>
        ))}
      </div>

      {/* While you wait */}
      <h2>Available Right Now</h2>
      <p>Dog training is on its way — meanwhile, explore what Dofurs already offers in Bangalore:</p>
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
            name: 'Dog Training',
            provider: { '@type': 'LocalBusiness', name: 'Dofurs', url: 'https://dofurs.in', areaServed: 'Bangalore' },
            description: 'Certified positive reinforcement dog training in Bangalore — puppy, obedience, behaviour correction, and agility.',
            areaServed: 'Bangalore',
          }),
        }}
      />
    </ContentPageLayout>
  );
}
