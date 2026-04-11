'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api/client';
import { useToast } from '@/components/ui/ToastProvider';
import SubscriptionPlanCard from '@/components/payments/SubscriptionPlanCard';
import { whatsappLinks } from '@/lib/site-data';

type PlanService = {
  service_type: string;
  credits_included: number;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  duration_days: number;
  price_inr: number;
  subscription_plan_services: PlanService[];
};

type MySubscription = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  subscription_plans?: { name?: string | null; code?: string | null } | null;
  user_service_credits?: Array<{
    service_type: string;
    total_credits: number;
    available_credits: number;
    consumed_credits: number;
  }>;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { email?: string };
  notes?: Record<string, string>;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
};

type RazorpayPaymentFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      on: (event: 'payment.failed', handler: (response: RazorpayPaymentFailureResponse) => void) => void;
    };
  }
}

export default function SubscriptionCheckoutPanel() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [plansPayload, subscriptionsPayload] = await Promise.all([
          apiRequest<{ plans: Plan[] }>('/api/subscriptions/plans'),
          apiRequest<{ subscriptions: MySubscription[] }>('/api/subscriptions/me'),
        ]);

        if (!isMounted) {
          return;
        }

        setPlans(plansPayload.plans ?? []);
        setSubscriptions(subscriptionsPayload.subscriptions ?? []);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || window.Razorpay) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const activeSubscriptions = useMemo(() => {
    const nowMs = Date.now();
    return subscriptions.filter((sub) => {
      if (sub.status !== 'active') return false;
      const startsAtMs = sub.starts_at ? Date.parse(sub.starts_at) : Number.NaN;
      const endsAtMs = sub.ends_at ? Date.parse(sub.ends_at) : Number.NaN;
      return Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && startsAtMs <= nowMs && endsAtMs >= nowMs;
    });
  }, [subscriptions]);

  const aggregatedActiveCredits = useMemo(() => {
    const merged = new Map<string, { service_type: string; total_credits: number; available_credits: number; consumed_credits: number }>();

    for (const sub of activeSubscriptions) {
      for (const credit of sub.user_service_credits ?? []) {
        const key = credit.service_type;
        const current = merged.get(key) ?? {
          service_type: key,
          total_credits: 0,
          available_credits: 0,
          consumed_credits: 0,
        };

        current.total_credits += Number(credit.total_credits ?? 0);
        current.available_credits += Number(credit.available_credits ?? 0);
        current.consumed_credits += Number(credit.consumed_credits ?? 0);
        merged.set(key, current);
      }
    }

    return Array.from(merged.values());
  }, [activeSubscriptions]);

  const activeSubscription = useMemo(
    () => activeSubscriptions[0] ?? null,
    [activeSubscriptions],
  );

  async function refreshSubscriptions() {
    const payload = await apiRequest<{ subscriptions: MySubscription[] }>('/api/subscriptions/me');
    setSubscriptions(payload.subscriptions ?? []);
  }

  useEffect(() => {
    const onCreditsUpdated = () => {
      void refreshSubscriptions();
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

  async function purchase(planId: string) {
    if (activeSubscriptions.length > 0) {
      showToast('You already have an active plan. Manage it from Subscriptions and Credits.', 'info');
      router.push('/dashboard/user/subscriptions');
      return;
    }

    setBuyingPlanId(planId);
    try {
      const payload = await apiRequest<{
        razorpay: {
          keyId: string;
          amount: number;
          currency: string;
          orderId: string;
          name: string;
          description: string;
          prefill?: { email?: string };
          notes?: Record<string, string>;
        };
      }>('/api/payments/subscriptions/order', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout SDK did not load.');
      }

      const razorpay = new window.Razorpay({
        key: payload.razorpay.keyId,
        amount: payload.razorpay.amount,
        currency: payload.razorpay.currency,
        name: payload.razorpay.name,
        description: payload.razorpay.description,
        order_id: payload.razorpay.orderId,
        prefill: payload.razorpay.prefill,
        notes: payload.razorpay.notes,
        handler: async (response) => {
          try {
            await apiRequest('/api/payments/subscriptions/verify', {
              method: 'POST',
              body: JSON.stringify({
                providerOrderId: response.razorpay_order_id,
                providerPaymentId: response.razorpay_payment_id,
                providerSignature: response.razorpay_signature,
              }),
            });

            showToast('Subscription activated! Your credits are ready to use.', 'success');
            await refreshSubscriptions();
            router.push('/dashboard/user/subscriptions/confirmation?status=success');
          } catch (verifyError) {
            console.error('Subscription verification failed after payment:', verifyError);
            showToast(
              'Payment received. We are finalizing your subscription now.',
              'success',
            );
            // Poll once after a delay as a fallback (webhook may activate it)
            setTimeout(() => {
              void refreshSubscriptions();
            }, 5000);
            router.push('/dashboard/user/subscriptions/confirmation?status=pending');
          }
        },
      });

      razorpay.on('payment.failed', (failureResponse) => {
        const errorDetail =
          failureResponse.error?.description ??
          failureResponse.error?.reason ??
          failureResponse.error?.code ??
          'Payment could not be completed. Please try a different card or method.';
        showToast(`Payment failed: ${errorDetail}`, 'error');
        console.error('Razorpay subscription payment failed', {
          detail: errorDetail,
          failureResponse,
        });
      });

      razorpay.open();
    } catch (error) {
      // Let callers decide whether to show a toast; keep this panel self-contained.
      const message = error instanceof Error ? error.message : 'Unable to start subscription purchase. Please try again.';
      showToast(message, 'error');
      console.error('Subscription purchase failed', error);
    } finally {
      setBuyingPlanId(null);
    }
  }

  const formatServiceType = (serviceType: string) =>
    serviceType
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const formatPriceInr = (price: number) => `₹${Math.round(price).toLocaleString('en-IN')}`;

  const derivePlanBadge = (plan: Plan, index: number) => {
    const normalized = `${plan.name} ${plan.code}`.toLowerCase();
    if (normalized.includes('essential')) return 'Starter Value';
    if (normalized.includes('premium') && plan.duration_days >= 300) return 'Elite Annual';
    if (normalized.includes('premium')) return 'Most Chosen';
    return index === 0 ? 'Starter Value' : 'Premium Plan';
  };

  const deriveIncludedSummary = (plan: Plan) => {
    const description = plan.description?.trim();
    if (description) {
      const sessionsMatch = description.match(/get\s+(\d+)\s+/i);
      if (sessionsMatch?.[1]) {
        const normalized = `${plan.name} ${plan.code}`.toLowerCase();
        const planTierLabel = normalized.includes('essential') ? 'essential' : normalized.includes('premium') ? 'premium' : 'grooming';
        return `${sessionsMatch[1]} ${planTierLabel} grooming sessions`;
      }
    }

    const totalCredits = plan.subscription_plan_services.reduce((sum, service) => sum + service.credits_included, 0);
    const firstService = plan.subscription_plan_services[0]?.service_type;
    if (!firstService) {
      return `${totalCredits} credits included`;
    }

    return `${totalCredits} credits ${formatServiceType(firstService)}`;
  };

  const derivePrimaryServiceType = (plan: Plan) => {
    const firstService = plan.subscription_plan_services[0]?.service_type;
    return firstService ? formatServiceType(firstService) : 'Grooming';
  };

  const deriveIncludedHint = (plan: Plan) => {
    const description = plan.description?.trim();
    if (description) {
      const worthMatch = description.match(/worth(?:\s+of)?\s+(.+)/i);
      if (worthMatch?.[1]) {
        const parsedWorth = worthMatch[1]
          .trim()
          .replace(/[.]+$/g, '')
          .replace(/^Rs\.?\s*/i, '₹');

        const digitsOnly = parsedWorth.replace(/[^\d]/g, '');
        if (digitsOnly) {
          return `₹${Number(digitsOnly).toLocaleString('en-IN')}`;
        }

        return parsedWorth;
      }

      return description;
    }

    return formatPriceInr(plan.price_inr);
  };

  return (
    <section className="rounded-[22px] border border-[#ead5c0] bg-[linear-gradient(140deg,#fff9f4_0%,#fffefc_55%,#fff8f1_100%)] p-4 shadow-gloss-premium sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral">Subscription Services</p>
          <h3 className="mt-1 text-xl font-semibold leading-tight text-[#2d221a] sm:text-2xl">Premium Grooming Plans</h3>
        </div>
        <p className="rounded-full border border-[#ead6c2] bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a5a45]">
          Fixed pricing. Priority booking.
        </p>
      </div>

      {activeSubscriptions.length > 0 ? (
        <div className="mt-4 rounded-xl border border-[#cdebd9] bg-[linear-gradient(145deg,#f2fdf6,#ecf9f2)] p-3.5 text-xs sm:text-sm">
          <p className="font-semibold text-[#176540]">
            {activeSubscriptions.length === 1
              ? `Active plan: ${activeSubscription?.subscription_plans?.name ?? activeSubscription?.subscription_plans?.code ?? 'Subscription'}`
              : `${activeSubscriptions.length} active plans`}
          </p>
          <p className="mt-1 text-[#27845c]">Valid until {new Date(activeSubscription.ends_at).toLocaleDateString()}</p>
          <div className="mt-2 space-y-1 text-xs text-[#2a7b58]">
            {aggregatedActiveCredits.map((credit) => (
              <p key={`agg-${credit.service_type}`}>
                {formatServiceType(credit.service_type)}: {credit.available_credits}/{credit.total_credits} credits available
              </p>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-[#e2d6cc] bg-[#fffaf6] px-3.5 py-2.5">
            <p className="text-xs leading-relaxed text-[#6b5443]">
              Need to upgrade, cancel, or have questions about your plan?{' '}
              <a
                href={whatsappLinks.subscriptionSupport}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#25D366] underline decoration-[#25D366]/30 underline-offset-2 transition hover:text-[#1da851] hover:decoration-[#1da851]/50"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Chat with us on WhatsApp
              </a>
            </p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Loading plans...</p>
      ) : plans.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No subscription plans are configured yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <SubscriptionPlanCard
              key={plan.id}
              badge={derivePlanBadge(plan, index)}
              durationLabel={`${plan.duration_days} days`}
              title={plan.name}
              priceLabel={formatPriceInr(plan.price_inr)}
              includedSummary={deriveIncludedSummary(plan)}
              worthLabel={deriveIncludedHint(plan)}
              serviceType={derivePrimaryServiceType(plan)}
              cta={(
                activeSubscriptions.length > 0 ? (
                  null
                ) : (
                  <button
                    type="button"
                    onClick={() => purchase(plan.id)}
                    disabled={buyingPlanId === plan.id}
                    className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#e2c2a4] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-4 text-[13px] font-semibold text-white transition hover:border-[#c7773b] hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] group-hover:shadow-[0_12px_22px_rgba(199,119,59,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {buyingPlanId === plan.id ? 'Processing...' : 'Choose Plan'}
                  </button>
                )
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
