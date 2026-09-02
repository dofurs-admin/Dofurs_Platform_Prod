'use client';

import { useState } from 'react';
import { EnquiryFields, type EnquiryDraft, EMPTY_DRAFT } from './enquiry-fields';

// Public website enquiry form (contact page) → POST /api/crm/enquiry.
// Submission creates a CRM lead (source = website_enquiry) with staff
// auto-assignment. Includes a honeypot field for basic bot filtering.

export default function EnquiryForm() {
  const [draft, setDraft] = useState<EnquiryDraft>(EMPTY_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    const email = draft.email.trim().toLowerCase();

    if (name.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email or leave it empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          area: draft.area.trim() || undefined,
          petInfo: draft.petInfo.trim() || undefined,
          message: draft.message.trim() || undefined,
          company: draft.company,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Please try again in a moment.');
      }

      setIsSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-5 shadow-soft-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Enquiry received</p>
        <p className="mt-1 text-[15px] font-semibold text-ink">Thanks! Our team will reach out to you shortly.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-5 shadow-soft-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Enquiry form</p>
      <h2 className="mt-1 text-xl font-bold text-ink">Tell us what you need</h2>
      <p className="mt-1 text-[13px] leading-6 text-[#4a4a4a]">
        Share your details and our team will call you back with grooming options for your pet.
      </p>
      <EnquiryFields draft={draft} setDraft={setDraft} />
      {error ? <p className="mt-3 text-xs font-semibold text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={isSubmitting}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-coral px-7 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting ? 'Sending…' : 'Request a call back'}
      </button>
    </div>
  );
}
