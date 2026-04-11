'use client';

import StatCard from '@/components/dashboard/premium/StatCard';
import AdminAnalyticsCharts from '@/components/dashboard/admin/charts/AdminAnalyticsCharts';

type BookingRiskSummary = {
  inProgress: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

type AdminOverviewViewProps = {
  bookingCount: number;
  bookingRiskSummary: BookingRiskSummary;
  providerCount: number;
  serviceCount: number;
  customerCount: number;
  activeDiscountCount: number;
  onNavigate: (view: 'payments' | 'subscriptions' | 'billing') => void;
};

export default function AdminOverviewView({
  bookingCount,
  bookingRiskSummary,
  providerCount,
  serviceCount,
  customerCount,
  activeDiscountCount,
  onNavigate,
}: AdminOverviewViewProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-section-title">Business Statistics</h2>
        <p className="text-muted">Track platform supply, customer footprint, and growth levers from one control panel</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <StatCard
          label="All Bookings"
          value={bookingCount}
          icon="calendar"
          description="Live pipeline volume"
        />
        <StatCard
          label="Bookings in Progress"
          value={bookingRiskSummary.inProgress}
          icon="trending-up"
          description="Pending and confirmed bookings"
        />
        <StatCard
          label="Completed Bookings"
          value={bookingRiskSummary.completed}
          icon="award"
          description="Successfully fulfilled bookings"
        />
        <StatCard
          label="No-show Bookings"
          value={bookingRiskSummary.noShow}
          icon="x-circle"
          description="Provider or customer no-show"
        />
        <StatCard
          label="Cancelled Bookings"
          value={bookingRiskSummary.cancelled}
          icon="x"
          description="Cancelled from pipeline"
        />
        <StatCard
          label="Total Providers"
          value={providerCount}
          icon="users"
          description="Onboarded provider base"
        />
        <StatCard
          label="Total Services"
          value={serviceCount}
          icon="star"
          description="Services in catalog"
        />
        <StatCard
          label="Total Customers"
          value={customerCount}
          icon="users"
          description="Unique customers from bookings"
        />
        <StatCard
          label="Live Discounts"
          value={activeDiscountCount}
          icon="tag"
          description="Currently active campaigns"
        />
      </div>

      <AdminAnalyticsCharts />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Finance Command Center</h3>
            <p className="mt-1 text-sm text-neutral-600">Open subscriptions, payments, and billing controls from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
            >
              Open Payments
            </button>
            <button
              type="button"
              onClick={() => onNavigate('subscriptions')}
              className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
            >
              Open Subscriptions
            </button>
            <button
              type="button"
              onClick={() => onNavigate('billing')}
              className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
            >
              Open Billing
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
