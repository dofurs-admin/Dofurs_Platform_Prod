'use client';

import type { Dispatch, SetStateAction } from 'react';

export type EnquiryDraft = {
  name: string;
  phone: string;
  email: string;
  area: string;
  petInfo: string;
  message: string;
  company: string; // honeypot
};

export const EMPTY_DRAFT: EnquiryDraft = {
  name: '',
  phone: '',
  email: '',
  area: '',
  petInfo: '',
  message: '',
  company: '',
};

export function EnquiryFields({
  draft,
  setDraft,
}: {
  draft: EnquiryDraft;
  setDraft: Dispatch<SetStateAction<EnquiryDraft>>;
}) {
  const fieldClass =
    'h-11 rounded-xl border border-[#e8d5c4] bg-white px-4 text-sm text-ink outline-none focus:border-coral';

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <input
        aria-label="Your name"
        placeholder="Your name"
        value={draft.name}
        onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
        className={fieldClass}
      />
      <input
        aria-label="Mobile number"
        placeholder="Mobile number"
        inputMode="tel"
        value={draft.phone}
        onChange={(event) => setDraft((d) => ({ ...d, phone: event.target.value }))}
        className={fieldClass}
      />
      <input
        aria-label="Email (optional)"
        placeholder="Email (optional)"
        inputMode="email"
        value={draft.email}
        onChange={(event) => setDraft((d) => ({ ...d, email: event.target.value }))}
        className={fieldClass}
      />
      <input
        aria-label="Area in Bengaluru (optional)"
        placeholder="Area in Bengaluru (optional)"
        value={draft.area}
        onChange={(event) => setDraft((d) => ({ ...d, area: event.target.value }))}
        className={fieldClass}
      />
      <input
        aria-label="Your pet (optional)"
        placeholder="Your pet — e.g. Labrador, 3 years"
        value={draft.petInfo}
        onChange={(event) => setDraft((d) => ({ ...d, petInfo: event.target.value }))}
        className={`${fieldClass} sm:col-span-2`}
      />
      <textarea
        aria-label="Message (optional)"
        placeholder="Anything else we should know? (optional)"
        value={draft.message}
        onChange={(event) => setDraft((d) => ({ ...d, message: event.target.value }))}
        rows={3}
        className="rounded-xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm text-ink outline-none focus:border-coral sm:col-span-2"
      />
      {/* Honeypot — hidden from humans, catches bots */}
      <input
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        value={draft.company}
        onChange={(event) => setDraft((d) => ({ ...d, company: event.target.value }))}
        className="hidden"
      />
    </div>
  );
}
