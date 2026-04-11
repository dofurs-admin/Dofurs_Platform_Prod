'use client';

import { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  highlight?: boolean;
}

export default function SectionCard({
  title,
  description,
  children,
  highlight = false,
}: SectionCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-6 sm:p-8 shadow-[0_16px_30px_rgba(147,101,63,0.12)] transition-all duration-300 ${
        highlight ? 'border-brand-400/60 ring-2 ring-brand-400/20' : 'border-[#ead3bf]'
      }`}
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-950">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-neutral-600">{description}</p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
