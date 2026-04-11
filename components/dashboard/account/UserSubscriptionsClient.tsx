'use client';

import Link from 'next/link';
import SubscriptionCheckoutPanel from '@/components/payments/SubscriptionCheckoutPanel';

export default function UserSubscriptionsClient() {
  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">Subscriptions and Credits</h1>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Manage active plans, track service credits, and purchase new plans securely.
            </p>
          </div>
          <Link
            href="/dashboard/user/billing"
            className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-4 py-2 text-xs font-semibold text-ink"
          >
            View Billing
          </Link>
        </div>
      </section>

      <SubscriptionCheckoutPanel />
    </div>
  );
}
