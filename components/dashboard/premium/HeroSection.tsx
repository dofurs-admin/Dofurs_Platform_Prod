'use client';

import Link from 'next/link';

interface HeroSectionProps {
  greeting: string;
  message: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
}

export default function HeroSection({
  greeting,
  message,
  primaryCta,
  secondaryCta,
}: HeroSectionProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-gradient-to-br from-white via-orange-50/30 to-white p-8 sm:p-10 shadow-sm">
      {/* Subtle background decoration */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-orange-200/20 to-orange-400/10 blur-3xl" />
      <div className="absolute -left-32 -bottom-32 h-80 w-80 rounded-full bg-gradient-to-tr from-orange-100/20 to-transparent blur-3xl" />

      {/* Content */}
      <div className="relative z-10">
        {/* Greeting */}
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-950 leading-tight">
          {greeting}
        </h1>

        {/* Message */}
        <p className="mt-3 text-base sm:text-lg text-neutral-600 max-w-2xl">
          {message}
        </p>

        {/* Action Buttons */}
        {(primaryCta || secondaryCta) && (
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            {primaryCta && (
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-400 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-150 ease-out hover:shadow-md hover:-translate-y-0.5"
              >
                {primaryCta.label}
              </Link>
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-all duration-150 ease-out hover:bg-neutral-50 hover:-translate-y-0.5"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
