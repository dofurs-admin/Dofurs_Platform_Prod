'use client';

import { useState } from 'react';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import ServiceProviderApplicationForm from '@/components/forms/ServiceProviderApplicationForm';
import { ArrowRight, Building2, ShieldCheck, UserRound } from 'lucide-react';

export default function ProviderApplicationFormPage() {
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const revealApplicationForm = () => {
    setShowApplicationForm(true);

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('provider-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 20);
    }
  };

  return (
    <ContentPageLayout
      title="Scale Your Pet Care Brand With Dofurs"
      description="A premium partner network for independent professionals, clinics, and grooming centers ready to grow with curated demand and modern operations."
      heroImageSrc="/Birthday/partners-with-dofurs.png"
      heroImageAlt="Partner with Dofurs"
    >
      <div className="relative overflow-hidden rounded-3xl border border-[#e0bea3] bg-[linear-gradient(140deg,#fff1df_0%,#fffdf9_42%,#ffe8ce_100%)] p-6 text-ink shadow-[0_24px_56px_rgba(137,93,56,0.2)] md:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.72),rgba(255,255,255,0))]" aria-hidden="true" />
        <div className="absolute -left-16 -top-14 h-44 w-44 rounded-full bg-[#f2c49e]/45 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-[#c58d5c]/25 blur-3xl" aria-hidden="true" />

        <div className="relative z-[2] space-y-4">
          <p className="inline-flex rounded-full border border-[#dcb998] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8f653d]">
            Dofurs Partner Network
          </p>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-ink md:text-4xl">
            Independent Professional or Pet Care Business — Grow With Dofurs
          </h2>
          <p className="max-w-2xl text-sm text-[#5f5f5f] md:text-base">
            Whether you&apos;re a freelance groomer, vet, or trainer — or run a clinic, salon, or boarding center — we equip you with visibility, booking momentum, and long-term brand trust.
          </p>
          <button
            type="button"
            onClick={revealApplicationForm}
            className="inline-flex items-center justify-center rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2"
          >
            Start Your Application
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="group rounded-2xl border border-[#ecd5c2] bg-gradient-to-b from-white to-[#fff9f2] p-6 shadow-premium transition-all duration-200 hover:-translate-y-1 hover:shadow-premium-lg">
          <UserRound className="h-7 w-7 text-neutral-900 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">For Independents</h3>
          <p className="mt-2 text-sm text-[#626262]">Freelance groomers, vets, trainers, and sitters get a steady stream of verified pet parent requests.</p>
        </div>
        <div className="group rounded-2xl border border-[#ecd5c2] bg-gradient-to-b from-white to-[#fff9f2] p-6 shadow-premium transition-all duration-200 hover:-translate-y-1 hover:shadow-premium-lg">
          <Building2 className="h-7 w-7 text-neutral-900 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">For Clinics & Centers</h3>
          <p className="mt-2 text-sm text-[#626262]">List your clinic, grooming salon, or boarding center — manage staff, services, and bookings from one dashboard.</p>
        </div>
        <div className="group rounded-2xl border border-[#ecd5c2] bg-gradient-to-b from-white to-[#fff9f2] p-6 shadow-premium transition-all duration-200 hover:-translate-y-1 hover:shadow-premium-lg">
          <ShieldCheck className="h-7 w-7 text-neutral-900 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">Trust & Visibility</h3>
          <p className="mt-2 text-sm text-[#626262]">Get a verified profile, premium brand placement, and reviews that build long-term credibility.</p>
        </div>
      </div>

      <FadeInSection delay={0.08}>
        <div id="provider-form" className="space-y-4">
          {showApplicationForm ? <ServiceProviderApplicationForm /> : null}
        </div>
      </FadeInSection>
    </ContentPageLayout>
  );
}
