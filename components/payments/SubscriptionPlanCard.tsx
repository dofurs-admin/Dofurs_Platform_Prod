import type { ReactNode } from 'react';
import PremiumCard from '@/components/PremiumCard';

type SubscriptionPlanCardProps = {
  badge: string;
  durationLabel: string;
  title: string;
  priceLabel: string;
  includedSummary: string;
  worthLabel: string;
  serviceType: string;
  cta: ReactNode;
};

export default function SubscriptionPlanCard({
  badge,
  durationLabel,
  title,
  priceLabel,
  includedSummary,
  worthLabel,
  serviceType,
  cta,
}: SubscriptionPlanCardProps) {
  return (
    <PremiumCard
      as="article"
      className="group flex h-full flex-col rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.08)_52%,rgba(255,250,244,0.05)_100%)] p-4 shadow-gloss-premium backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-nowrap rounded-full border border-[#f0d8c0] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8f552a]">
          {badge}
        </p>
        <p className="whitespace-nowrap rounded-full border border-[#ead6c2] bg-white/84 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#7a5a45]">
          {durationLabel}
        </p>
      </div>

      <h4 className="mt-2.5 text-[17px] font-semibold leading-snug text-[#3a2c22]">{title}</h4>

      <div className="mt-2 flex items-end gap-2">
        <p className="text-[23px] font-bold leading-none tracking-tight text-[#2d221a]">{priceLabel}</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8b6c56]">for plan period</p>
      </div>

      <div className="mt-2.5 rounded-xl border border-[#f0dfcf] bg-[#fff8f1] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b6c56]">Included</p>
        <p className="mt-1 text-[13px] font-semibold text-[#4a392d]">{includedSummary}</p>
        <p className="mt-1 text-[11px] text-[#6f594a]">Service value worth {worthLabel}</p>
        <p className="mt-1 text-[11px] text-[#6f594a]">Subscription credits can be used across all grooming service types.</p>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-[#f0dfcf] bg-white/82 px-3 py-2 text-[11px] font-semibold text-[#5d4739]">
        <span>{serviceType}</span>
        <span>Priority slots</span>
      </div>

      <div className="mt-3">{cta}</div>
    </PremiumCard>
  );
}
