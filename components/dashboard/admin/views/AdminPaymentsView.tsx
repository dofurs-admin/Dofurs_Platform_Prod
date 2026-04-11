'use client';

import { useState } from 'react';
import AdminPaginationControls from '@/components/dashboard/admin/AdminPaginationControls';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import { exportToCsv } from '@/lib/utils/export';

type AdminPaymentTransaction = {
  id: string;
  user_id: string;
  booking_id: number | null;
  transaction_type: string;
  status: string;
  amount_inr: number;
  provider: string;
  provider_payment_id: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_type?: string | null;
  booking_mode?: string | null;
  service_address?: string | null;
  service_pincode?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  checkout_context?: string | null;
  inferred?: boolean;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  return CURRENCY_FORMATTER.format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_TIME_FORMATTER.format(date);
}

function isInferredFallbackTransaction(transaction: AdminPaymentTransaction) {
  return transaction.inferred === true || transaction.transaction_type === 'invoice_paid_fallback' || transaction.provider === 'billing_invoice';
}

function formatTransactionType(transaction: AdminPaymentTransaction) {
  if (isInferredFallbackTransaction(transaction)) {
    return 'invoice_paid_fallback';
  }
  return transaction.transaction_type;
}

function formatMode(value: string | null | undefined) {
  if (!value) return 'N/A';
  return value.replaceAll('_', ' ');
}

function customerLabel(transaction: AdminPaymentTransaction) {
  if (transaction.customer_name) return transaction.customer_name;
  if (transaction.customer_email) return transaction.customer_email;
  if (transaction.customer_phone) return transaction.customer_phone;
  return transaction.user_id;
}

function serviceLocation(transaction: AdminPaymentTransaction) {
  const parts = [transaction.service_address ?? '', transaction.service_pincode ? `(${transaction.service_pincode})` : ''].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  if (transaction.booking_id == null) return 'Pending booking link';
  return 'Location not recorded';
}

function serviceLabel(transaction: AdminPaymentTransaction) {
  if (transaction.service_type) return transaction.service_type;
  if (transaction.transaction_type === 'subscription_purchase') return 'Subscription';
  if (transaction.transaction_type === 'service_collection') return 'Service booking';
  return 'Service context unavailable';
}

function modeLabel(transaction: AdminPaymentTransaction) {
  if (transaction.booking_mode) return formatMode(transaction.booking_mode);
  if (transaction.booking_id == null) return 'Pending booking link';
  return 'Mode not recorded';
}

function statusChipClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'captured' || normalized === 'paid' || normalized === 'paid_manual') {
    return 'border-emerald-300 bg-emerald-100 text-emerald-800';
  }
  if (normalized === 'initiated' || normalized === 'authorized') {
    return 'border-amber-300 bg-amber-100 text-amber-800';
  }
  if (normalized.includes('fail') || normalized === 'cancelled') {
    return 'border-rose-300 bg-rose-100 text-rose-800';
  }
  return 'border-neutral-300 bg-neutral-100 text-neutral-700';
}

const PAGE_SIZE = 30;

