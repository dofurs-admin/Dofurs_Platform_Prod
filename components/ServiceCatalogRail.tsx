'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import PremiumCard from '@/components/PremiumCard';
import { GROOMING_PACKAGES } from '@/lib/service-catalog/grooming-packages';

type GroomingPackage = {
  title: string;
  price: string | number;
  mrp?: number;
  features: string[];
  badge?: string;
  badgeVariant?: 'popular' | 'best-value' | 'premium' | 'deal' | 'special' | 'coming-soon';
  isBookable?: boolean;
};

const PACKAGES: GroomingPackage[] = GROOMING_PACKAGES;

const badgeStyles: Record<NonNullable<GroomingPackage['badgeVariant']>, string> = {
  popular: 'bg-[#fff4e6] text-[#c7773b] border border-[#f0c89a]',
  'best-value': 'bg-[linear-gradient(115deg,#de9158,#c7773b)] text-white shadow-[0_2px_8px_rgba(199,119,59,0.4)]',
  premium: 'bg-neutral-900 text-white',
  deal: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  special: 'bg-purple-50 text-purple-700 border border-purple-200',
  'coming-soon': 'bg-rose-50 text-rose-700 border border-rose-200',
};

function formatPrice(price: string | number): string {
  if (typeof price === 'string') {
    return price.replace(/(\d{3,})/, (m) => `₹${Number(m).toLocaleString('en-IN')}`);
  }
  return `₹${price.toLocaleString('en-IN')}`;
}

function CheckIcon() {
  return (
    <svg className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#c7773b]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd" />
    </svg>
  );
}

function PackageCard({ pkg }: { pkg: GroomingPackage }) {
  const { title, price, mrp, features, badge, badgeVariant = 'popular', isBookable = true } = pkg;

  return (
    <div className="w-[210px] shrink-0 self-stretch">
      <PremiumCard className="flex h-full w-full flex-col rounded-2xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f4_100%)] p-4 shadow-[0_4px_16px_rgba(79,47,25,0.06)]">
        {/* Fixed-height badge row so all card titles sit at the same vertical position */}
        <div className="mb-3 flex h-[22px] items-center">
          {badge && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${badgeStyles[badgeVariant]}`}>
              {badge}
            </span>
          )}
        </div>

        <h3 className="text-[13px] font-semibold leading-snug text-neutral-950">{title}</h3>

        <div className="mt-1.5 space-y-1">
          {mrp ? (
            <p className="text-[10px] font-medium leading-none text-[#9a7258]">
              MRP <span className="line-through decoration-[#b78258]/70 decoration-1">{formatPrice(mrp)}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {mrp ? <span className="text-[10px] font-semibold uppercase text-[#c7773b]">Now</span> : null}
            <span className="text-[18px] font-bold leading-none text-neutral-950">
              {formatPrice(price)}
            </span>
            {typeof price === 'number' && (
              <span className="text-[10px] text-[#9a7258]">/ session</span>
            )}
          </div>
        </div>

        <div className="my-2.5 border-t border-[#f0e4d6]" />

        <ul className="flex-1 space-y-1.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-1.5">
              <CheckIcon />
              <span className="text-[11px] leading-snug text-[#5c3d22]">{feature}</span>
            </li>
          ))}
        </ul>

        {isBookable ? (
          <Link
            href="/forms/customer-booking#start-your-booking"
            className="mt-4 block w-full rounded-full border border-[#e0c4a8] bg-white px-3 py-1.5 text-center text-[12px] font-semibold text-[#7c5335] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c7773b] hover:bg-[#fffaf5] hover:text-[#c7773b] focus:outline-none"
          >
            Book Now
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="mt-4 block w-full cursor-not-allowed rounded-full border border-[#ead8c8] bg-[#fbf4ee] px-3 py-1.5 text-center text-[12px] font-semibold text-[#aa8b72]"
          >
            Coming Soon
          </button>
        )}
      </PremiumCard>
    </div>
  );
}

// Props kept for API compatibility but ignored — content is the grooming catalog.
export default function ServiceCatalogRail() {
  const railRef = useRef<HTMLDivElement>(null);

  function scrollByStep(direction: 'left' | 'right') {
    railRef.current?.scrollBy({ left: direction === 'right' ? 226 : -226, behavior: 'smooth' });
  }

  return (
    // Outer wrapper: position:relative so the fade overlays anchor here,
    // NOT inside the scroll container (which caused them to scroll with the content).
    <div className="relative mt-7 rounded-[22px] border border-[#ead5c0] bg-white/62 p-2.5 sm:p-3">

      {/* Fade overlays anchored to the wrapper, never scroll */}
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12 rounded-l-[22px] bg-gradient-to-r from-[rgba(255,250,243,0.96)] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-12 rounded-r-[22px] bg-gradient-to-l from-[rgba(255,250,243,0.96)] to-transparent" />

      {/* Header row */}
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#8b6c56]">
          Drag to explore
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByStep('left')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e6ccb4] bg-white/85 text-[#7b5d47] transition hover:border-coral/50 hover:text-[#5f3a21]"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByStep('right')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e6ccb4] bg-white/85 text-[#7b5d47] transition hover:border-coral/50 hover:text-[#5f3a21]"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scroll container — no position:relative, no ::before/::after CSS classes */}
      <div
        ref={railRef}
        className="overflow-x-auto pb-4 pt-4 touch-manipulation [scrollbar-width:thin] [scrollbar-color:#d8b79a_transparent] [-webkit-overflow-scrolling:touch]"
      >
        <div className="flex w-max min-w-full items-stretch justify-center gap-4 px-1 pb-1">
          {PACKAGES.map((pkg) => (
            <PackageCard key={pkg.title} pkg={pkg} />
          ))}
        </div>
      </div>
    </div>
  );
}
