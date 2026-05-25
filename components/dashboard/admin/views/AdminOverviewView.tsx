'use client';

import AdminAnalyticsCharts from '@/components/dashboard/admin/charts/AdminAnalyticsCharts';
import { cn } from '@/lib/design-system';

type BookingRiskSummary = {
  pending: number;
  inProgress: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

type AdminOverviewViewProps = {
  bookingCount: number;
  bookingServiceUnitCount: number;
  bookingRiskSummary: BookingRiskSummary;
  providerCount: number;
  serviceCount: number;
  customerCount: number;
  activeDiscountCount: number;
  onNavigate: (view: 'payments' | 'subscriptions' | 'billing') => void;
};

type OverviewCompactCardProps = {
  label: string;
  value: number | string;
  description: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
};

function OverviewCompactCard({
  label,
  value,
  description,
  className,
  labelClassName,
  valueClassName,
}: OverviewCompactCardProps) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-neutral-200 bg-white p-2 shadow-sm', className)}>
      <p className={cn('truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-600', labelClassName)}>{label}</p>
      <p className={cn('mt-0.5 text-base font-semibold leading-5 text-neutral-950', valueClassName)}>{value}</p>
      <p className="truncate text-[10px] leading-4 text-neutral-500">{description}</p>
    </div>
  );
}

export default function AdminOverviewView({
  bookingCount,
  bookingServiceUnitCount,
  bookingRiskSummary,
  providerCount,
  serviceCount,
  customerCount,
  activeDiscountCount,
  onNavigate,
}: AdminOverviewViewProps) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <OverviewCompactCard
          label="Pending SLA"
          value={bookingRiskSummary.pending}
          description="Needs admin attention"
          className="border-amber-200 bg-amber-50"
          labelClassName="text-amber-700"
          valueClassName="text-amber-900"
        />
        <OverviewCompactCard
          label="In Progress"
          value={bookingRiskSummary.inProgress}
          description="Pending and confirmed"
          className="border-blue-200 bg-blue-50"
          labelClassName="text-blue-700"
          valueClassName="text-blue-900"
        />
        <OverviewCompactCard
          label="Completed"
          value={bookingRiskSummary.completed}
          description="Successfully fulfilled"
          className="border-emerald-200 bg-emerald-50"
          labelClassName="text-emerald-700"
          valueClassName="text-emerald-900"
        />
        <OverviewCompactCard
          label="No-shows"
          value={bookingRiskSummary.noShow}
          description="High-risk exceptions"
          className="border-red-200 bg-red-50"
          labelClassName="text-red-700"
          valueClassName="text-red-900"
        />
        <OverviewCompactCard
          label="Cancelled"
          value={bookingRiskSummary.cancelled}
          description="Removed from pipeline"
          className="border-neutral-200 bg-neutral-50"
        />
        <OverviewCompactCard
          label="Live Discounts"
          value={activeDiscountCount}
          description="Active campaigns"
          className="border-brand-200 bg-brand-50"
          labelClassName="text-coral"
          valueClassName="text-[#9f5529]"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[12rem_repeat(3,minmax(0,1fr))] lg:items-stretch">
          <div>
            <h2 className="text-xs font-semibold text-neutral-950">Today&apos;s Control Room</h2>
            <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Fast queues.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('billing')}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-2.5 py-2 text-left transition hover:bg-brand-50/40"
          >
            <span>
              <span className="block text-xs font-semibold text-neutral-950">Billing queue</span>
              <span className="block text-[11px] text-neutral-500">Invoices and reminders</span>
            </span>
            <span className="text-xs font-semibold text-neutral-500">Open</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('payments')}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-2.5 py-2 text-left transition hover:bg-brand-50/40"
          >
            <span>
              <span className="block text-xs font-semibold text-neutral-950">Payment review</span>
              <span className="block text-[11px] text-neutral-500">Collection status</span>
            </span>
            <span className="text-xs font-semibold text-neutral-500">Open</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('subscriptions')}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-2.5 py-2 text-left transition hover:bg-brand-50/40"
          >
            <span>
              <span className="block text-xs font-semibold text-neutral-950">Subscription health</span>
              <span className="block text-[11px] text-neutral-500">Plans and credits</span>
            </span>
            <span className="text-xs font-semibold text-neutral-500">Open</span>
          </button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <OverviewCompactCard
          label="All Bookings"
          value={bookingCount}
          description="Live pipeline volume"
        />
        <OverviewCompactCard
          label="Service Units"
          value={bookingServiceUnitCount}
          description="Booked service items across bundles"
        />
        <OverviewCompactCard
          label="Total Providers"
          value={providerCount}
          description="Onboarded provider base"
        />
        <OverviewCompactCard
          label="Total Services"
          value={serviceCount}
          description="Services in catalog"
        />
        <OverviewCompactCard
          label="Total Customers"
          value={customerCount}
          description="Unique customers from bookings"
        />
      </div>

      <AdminAnalyticsCharts />
    </section>
  );
}
