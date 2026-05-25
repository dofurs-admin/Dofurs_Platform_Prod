import type { ReactNode } from 'react';
import PremiumCard from '@/components/PremiumCard';

type SubscriptionPlanCardProps = {
  badge: string;
  durationLabel: string;
  title: string;
  priceLabel: string;
  originalPriceLabel?: string;
  dealLabel?: string;
  descriptionLabel?: string;
  includedSummary: string;
  worthLabel: string;
  serviceType: string;
  bonusLabel?: string;
  footerLabel?: string;
  highlight?: boolean;
  cta: ReactNode;
};

export default function SubscriptionPlanCard({
  badge,
  durationLabel,
  title,
  priceLabel,
  originalPriceLabel,
  dealLabel = 'for plan period',
  descriptionLabel,
  includedSummary,
  worthLabel,
  serviceType,
  bonusLabel,
  footerLabel = 'Flexible booking',
  highlight = false,
  cta,
}: SubscriptionPlanCardProps) {
  return (
    <PremiumCard
      as="article"
      className={`group flex h-full flex-col rounded-[18px] border border-[#e7c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.08)_52%,rgba(255,250,244,0.05)_100%)] p-3 shadow-gloss-premium backdrop-blur-[2px] sm:p-3.5 ${highlight ? 'border-[#d48950] shadow-premium' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <p className="whitespace-nowrap rounded-full border border-[#f0d8c0] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8f552a]">
          {badge}
        </p>
        <p className="whitespace-nowrap rounded-full border border-[#ead6c2] bg-white/84 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#7a5a45]">
          {durationLabel}
        </p>
      </div>

      <h4 className="mt-2.5 text-[16px] font-semibold leading-snug text-[#3a2c22]">{title}</h4>
      {descriptionLabel ? (
        <p className="mt-1 text-[12px] leading-snug text-[#6f594a]">{descriptionLabel}</p>
      ) : null}

      <div className="mt-2 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8b6c56]">
          Original value{' '}
          <span className="text-[#9f7b64] line-through decoration-[#b56b37] decoration-2">
            {originalPriceLabel ?? worthLabel}
          </span>
        </p>
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <p className="text-[22px] font-bold leading-none tracking-tight text-[#2d221a]">{priceLabel}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8b6c56]">{dealLabel}</p>
        </div>
      </div>

      <div className="mt-2.5 rounded-xl border border-[#f0dfcf] bg-[#fff8f1] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b6c56]">Included</p>
        <p className="mt-1 text-[13px] font-semibold text-[#4a392d]">{includedSummary}</p>
        <p className="mt-1 text-[11px] text-[#6f594a]">Credit value added after purchase.</p>
        <p className="mt-1 text-[11px] text-[#6f594a]">Use for eligible grooming bookings.</p>
        {bonusLabel ? (
          <p className="mt-1 rounded-lg border border-[#ead2b9] bg-white/72 px-2 py-1 text-[11px] font-semibold text-[#8f552a]">
            {bonusLabel}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-1 rounded-xl border border-[#f0dfcf] bg-white/82 px-3 py-2 text-[11px] font-semibold text-[#5d4739]">
        <span>{serviceType}</span>
        <span>{footerLabel}</span>
      </div>

      {cta ? <div className="mt-3">{cta}</div> : null}
    </PremiumCard>
  );
}
