'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Crown, CalendarClock, BadgeCheck } from 'lucide-react';

type SubscriptionCredit = {
  service_type: string;
  total_credits: number;
  available_credits: number;
  consumed_credits: number;
};

type SubscriptionRow = {
  id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  subscription_plans?: {
    name?: string | null;
    code?: string | null;
  } | null;
  user_service_credits?: SubscriptionCredit[];
};

function formatServiceType(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function SubscriptionSpotlightCard() {
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);

  const loadSubscriptions = async () => {
    const response = await fetch('/api/subscriptions/me', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => null)) as { subscriptions?: SubscriptionRow[] } | null;
    setSubscriptions(payload?.subscriptions ?? []);
  };

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        await loadSubscriptions();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onCreditsUpdated = () => {
      void loadSubscriptions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dofurs:subscription-credits-updated', onCreditsUpdated as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dofurs:subscription-credits-updated', onCreditsUpdated as EventListener);
      }
    };
  }, []);

  const activeSubscription = useMemo(
    () => {
      const nowMs = Date.now();
      return (
        subscriptions.find((subscription) => {
          if (subscription.status !== 'active') return false;
          const startsAtMs = subscription.starts_at ? Date.parse(subscription.starts_at) : Number.NaN;
          const endsAtMs = subscription.ends_at ? Date.parse(subscription.ends_at) : Number.NaN;
          return Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && startsAtMs <= nowMs && endsAtMs >= nowMs;
        }) ?? null
      );
    },
    [subscriptions],
  );

  const aggregatedActiveCredits = useMemo(() => {
    const nowMs = Date.now();
    const activeSubscriptions = subscriptions.filter((subscription) => {
      if (subscription.status !== 'active') return false;
      const startsAtMs = subscription.starts_at ? Date.parse(subscription.starts_at) : Number.NaN;
      const endsAtMs = subscription.ends_at ? Date.parse(subscription.ends_at) : Number.NaN;
      return Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && startsAtMs <= nowMs && endsAtMs >= nowMs;
    });

    const merged = new Map<string, SubscriptionCredit>();

    for (const sub of activeSubscriptions) {
      for (const credit of sub.user_service_credits ?? []) {
        const current = merged.get(credit.service_type) ?? {
          service_type: credit.service_type,
          total_credits: 0,
          available_credits: 0,
          consumed_credits: 0,
        };

        current.total_credits += Number(credit.total_credits ?? 0);
        current.available_credits += Number(credit.available_credits ?? 0);
        current.consumed_credits += Number(credit.consumed_credits ?? 0);
        merged.set(credit.service_type, current);
      }
    }

    return Array.from(merged.values());
  }, [subscriptions]);

  if (isLoading) {
    return <div className="h-[128px] animate-pulse rounded-3xl border border-[#f1dcbd] bg-[#fff5ea]" />;
  }

  if (activeSubscription) {
    const activeCredits = aggregatedActiveCredits.filter(
      (credit) => Number(credit.total_credits ?? 0) > 0,
    );

    return (
      <Link
        href="/dashboard/user/subscriptions"
        className="block rounded-3xl border border-[#cde9d8] bg-[linear-gradient(140deg,#f5fcf8_0%,#ecf9f1_46%,#f8fcfa_100%)] p-5 shadow-soft transition-all duration-200 hover:shadow-premium"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1c7c55]">Your Subscription</p>
            <p className="mt-1 text-base font-bold text-ink">
              {activeSubscription.subscription_plans?.name ?? activeSubscription.subscription_plans?.code ?? 'Active Plan'}
            </p>
            <p className="mt-0.5 text-sm text-[#2e6a51]">
              Valid until{' '}
              {activeSubscription.ends_at
                ? new Date(activeSubscription.ends_at).toLocaleDateString('en-IN')
                : 'ongoing'}
            </p>
          </div>
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#20b26a] text-white shadow-soft">
            <BadgeCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {activeCredits.slice(0, 2).map((credit) => (
            <div key={`${activeSubscription.id}-${credit.service_type}`} className="rounded-xl border border-[#d4eadc] bg-white/80 px-3 py-2">
              <p className="text-xs font-semibold text-[#2e6a51]">{formatServiceType(credit.service_type)}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {credit.available_credits}/{credit.total_credits} credits left
              </p>
            </div>
          ))}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/user/subscriptions"
      className="block rounded-3xl border border-[#f1dcbd] bg-[linear-gradient(135deg,#fff8ef,#fff2e2)] p-5 shadow-soft transition-all duration-200 hover:shadow-premium"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#a05a2c]">Subscription Services</p>
          <p className="mt-1 text-base font-bold text-ink">Save more with a grooming subscription</p>
          <p className="mt-0.5 text-sm text-ink/65">
            Prepaid plans unlock priority slots and bundled credits for repeated care.
          </p>
        </div>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-coral text-white shadow-soft">
          <Crown className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#ebc9ab] bg-white px-2.5 py-1 text-xs font-semibold text-[#8f4a1d]">
          <Sparkles className="h-3.5 w-3.5" /> Priority Booking
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#ebc9ab] bg-white px-2.5 py-1 text-xs font-semibold text-[#8f4a1d]">
          <CalendarClock className="h-3.5 w-3.5" /> Credits for repeat visits
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold text-coral">Explore plans and start saving &rarr;</p>
    </Link>
  );
}
