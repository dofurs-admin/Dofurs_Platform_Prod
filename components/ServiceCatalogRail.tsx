'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import PremiumCard from '@/components/PremiumCard';

type GroomingPackage = {
  title: string;
  price: string | number;
  features: string[];
  badge?: string;
  badgeVariant?: 'popular' | 'best-value' | 'premium' | 'deal' | 'special' | 'coming-soon';
};

const PACKAGES: GroomingPackage[] = [
  {
    title: 'Doorstep Pet Grooming',
    price: 'Starts from 899',
    features: ['Nail Trimming', 'Paw Hair Trimming', 'Knot Removal & De-shedding', 'Eye & Ear Cleaning'],
    badge: 'Popular',
    badgeVariant: 'popular',
  },
  {
    title: 'Summer Bonanza',
    price: 1199,
    features: ['Bathing, Drying & Conditioning', 'Shampoo & Conditioner', 'Brushing & De-shedding', 'De-matting', 'Nail Clipping & Paw Cleaning'],
    badge: 'Great Deal',
    badgeVariant: 'deal',
  },
  {
    title: 'Essential Grooming',
    price: 1799,
    features: ['Bathing, Drying & Conditioning', 'Nail Clipping', 'Paw Hair Cleaning', 'Sanitary Cleaning', 'Brushing & De-shedding', 'De-matting', 'Paw Massage', 'Eye Cleaning', 'Standard Haircut'],
    badge: 'Best Value',
    badgeVariant: 'best-value',
  },
  {
    title: 'Complete Care',
    price: 2299,
    features: ['Bathing, Drying & Conditioning', 'Nail Clipping & Grinding', 'Paw Care & Massage', 'Sanitary Cleaning', 'Brushing & De-shedding', 'De-matting', 'Custom Haircut', 'Face Styling', 'Eye, Ear & Nose Cleaning'],
    badge: 'Premium',
    badgeVariant: 'premium',
  },
  {
    title: 'Pet Birthday Package',
    price: 1999,
    features: ['Custom Party Setup', 'Treats & Decorations', 'Photoshoots'],
    badge: 'Special',
    badgeVariant: 'special',
  },
  {
    title: 'Pet Boarding',
    price: 999,
    features: ['Safe Stay', 'Comfortable Environment', 'Stress-Free Care'],
    badge: 'COMMING SOON',
    badgeVariant: 'coming-soon',
  },
];

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
  const { title, price, features, badge, badgeVariant = 'popular' } = pkg;

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

        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-[18px] font-bold leading-none tracking-tight text-neutral-950">
            {formatPrice(price)}
          </span>
          {typeof price === 'number' && (
            <span className="text-[10px] text-[#9a7258]">/ session</span>
          )}
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

        <Link
          href="/forms/customer-booking#start-your-booking"
          className="mt-4 block w-full rounded-full border border-[#e0c4a8] bg-white px-3 py-1.5 text-center text-[12px] font-semibold text-[#7c5335] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c7773b] hover:bg-[#fffaf5] hover:text-[#c7773b] focus:outline-none"
        >
          Book Now
        </Link>
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
        <div className="flex items-stretch gap-4 px-1 pb-1">
          {PACKAGES.map((pkg) => (
            <PackageCard key={pkg.title} pkg={pkg} />
          ))}
        </div>
      </div>
    </div>
  );
}
