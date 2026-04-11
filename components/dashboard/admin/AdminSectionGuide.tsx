'use client';

import { useState } from 'react';

export type GuideStep = {
  title: string;
  description: string;
};

type AdminSectionGuideProps = {
  title: string;
  subtitle: string;
  steps: GuideStep[];
  defaultOpen?: boolean;
};

export default function AdminSectionGuide({
  title,
  subtitle,
  steps,
  defaultOpen = false,
}: AdminSectionGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/80 via-white to-brand-50/40 p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coral/10 text-lg">📖</span>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            <p className="text-sm text-neutral-600">{subtitle}</p>
          </div>
        </div>
        <span className="text-sm font-medium text-coral">{open ? 'Hide guide ▲' : 'Show guide ▼'}</span>
      </button>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={index} className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-coral/10 text-xs font-bold text-coral">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold text-neutral-900">{step.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">{step.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
