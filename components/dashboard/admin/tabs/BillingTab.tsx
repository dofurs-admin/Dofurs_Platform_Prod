'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminBillingView from '@/components/dashboard/admin/views/AdminBillingView';
import InvoicePDFPreview from '@/components/ui/InvoicePDFPreview';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';
import { cn } from '@/lib/design-system';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminBillingInvoice = {
  id: string;
  user_id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  total_inr: number;
  wallet_credits_applied_inr?: number;
  created_at: string;
};

type BillingInvoiceUpdateStatus = 'draft' | 'issued' | 'paid';

type AdminBillingInvoiceDetail = AdminBillingInvoice & {
  booking_id: number | null;
  user_subscription_id: string | null;
  payment_transaction_id: string | null;
  subtotal_inr: number;
  discount_inr: number;
  tax_inr: number;
  wallet_credits_applied_inr: number;
  issued_at: string | null;
  paid_at: string | null;
  metadata?: Record<string, unknown> | null;
};

type AdminBillingInvoiceItem = {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_amount_inr: number;
  line_total_inr: number;
  created_at: string;
};

type AdminManualInvoiceDraft = {
  userId: string;
  invoiceType: 'service' | 'subscription';
  status: 'draft' | 'issued' | 'paid';
  subtotalInr: string;
  discountInr: string;
  taxInr: string;
  cgstInr: string;
  sgstInr: string;
  igstInr: string;
  gstin: string;
  hsnSacCode: string;
  description: string;
  bookingId: string;
  userSubscriptionId: string;
};

type AdminUserSearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  photo_url: string | null;
  created_at: string;
  role: string | null;
  profile_type: 'admin' | 'staff' | 'provider' | 'customer';
  pets: unknown[];
};

type InvoicePreset = {
  id: 'service_visit' | 'subscription_renewal' | 'credit_adjustment';
  label: string;
  description: string;
  defaults: Pick<AdminManualInvoiceDraft, 'invoiceType' | 'status' | 'description' | 'discountInr' | 'taxInr'>;
};

// Re-export billing-specific payload types from AdminBillingView
type BillingReconciliationSummary = Parameters<typeof AdminBillingView>[0]['reconciliationState']['summary'];
type BillingReconciliationCandidates = Parameters<typeof AdminBillingView>[0]['reconciliationState']['candidates'];
type BillingReminderQueue = Parameters<typeof AdminBillingView>[0]['reminderState']['queue'];
type BillingReminderScheduleStatus = Parameters<typeof AdminBillingView>[0]['reminderState']['scheduleStatus'];
type BillingReminderRunsHistory = Parameters<typeof AdminBillingView>[0]['reminderState']['runsHistory'];
type BillingEscalationQueue = Parameters<typeof AdminBillingView>[0]['escalationState']['queue'];
type BillingCollectionsMetrics = Parameters<typeof AdminBillingView>[0]['collectionsState']['metrics'];

const ADMIN_PAGE_SIZE = 30;

const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});
const ADMIN_CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function formatAdminCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  return ADMIN_CURRENCY_FORMATTER.format(value);
}

function formatAdminDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return ADMIN_DATE_TIME_FORMATTER.format(date);
}

const adminRawFieldClass =
  'rounded-xl border border-neutral-200/60 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1';

