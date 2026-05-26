'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck2, CheckCircle2, Clock3, Sparkles } from 'lucide-react';
import PremiumCard from '@/components/PremiumCard';
import type { MarketingSubscriptionPlan, MarketingSubscriptionPlanGroup } from '@/lib/subscriptions/marketing-plans';

type MarketingSubscriptionGroupCardProps = {
  group: MarketingSubscriptionPlanGroup;
  ctaHref?: string;
};

function hasHighlight(plan: MarketingSubscriptionPlan): boolean {
  return 'highlight' in plan && Boolean(plan.highlight);
}

function getBonusLabel(plan: MarketingSubscriptionPlan): string | undefined {
  return 'bonus' in plan ? plan.bonus : undefined;
}

function getPackageName(title: string): string {
  return title.replace(/\s+(3M|6M)$/i, '');
}

function parsePriceInr(label: string): number {
  const parsed = Number.parseInt(label.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPriceInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function getPlanPromise(title: string): string {
  return title.includes('6M') ? 'Pay for 5, get 6 services' : 'Pay for 2, get 3 services';
}

function getCtaLabel(title: string): string {
  return title.includes('6M') ? 'Choose 6M Pack' : 'Choose 3M Pack';
}

function getGroupGlowClass(title: string): string {
  if (title.includes('6M')) {
    return 'border-[#e7bf55] shadow-[0_18px_48px_rgba(198,142,28,0.24),0_0_0_1px_rgba(246,211,107,0.62),0_0_34px_rgba(251,191,36,0.28)]';
  }

  if (title.includes('3M')) {
    return 'border-[#c7d1de] shadow-[0_18px_46px_rgba(120,135,156,0.22),0_0_0_1px_rgba(226,232,240,0.78),0_0_34px_rgba(203,213,225,0.42)]';
  }

  return 'border-[#e4c3a6] shadow-gloss-premium';
}

export default function MarketingSubscriptionGroupCard({
  group,
  ctaHref = '/dashboard/user/subscriptions',
}: MarketingSubscriptionGroupCardProps) {
  const defaultPlan = useMemo(
    () => group.plans.find(hasHighlight) ?? group.plans[0],
    [group.plans],
  );

  const [selectedTitle, setSelectedTitle] = useState(defaultPlan.title);

  const selectedPlan = useMemo(
    () => group.plans.find((plan) => plan.title === selectedTitle) ?? defaultPlan,
    [defaultPlan, group.plans, selectedTitle],
  );

  const lowestPlan = useMemo(
    () => group.plans.reduce((lowest, plan) => (
      parsePriceInr(plan.price) < parsePriceInr(lowest.price) ? plan : lowest
    ), group.plans[0]),
    [group.plans],
  );

  const selectedPrice = parsePriceInr(selectedPlan.price);
  const selectedWorth = parsePriceInr(selectedPlan.worth);
  const savings = Math.max(0, selectedWorth - selectedPrice);
  const selectedPackageName = getPackageName(selectedPlan.title);
  const selectedBonus = getBonusLabel(selectedPlan);
  const planPromise = getPlanPromise(group.title);
  const glowClass = getGroupGlowClass(group.title);

  return (
    <PremiumCard
      as="article"
      className={`flex h-full flex-col overflow-hidden rounded-[20px] border bg-[linear-gradient(150deg,#fffdfb_0%,#fff8f1_54%,#fff2e5_100%)] p-3.5 sm:p-4 ${glowClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#efd9c4] bg-white/86 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#835739]">
          <Sparkles className="h-3 w-3 text-coral" aria-hidden="true" />
          {planPromise}
        </span>
        <span className="rounded-full border border-[#ead6c2] bg-white/84 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#7a5a45]">
          {selectedPlan.duration}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-h-[86px]">
          <h3 className="text-[20px] font-bold leading-tight text-[#2d221a] sm:text-[21px]">{group.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#6a5242]">{group.summary}</p>
        </div>
        <div className="rounded-2xl border border-[#ecd7c2] bg-white/78 px-3 py-2.5 sm:min-w-[136px]">
          <p className="text-[10px] font-semibold uppercase text-[#8b6c56]">Starts at</p>
          <p className="mt-1 text-[21px] font-bold leading-none text-[#2d221a]">{lowestPlan.price}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#8b6c56]">{getPackageName(lowestPlan.title)}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-[#e9d4bf] bg-white/72 p-3" aria-live="polite">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase text-[#8b6c56]">Selected package</p>
            <h4 className="mt-0.5 text-[17px] font-bold leading-tight text-[#30251d]">{selectedPackageName}</h4>
            <p className="mt-0.5 text-[11px] font-semibold text-[#7a5a45]">{selectedPlan.sessions}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-semibold uppercase text-[#8b6c56]">{group.dealLabel}</p>
            <p className="mt-0.5 text-[25px] font-bold leading-none text-[#2d221a]">{selectedPlan.price}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#8b6c56]">
              Value <span className="line-through decoration-[#b56b37] decoration-2">{selectedPlan.worth}</span>
              {savings > 0 ? <span> · Save {formatPriceInr(savings)}</span> : null}
            </p>
          </div>
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="text-[11px] font-semibold uppercase text-[#765743]">Choose grooming package</legend>
        <div className="mt-2 grid gap-1.5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {group.plans.map((plan) => {
            const isSelected = plan.title === selectedPlan.title;
            const packageName = getPackageName(plan.title);

            return (
              <label
                key={plan.title}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-1 transition focus-within:ring-2 focus-within:ring-[#d48950] ${
                  isSelected
                    ? 'border-[#d48950] bg-[#fff1e3] shadow-[0_10px_22px_rgba(199,119,59,0.12)]'
                    : 'border-[#f0dfcf] bg-white/78 hover:border-[#dfb58d] hover:bg-[#fffaf5]'
                }`}
              >
                <input
                  type="radio"
                  name={`subscription-pack-${group.title}`}
                  value={plan.title}
                  checked={isSelected}
                  onChange={() => setSelectedTitle(plan.title)}
                  className="sr-only"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[#3c2d23]">
                    {packageName}
                    {hasHighlight(plan) ? (
                      <span className="rounded-full bg-[#2d221a] px-1.5 py-0.5 text-[8px] font-semibold uppercase text-white">
                        Pick
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] leading-4 text-[#755b49]">{plan.sessions}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[12px] font-bold text-[#2d221a]">{plan.price}</span>
                  <span className="block text-[9px] font-semibold text-[#8b6c56]">value {plan.worth}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 grid gap-1.5 text-[11px] font-semibold text-[#5d4739] sm:grid-cols-2">
        <span className="flex items-center gap-1.5 rounded-xl border border-[#f0dfcf] bg-white/76 px-2.5 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#c7773b]" aria-hidden="true" />
          Credit value after purchase
        </span>
        <span className="flex items-center gap-1.5 rounded-xl border border-[#f0dfcf] bg-white/76 px-2.5 py-1">
          <CalendarCheck2 className="h-3.5 w-3.5 shrink-0 text-[#c7773b]" aria-hidden="true" />
          Pick date and time later
        </span>
        <span className="flex items-center gap-1.5 rounded-xl border border-[#f0dfcf] bg-white/76 px-2.5 py-1">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#c7773b]" aria-hidden="true" />
          Valid for {selectedPlan.duration}
        </span>
        <span className="flex items-center gap-1.5 rounded-xl border border-[#f0dfcf] bg-white/76 px-2.5 py-1">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#c7773b]" aria-hidden="true" />
          {selectedBonus ? 'Herbal shampoo bonus' : 'Eligible grooming credit'}
        </span>
      </div>

      <div className="mt-auto pt-4">
        <Link
          href={ctaHref}
          aria-label={`${getCtaLabel(group.title)}: ${selectedPlan.title}`}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-4 text-[13px] font-semibold text-white transition hover:border-[#c7773b] hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] hover:shadow-[0_12px_22px_rgba(199,119,59,0.28)]"
        >
          {getCtaLabel(group.title)}
        </Link>
      </div>
    </PremiumCard>
  );
}