type AdminPaymentsViewProps = {
  transactions: AdminPaymentTransaction[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  statusFilter?: string;
  methodFilter?: string;
  serviceFilter?: string;
  statusOptions?: string[];
  methodOptions?: string[];
  serviceOptions?: string[];
  onStatusFilterChange?: (value: string) => void;
  onMethodFilterChange?: (value: string) => void;
  onServiceFilterChange?: (value: string) => void;
  onResetFilters?: () => void;
};

export default function AdminPaymentsView({
  transactions,
  isLoading,
  page,
  onPageChange,
  statusFilter = 'all',
  methodFilter = 'all',
  serviceFilter = 'all',
  statusOptions = ['all'],
  methodOptions = ['all'],
  serviceOptions = ['all'],
  onStatusFilterChange,
  onMethodFilterChange,
  onServiceFilterChange,
  onResetFilters,
}: AdminPaymentsViewProps) {
  const [density, setDensity] = useState<'compact' | 'expanded'>('expanded');
  const capturedCount = transactions.filter((tx) => tx.status === 'captured' || tx.status === 'paid').length;
  const initiatedCount = transactions.filter((tx) => tx.status === 'initiated' || tx.status === 'authorized').length;
  const inferredCount = transactions.filter((tx) => isInferredFallbackTransaction(tx)).length;

  return (
    <section className="space-y-4">
      <AdminSectionGuide
        title="How to Use Payments"
        subtitle="Track payment transactions and monitor collection status"
        steps={[
          { title: 'Browse Transactions', description: 'All payment transactions are listed below with customer info, amount, status, and payment method.' },
          { title: 'Understand Statuses', description: 'Captured/Paid = successful payment. Initiated/Authorized = pending. Failed = unsuccessful attempt.' },
          { title: 'Identify Types', description: 'Each transaction shows if it was for a booking service, subscription, or manual payment.' },
          { title: 'Search & Navigate', description: 'Use pagination to browse through all transactions. Each page shows the most recent first.' },
          { title: 'Export Data', description: 'Click "Export CSV" to download all payment data for accounting or reconciliation.' },
        ]}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-section-title">Payments Operations</h2>
          <p className="text-muted">Recent transactions including subscription and manual payment logs.</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
          onClick={() => exportToCsv(
            'payments-export',
            ['ID', 'Customer', 'User ID', 'Booking ID', 'Service', 'Mode', 'Location', 'Type', 'Status', 'Amount (INR)', 'Method', 'Reference', 'Provider', 'Created At'],
            transactions.map((t) => [
              t.id,
              customerLabel(t),
              t.user_id,
              t.booking_id ?? '',
              t.service_type ?? '',
              formatMode(t.booking_mode),
              serviceLocation(t),
              formatTransactionType(t),
              t.status,
              t.amount_inr,
              t.payment_method ?? t.provider,
              t.payment_reference ?? t.provider_payment_id ?? '',
              t.provider,
              t.created_at,
            ]),
          )}
        >
          Export CSV
        </button>
      </div>
      <div className="sticky top-20 z-20 rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Triage Filters</p>
          <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-0.5">
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-xs font-semibold ${density === 'compact' ? 'bg-neutral-900 text-white' : 'text-neutral-700'}`}
              onClick={() => setDensity('compact')}
            >
              Compact
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-xs font-semibold ${density === 'expanded' ? 'bg-neutral-900 text-white' : 'text-neutral-700'}`}
              onClick={() => setDensity('expanded')}
            >
              Expanded
            </button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-neutral-600">
          <span>Status</span>
          <select
            className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange?.(event.target.value)}
            disabled={!onStatusFilterChange}
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-600">
          <span>Method/Provider</span>
          <select
            className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
            value={methodFilter}
            onChange={(event) => onMethodFilterChange?.(event.target.value)}
            disabled={!onMethodFilterChange}
          >
            {methodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-600">
          <span>Service</span>
          <select
            className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
            value={serviceFilter}
            onChange={(event) => onServiceFilterChange?.(event.target.value)}
            disabled={!onServiceFilterChange}
          >
            {serviceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
            onClick={onResetFilters}
            disabled={!onResetFilters}
          >
            Reset Filters
          </button>
        </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Total Visible</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{transactions.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">Captured/Paid</p>
          <p className="mt-1 text-lg font-semibold text-emerald-800">{capturedCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-700">Pending + Inferred</p>
          <p className="mt-1 text-lg font-semibold text-amber-800">{initiatedCount + inferredCount}</p>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-4">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading payment operations...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-neutral-500">No payment transactions found.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {transactions
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((tx) => (
                  <div key={tx.id} className={`rounded-lg bg-neutral-50/60 px-3 ${density === 'compact' ? 'py-2' : 'py-3'} text-sm`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium text-neutral-900">
                        <span>{formatTransactionType(tx)}</span>
                        {isInferredFallbackTransaction(tx) ? (
                          <span
                            className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                            title="This row is inferred from a paid invoice because a linked payment transaction row is missing."
                          >
                            Inferred
                          </span>
                        ) : null}
                      </span>
                      <span className="text-neutral-600">{formatCurrency(tx.amount_inr)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusChipClass(tx.status)}`}>
                        {tx.status}
                      </span>
                      <span className="text-neutral-500">{formatDateTime(tx.created_at)}</span>
                    </div>
                    {density === 'compact' ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-600">
                        <span><span className="font-medium text-neutral-700">Customer:</span> {customerLabel(tx)}</span>
                        <span><span className="font-medium text-neutral-700">Service:</span> {serviceLabel(tx)}</span>
                        <span><span className="font-medium text-neutral-700">Method:</span> {tx.payment_method ?? tx.provider}</span>
                        <span className="text-neutral-500">{tx.booking_id ? `Booking #${tx.booking_id}` : 'Unlinked booking'}</span>
                      </div>
                    ) : (
                      <>
                        <div className="mt-1 grid gap-x-3 gap-y-1 text-xs text-neutral-600 sm:grid-cols-2 lg:grid-cols-4">
                          <span><span className="font-medium text-neutral-700">Customer:</span> {customerLabel(tx)}</span>
                          <span><span className="font-medium text-neutral-700">Service:</span> {serviceLabel(tx)}</span>
                          <span><span className="font-medium text-neutral-700">Mode:</span> {modeLabel(tx)}</span>
                          <span><span className="font-medium text-neutral-700">Method:</span> {tx.payment_method ?? tx.provider}</span>
                          <span className="sm:col-span-2 lg:col-span-2"><span className="font-medium text-neutral-700">Location:</span> {serviceLocation(tx)}</span>
                          <span className="sm:col-span-2 lg:col-span-2"><span className="font-medium text-neutral-700">Reference:</span> {tx.payment_reference ?? tx.provider_payment_id ?? 'Reference unavailable'}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          User ID: {tx.user_id}{tx.booking_id ? ` • Booking #${tx.booking_id}` : ''}
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
            <AdminPaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              total={transactions.length}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}
