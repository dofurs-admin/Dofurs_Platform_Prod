'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/design-system';
import AdminPaginationControls from '@/components/dashboard/admin/AdminPaginationControls';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import { exportToCsv } from '@/lib/utils/export';

type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  auto_renew?: boolean;
  subscription_plans?: { name?: string | null; code?: string | null } | null;
};

const PAGE_SIZE = 30;

type AdminSubscriptionsViewProps = {
  subscriptions: AdminSubscriptionRow[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onUpdateStatus: (subscriptionId: string, status: 'active' | 'paused' | 'cancelled') => void;
  onViewDetails?: (subscriptionId: string) => void;
  showGuide?: boolean;
};

export default function AdminSubscriptionsView({
  subscriptions,
  isLoading,
  page,
  onPageChange,
  onUpdateStatus,
  onViewDetails,
  showGuide = true,
}: AdminSubscriptionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  const planOptions = useMemo(() => {
    const planSet = new Set<string>();
    for (const row of subscriptions) {
      const planName = row.subscription_plans?.name?.trim();
      const planCode = row.subscription_plans?.code?.trim();
      if (planName) {
        planSet.add(planName);
      } else if (planCode) {
        planSet.add(planCode);
      }
    }
    return Array.from(planSet).sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return subscriptions.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      const planLabel = row.subscription_plans?.name ?? row.subscription_plans?.code ?? '';
      if (planFilter !== 'all' && planLabel !== planFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = [
        row.user_name ?? '',
        row.user_email ?? '',
        row.user_phone ?? '',
        row.user_id ?? '',
        row.subscription_plans?.name ?? '',
        row.subscription_plans?.code ?? '',
        row.status ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [subscriptions, searchQuery, statusFilter, planFilter]);

  useEffect(() => {
    if (page !== 1) {
      onPageChange(1);
    }
  }, [searchQuery, statusFilter, planFilter, page, onPageChange]);

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== 'all' || planFilter !== 'all';

  function resetFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setPlanFilter('all');
  }

  return (
    <section className="space-y-4">
      {showGuide && (
        <AdminSectionGuide
          title="How to Use Subscriptions"
          subtitle="Monitor and manage customer subscription plans"
          steps={[
            { title: 'View Subscriptions', description: 'All customer subscriptions are listed with their plan name, status, and validity dates.' },
            { title: 'Understand Statuses', description: 'Active = running plan. Paused = temporarily on hold. Cancelled/Expired = no longer active.' },
            { title: 'Change Status', description: 'Use the status buttons on each row to pause, reactivate, or cancel a subscription.' },
            { title: 'Check Dates', description: 'Each subscription shows its start date, end date, and whether auto-renewal is enabled.' },
            { title: 'Export Data', description: 'Download all subscription data as CSV for reporting or audit purposes.' },
          ]}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-section-title">Subscriptions Operations</h2>
          <p className="text-muted">Monitor active plans and apply operational status controls.</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
          onClick={() => exportToCsv('subscriptions-export', ['ID', 'Subscriber Name', 'User ID', 'Plan', 'Status', 'Starts At', 'Ends At', 'Auto Renew'], subscriptions.map((s) => [s.id, s.user_name ?? '', s.user_id, s.subscription_plans?.name ?? '', s.status, s.starts_at, s.ends_at, s.auto_renew ? 'Yes' : 'No']))}
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-700">Search</label>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, UID, email, phone, plan"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-700">Status</label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-700">Plan</label>
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          >
            <option value="all">All plans</option>
            {planOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading subscriptions...</p>
        ) : filteredSubscriptions.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {hasActiveFilters ? 'No subscriptions match the selected filters.' : 'No subscriptions found.'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {filteredSubscriptions
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((subscription) => {
                  const subStatus = subscription.status;
                  const isActive = subStatus === 'active';
                  const isPaused = subStatus === 'paused';
                  const isCancelled = subStatus === 'cancelled' || subStatus === 'expired';
                  return (
                    <div key={subscription.id} className="rounded-lg bg-neutral-50/60 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-neutral-900">
                            {subscription.subscription_plans?.name ?? subscription.subscription_plans?.code ?? 'Unknown Plan'}
                          </span>
                          {subscription.user_name && (
                            <span className="mt-0.5 block text-xs font-medium text-neutral-700">
                              Subscriber: {subscription.user_name}
                            </span>
                          )}
                          <span className="mt-0.5 block font-mono text-[11px] text-neutral-400" title={subscription.user_id}>
                            UID: {subscription.user_id.slice(0, 18)}…
                          </span>
                          {(subscription.starts_at || subscription.ends_at) && (
                            <span className="mt-0.5 block text-[11px] text-neutral-500">
                              {subscription.starts_at ? new Date(subscription.starts_at).toLocaleDateString() : '—'}
                              {' → '}
                              {subscription.ends_at ? new Date(subscription.ends_at).toLocaleDateString() : '—'}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-semibold',
                            isActive
                              ? 'border-green-300 bg-green-50 text-green-700'
                              : isPaused
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : isCancelled
                              ? 'border-red-200 bg-red-50 text-red-600'
                              : 'border-neutral-300 bg-neutral-100 text-neutral-600',
                          )}
                        >
                          {subStatus}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {onViewDetails ? (
                          <button
                            type="button"
                            onClick={() => onViewDetails(subscription.id)}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
                          >
                            Details
                          </button>
                        ) : null}
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(subscription.id, 'active')}
                            className="rounded-md border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                          >
                            Activate
                          </button>
                        )}
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(subscription.id, 'paused')}
                            className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                          >
                            Pause
                          </button>
                        )}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(subscription.id, 'cancelled')}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            <AdminPaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              total={filteredSubscriptions.length}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}