const INVOICE_PRESETS: InvoicePreset[] = [
  {
    id: 'service_visit',
    label: 'Service Visit Invoice',
    description: 'Standard post-service invoice with immediate issue state.',
    defaults: { invoiceType: 'service', status: 'issued', description: 'Professional service visit charge', discountInr: '0', taxInr: '0' },
  },
  {
    id: 'subscription_renewal',
    label: 'Subscription Renewal',
    description: 'Recurring subscription billing record, typically paid online.',
    defaults: { invoiceType: 'subscription', status: 'paid', description: 'Subscription renewal', discountInr: '0', taxInr: '0' },
  },
  {
    id: 'credit_adjustment',
    label: 'Credit Adjustment',
    description: 'Manual adjustment invoice for goodwill or operational correction.',
    defaults: { invoiceType: 'service', status: 'issued', description: 'Manual billing adjustment', discountInr: '0', taxInr: '0' },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

type BillingTabProps = {
  openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
};

export default function BillingTab({ openConfirm }: BillingTabProps) {
  const { showToast } = useToast();

  // Invoice list state
  const [billingInvoices, setBillingInvoices] = useState<AdminBillingInvoice[]>([]);
  const [billingInvoicePage, setBillingInvoicePage] = useState(1);
  const [billingInvoiceTotal, setBillingInvoiceTotal] = useState(0);
  const [isFinanceDataLoading, setIsFinanceDataLoading] = useState(false);
  const [billingStatusFilter, setBillingStatusFilter] = useState<'all' | BillingInvoiceUpdateStatus>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<'all' | 'service' | 'subscription'>('all');
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [billingSearchDebounced, setBillingSearchDebounced] = useState('');
  const [billingFromDate, setBillingFromDate] = useState('');
  const [billingToDate, setBillingToDate] = useState('');
  const [selectedBillingInvoiceIds, setSelectedBillingInvoiceIds] = useState<string[]>([]);
  const [billingBulkStatus, setBillingBulkStatus] = useState<BillingInvoiceUpdateStatus>('issued');
  const [isApplyingBillingBulkStatus, setIsApplyingBillingBulkStatus] = useState(false);

  // Reconciliation state
  const [billingReconciliation, setBillingReconciliation] = useState<BillingReconciliationSummary>(null);
  const [isBillingReconciliationLoading, setIsBillingReconciliationLoading] = useState(false);
  const [billingReconciliationCandidates, setBillingReconciliationCandidates] = useState<BillingReconciliationCandidates>(null);
  const [isBillingReconciliationCandidatesLoading, setIsBillingReconciliationCandidatesLoading] = useState(false);
  const [billingBulkAutoMatchConfidence, setBillingBulkAutoMatchConfidence] = useState(75);
  const [isRunningBillingBulkAutoMatch, setIsRunningBillingBulkAutoMatch] = useState(false);
  const [isResolvingReconciliation, setIsResolvingReconciliation] = useState(false);

  // Collections state
  const [billingCollectionsMetrics, setBillingCollectionsMetrics] = useState<BillingCollectionsMetrics>(null);
  const [isBillingCollectionsMetricsLoading, setIsBillingCollectionsMetricsLoading] = useState(false);

  // Reminder state
  const [billingReminderQueue, setBillingReminderQueue] = useState<BillingReminderQueue>(null);
  const [billingReminderScheduleStatus, setBillingReminderScheduleStatus] = useState<BillingReminderScheduleStatus>(null);
  const [billingReminderRunsHistory, setBillingReminderRunsHistory] = useState<BillingReminderRunsHistory>(null);
  const [isBillingReminderLoading, setIsBillingReminderLoading] = useState(false);
  const [isSendingBillingReminders, setIsSendingBillingReminders] = useState(false);
  const [isRunningBillingAutoReminders, setIsRunningBillingAutoReminders] = useState(false);
  const [selectedReminderInvoiceIds, setSelectedReminderInvoiceIds] = useState<string[]>([]);
  const [billingReminderTemplate, setBillingReminderTemplate] = useState<'due_soon' | 'overdue_7' | 'overdue_14'>('due_soon');
  const [billingReminderChannel, setBillingReminderChannel] = useState<'email' | 'whatsapp'>('whatsapp');
  const [billingReminderEnforceCadence, setBillingReminderEnforceCadence] = useState(true);
  const [billingAutoRunBucket, setBillingAutoRunBucket] = useState<'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'all'>('all');
  const [billingAutoRunDryRun, setBillingAutoRunDryRun] = useState(false);
  const [billingRunsStatusFilter, setBillingRunsStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [billingRunsSourceFilter, setBillingRunsSourceFilter] = useState<'all' | 'admin_panel' | 'scheduler'>('all');
  const [billingRunsModeFilter, setBillingRunsModeFilter] = useState<'all' | 'preview' | 'live'>('all');

  // Escalation state
  const [billingEscalationQueue, setBillingEscalationQueue] = useState<BillingEscalationQueue>(null);
  const [billingEscalationStateFilter, setBillingEscalationStateFilter] = useState<'active' | 'resolved' | 'all' | 'candidates'>('active');
  const [selectedEscalationInvoiceIds, setSelectedEscalationInvoiceIds] = useState<string[]>([]);
  const [billingEscalationActionNote, setBillingEscalationActionNote] = useState('');
  const [isBillingEscalationLoading, setIsBillingEscalationLoading] = useState(false);
  const [isApplyingBillingEscalationAction, setIsApplyingBillingEscalationAction] = useState(false);

  // Invoice detail modal
  const [isInvoiceDetailsModalOpen, setIsInvoiceDetailsModalOpen] = useState(false);
  const [isInvoiceDetailsLoading, setIsInvoiceDetailsLoading] = useState(false);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<AdminBillingInvoiceDetail | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<AdminBillingInvoiceItem[]>([]);

  // Create invoice modal
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [selectedInvoicePresetId, setSelectedInvoicePresetId] = useState<InvoicePreset['id'] | null>('service_visit');
  const [billingUserLookupQuery, setBillingUserLookupQuery] = useState('');
  const [billingUserLookupDebounced, setBillingUserLookupDebounced] = useState('');
  const [billingUserLookupResults, setBillingUserLookupResults] = useState<AdminUserSearchResult[]>([]);
  const [isBillingUserLookupLoading, setIsBillingUserLookupLoading] = useState(false);
  const [selectedBillingUserLabel, setSelectedBillingUserLabel] = useState('');
  const [manualInvoiceDraft, setManualInvoiceDraft] = useState<AdminManualInvoiceDraft>({
    userId: '', invoiceType: 'service', status: 'issued', subtotalInr: '', discountInr: '0', taxInr: '0',
    cgstInr: '0', sgstInr: '0', igstInr: '0', gstin: '', hsnSacCode: '', description: '', bookingId: '', userSubscriptionId: '',
  });

  // Debounce billing search
  useEffect(() => {
    const timeout = window.setTimeout(() => setBillingSearchDebounced(billingSearchQuery.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [billingSearchQuery]);

  // Debounce user lookup
  useEffect(() => {
    const timeout = window.setTimeout(() => setBillingUserLookupDebounced(billingUserLookupQuery.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [billingUserLookupQuery]);

  // Auto-calculate standard GST split from subtotal for manual invoice draft.
  useEffect(() => {
    const subtotal = Number(manualInvoiceDraft.subtotalInr || '0');
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      setManualInvoiceDraft((current) => ({
        ...current,
        taxInr: '0',
        cgstInr: '0',
        sgstInr: '0',
        igstInr: '0',
      }));
      return;
    }

    const tax = (subtotal * 0.18).toFixed(2);
    const cgst = (subtotal * 0.09).toFixed(2);
    const sgst = (subtotal * 0.09).toFixed(2);

    setManualInvoiceDraft((current) => ({
      ...current,
      taxInr: tax,
      cgstInr: cgst,
      sgstInr: sgst,
      igstInr: '0',
    }));
  }, [manualInvoiceDraft.subtotalInr]);

  // User lookup effect
  useEffect(() => {
    if (!isCreateInvoiceModalOpen || !billingUserLookupDebounced) {
      setBillingUserLookupResults([]);
      setIsBillingUserLookupLoading(false);
      return;
    }

    let isMounted = true;
    setIsBillingUserLookupLoading(true);

    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set('q', billingUserLookupDebounced);
        params.set('limit', '8');
        const response = await fetch(`/api/admin/users/search?${params.toString()}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { users?: AdminUserSearchResult[]; error?: string };
        if (!isMounted) return;
        if (!response.ok) throw new Error(payload.error ?? 'Unable to search users.');
        setBillingUserLookupResults(payload.users ?? []);
      } catch (err) { console.error(err);
        if (isMounted) setBillingUserLookupResults([]);
      } finally {
        if (isMounted) setIsBillingUserLookupLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [billingUserLookupDebounced, isCreateInvoiceModalOpen]);

  const fetchBillingInvoices = useCallback(async (page: number) => {
    const offset = (page - 1) * ADMIN_PAGE_SIZE;
    const params = new URLSearchParams();
    params.set('limit', String(ADMIN_PAGE_SIZE));
    params.set('offset', String(offset));
    if (billingStatusFilter !== 'all') params.set('status', billingStatusFilter);
    if (billingTypeFilter !== 'all') params.set('invoiceType', billingTypeFilter);
    if (billingSearchDebounced) params.set('q', billingSearchDebounced);
    if (billingFromDate) params.set('fromDate', billingFromDate);
    if (billingToDate) params.set('toDate', billingToDate);

    const res = await fetch(`/api/admin/billing/invoices?${params.toString()}`);
    const data = await res.json().catch(() => ({})) as { invoices?: AdminBillingInvoice[]; total?: number; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? 'Unable to load billing invoices.');
    }
    const nextInvoices = data.invoices ?? [];
    setBillingInvoices(nextInvoices);
    setBillingInvoiceTotal(data.total ?? 0);
    setSelectedBillingInvoiceIds((c) => c.filter((id) => nextInvoices.some((inv) => inv.id === id)));
  }, [billingFromDate, billingSearchDebounced, billingStatusFilter, billingToDate, billingTypeFilter]);

  const refreshFinanceData = useCallback(async () => {
    setIsFinanceDataLoading(true);
    try {
      setBillingInvoicePage(1);
      await fetchBillingInvoices(1);
    } catch (err) { console.error(err);
      showToast('Unable to load finance data.', 'error');
    } finally {
      setIsFinanceDataLoading(false);
    }
  }, [fetchBillingInvoices, showToast]);

  const refreshBillingReconciliation = useCallback(async () => {
    setIsBillingReconciliationLoading(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation?limit=400', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as (BillingReconciliationSummary & { error?: string }) | null;
      if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to load reconciliation.');
      setBillingReconciliation(payload as BillingReconciliationSummary);
    } catch (error) {
      setBillingReconciliation(null);
      showToast(error instanceof Error ? error.message : 'Unable to load reconciliation.', 'error');
    } finally {
      setIsBillingReconciliationLoading(false);
    }
  }, [showToast]);

  const refreshBillingReconciliationCandidates = useCallback(async () => {
    setIsBillingReconciliationCandidatesLoading(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation/candidates?limit=120', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as (BillingReconciliationCandidates & { error?: string }) | null;
      if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to load candidates.');
      setBillingReconciliationCandidates(payload as BillingReconciliationCandidates);
    } catch (error) {
      setBillingReconciliationCandidates(null);
      showToast(error instanceof Error ? error.message : 'Unable to load candidates.', 'error');
    } finally {
      setIsBillingReconciliationCandidatesLoading(false);
    }
  }, [showToast]);

  const refreshBillingReminders = useCallback(async () => {
    setIsBillingReminderLoading(true);
    try {
      const [queueRes, scheduleRes, runsRes] = await Promise.all([
        fetch('/api/admin/billing/reminders?limit=300', { cache: 'no-store' }),
        fetch('/api/admin/billing/reminders/schedule', { cache: 'no-store' }),
        fetch('/api/admin/billing/reminders/runs?limit=20', { cache: 'no-store' }),
      ]);
      const queue = await queueRes.json().catch(() => ({})) as BillingReminderQueue & { error?: string };
      const schedule = await scheduleRes.json().catch(() => ({})) as BillingReminderScheduleStatus;
      const runs = await runsRes.json().catch(() => ({})) as BillingReminderRunsHistory;
      if (!queueRes.ok) throw new Error((queue as { error?: string }).error ?? 'Unable to load reminder queue.');
      setBillingReminderQueue(queue as BillingReminderQueue);
      setSelectedReminderInvoiceIds((c) => c.filter((id) => ((queue as BillingReminderQueue)?.queue ?? []).some((r) => r.invoice_id === id)));
      if (scheduleRes.ok) setBillingReminderScheduleStatus(schedule as BillingReminderScheduleStatus);
      if (runsRes.ok) setBillingReminderRunsHistory(runs as BillingReminderRunsHistory);
    } catch (error) {
      setBillingReminderQueue(null);
      showToast(error instanceof Error ? error.message : 'Unable to load reminder queue.', 'error');
    } finally {
      setIsBillingReminderLoading(false);
    }
  }, [showToast]);

  const refreshBillingCollectionsMetrics = useCallback(async () => {
    setIsBillingCollectionsMetricsLoading(true);
    try {
      const response = await fetch('/api/admin/billing/metrics?limit=800', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as BillingCollectionsMetrics & { error?: string };
      if (!response.ok) throw new Error((payload as { error?: string }).error ?? 'Unable to load collections metrics.');
      setBillingCollectionsMetrics(payload as BillingCollectionsMetrics);
    } catch (error) {
      setBillingCollectionsMetrics(null);
      showToast(error instanceof Error ? error.message : 'Unable to load metrics.', 'error');
    } finally {
      setIsBillingCollectionsMetricsLoading(false);
    }
  }, [showToast]);

  const refreshBillingEscalations = useCallback(async () => {
    setIsBillingEscalationLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('state', billingEscalationStateFilter);
      params.set('limit', '800');
      const response = await fetch(`/api/admin/billing/escalations?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as BillingEscalationQueue & { error?: string };
      if (!response.ok) throw new Error((payload as { error?: string }).error ?? 'Unable to load escalation queue.');
      setBillingEscalationQueue(payload as BillingEscalationQueue);
      setSelectedEscalationInvoiceIds((c) => c.filter((id) => ((payload as BillingEscalationQueue)?.queue ?? []).some((r) => r.invoice_id === id)));
    } catch (error) {
      setBillingEscalationQueue(null);
      showToast(error instanceof Error ? error.message : 'Unable to load escalations.', 'error');
    } finally {
      setIsBillingEscalationLoading(false);
    }
  }, [billingEscalationStateFilter, showToast]);

  // Load all billing data on mount
  useEffect(() => {
    void refreshFinanceData();
    void refreshBillingReconciliation();
    void refreshBillingReconciliationCandidates();
    void refreshBillingReminders();
    void refreshBillingCollectionsMetrics();
    void refreshBillingEscalations();
  }, [
    refreshFinanceData, refreshBillingReconciliation, refreshBillingReconciliationCandidates,
    refreshBillingReminders, refreshBillingCollectionsMetrics, refreshBillingEscalations,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshFinanceData();
      void refreshBillingReminders();
      void refreshBillingReconciliation();
    }, 45_000);

    return () => window.clearInterval(intervalId);
  }, [refreshFinanceData, refreshBillingReminders, refreshBillingReconciliation]);

  const filteredBillingReminderRuns = useMemo(() => {
    const runs = billingReminderRunsHistory?.runs ?? [];
    return runs.filter((run) => {
      if (billingRunsStatusFilter !== 'all' && run.status !== billingRunsStatusFilter) return false;
      if (billingRunsSourceFilter !== 'all' && run.trigger_source !== billingRunsSourceFilter) return false;
      if (billingRunsModeFilter === 'preview' && !run.dry_run) return false;
      if (billingRunsModeFilter === 'live' && run.dry_run) return false;
      return true;
    });
  }, [billingReminderRunsHistory, billingRunsModeFilter, billingRunsSourceFilter, billingRunsStatusFilter]);

  // Action handlers
  function toggleBillingInvoiceSelection(invoiceId: string) {
    setSelectedBillingInvoiceIds((c) => c.includes(invoiceId) ? c.filter((id) => id !== invoiceId) : [...c, invoiceId]);
  }

  function toggleSelectAllVisibleBillingInvoices() {
    const visibleIds = billingInvoices.map((inv) => inv.id);
    setSelectedBillingInvoiceIds((c) => {
      if (visibleIds.length > 0 && visibleIds.every((id) => c.includes(id))) return c.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...c, ...visibleIds]));
    });
  }

  function resetBillingFilters() {
    setBillingStatusFilter('all');
    setBillingTypeFilter('all');
    setBillingSearchQuery('');
    setBillingSearchDebounced('');
    setBillingFromDate('');
    setBillingToDate('');
  }

  function applyBillingBulkStatus() {
    if (selectedBillingInvoiceIds.length === 0) { showToast('Select at least one invoice first.', 'error'); return; }
    openConfirm({
      title: 'Update Invoice Status',
      description: `Update ${selectedBillingInvoiceIds.length} invoice(s) to status "${billingBulkStatus}"?`,
      confirmLabel: 'Update Status',
      confirmVariant: 'warning',
      onConfirm: () => void doApplyBillingBulkStatus(),
    });
  }

  async function doApplyBillingBulkStatus() {
    setIsApplyingBillingBulkStatus(true);
    try {
      const response = await fetch('/api/admin/billing/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: selectedBillingInvoiceIds, status: billingBulkStatus }),
      });
      const payload = await response.json().catch(() => ({})) as { updated?: number; invoices?: AdminBillingInvoice[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update statuses.');
      const updated = payload.invoices ?? [];
      if (updated.length > 0) {
        const updatedById = new Map(updated.map((inv) => [inv.id, inv]));
        setBillingInvoices((c) => c.map((inv) => updatedById.get(inv.id) ?? inv));
      }
      setSelectedBillingInvoiceIds([]);
      showToast(`Updated ${payload.updated ?? updated.length} invoice(s) to ${billingBulkStatus}.`, 'success');
      await refreshFinanceData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update statuses.', 'error');
    } finally {
      setIsApplyingBillingBulkStatus(false);
    }
  }

  function exportBillingCsv() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('limit', '5000');
    if (billingStatusFilter !== 'all') params.set('status', billingStatusFilter);
    if (billingTypeFilter !== 'all') params.set('invoiceType', billingTypeFilter);
    if (billingSearchDebounced) params.set('q', billingSearchDebounced);
    if (billingFromDate) params.set('fromDate', billingFromDate);
    if (billingToDate) params.set('toDate', billingToDate);
    window.open(`/api/admin/billing/invoices/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  function exportBillingFollowupsCsv() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('limit', '10000');
    params.set('bucket', billingAutoRunBucket);
    window.open(`/api/admin/billing/followups/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  async function openInvoiceDetails(invoiceId: string) {
    setIsInvoiceDetailsModalOpen(true);
    setIsInvoiceDetailsLoading(true);
    setSelectedInvoiceDetails(null);
    setSelectedInvoiceItems([]);
    try {
      const response = await fetch(`/api/admin/billing/invoices/${invoiceId}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { invoice?: AdminBillingInvoiceDetail; items?: AdminBillingInvoiceItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load invoice details.');
      if (!payload.invoice) throw new Error('Invoice details unavailable.');
      setSelectedInvoiceDetails(payload.invoice);
      setSelectedInvoiceItems(payload.items ?? []);
    } catch (error) {
      setIsInvoiceDetailsModalOpen(false);
      showToast(error instanceof Error ? error.message : 'Unable to load invoice details.', 'error');
    } finally {
      setIsInvoiceDetailsLoading(false);
    }
  }

  function openInvoicePrint(invoiceId: string) {
    window.open(`/api/admin/billing/invoices/${invoiceId}/print`, '_blank', 'noopener,noreferrer');
  }

  function downloadInvoicePdf(invoiceId: string) {
    window.open(`/api/admin/billing/invoices/${invoiceId}/pdf`, '_blank', 'noopener,noreferrer');
  }

  async function copyInvoiceLink(invoiceId: string) {
    try {
      const url = `${window.location.origin}/api/admin/billing/invoices/${invoiceId}/print`;
      await navigator.clipboard.writeText(url);
      showToast('Invoice link copied.', 'success');
    } catch (err) { console.error(err);
      showToast('Unable to copy invoice link.', 'error');
    }
  }

  function toggleReminderInvoiceSelection(invoiceId: string) {
    setSelectedReminderInvoiceIds((c) => c.includes(invoiceId) ? c.filter((id) => id !== invoiceId) : [...c, invoiceId]);
  }

  async function sendBillingReminders() {
    if (selectedReminderInvoiceIds.length === 0) { showToast('Select at least one invoice.', 'error'); return; }
    setIsSendingBillingReminders(true);
    try {
      const response = await fetch('/api/admin/billing/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: selectedReminderInvoiceIds, template: billingReminderTemplate, channel: billingReminderChannel, enforceCadence: billingReminderEnforceCadence }),
      });
      const payload = await response.json().catch(() => ({})) as { sent?: number; skipped?: Array<{ invoice_id: string; reason: string }>; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to send reminders.');
      const skippedCount = payload.skipped?.length ?? 0;
      const sentCount = payload.sent ?? selectedReminderInvoiceIds.length;
      showToast(skippedCount > 0 ? `Reminders queued: ${sentCount}. Skipped: ${skippedCount}.` : `Reminder dispatch queued for ${sentCount} invoice(s).`, 'success');
      setSelectedReminderInvoiceIds([]);
      await refreshBillingReminders();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to send reminders.', 'error');
    } finally {
      setIsSendingBillingReminders(false);
    }
  }

  async function runBillingAutoReminders() {
    setIsRunningBillingAutoReminders(true);
    try {
      const response = await fetch('/api/admin/billing/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: billingAutoRunBucket, channel: billingReminderChannel, enforceCadence: billingReminderEnforceCadence, enforceCooldown: true, dryRun: billingAutoRunDryRun }),
      });
      const payload = await response.json().catch(() => ({})) as { scanned?: number; sent?: number; escalated?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to run auto reminders.');
      showToast(
        billingAutoRunDryRun
          ? `Preview: would scan ${payload.scanned ?? 0}, send ${payload.sent ?? 0}, escalate ${payload.escalated ?? 0}.`
          : `Auto-run: scanned ${payload.scanned ?? 0}, sent ${payload.sent ?? 0}, escalated ${payload.escalated ?? 0}.`,
        'success',
      );
      await Promise.all([refreshBillingReminders(), refreshBillingEscalations()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to run auto reminders.', 'error');
    } finally {
      setIsRunningBillingAutoReminders(false);
    }
  }

  function toggleEscalationInvoiceSelection(invoiceId: string) {
    setSelectedEscalationInvoiceIds((c) => c.includes(invoiceId) ? c.filter((id) => id !== invoiceId) : [...c, invoiceId]);
  }

  async function applyBillingEscalationAction(action: 'escalate' | 'resolve' | 'snooze_48h' | 'clear') {
    if (selectedEscalationInvoiceIds.length === 0) { showToast('Select at least one invoice.', 'error'); return; }
    if (action === 'escalate' || action === 'resolve') {
      const count = selectedEscalationInvoiceIds.length;
      openConfirm({
        title: action === 'escalate' ? 'Escalate Invoices' : 'Resolve Escalations',
        description: action === 'escalate' ? `Escalate ${count} invoice(s) for manual follow-up.` : `Mark ${count} invoice(s) as resolved.`,
        confirmLabel: action === 'escalate' ? 'Escalate' : 'Resolve',
        confirmVariant: action === 'escalate' ? 'danger' : 'warning',
        onConfirm: () => void doApplyBillingEscalationAction(action),
      });
      return;
    }
    await doApplyBillingEscalationAction(action);
  }

  async function doApplyBillingEscalationAction(action: 'escalate' | 'resolve' | 'snooze_48h' | 'clear') {
    setIsApplyingBillingEscalationAction(true);
    try {
      const response = await fetch('/api/admin/billing/escalations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: selectedEscalationInvoiceIds, action, note: billingEscalationActionNote }),
      });
      const payload = await response.json().catch(() => ({})) as { updated?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to apply action.');
      showToast(`Action applied to ${payload.updated ?? selectedEscalationInvoiceIds.length} invoice(s).`, 'success');
      setSelectedEscalationInvoiceIds([]);
      setBillingEscalationActionNote('');
      await Promise.all([refreshBillingEscalations(), refreshBillingReminders()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to apply action.', 'error');
    } finally {
      setIsApplyingBillingEscalationAction(false);
    }
  }

  async function resolveReconciliationMismatch(
    action: 'link_payment_reference' | 'clear_payment_reference' | 'sync_invoice_total_to_payment' | 'auto_match_missing_reference',
    invoiceId: string,
  ) {
    if (action !== 'clear_payment_reference' && action !== 'auto_match_missing_reference') {
      openConfirm({
        title: 'Link Payment Reference',
        description: 'Enter the Razorpay payment transaction ID to link to this invoice.',
        confirmLabel: 'Apply Resolution',
        confirmVariant: 'default',
        inputLabel: 'Payment transaction ID',
        inputRequired: true,
        inputPlaceholder: 'e.g. pay_XXXXXXXXXX',
        onConfirm: (transactionId) => void doResolveReconciliationMismatch(action, invoiceId, transactionId),
      });
      return;
    }
    await doResolveReconciliationMismatch(action, invoiceId, undefined);
  }

  async function doResolveReconciliationMismatch(
    action: 'link_payment_reference' | 'clear_payment_reference' | 'sync_invoice_total_to_payment' | 'auto_match_missing_reference',
    invoiceId: string,
    paymentTransactionId: string | undefined,
  ) {
    setIsResolvingReconciliation(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, invoiceId, paymentTransactionId }),
      });
      const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string; confidence?: number; candidateCount?: number };
      if (!response.ok) {
        const detail = payload.confidence !== undefined ? ` (confidence ${payload.confidence}${payload.candidateCount !== undefined ? `, candidates ${payload.candidateCount}` : ''})` : '';
        throw new Error((payload.error ?? 'Unable to resolve mismatch.') + detail);
      }
      showToast('Reconciliation resolution applied.', 'success');
      await Promise.all([refreshBillingReconciliation(), refreshBillingReconciliationCandidates(), refreshFinanceData()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to resolve mismatch.', 'error');
    } finally {
      setIsResolvingReconciliation(false);
    }
  }

  async function runBillingBulkAutoMatch() {
    setIsRunningBillingBulkAutoMatch(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minConfidence: billingBulkAutoMatchConfidence, limit: 40 }),
      });
      const payload = await response.json().catch(() => ({})) as { matched?: number; considered?: number; skipped?: unknown[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to run bulk auto-match.');
      showToast(`Bulk auto-match: matched ${payload.matched ?? 0} of ${payload.considered ?? 0}, skipped ${(payload.skipped as unknown[])?.length ?? 0}.`, 'success');
      await Promise.all([refreshBillingReconciliation(), refreshBillingReconciliationCandidates(), refreshFinanceData()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to run bulk auto-match.', 'error');
    } finally {
      setIsRunningBillingBulkAutoMatch(false);
    }
  }

  // Create Invoice
  function resetManualInvoiceComposer() {
    setManualInvoiceDraft({
      userId: '', invoiceType: 'service', status: 'issued', subtotalInr: '', discountInr: '0', taxInr: '0',
      cgstInr: '0', sgstInr: '0', igstInr: '0', gstin: '', hsnSacCode: '', description: '', bookingId: '', userSubscriptionId: '',
    });
    setSelectedInvoicePresetId(null);
    setSelectedBillingUserLabel('');
    setBillingUserLookupQuery('');
    setBillingUserLookupDebounced('');
    setBillingUserLookupResults([]);
  }

  function applyInvoicePreset(presetId: InvoicePreset['id']) {
    const preset = INVOICE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedInvoicePresetId(presetId);
    setManualInvoiceDraft((c) => ({
      ...c,
      invoiceType: preset.defaults.invoiceType,
      status: preset.defaults.status,
      description: preset.defaults.description,
      discountInr: preset.defaults.discountInr,
      taxInr: preset.defaults.taxInr,
    }));
  }

  function selectBillingUser(user: AdminUserSearchResult) {
    setManualInvoiceDraft((c) => ({ ...c, userId: user.id }));
    setSelectedBillingUserLabel(user.name ?? user.email ?? user.phone ?? 'Unnamed user');
    setBillingUserLookupQuery('');
    setBillingUserLookupDebounced('');
    setBillingUserLookupResults([]);
  }

  async function createManualInvoice() {
    const subtotal = Number(manualInvoiceDraft.subtotalInr || '0');
    const discount = Number(manualInvoiceDraft.discountInr || '0');
    const tax = Number(manualInvoiceDraft.taxInr || '0');

    if (!manualInvoiceDraft.userId.trim()) { showToast('Select a customer from User Lookup.', 'error'); return; }
    if (!manualInvoiceDraft.description.trim()) { showToast('Description is required.', 'error'); return; }
    if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(discount) || discount < 0 || !Number.isFinite(tax) || tax < 0) {
      showToast('Subtotal, discount and tax must be valid non-negative numbers.', 'error'); return;
    }

    setIsCreatingInvoice(true);
    try {
      const response = await fetch('/api/admin/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: manualInvoiceDraft.userId.trim(),
          invoiceType: manualInvoiceDraft.invoiceType,
          status: manualInvoiceDraft.status,
          subtotalInr: subtotal,
          discountInr: discount,
          taxInr: tax,
          cgstInr: Number(manualInvoiceDraft.cgstInr || '0'),
          sgstInr: Number(manualInvoiceDraft.sgstInr || '0'),
          igstInr: Number(manualInvoiceDraft.igstInr || '0'),
          gstin: manualInvoiceDraft.gstin.trim() || undefined,
          hsnSacCode: manualInvoiceDraft.hsnSacCode.trim() || undefined,
          description: manualInvoiceDraft.description.trim(),
          bookingId: manualInvoiceDraft.bookingId.trim() ? Number(manualInvoiceDraft.bookingId) : undefined,
          userSubscriptionId: manualInvoiceDraft.userSubscriptionId.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { invoice?: AdminBillingInvoice; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to create invoice.');
      if (payload.invoice) setBillingInvoices((c) => [payload.invoice!, ...c]);
      else await refreshFinanceData();
      setIsCreateInvoiceModalOpen(false);
      resetManualInvoiceComposer();
      showToast('Manual invoice created successfully.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create invoice.', 'error');
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  return (
    <>
      <AdminBillingView
        pageSize={ADMIN_PAGE_SIZE}
        invoiceState={{
          invoices: billingInvoices,
          page: billingInvoicePage,
          total: billingInvoiceTotal,
          isLoading: isFinanceDataLoading,
          selectedIds: selectedBillingInvoiceIds,
          bulkStatus: billingBulkStatus,
          isApplyingBulk: isApplyingBillingBulkStatus,
        }}
        filterState={{
          searchQuery: billingSearchQuery,
          statusFilter: billingStatusFilter,
          typeFilter: billingTypeFilter,
          fromDate: billingFromDate,
          toDate: billingToDate,
        }}
        reconciliationState={{
          summary: billingReconciliation,
          candidates: billingReconciliationCandidates,
          isSummaryLoading: isBillingReconciliationLoading,
          isCandidatesLoading: isBillingReconciliationCandidatesLoading,
          isResolving: isResolvingReconciliation,
          bulkAutoMatchConfidence: billingBulkAutoMatchConfidence,
          isRunningBulkAutoMatch: isRunningBillingBulkAutoMatch,
        }}
        collectionsState={{ metrics: billingCollectionsMetrics, isLoading: isBillingCollectionsMetricsLoading }}
        reminderState={{
          queue: billingReminderQueue,
          scheduleStatus: billingReminderScheduleStatus,
          runsHistory: billingReminderRunsHistory,
          filteredRuns: filteredBillingReminderRuns,
          isLoading: isBillingReminderLoading,
          isSending: isSendingBillingReminders,
          isRunningAuto: isRunningBillingAutoReminders,
          selectedInvoiceIds: selectedReminderInvoiceIds,
          template: billingReminderTemplate,
          channel: billingReminderChannel,
          enforceCadence: billingReminderEnforceCadence,
          autoRunDryRun: billingAutoRunDryRun,
          autoRunBucket: billingAutoRunBucket,
          runsStatusFilter: billingRunsStatusFilter,
          runsSourceFilter: billingRunsSourceFilter,
          runsModeFilter: billingRunsModeFilter,
        }}
        escalationState={{
          queue: billingEscalationQueue,
          isLoading: isBillingEscalationLoading,
          isApplyingAction: isApplyingBillingEscalationAction,
          selectedInvoiceIds: selectedEscalationInvoiceIds,
          stateFilter: billingEscalationStateFilter,
          actionNote: billingEscalationActionNote,
        }}
        formatCurrency={formatAdminCurrency}
        formatDateTime={formatAdminDateTime}
        onCreateInvoice={() => { resetManualInvoiceComposer(); setIsCreateInvoiceModalOpen(true); }}
        onRefreshLedger={() => void refreshFinanceData()}
        onExportCsv={exportBillingCsv}
        onExportFollowupsCsv={exportBillingFollowupsCsv}
        onResetFilters={resetBillingFilters}
        onSearchChange={setBillingSearchQuery}
        onStatusFilterChange={(v) => setBillingStatusFilter(v as typeof billingStatusFilter)}
        onTypeFilterChange={(v) => setBillingTypeFilter(v as typeof billingTypeFilter)}
        onFromDateChange={setBillingFromDate}
        onToDateChange={setBillingToDate}
        onToggleInvoiceSelection={toggleBillingInvoiceSelection}
        onToggleSelectAllVisible={toggleSelectAllVisibleBillingInvoices}
        onBulkStatusChange={setBillingBulkStatus}
        onApplyBulkStatus={applyBillingBulkStatus}
        onViewInvoiceDetails={openInvoiceDetails}
        onDownloadInvoicePdf={downloadInvoicePdf}
        onCopyInvoiceLink={copyInvoiceLink}
        onOpenInvoicePrint={openInvoicePrint}
        onPageChange={(page) => { setBillingInvoicePage(page); void fetchBillingInvoices(page); }}
        onRunReconciliation={refreshBillingReconciliation}
        onResolveReconciliationMismatch={resolveReconciliationMismatch}
        onBulkAutoMatchConfidenceChange={setBillingBulkAutoMatchConfidence}
        onRunBulkAutoMatch={runBillingBulkAutoMatch}
        onRefreshReconciliationCandidates={refreshBillingReconciliationCandidates}
        onRefreshCollectionsMetrics={refreshBillingCollectionsMetrics}
        onRefreshReminders={refreshBillingReminders}
        onReminderTemplateChange={setBillingReminderTemplate}
        onReminderChannelChange={setBillingReminderChannel}
        onReminderEnforceCadenceChange={setBillingReminderEnforceCadence}
        onAutoRunDryRunChange={setBillingAutoRunDryRun}
        onAutoRunBucketChange={setBillingAutoRunBucket}
        onSendReminders={sendBillingReminders}
        onRunAutoReminders={runBillingAutoReminders}
        onToggleReminderInvoiceSelection={toggleReminderInvoiceSelection}
        onRunsStatusFilterChange={setBillingRunsStatusFilter}
        onRunsSourceFilterChange={setBillingRunsSourceFilter}
        onRunsModeFilterChange={setBillingRunsModeFilter}
        onRefreshEscalations={refreshBillingEscalations}
        onEscalationStateFilterChange={(v) => setBillingEscalationStateFilter(v as typeof billingEscalationStateFilter)}
        onEscalationActionNoteChange={setBillingEscalationActionNote}
        onApplyEscalationAction={applyBillingEscalationAction}
        onToggleEscalationInvoiceSelection={toggleEscalationInvoiceSelection}
      />

      {/* Invoice Details Modal */}
      <Modal
        isOpen={isInvoiceDetailsModalOpen}
        onClose={() => { if (isInvoiceDetailsLoading) return; setIsInvoiceDetailsModalOpen(false); }}
        size="xl"
        title="Invoice Details"
        description="Review line items, totals, and status before sharing or printing."
      >
        {isInvoiceDetailsLoading ? (
          <p className="text-sm text-neutral-500">Loading invoice details...</p>
        ) : !selectedInvoiceDetails ? (
          <p className="text-sm text-neutral-500">Invoice details are unavailable.</p>
        ) : (
          <InvoicePDFPreview
            invoice={selectedInvoiceDetails}
            items={selectedInvoiceItems}
            onDownload={() => downloadInvoicePdf(selectedInvoiceDetails.id)}
            onCopyLink={() => void copyInvoiceLink(selectedInvoiceDetails.id)}
            onPrint={() => openInvoicePrint(selectedInvoiceDetails.id)}
          />
        )}
      </Modal>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={isCreateInvoiceModalOpen}
        onClose={() => { if (isCreatingInvoice) return; resetManualInvoiceComposer(); setIsCreateInvoiceModalOpen(false); }}
        size="xl"
        title="Create Manual Invoice"
        description="Generate an invoice for a specific user with full control over status, amounts, and linkage."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Invoice Presets</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {INVOICE_PRESETS.map((preset) => {
                const isSelected = selectedInvoicePresetId === preset.id;
                return (
                  <button key={preset.id} type="button" onClick={() => applyInvoicePreset(preset.id)}
                    className={cn('rounded-xl border px-3 py-2 text-left transition-colors', isSelected ? 'border-coral bg-coral/10' : 'border-neutral-200 bg-white hover:border-neutral-300')}>
                    <p className="text-xs font-semibold text-neutral-900">{preset.label}</p>
                    <p className="mt-1 text-[11px] text-neutral-600">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">User Lookup</p>
            {manualInvoiceDraft.userId ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                <p className="font-semibold">Selected Customer</p>
                <p className="mt-1">{selectedBillingUserLabel}</p>
              </div>
            ) : null}
            <input
              value={billingUserLookupQuery}
              onChange={(e) => {
                const nextValue = e.target.value;
                setBillingUserLookupQuery(nextValue);
                setManualInvoiceDraft((c) => ({ ...c, userId: '' }));
                setSelectedBillingUserLabel('');
              }}
              placeholder="Search customer by name, email, phone, or user id"
              className={cn('w-full', adminRawFieldClass)}
            />
            {isBillingUserLookupLoading ? <p className="text-xs text-neutral-500">Searching users...</p> : null}
            {!isBillingUserLookupLoading && billingUserLookupDebounced && billingUserLookupResults.length === 0 ? <p className="text-xs text-neutral-500">No matching users found.</p> : null}
            {billingUserLookupResults.length > 0 ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2">
                {billingUserLookupResults.map((user) => (
                  <button key={user.id} type="button" onClick={() => selectBillingUser(user)} className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-left hover:border-neutral-300">
                    <p className="text-xs font-semibold text-neutral-900">
                      {user.name ?? 'Unnamed user'}
                      <span className="ml-2 rounded-full border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">{user.profile_type}</span>
                    </p>
                    <p className="text-[11px] text-neutral-600">{user.email ?? user.phone ?? user.id}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">Invoice Type</span>
              <select
                value={manualInvoiceDraft.invoiceType}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, invoiceType: e.target.value as 'service' | 'subscription' }))}
                className={cn('w-full', adminRawFieldClass)}
              >
                <option value="service">Service Invoice</option>
                <option value="subscription">Subscription Invoice</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">Status</span>
              <select
                value={manualInvoiceDraft.status}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, status: e.target.value as 'draft' | 'issued' | 'paid' }))}
                className={cn('w-full', adminRawFieldClass)}
              >
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">Subtotal (INR)</span>
              <input
                value={manualInvoiceDraft.subtotalInr}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, subtotalInr: e.target.value }))}
                placeholder="Enter subtotal"
                className={cn('w-full', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">Discount (INR)</span>
              <input
                value={manualInvoiceDraft.discountInr}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, discountInr: e.target.value }))}
                placeholder="0"
                className={cn('w-full', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">GST Total (18%)</span>
              <input
                value={manualInvoiceDraft.taxInr}
                readOnly
                className={cn('w-full bg-neutral-50 text-neutral-600', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">CGST (9%)</span>
              <input
                value={manualInvoiceDraft.cgstInr}
                readOnly
                className={cn('w-full bg-neutral-50 text-neutral-600', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">SGST (9%)</span>
              <input
                value={manualInvoiceDraft.sgstInr}
                readOnly
                className={cn('w-full bg-neutral-50 text-neutral-600', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">IGST (Inter-state)</span>
              <input
                value={manualInvoiceDraft.igstInr}
                readOnly
                className={cn('w-full bg-neutral-50 text-neutral-600', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">GSTIN (optional)</span>
              <input
                value={manualInvoiceDraft.gstin}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, gstin: e.target.value }))}
                placeholder="Enter GSTIN"
                className={cn('w-full', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">HSN/SAC Code (optional)</span>
              <input
                value={manualInvoiceDraft.hsnSacCode}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, hsnSacCode: e.target.value }))}
                placeholder="Enter HSN/SAC code"
                className={cn('w-full', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">Booking ID (optional)</span>
              <input
                value={manualInvoiceDraft.bookingId}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, bookingId: e.target.value }))}
                placeholder="Enter booking id"
                className={cn('w-full', adminRawFieldClass)}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-700">
              <span className="font-medium">User Subscription ID (optional)</span>
              <input
                value={manualInvoiceDraft.userSubscriptionId}
                onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, userSubscriptionId: e.target.value }))}
                placeholder="Enter subscription id"
                className={cn('w-full', adminRawFieldClass)}
              />
            </label>
          </div>

          <textarea rows={2} value={manualInvoiceDraft.description} onChange={(e) => setManualInvoiceDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Line item description" className={cn('w-full', adminRawFieldClass)} />

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            Invoice total preview:{' '}
            {formatAdminCurrency(Math.max(0,
              Number(manualInvoiceDraft.subtotalInr || '0') - Number(manualInvoiceDraft.discountInr || '0') +
              Number(manualInvoiceDraft.taxInr || '0'),
            ))}
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { resetManualInvoiceComposer(); setIsCreateInvoiceModalOpen(false); }} disabled={isCreatingInvoice} className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0] disabled:opacity-60">Cancel</button>
            <button type="button" onClick={() => void createManualInvoice()} disabled={isCreatingInvoice} className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
              {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
