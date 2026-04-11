'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminSubscriptionsView from '@/components/dashboard/admin/views/AdminSubscriptionsView';
import AdminSubscriptionPlansClient from '@/components/dashboard/admin/AdminSubscriptionPlansClient';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';

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

type SubscriptionDetailsResponse = {
  subscription: {
    id: string;
    user_id: string;
    plan_id: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    activated_at: string | null;
    cancelled_at: string | null;
    payment_transaction_id: string | null;
    created_at: string;
    updated_at: string;
    subscription_plans: {
      id: string;
      name: string | null;
      code: string | null;
      description: string | null;
      duration_days: number | null;
      price_inr: number | null;
    } | null;
  };
  subscriber: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  plan_services: Array<{ service_type: string; credit_count: number }>;
  credits: Array<{ service_type: string; total_credits: number; available_credits: number; consumed_credits: number }>;
  credit_summary: { total: number; available: number; consumed: number };
  payment: {
    transaction: {
      id: string;
      payment_order_id: string | null;
      provider: string;
      transaction_type: string;
      status: string;
      amount_inr: number;
      currency: string;
      provider_payment_id: string | null;
      created_at: string;
    };
    order: {
      id: string;
      provider_order_id: string;
      amount_inr: number;
      currency: string;
      status: string;
      created_at: string;
    } | null;
    display_method: string | null;
  } | null;
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    total_inr: number;
    issued_at: string | null;
    paid_at: string | null;
    created_at: string;
  } | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN');
}

