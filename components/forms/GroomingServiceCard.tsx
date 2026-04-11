'use client';

import { motion } from 'framer-motion';
import PremiumCard from '@/components/PremiumCard';

export type GroomingService = {
  title: string;
  price: string | number;
  features: string[];
  badge?: string;
  badgeVariant?: 'popular' | 'best-value' | 'premium' | 'deal' | 'special' | 'coming-soon';
  highlighted?: boolean;
};

function CheckIcon() {
  return (
    <svg
      className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#c7773b]"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatPrice(price: string | number): string {
  if (typeof price === 'string') {
    return price.replace(/(\d{3,})/, (m) => `₹${Number(m).toLocaleString('en-IN')}`);
  }
  return `₹${price.toLocaleString('en-IN')}`;
}

const badgeStyles: Record<NonNullable<GroomingService['badgeVariant']>, string> = {
  popular: 'bg-[#fff4e6] text-[#c7773b] border border-[#f0c89a]',
  'best-value':
    'bg-[linear-gradient(115deg,#de9158,#c7773b)] text-white shadow-[0_2px_8px_rgba(199,119,59,0.4)]',
  premium: 'bg-neutral-900 text-white',
  deal: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  special: 'bg-purple-50 text-purple-700 border border-purple-200',
  'coming-soon': 'bg-rose-50 text-rose-700 border border-rose-200',
};

interface GroomingServiceCardProps {
  service: GroomingService;
  index: number;
  onBookNow?: (title: string) => void;
}

export default function GroomingServiceCard({ service, index }: GroomingServiceCardProps) {
  const { title, price, features, badge, badgeVariant = 'popular' } = service;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full"
    >
      <PremiumCard
        className="flex h-full flex-col rounded-2xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f4_100%)] p-4 shadow-[0_4px_16px_rgba(79,47,25,0.06)]"
      >
      <div className="mb-3 flex h-[22px] items-center">
        {badge && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${badgeStyles[badgeVariant]}`}
          >
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


      </PremiumCard>
    </motion.div>
  );
}
