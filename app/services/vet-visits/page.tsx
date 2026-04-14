import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import { whatsappLinks } from '@/lib/site-data';
import { premiumPrimaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Vet Home Visits & Pet Health Consultations in Bangalore | Dofurs',
  description:
    'Book trusted vet home visits in Bangalore — wellness checkups, vaccinations, preventive care, and specialist consultations from verified veterinarians. Coming soon to Dofurs.',
  openGraph: {
    title: 'Vet Visits in Bangalore | Dofurs',
    description:
      'Trusted vet home visits in Bangalore for wellness checks, vaccinations, and preventive care. Coming soon from verified veterinary professionals.',
    type: 'website',
    url: 'https://dofurs.in/services/vet-visits',
  },
  keywords: [
    'vet home visit Bangalore',
    'dog vaccination Bangalore',
    'cat health checkup Bangalore',
    'veterinarian at home Bangalore',
    'pet health consultation Bangalore',
    'vet teleconsult Bangalore',
  ],
  alternates: { canonical: 'https://dofurs.in/services/vet-visits' },
};

const SERVICES_OFFERED = [
  { icon: '🩺', title: 'Wellness Checkups', desc: 'Routine health assessments to catch issues early and keep your pet in peak condition.' },
  { icon: '💉', title: 'Vaccinations', desc: 'Core and non-core vaccination schedules managed by a certified vet — at your home.' },
  { icon: '🔬', title: 'Diagnostic Support', desc: 'Basic health screenings and guidance on when further tests or specialist care is needed.' },
  { icon: '💊', title: 'Prescription & Medication', desc: 'Prescription-ready consultations with clear treatment plans and follow-up care.' },
  { icon: '📋', title: 'Health Plans', desc: 'Customised preventive health plans to keep your pet healthy year-round.' },
  { icon: '📱', title: 'Teleconsult', desc: 'Quick remote consultations for non-emergency questions, follow-ups, and second opinions.' },
];

export default function VetVisitsPage() {
  const notifyCtaClass = premiumPrimaryCtaClass('h-11 px-7 text-sm font-semibold tracking-[0.01em]');

  return (
    <ContentPageLayout
      title="Vet Visits & Health Consultations"
      description="Trusted veterinary care delivered to your home across Bangalore — wellness checks, vaccinations, preventive plans, and specialist consultations. Coming soon."
      heroImageSrc="/services/vet-visits-hero.png"
      heroImageAlt="A professional veterinarian conducting a health checkup on a dog in Bangalore"
      heroImageObjectPosition="center"
      belowContent={
        <FadeInSection>
          <div className="mt-8 rounded-2xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#fff8f0,#fffdf9)] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Stay in the loop</p>
            <h3 className="mt-2 text-xl font-bold text-neutral-950">Be the First to Know When We Launch</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              Vet visits are coming to Dofurs soon. Drop us a message on WhatsApp and we&apos;ll notify you the moment it&apos;s live in your area.
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
      {/* Coming soon banner */}
      <div className="not-prose mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="text-lg">⏳</span>
        <div>
          <p className="text-[13px] font-semibold text-amber-800">Coming Soon</p>
          <p className="text-[12px] text-amber-700">We&apos;re onboarding verified veterinarians across Bangalore. This service will be live shortly.</p>
        </div>
      </div>

      <h2>Expert Veterinary Care, at Your Door</h2>
      <p>
        Pet health shouldn&apos;t be complicated. Dofurs is building a network of verified, compassionate veterinarians who come directly to your home — removing the stress of clinic visits for anxious pets and busy owners alike.
      </p>
      <p>
        Whether it&apos;s a routine wellness check, an annual vaccination, or a specific health concern, our vets will provide thorough, transparent care at your convenience. All consultations are documented and followed up with a clear care plan.
      </p>

      {/* Services */}
      <h2>What Vet Visits Will Cover</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES_OFFERED.map((item) => (
          <div key={item.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4">
            <span className="text-2xl">{item.icon}</span>
            <p className="mt-2 text-[14px] font-semibold text-neutral-900">{item.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Service modes */}
      <h2>How We&apos;ll Deliver Vet Care</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-3">
        {[
          { icon: '🏠', title: 'At Home', desc: 'The vet comes to you. Ideal for anxious pets, elderly animals, or multi-pet households.' },
          { icon: '🏥', title: 'Partner Clinics', desc: 'For complex cases requiring equipment, we partner with trusted clinics across Bangalore.' },
          { icon: '📱', title: 'Teleconsult', desc: 'Quick online advice for follow-ups, minor concerns, and second opinions — from your phone.' },
        ].map((mode) => (
          <div key={mode.title} className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf6] p-4 text-center">
            <span className="text-2xl">{mode.icon}</span>
            <p className="mt-2 text-[14px] font-semibold text-neutral-900">{mode.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{mode.desc}</p>
          </div>
        ))}
      </div>

      {/* Standards */}
      <h2>Our Veterinary Standards</h2>
      <p>Every Dofurs vet partner must meet stringent standards before being listed:</p>
      <ul>
        <li>Valid veterinary licence from a recognised institution</li>
        <li>Minimum 3 years of clinical or practice experience</li>
        <li>Background and conduct verification</li>
        <li>Proficiency in calm, low-stress handling techniques</li>
        <li>Commitment to transparent communication with pet owners</li>
      </ul>

      {/* While you wait */}
      <h2>While You Wait — Available Now</h2>
      <p>
        Vet visits are coming soon, but Dofurs already offers professional grooming, pet birthday celebrations, and boarding services in Bangalore. Explore what&apos;s available today.
      </p>
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
            name: 'Veterinary Home Visits',
            provider: { '@type': 'LocalBusiness', name: 'Dofurs', url: 'https://dofurs.in', areaServed: 'Bangalore' },
            description: 'Trusted veterinary home visits and consultations in Bangalore — wellness checks, vaccinations, and preventive care. Coming soon.',
            areaServed: 'Bangalore',
          }),
        }}
      />
    </ContentPageLayout>
  );
}