function formatCurrency(value: number | null | undefined) {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

type SubscriptionsTabProps = {
  openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
};

export default function SubscriptionsTab({ openConfirm }: SubscriptionsTabProps) {
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<SubscriptionDetailsResponse | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/subscriptions?limit=100');
      if (response.ok) {
        const data = await response.json() as { subscriptions?: AdminSubscriptionRow[] };
        setSubscriptions(data.subscriptions ?? []);
      }
    } catch (err) { console.error(err);
      showToast('Unable to load subscriptions.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  async function updateSubscriptionStatus(subscriptionId: string, status: 'active' | 'paused' | 'expired' | 'cancelled') {
    if (status === 'cancelled' || status === 'paused') {
      openConfirm({
        title: status === 'cancelled' ? 'Cancel Subscription' : 'Pause Subscription',
        description: status === 'cancelled'
          ? 'Cancel the subscription. The customer will lose access to all subscription benefits.'
          : 'Pause the subscription. The customer will not be charged until it is resumed.',
        confirmLabel: status === 'cancelled' ? 'Cancel Subscription' : 'Pause Subscription',
        confirmVariant: status === 'cancelled' ? 'danger' : 'warning',
        onConfirm: () => void doUpdateSubscriptionStatus(subscriptionId, status),
      });
      return;
    }
    await doUpdateSubscriptionStatus(subscriptionId, status);
  }

  async function doUpdateSubscriptionStatus(subscriptionId: string, status: 'active' | 'paused' | 'expired' | 'cancelled') {
    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? 'Unable to update subscription status.');
      }
      setSubscriptions((c) => c.map((row) => row.id === subscriptionId ? { ...row, status } : row));
      showToast(`Subscription marked as ${status}.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update subscription status.', 'error');
    }
  }

  async function openSubscriptionDetails(subscriptionId: string) {
    setIsDetailsOpen(true);
    setIsDetailsLoading(true);
    setDetailsError(null);
    setSelectedDetails(null);

    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? 'Unable to load subscription details.');
      }
      const data = await response.json() as SubscriptionDetailsResponse;
      setSelectedDetails(data);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Unable to load subscription details.');
    } finally {
      setIsDetailsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionGuide
          title="How to Use Subscription Plans"
          subtitle="Create and manage subscription plans with credit allocations"
          steps={[
            { title: 'View Plans', description: 'All subscription plans are listed below with their pricing, duration, and included service credits.' },
            { title: 'Create a Plan', description: 'Click "+ New Plan" to create a new subscription plan. Fill in the name, price, duration, and credits.' },
            { title: 'Edit Credits', description: 'Each plan includes service credits (e.g., 2 grooming sessions). Adjust allocations per service type.' },
            { title: 'Manage Visibility', description: 'Plans can be active or hidden. Only active plans are shown to customers on the subscription page.' },
          ]}
        />
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
      </div>
      <AdminSubscriptionPlansClient showGuide={false} />
      <AdminSubscriptionsView
        subscriptions={subscriptions}
        isLoading={isLoading}
        page={page}
        onPageChange={setPage}
        onUpdateStatus={updateSubscriptionStatus}
        onViewDetails={openSubscriptionDetails}
        showGuide={false}
      />

      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        size="xl"
        title="Subscription Details"
        description="Complete subscriber, plan, credits, and payment picture for this subscription."
      >
        {isDetailsLoading ? <p className="text-sm text-neutral-500">Loading details...</p> : null}
        {!isDetailsLoading && detailsError ? <p className="text-sm font-semibold text-red-700">{detailsError}</p> : null}

        {!isDetailsLoading && !detailsError && selectedDetails ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Subscriber</h3>
              <div className="mt-2 grid gap-1 text-xs text-neutral-700 sm:grid-cols-2">
                <p>Name: <span className="font-semibold text-neutral-900">{selectedDetails.subscriber.name ?? '-'}</span></p>
                <p>Email: <span className="font-semibold text-neutral-900">{selectedDetails.subscriber.email ?? '-'}</span></p>
                <p>Phone: <span className="font-semibold text-neutral-900">{selectedDetails.subscriber.phone ?? '-'}</span></p>
                <p>UID: <span className="font-mono text-[11px] text-neutral-900">{selectedDetails.subscriber.id}</span></p>
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Subscription Summary</h3>
              <div className="mt-2 grid gap-1 text-xs text-neutral-700 sm:grid-cols-2">
                <p>Plan: <span className="font-semibold text-neutral-900">{selectedDetails.subscription.subscription_plans?.name ?? '-'}</span></p>
                <p>Plan Code: <span className="font-semibold text-neutral-900">{selectedDetails.subscription.subscription_plans?.code ?? '-'}</span></p>
                <p>Status: <span className="font-semibold text-neutral-900">{selectedDetails.subscription.status}</span></p>
                <p>Plan Price: <span className="font-semibold text-neutral-900">{formatCurrency(selectedDetails.subscription.subscription_plans?.price_inr ?? 0)}</span></p>
                <p>Starts At: <span className="font-semibold text-neutral-900">{formatDateTime(selectedDetails.subscription.starts_at)}</span></p>
                <p>Ends At: <span className="font-semibold text-neutral-900">{formatDateTime(selectedDetails.subscription.ends_at)}</span></p>
                <p>Activated At: <span className="font-semibold text-neutral-900">{formatDateTime(selectedDetails.subscription.activated_at)}</span></p>
                <p>Cancelled At: <span className="font-semibold text-neutral-900">{formatDateTime(selectedDetails.subscription.cancelled_at)}</span></p>
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Credits Picture</h3>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-lg bg-neutral-50 p-2">Total: <span className="font-semibold text-neutral-900">{selectedDetails.credit_summary.total}</span></div>
                <div className="rounded-lg bg-green-50 p-2 text-green-700">Available: <span className="font-semibold">{selectedDetails.credit_summary.available}</span></div>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-700">Consumed: <span className="font-semibold">{selectedDetails.credit_summary.consumed}</span></div>
              </div>
              <div className="mt-3 space-y-2">
                {selectedDetails.credits.length === 0 ? (
                  <p className="text-xs text-neutral-500">No credit rows found for this subscription.</p>
                ) : selectedDetails.credits.map((row) => (
                  <div key={row.service_type} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-700">
                    <span className="font-semibold text-neutral-900">{row.service_type}</span>
                    {' - '}Total {row.total_credits}, Available {row.available_credits}, Consumed {row.consumed_credits}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Payment Details</h3>
              {selectedDetails.payment ? (
                <div className="mt-2 grid gap-1 text-xs text-neutral-700 sm:grid-cols-2">
                  <p>Method: <span className="font-semibold text-neutral-900">{selectedDetails.payment.display_method ?? '-'}</span></p>
                  <p>Provider: <span className="font-semibold text-neutral-900">{selectedDetails.payment.transaction.provider}</span></p>
                  <p>Transaction Status: <span className="font-semibold text-neutral-900">{selectedDetails.payment.transaction.status}</span></p>
                  <p>Amount: <span className="font-semibold text-neutral-900">{formatCurrency(selectedDetails.payment.transaction.amount_inr)}</span></p>
                  <p>Provider Payment ID: <span className="font-semibold text-neutral-900">{selectedDetails.payment.transaction.provider_payment_id ?? '-'}</span></p>
                  <p>Transaction Created: <span className="font-semibold text-neutral-900">{formatDateTime(selectedDetails.payment.transaction.created_at)}</span></p>
                  <p>Order ID: <span className="font-semibold text-neutral-900">{selectedDetails.payment.order?.provider_order_id ?? '-'}</span></p>
                  <p>Order Status: <span className="font-semibold text-neutral-900">{selectedDetails.payment.order?.status ?? '-'}</span></p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">No payment transaction is linked to this subscription.</p>
              )}

              {selectedDetails.invoice ? (
                <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                  <p className="font-semibold text-neutral-900">Invoice: {selectedDetails.invoice.invoice_number}</p>
                  <p>Status: {selectedDetails.invoice.status}</p>
                  <p>Total: {formatCurrency(selectedDetails.invoice.total_inr)}</p>
                  <p>Issued: {formatDateTime(selectedDetails.invoice.issued_at)}</p>
                  <p>Paid: {formatDateTime(selectedDetails.invoice.paid_at)}</p>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
