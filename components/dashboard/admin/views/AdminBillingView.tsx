'use client';

import { useState } from 'react';
import { cn } from '@/lib/design-system';
import AdminPaginationControls from '@/components/dashboard/admin/AdminPaginationControls';

// ── Types ──────────────────────────────────────────────────────────────────

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

type BillingReconciliationSummary = {
  checked_at: string;
  totals: {
    invoices: number;
    transactions: number;
    matched: number;
    mismatched: number;
    unlinkedTransactions: number;
    paidInvoicesMissingPaymentRef: number;
    amountMismatches: number;
  };
  mismatches: Array<{
    invoice_id: string;
    invoice_number: string;
    reason: 'missing_transaction' | 'amount_mismatch';
    invoice_total_inr: number;
    payment_transaction_id: string | null;
    payment_amount_inr: number | null;
  }>;
  paidInvoicesMissingPaymentRef: Array<{
    invoice_id: string;
    invoice_number: string;
    total_inr: number;
    created_at: string;
  }>;
  unlinkedTransactions: Array<{
    payment_transaction_id: string;
    status: string;
    amount_inr: number;
    provider_payment_id: string | null;
    created_at: string;
  }>;
};

type BillingReconciliationCandidates = {
  generated_at: string;
  totals: {
    invoices_considered: number;
    with_candidates: number;
    auto_match_ready: number;
    manual_review_required: number;
  };
  queue: Array<{
    invoice_id: string;
    invoice_number: string;
    status: string;
    total_inr: number;
    issued_at: string | null;
    created_at: string;
    candidate_count: number;
    confidence: number;
    recommended_action: 'manual_link' | 'auto_match_possible' | 'manual_review_required';
    candidates: Array<{
      payment_transaction_id: string;
      provider_payment_id: string | null;
      status: string;
      amount_inr: number;
      created_at: string;
      time_delta_hours: number;
    }>;
  }>;
};

type BillingReminderAutomationRun = {
  id: string;
  trigger_source: 'admin_panel' | 'scheduler';
  status: 'success' | 'failed';
  run_scope: 'manual' | 'scheduled';
  bucket: string;
  channel: string;
  dry_run: boolean;
  enforce_cadence: boolean;
  enforce_cooldown: boolean;
  scanned: number;
  sent: number;
  skipped_cadence: number;
  skipped_cooldown: number;
  escalated: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

type BillingReminderQueue = {
  generated_at: string;
  summary: {
    total: number;
    due_soon: number;
    overdue_7: number;
    overdue_14: number;
    overdue_30: number;
    escalated: number;
  };
  queue: Array<{
    invoice_id: string;
    invoice_number: string;
    user_id: string;
    total_inr: number;
    issued_at: string | null;
    days_since_issued: number;
    bucket: 'current' | 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30';
    last_reminder: unknown;
    escalated: boolean;
  }>;
};

type BillingEscalationQueue = {
  generated_at: string;
  state: 'active' | 'resolved' | 'all' | 'candidates';
  summary: {
    total: number;
    active: number;
    candidates: number;
    snoozed: number;
    resolved: number;
  };
  queue: Array<{
    invoice_id: string;
    invoice_number: string;
    user_id: string;
    total_inr: number;
    issued_at: string | null;
    days_since_issued: number;
    escalated: boolean;
    snoozed: boolean;
    snooze_until: string | null;
    resolved_at: string | null;
    escalated_at: string | null;
    reason: string | null;
    needs_escalation: boolean;
    last_reminder_at: string | null;
  }>;
};

type BillingCollectionsMetrics = {
  generated_at: string;
  totals: {
    invoices_considered: number;
    issued_amount_inr: number;
    collected_amount_inr: number;
    outstanding_amount_inr: number;
    collection_rate_pct: number;
    dso_days: number;
  };
  aging: {
    days_0_7: { count: number; amount_inr: number };
    days_8_14: { count: number; amount_inr: number };
    days_15_30: { count: number; amount_inr: number };
    days_30_plus: { count: number; amount_inr: number };
  };
};

type BillingReminderScheduleStatus = {
  enabled: boolean;
  requires_token: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  defaults: {
    bucket: string;
    channel: string;
    enforceCadence: boolean;
    enforceCooldown: boolean;
    dryRun: boolean;
  };
  supported: {
    buckets: string[];
    channels: string[];
  };
  last_run: BillingReminderAutomationRun | null;
};

type BillingReminderRunsHistory = {
  generated_at: string;
  limit: number;
  runs: BillingReminderAutomationRun[];
};

// ── Prop groups ────────────────────────────────────────────────────────────

type InvoiceState = {
  invoices: AdminBillingInvoice[];
  page: number;
  total: number;
  isLoading: boolean;
  selectedIds: string[];
  bulkStatus: BillingInvoiceUpdateStatus;
  isApplyingBulk: boolean;
};

type FilterState = {
  searchQuery: string;
  statusFilter: string;
  typeFilter: string;
  fromDate: string;
  toDate: string;
};

type ReconciliationState = {
  summary: BillingReconciliationSummary | null;
  candidates: BillingReconciliationCandidates | null;
  isSummaryLoading: boolean;
  isCandidatesLoading: boolean;
  isResolving: boolean;
  bulkAutoMatchConfidence: number;
  isRunningBulkAutoMatch: boolean;
};

type CollectionsState = {
  metrics: BillingCollectionsMetrics | null;
  isLoading: boolean;
};

type ReminderState = {
  queue: BillingReminderQueue | null;
  scheduleStatus: BillingReminderScheduleStatus | null;
  runsHistory: BillingReminderRunsHistory | null;
  filteredRuns: BillingReminderAutomationRun[];
  isLoading: boolean;
  isSending: boolean;
  isRunningAuto: boolean;
  selectedInvoiceIds: string[];
  template: 'due_soon' | 'overdue_7' | 'overdue_14';
  channel: 'email' | 'whatsapp';
  enforceCadence: boolean;
  autoRunDryRun: boolean;
  autoRunBucket: 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'all';
  runsStatusFilter: 'all' | 'success' | 'failed';
  runsSourceFilter: 'all' | 'admin_panel' | 'scheduler';
  runsModeFilter: 'all' | 'preview' | 'live';
};

type EscalationState = {
  queue: BillingEscalationQueue | null;
  isLoading: boolean;
  isApplyingAction: boolean;
  selectedInvoiceIds: string[];
  stateFilter: 'active' | 'resolved' | 'all' | 'candidates';
  actionNote: string;
};

// ── Main props ─────────────────────────────────────────────────────────────

export type AdminBillingViewProps = {
  pageSize: number;

  // Data states
  invoiceState: InvoiceState;
  filterState: FilterState;
  reconciliationState: ReconciliationState;
  collectionsState: CollectionsState;
  reminderState: ReminderState;
  escalationState: EscalationState;

  // Formatters
  formatCurrency: (value: number | null | undefined) => string;
  formatDateTime: (value: string) => string;

  // Invoice actions
  onCreateInvoice: () => void;
  onRefreshLedger: () => void;
  onExportCsv: () => void;
  onExportFollowupsCsv: () => void;
  onResetFilters: () => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onToggleInvoiceSelection: (invoiceId: string) => void;
  onToggleSelectAllVisible: () => void;
  onBulkStatusChange: (status: BillingInvoiceUpdateStatus) => void;
  onApplyBulkStatus: () => void;
  onViewInvoiceDetails: (invoiceId: string) => void;
  onDownloadInvoicePdf: (invoiceId: string) => void;
  onCopyInvoiceLink: (invoiceId: string) => void;
  onOpenInvoicePrint: (invoiceId: string) => void;
  onPageChange: (page: number) => void;

  // Reconciliation actions
  onRunReconciliation: () => void;
  onResolveReconciliationMismatch: (
    action: 'auto_match_missing_reference' | 'link_payment_reference' | 'sync_invoice_total_to_payment' | 'clear_payment_reference',
    invoiceId: string,
  ) => void;
  onBulkAutoMatchConfidenceChange: (confidence: number) => void;
  onRunBulkAutoMatch: () => void;
  onRefreshReconciliationCandidates: () => void;

  // Collections actions
  onRefreshCollectionsMetrics: () => void;

  // Reminder actions
  onRefreshReminders: () => void;
  onReminderTemplateChange: (template: 'due_soon' | 'overdue_7' | 'overdue_14') => void;
  onReminderChannelChange: (channel: 'email' | 'whatsapp') => void;
  onReminderEnforceCadenceChange: (enforce: boolean) => void;
  onAutoRunDryRunChange: (dryRun: boolean) => void;
  onAutoRunBucketChange: (bucket: 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'all') => void;
  onSendReminders: () => void;
  onRunAutoReminders: () => void;
  onToggleReminderInvoiceSelection: (invoiceId: string) => void;
  onRunsStatusFilterChange: (value: 'all' | 'success' | 'failed') => void;
  onRunsSourceFilterChange: (value: 'all' | 'admin_panel' | 'scheduler') => void;
  onRunsModeFilterChange: (value: 'all' | 'preview' | 'live') => void;

  // Escalation actions
  onRefreshEscalations: () => void;
  onEscalationStateFilterChange: (value: 'active' | 'resolved' | 'all' | 'candidates') => void;
  onEscalationActionNoteChange: (note: string) => void;
  onApplyEscalationAction: (action: 'escalate' | 'resolve' | 'snooze_48h' | 'clear') => void;
  onToggleEscalationInvoiceSelection: (invoiceId: string) => void;
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminBillingView({
  pageSize,
  invoiceState,
  filterState,
  reconciliationState,
  collectionsState,
  reminderState,
  escalationState,
  formatCurrency,
  formatDateTime,
  onCreateInvoice,
  onRefreshLedger,
  onExportCsv,
  onExportFollowupsCsv,
  onResetFilters,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onFromDateChange,
  onToDateChange,
  onToggleInvoiceSelection,
  onToggleSelectAllVisible,
  onBulkStatusChange,
  onApplyBulkStatus,
  onViewInvoiceDetails,
  onDownloadInvoicePdf,
  onCopyInvoiceLink,
  onOpenInvoicePrint,
  onPageChange,
  onRunReconciliation,
  onResolveReconciliationMismatch,
  onBulkAutoMatchConfidenceChange,
  onRunBulkAutoMatch,
  onRefreshReconciliationCandidates,
  onRefreshCollectionsMetrics,
  onRefreshReminders,
  onReminderTemplateChange,
  onReminderChannelChange,
  onReminderEnforceCadenceChange,
  onAutoRunDryRunChange,
  onAutoRunBucketChange,
  onSendReminders,
  onRunAutoReminders,
  onToggleReminderInvoiceSelection,
  onRunsStatusFilterChange,
  onRunsSourceFilterChange,
  onRunsModeFilterChange,
  onRefreshEscalations,
  onEscalationStateFilterChange,
  onEscalationActionNoteChange,
  onApplyEscalationAction,
  onToggleEscalationInvoiceSelection,
}: AdminBillingViewProps) {
  const {
    invoices,
    page,
    total,
    isLoading: isFinanceDataLoading,
    selectedIds: selectedBillingInvoiceIds,
    bulkStatus: billingBulkStatus,
    isApplyingBulk: isApplyingBillingBulkStatus,
  } = invoiceState;

  const {
    searchQuery: billingSearchQuery,
    statusFilter: billingStatusFilter,
    typeFilter: billingTypeFilter,
    fromDate: billingFromDate,
    toDate: billingToDate,
  } = filterState;

  const {
    summary: billingReconciliation,
    candidates: billingReconciliationCandidates,
    isSummaryLoading: isBillingReconciliationLoading,
    isCandidatesLoading: isBillingReconciliationCandidatesLoading,
    isResolving: isResolvingReconciliation,
    bulkAutoMatchConfidence: billingBulkAutoMatchConfidence,
    isRunningBulkAutoMatch: isRunningBillingBulkAutoMatch,
  } = reconciliationState;

  const {
    metrics: billingCollectionsMetrics,
    isLoading: isBillingCollectionsMetricsLoading,
  } = collectionsState;

  const {
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
  } = reminderState;

  const {
    queue: billingEscalationQueue,
    isLoading: isBillingEscalationLoading,
    isApplyingAction: isApplyingBillingEscalationAction,
    selectedInvoiceIds: selectedEscalationInvoiceIds,
    stateFilter: billingEscalationStateFilter,
    actionNote: billingEscalationActionNote,
  } = escalationState;

  const [showGuide, setShowGuide] = useState(false);

  // ── Shared styles ──────────────────────────────────────────────────────
  const sectionCard = 'rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm';
  const sectionNumber = 'flex h-7 w-7 items-center justify-center rounded-full bg-coral/10 text-xs font-bold text-coral';
  const statCard = 'rounded-xl border p-4';
  const statLabel = 'text-xs font-medium';
  const statValue = 'mt-1 text-lg font-bold';
  const primaryBtn = 'rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60';
  const secondaryBtn = 'rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition-all hover:border-neutral-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60';
  const outlineCoralBtn = 'rounded-xl border border-coral/40 bg-white px-4 py-2.5 text-sm font-semibold text-coral shadow-sm transition-all hover:border-coral hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60';
  const smallActionBtn = 'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const selectField = 'input-field rounded-lg';

  return (
    <section className="space-y-6">

      {/* ── Quick Guide Banner ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/80 via-white to-brand-50/40 p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coral/10 text-lg">📖</span>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">How to Use This Dashboard</h3>
              <p className="text-sm text-neutral-600">Quick guide to manage invoices, payments, and reminders</p>
            </div>
          </div>
          <span className="text-sm text-coral font-medium">{showGuide ? 'Hide guide ▲' : 'Show guide ▼'}</span>
        </button>

        {showGuide && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className={sectionNumber}>1</span>
                <p className="text-sm font-semibold text-neutral-900">Search & Filter Invoices</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">Find any invoice by number, filter by payment status (draft, issued, paid), type, or date range.</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className={sectionNumber}>2</span>
                <p className="text-sm font-semibold text-neutral-900">Money Overview</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">See how much has been billed, collected, and what&apos;s still pending. Track how fast payments come in.</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className={sectionNumber}>3</span>
                <p className="text-sm font-semibold text-neutral-900">Payment Matching</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">Check if payments are correctly linked to invoices. Fix any mismatches automatically or manually.</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className={sectionNumber}>4</span>
                <p className="text-sm font-semibold text-neutral-900">Match Queue</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">Review unlinked payments waiting to be matched to invoices. Use auto-match or link them yourself.</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className={sectionNumber}>5</span>
                <p className="text-sm font-semibold text-neutral-900">Payment Reminders</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">Send payment reminders to customers via WhatsApp or email. Run them one-by-one or in bulk.</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-white/80 p-4">
              <div className="flex items-center gap-2.5">
                <span className={sectionNumber}>6</span>
                <p className="text-sm font-semibold text-neutral-900">Overdue Escalations</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">Manage invoices that are 30+ days overdue. Escalate, snooze, or mark them as resolved.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Header Actions ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-page-title">Billing Operations</h2>
          <p className="mt-1 text-sm text-neutral-600">Manage invoices, track payments, send reminders, and resolve overdue items.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCreateInvoice} className={primaryBtn}>
            + Create Invoice
          </button>
          <button type="button" onClick={onRefreshLedger} className={secondaryBtn}>
            ↻ Refresh
          </button>
          <button type="button" onClick={onExportCsv} className={outlineCoralBtn}>
            ↓ Export CSV
          </button>
          <button type="button" onClick={onExportFollowupsCsv} className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition-all hover:border-amber-400 hover:shadow-md">
            ↓ Export Follow-ups
          </button>
        </div>
      </div>

      {/* ── Section 1: Search & Filter ──────────────────────────────────── */}
      <div className={sectionCard}>
        <div className="mb-4 flex items-center gap-2.5">
          <span className={sectionNumber}>1</span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Search & Filter Invoices</h3>
            <p className="text-xs text-neutral-500">Narrow down invoices using any combination of filters below.</p>
          </div>
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">Search</label>
            <input
              type="search"
              placeholder="Invoice number or user ID"
              value={billingSearchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className={cn(selectField, 'w-full')}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">Status</label>
            <select value={billingStatusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className={cn(selectField, 'w-full')}>
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">Invoice Type</label>
            <select value={billingTypeFilter} onChange={(event) => onTypeFilterChange(event.target.value)} className={cn(selectField, 'w-full')}>
              <option value="all">All Types</option>
              <option value="service">Service</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">From Date</label>
            <input type="date" value={billingFromDate} onChange={(event) => onFromDateChange(event.target.value)} className={cn(selectField, 'w-full')} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">To Date</label>
            <input type="date" value={billingToDate} onChange={(event) => onToDateChange(event.target.value)} className={cn(selectField, 'w-full')} />
          </div>
          <div>
            <button type="button" onClick={onResetFilters} className={cn(secondaryBtn, 'w-full')}>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Money Overview (Collections Health) ──────────────── */}
      <div className={sectionCard}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={sectionNumber}>2</span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Money Overview</h3>
              <p className="text-xs text-neutral-500">Your billing summary — how much has been billed, collected, and what&apos;s still outstanding.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onRefreshCollectionsMetrics()}
            disabled={isBillingCollectionsMetricsLoading}
            className={secondaryBtn}
          >
            {isBillingCollectionsMetricsLoading ? 'Refreshing...' : '↻ Refresh Metrics'}
          </button>
        </div>

        {billingCollectionsMetrics ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cn(statCard, 'border-neutral-200 bg-neutral-50')}>
                <p className={cn(statLabel, 'text-neutral-600')}>Total Billed</p>
                <p className={cn(statValue, 'text-neutral-900')}>{formatCurrency(billingCollectionsMetrics.totals.issued_amount_inr)}</p>
              </div>
              <div className={cn(statCard, 'border-emerald-200 bg-emerald-50')}>
                <p className={cn(statLabel, 'text-emerald-700')}>Collected</p>
                <p className={cn(statValue, 'text-emerald-700')}>{formatCurrency(billingCollectionsMetrics.totals.collected_amount_inr)}</p>
              </div>
              <div className={cn(statCard, 'border-red-200 bg-red-50')}>
                <p className={cn(statLabel, 'text-red-700')}>Still Pending</p>
                <p className={cn(statValue, 'text-red-700')}>{formatCurrency(billingCollectionsMetrics.totals.outstanding_amount_inr)}</p>
              </div>
              <div className={cn(statCard, 'border-blue-200 bg-blue-50')}>
                <p className={cn(statLabel, 'text-blue-700')}>Collection Rate</p>
                <p className={cn(statValue, 'text-blue-700')}>{Number(billingCollectionsMetrics.totals.collection_rate_pct).toFixed(1)}%</p>
                <p className="mt-1 text-xs text-blue-600">Avg. {Number(billingCollectionsMetrics.totals.dso_days).toFixed(1)} days to collect</p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Aging Breakdown — How long invoices have been unpaid</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">0–7 days</p>
                  <p className="mt-1 text-xs text-emerald-700">{billingCollectionsMetrics.aging.days_0_7.count} invoices</p>
                  <p className="mt-0.5 text-base font-bold text-emerald-900">{formatCurrency(billingCollectionsMetrics.aging.days_0_7.amount_inr)}</p>
                </div>
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
                  <p className="text-sm font-semibold text-amber-800">8–14 days</p>
                  <p className="mt-1 text-xs text-amber-700">{billingCollectionsMetrics.aging.days_8_14.count} invoices</p>
                  <p className="mt-0.5 text-base font-bold text-amber-900">{formatCurrency(billingCollectionsMetrics.aging.days_8_14.amount_inr)}</p>
                </div>
                <div className="rounded-xl border border-orange-200/60 bg-orange-50/50 p-4">
                  <p className="text-sm font-semibold text-orange-800">15–30 days</p>
                  <p className="mt-1 text-xs text-orange-700">{billingCollectionsMetrics.aging.days_15_30.count} invoices</p>
                  <p className="mt-0.5 text-base font-bold text-orange-900">{formatCurrency(billingCollectionsMetrics.aging.days_15_30.amount_inr)}</p>
                </div>
                <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-4">
                  <p className="text-sm font-semibold text-red-800">30+ days</p>
                  <p className="mt-1 text-xs text-red-700">{billingCollectionsMetrics.aging.days_30_plus.count} invoices</p>
                  <p className="mt-0.5 text-base font-bold text-red-900">{formatCurrency(billingCollectionsMetrics.aging.days_30_plus.amount_inr)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
            <p className="text-sm text-neutral-500">Click &quot;Refresh Metrics&quot; to load your billing overview.</p>
          </div>
        )}
      </div>

      {/* ── Section 3: Payment Matching (Reconciliation) ────────────────── */}
      <div className={sectionCard}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={sectionNumber}>3</span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Payment Matching</h3>
              <p className="text-xs text-neutral-500">Check if every payment is correctly linked to its invoice. Fix mismatches here.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onRunReconciliation()}
            disabled={isBillingReconciliationLoading}
            className={secondaryBtn}
          >
            {isBillingReconciliationLoading ? 'Checking...' : '↻ Run Check'}
          </button>
        </div>

        {billingReconciliation ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cn(statCard, 'border-emerald-200 bg-emerald-50')}>
                <p className={cn(statLabel, 'text-emerald-700')}>Matched</p>
                <p className={cn(statValue, 'text-emerald-700')}>{billingReconciliation.totals.matched}</p>
                <p className="mt-1 text-xs text-emerald-600">Payments correctly linked</p>
              </div>
              <div className={cn(statCard, 'border-red-200 bg-red-50')}>
                <p className={cn(statLabel, 'text-red-700')}>Mismatches</p>
                <p className={cn(statValue, 'text-red-700')}>{billingReconciliation.totals.mismatched}</p>
                <p className="mt-1 text-xs text-red-600">Need attention</p>
              </div>
              <div className={cn(statCard, 'border-amber-200 bg-amber-50')}>
                <p className={cn(statLabel, 'text-amber-700')}>Unlinked Payments</p>
                <p className={cn(statValue, 'text-amber-700')}>{billingReconciliation.totals.paidInvoicesMissingPaymentRef}</p>
                <p className="mt-1 text-xs text-amber-600">Paid but not linked</p>
              </div>
              <div className={cn(statCard, 'border-neutral-200 bg-neutral-50')}>
                <p className={cn(statLabel, 'text-neutral-600')}>Unlinked Transactions</p>
                <p className={cn(statValue, 'text-neutral-900')}>{billingReconciliation.totals.unlinkedTransactions}</p>
                <p className="mt-1 text-xs text-neutral-500">Orphaned payment records</p>
              </div>
            </div>

            {billingReconciliation.mismatches.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                <p className="mb-3 text-sm font-semibold text-red-800">⚠ Items That Need Fixing</p>
                <div className="space-y-2">
                  {billingReconciliation.mismatches.slice(0, 5).map((row) => (
                    <div key={row.invoice_id} className="rounded-lg border border-red-200 bg-white p-3">
                      <p className="text-sm font-medium text-red-800">
                        {row.invoice_number} — {row.reason === 'amount_mismatch' ? 'Amount doesn\'t match' : 'Missing payment link'}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void onResolveReconciliationMismatch('auto_match_missing_reference', row.invoice_id)}
                          disabled={isResolvingReconciliation}
                          className={cn(smallActionBtn, 'border-blue-300 text-blue-700 hover:bg-blue-50')}
                        >
                          Auto Fix
                        </button>
                        <button
                          type="button"
                          onClick={() => void onResolveReconciliationMismatch('link_payment_reference', row.invoice_id)}
                          disabled={isResolvingReconciliation}
                          className={cn(smallActionBtn, 'border-neutral-300 text-neutral-700 hover:bg-neutral-50')}
                        >
                          Link Manually
                        </button>
                        <button
                          type="button"
                          onClick={() => void onResolveReconciliationMismatch('sync_invoice_total_to_payment', row.invoice_id)}
                          disabled={isResolvingReconciliation}
                          className={cn(smallActionBtn, 'border-amber-300 text-amber-700 hover:bg-amber-50')}
                        >
                          Sync Amount
                        </button>
                        <button
                          type="button"
                          onClick={() => void onResolveReconciliationMismatch('clear_payment_reference', row.invoice_id)}
                          disabled={isResolvingReconciliation}
                          className={cn(smallActionBtn, 'border-red-300 text-red-700 hover:bg-red-50')}
                        >
                          Remove Link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                <p className="text-sm font-medium text-emerald-700">✓ All payments are correctly matched. No issues found.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
            <p className="text-sm text-neutral-500">Click &quot;Run Check&quot; to verify payment-to-invoice links.</p>
          </div>
        )}
      </div>

      {/* ── Section 4: Payment Match Queue ─────────────────────────────── */}
      <div className={sectionCard}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={sectionNumber}>4</span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Match Queue</h3>
              <p className="text-xs text-neutral-500">Unlinked payments waiting to be paired with invoices. Review and approve matches.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billingBulkAutoMatchConfidence}
              onChange={(event) => onBulkAutoMatchConfidenceChange(Number(event.target.value))}
              className={cn(selectField, 'min-w-[180px]')}
            >
              <option value={60}>Auto-match: 60%+ confidence</option>
              <option value={70}>Auto-match: 70%+ confidence</option>
              <option value={75}>Auto-match: 75%+ confidence</option>
              <option value={80}>Auto-match: 80%+ confidence</option>
              <option value={85}>Auto-match: 85%+ confidence</option>
            </select>
            <button
              type="button"
              onClick={() => void onRunBulkAutoMatch()}
              disabled={isRunningBillingBulkAutoMatch}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningBillingBulkAutoMatch ? 'Matching...' : '⚡ Auto-Match All'}
            </button>
            <button
              type="button"
              onClick={() => void onRefreshReconciliationCandidates()}
              disabled={isBillingReconciliationCandidatesLoading}
              className={secondaryBtn}
            >
              {isBillingReconciliationCandidatesLoading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {billingReconciliationCandidates ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cn(statCard, 'border-neutral-200 bg-neutral-50')}>
                <p className={cn(statLabel, 'text-neutral-600')}>Invoices Checked</p>
                <p className={cn(statValue, 'text-neutral-900')}>{billingReconciliationCandidates.totals.invoices_considered}</p>
              </div>
              <div className={cn(statCard, 'border-blue-200 bg-blue-50')}>
                <p className={cn(statLabel, 'text-blue-700')}>Possible Matches Found</p>
                <p className={cn(statValue, 'text-blue-700')}>{billingReconciliationCandidates.totals.with_candidates}</p>
              </div>
              <div className={cn(statCard, 'border-emerald-200 bg-emerald-50')}>
                <p className={cn(statLabel, 'text-emerald-700')}>Ready to Auto-Match</p>
                <p className={cn(statValue, 'text-emerald-700')}>{billingReconciliationCandidates.totals.auto_match_ready}</p>
              </div>
              <div className={cn(statCard, 'border-amber-200 bg-amber-50')}>
                <p className={cn(statLabel, 'text-amber-700')}>Needs Manual Review</p>
                <p className={cn(statValue, 'text-amber-700')}>{billingReconciliationCandidates.totals.manual_review_required}</p>
              </div>
            </div>

            {billingReconciliationCandidates.queue.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                <p className="text-sm font-medium text-emerald-700">✓ No pending items in the match queue.</p>
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-neutral-200/60 bg-neutral-50/40 p-3">
                {billingReconciliationCandidates.queue.slice(0, 40).map((row) => (
                  <div key={row.invoice_id} className="rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-neutral-900">{row.invoice_number}</p>
                      <span className="text-sm font-medium text-neutral-700">{formatCurrency(row.total_inr)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold',
                          row.confidence >= 60
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                            : 'border-amber-300 bg-amber-100 text-amber-700',
                        )}
                      >
                        {row.confidence}% match
                      </span>
                      <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        {row.candidate_count} candidate{row.candidate_count !== 1 ? 's' : ''}
                      </span>
                      <span className="rounded-full border border-blue-300 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {row.recommended_action.replaceAll('_', ' ')}
                      </span>
                    </div>

                    {row.candidates.length > 0 && (
                      <p className="mt-2 text-xs text-neutral-500">
                        Best match: {row.candidates[0].payment_transaction_id} ({row.candidates[0].time_delta_hours}h apart)
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void onResolveReconciliationMismatch('auto_match_missing_reference', row.invoice_id)}
                        disabled={isResolvingReconciliation || row.confidence < 60}
                        className={cn(smallActionBtn, 'border-blue-300 text-blue-700 hover:bg-blue-50')}
                      >
                        Auto Match (60%+)
                      </button>
                      <button
                        type="button"
                        onClick={() => void onResolveReconciliationMismatch('link_payment_reference', row.invoice_id)}
                        disabled={isResolvingReconciliation}
                        className={cn(smallActionBtn, 'border-neutral-300 text-neutral-700 hover:bg-neutral-50')}
                      >
                        Link Manually
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
            <p className="text-sm text-neutral-500">Click &quot;Refresh&quot; to load the payment match queue.</p>
          </div>
        )}
      </div>

      {/* ── Section 5: Payment Reminders ────────────────────────────────── */}
      <div className={sectionCard}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={sectionNumber}>5</span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Payment Reminders</h3>
              <p className="text-xs text-neutral-500">Send reminders to customers with unpaid invoices. Supports WhatsApp and email.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onRefreshReminders()}
            disabled={isBillingReminderLoading}
            className={secondaryBtn}
          >
            {isBillingReminderLoading ? 'Refreshing...' : '↻ Refresh Queue'}
          </button>
        </div>

        {billingReminderQueue ? (
          <div className="space-y-5">
            {/* Reminder summary stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cn(statCard, 'border-neutral-200 bg-neutral-50')}>
                <p className={cn(statLabel, 'text-neutral-600')}>Total Pending</p>
                <p className={cn(statValue, 'text-neutral-900')}>{billingReminderQueue.summary.total}</p>
                <p className="mt-1 text-xs text-neutral-500">{billingReminderQueue.summary.due_soon} due soon</p>
              </div>
              <div className={cn(statCard, 'border-amber-200 bg-amber-50')}>
                <p className={cn(statLabel, 'text-amber-700')}>7+ Days Overdue</p>
                <p className={cn(statValue, 'text-amber-700')}>{billingReminderQueue.summary.overdue_7}</p>
              </div>
              <div className={cn(statCard, 'border-red-200 bg-red-50')}>
                <p className={cn(statLabel, 'text-red-700')}>14+ Days Overdue</p>
                <p className={cn(statValue, 'text-red-700')}>{billingReminderQueue.summary.overdue_14}</p>
              </div>
              <div className={cn(statCard, 'border-red-300 bg-red-100')}>
                <p className={cn(statLabel, 'text-red-800')}>30+ Days (Critical)</p>
                <p className={cn(statValue, 'text-red-800')}>
                  {billingReminderQueue.summary.overdue_30}
                </p>
                <p className="mt-0.5 text-xs text-red-700">{billingReminderQueue.summary.escalated} escalated</p>
              </div>
            </div>

            {/* Last automation run */}
            {billingReminderScheduleStatus?.last_run && (
              <div
                className={cn(
                  'rounded-xl border p-4',
                  billingReminderScheduleStatus.last_run.status === 'success'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50',
                )}
              >
                <p className="text-sm font-semibold text-neutral-900">
                  Last Automation Run:{' '}
                  <span className={billingReminderScheduleStatus.last_run.status === 'success' ? 'text-emerald-700' : 'text-red-700'}>
                    {billingReminderScheduleStatus.last_run.status === 'success' ? '✓ Success' : '✗ Failed'}
                  </span>
                  {' '}({billingReminderScheduleStatus.last_run.run_scope})
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  {new Date(billingReminderScheduleStatus.last_run.finished_at ?? billingReminderScheduleStatus.last_run.created_at).toLocaleString('en-IN')}
                  {' · '}Group: {billingReminderScheduleStatus.last_run.bucket}
                  {' · '}{billingReminderScheduleStatus.last_run.dry_run ? 'Preview mode' : 'Live'}
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Checked {billingReminderScheduleStatus.last_run.scanned} invoices, sent {billingReminderScheduleStatus.last_run.sent} reminders,
                  escalated {billingReminderScheduleStatus.last_run.escalated}
                </p>
                {billingReminderScheduleStatus.last_run.error_message && (
                  <p className="mt-1 text-xs text-red-700">{billingReminderScheduleStatus.last_run.error_message}</p>
                )}
              </div>
            )}

            {/* Scheduler health */}
            {billingReminderScheduleStatus && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                <p className="text-sm font-semibold text-neutral-900">Scheduler Health</p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
                  <span>
                    Consecutive failures: <strong className="text-neutral-800">{billingReminderScheduleStatus.consecutive_failures}</strong>
                  </span>
                  <span>
                    Last success:{' '}
                    <strong className="text-neutral-800">
                      {billingReminderScheduleStatus.last_success_at
                        ? new Date(billingReminderScheduleStatus.last_success_at).toLocaleString('en-IN')
                        : 'n/a'}
                    </strong>
                  </span>
                  <span>
                    Last failure:{' '}
                    <strong className="text-neutral-800">
                      {billingReminderScheduleStatus.last_failure_at
                        ? new Date(billingReminderScheduleStatus.last_failure_at).toLocaleString('en-IN')
                        : 'n/a'}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            {/* Recent runs history */}
            {billingReminderRunsHistory && billingReminderRunsHistory.runs.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200/60 bg-neutral-50/80 p-3">
                  <p className="text-sm font-semibold text-neutral-700">Recent Runs</p>
                  <select value={billingRunsStatusFilter} onChange={(event) => onRunsStatusFilterChange(event.target.value as 'all' | 'success' | 'failed')} className={cn(selectField, 'min-w-[130px]')}>
                    <option value="all">Status: All</option>
                    <option value="success">Status: Success</option>
                    <option value="failed">Status: Failed</option>
                  </select>
                  <select value={billingRunsSourceFilter} onChange={(event) => onRunsSourceFilterChange(event.target.value as 'all' | 'admin_panel' | 'scheduler')} className={cn(selectField, 'min-w-[130px]')}>
                    <option value="all">Source: All</option>
                    <option value="scheduler">Source: Scheduler</option>
                    <option value="admin_panel">Source: Admin</option>
                  </select>
                  <select value={billingRunsModeFilter} onChange={(event) => onRunsModeFilterChange(event.target.value as 'all' | 'preview' | 'live')} className={cn(selectField, 'min-w-[120px]')}>
                    <option value="all">Mode: All</option>
                    <option value="preview">Mode: Preview</option>
                    <option value="live">Mode: Live</option>
                  </select>
                  <span className="text-xs text-neutral-500">Showing {filteredBillingReminderRuns.length} run(s)</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-neutral-200/60">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold">Finished</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Source</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Scope</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Group / Channel</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Mode</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Checked</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Sent</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Escalated</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBillingReminderRuns.map((run) => (
                        <tr key={run.id} className="border-t border-neutral-100 text-neutral-700 hover:bg-neutral-50/50">
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                            {new Date(run.finished_at ?? run.created_at).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-xs font-semibold',
                                run.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                              )}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">{run.trigger_source === 'admin_panel' ? 'Admin' : 'Scheduler'}</td>
                          <td className="px-3 py-2.5 text-xs">{run.run_scope}</td>
                          <td className="px-3 py-2.5 text-xs">{run.bucket} / {run.channel}</td>
                          <td className="px-3 py-2.5 text-xs">{run.dry_run ? 'Preview' : 'Live'}</td>
                          <td className="px-3 py-2.5 text-right text-xs">{run.scanned}</td>
                          <td className="px-3 py-2.5 text-right text-xs">{run.sent}</td>
                          <td className="px-3 py-2.5 text-right text-xs">{run.escalated}</td>
                          <td className="max-w-[320px] truncate px-3 py-2.5 text-xs" title={run.error_message ?? ''}>
                            {run.error_message ?? '—'}
                          </td>
                        </tr>
                      ))}
                      {filteredBillingReminderRuns.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-center text-neutral-500" colSpan={10}>
                            No runs match the active filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Send reminders controls */}
            <div className="rounded-xl border border-neutral-200/60 bg-neutral-50/80 p-4">
              <p className="mb-3 text-sm font-semibold text-neutral-800">Send Reminders</p>
              <div className="flex flex-wrap items-center gap-3">
                <select value={billingReminderTemplate} onChange={(event) => onReminderTemplateChange(event.target.value as 'due_soon' | 'overdue_7' | 'overdue_14')} className={cn(selectField, 'min-w-[180px]')}>
                  <option value="due_soon">Template: Due Soon</option>
                  <option value="overdue_7">Template: 7+ Days Overdue</option>
                  <option value="overdue_14">Template: 14+ Days Overdue</option>
                </select>
                <select value={billingReminderChannel} onChange={(event) => onReminderChannelChange(event.target.value as 'email' | 'whatsapp')} className={cn(selectField, 'min-w-[150px]')}>
                  <option value="whatsapp">Send via: WhatsApp</option>
                  <option value="email">Send via: Email</option>
                </select>
                <button
                  type="button"
                  onClick={() => void onSendReminders()}
                  disabled={isSendingBillingReminders || selectedReminderInvoiceIds.length === 0}
                  className={primaryBtn}
                >
                  {isSendingBillingReminders ? 'Sending...' : `Send to ${selectedReminderInvoiceIds.length} selected`}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-3">
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={billingReminderEnforceCadence} onChange={(event) => onReminderEnforceCadenceChange(event.target.checked)} className="h-4 w-4 rounded border-neutral-300 accent-coral" />
                  Skip if recently reminded
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={billingAutoRunDryRun} onChange={(event) => onAutoRunDryRunChange(event.target.checked)} className="h-4 w-4 rounded border-neutral-300 accent-coral" />
                  Preview only (no actual send)
                </label>
                <select value={billingAutoRunBucket} onChange={(event) => onAutoRunBucketChange(event.target.value as 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'all')} className={cn(selectField, 'min-w-[190px]')}>
                  <option value="all">Auto Batch: All Groups</option>
                  <option value="due_soon">Auto Batch: Due Soon</option>
                  <option value="overdue_7">Auto Batch: 7+ Overdue</option>
                  <option value="overdue_14">Auto Batch: 14+ Overdue</option>
                  <option value="overdue_30">Auto Batch: 30+ Overdue</option>
                </select>
                <button
                  type="button"
                  onClick={() => void onRunAutoReminders()}
                  disabled={isRunningBillingAutoReminders}
                  className={outlineCoralBtn}
                >
                  {isRunningBillingAutoReminders
                    ? billingAutoRunDryRun ? 'Running Preview...' : 'Running Batch...'
                    : billingAutoRunDryRun ? 'Preview Batch' : 'Run Auto Batch'}
                </button>
              </div>
            </div>

            {/* Reminder queue items */}
            {billingReminderQueue.queue.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                <p className="text-sm font-medium text-emerald-700">✓ No invoices need reminders right now.</p>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-neutral-200/60 bg-neutral-50/40 p-3">
                {billingReminderQueue.queue.slice(0, 40).map((row) => (
                  <label
                    key={row.invoice_id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedReminderInvoiceIds.includes(row.invoice_id)}
                        onChange={() => onToggleReminderInvoiceSelection(row.invoice_id)}
                        className="h-4 w-4 rounded border-neutral-300 accent-coral"
                      />
                      <span>
                        <span className="text-sm font-semibold text-neutral-900">{row.invoice_number}</span>
                        <span className="ml-2 text-xs text-neutral-500">{row.user_id.slice(0, 8)}...</span>
                      </span>
                    </span>
                    <span className="text-sm font-medium text-neutral-700">{formatCurrency(row.total_inr)}</span>
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold',
                        row.bucket === 'overdue_30'
                          ? 'border-red-400 bg-red-200 text-red-800'
                          : row.bucket === 'overdue_14'
                          ? 'border-red-300 bg-red-100 text-red-700'
                          : row.bucket === 'overdue_7'
                          ? 'border-amber-300 bg-amber-100 text-amber-700'
                          : row.bucket === 'due_soon'
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-neutral-300 bg-neutral-100 text-neutral-700',
                      )}
                    >
                      {row.bucket.replace('_', ' ')} ({row.days_since_issued}d)
                    </span>
                    {row.escalated && (
                      <span className="rounded-full border border-red-400 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                        Escalated
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
            <p className="text-sm text-neutral-500">Click &quot;Refresh Queue&quot; to load pending reminders.</p>
          </div>
        )}
      </div>

      {/* ── Section 6: Escalation Review ───────────────────────────────── */}
      <div className={sectionCard}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={sectionNumber}>6</span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Overdue Escalations</h3>
              <p className="text-xs text-neutral-500">Invoices unpaid for 30+ days. Escalate, snooze (pause for 48h), or mark as resolved.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={billingEscalationStateFilter}
              onChange={(event) => onEscalationStateFilterChange(event.target.value as 'active' | 'resolved' | 'all' | 'candidates')}
              className={cn(selectField, 'min-w-[170px]')}
            >
              <option value="active">Show: Active</option>
              <option value="candidates">Show: Candidates</option>
              <option value="resolved">Show: Resolved</option>
              <option value="all">Show: All</option>
            </select>
            <button
              type="button"
              onClick={() => void onRefreshEscalations()}
              disabled={isBillingEscalationLoading}
              className={secondaryBtn}
            >
              {isBillingEscalationLoading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {billingEscalationQueue ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cn(statCard, 'border-neutral-200 bg-neutral-50')}>
                <p className={cn(statLabel, 'text-neutral-600')}>Total</p>
                <p className={cn(statValue, 'text-neutral-900')}>{billingEscalationQueue.summary.total}</p>
                <p className="mt-1 text-xs text-neutral-500">{billingEscalationQueue.summary.candidates} candidates</p>
              </div>
              <div className={cn(statCard, 'border-red-200 bg-red-50')}>
                <p className={cn(statLabel, 'text-red-700')}>Active</p>
                <p className={cn(statValue, 'text-red-700')}>{billingEscalationQueue.summary.active}</p>
              </div>
              <div className={cn(statCard, 'border-blue-200 bg-blue-50')}>
                <p className={cn(statLabel, 'text-blue-700')}>Snoozed</p>
                <p className={cn(statValue, 'text-blue-700')}>{billingEscalationQueue.summary.snoozed}</p>
              </div>
              <div className={cn(statCard, 'border-emerald-200 bg-emerald-50')}>
                <p className={cn(statLabel, 'text-emerald-700')}>Resolved</p>
                <p className={cn(statValue, 'text-emerald-700')}>{billingEscalationQueue.summary.resolved}</p>
              </div>
            </div>

            {/* Escalation actions */}
            <div className="rounded-xl border border-neutral-200/60 bg-neutral-50/80 p-4">
              <p className="mb-3 text-sm font-semibold text-neutral-800">Bulk Actions</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Add a note (optional)"
                  value={billingEscalationActionNote}
                  onChange={(event) => onEscalationActionNoteChange(event.target.value)}
                  className="input-field min-w-[260px] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => void onApplyEscalationAction('escalate')}
                  disabled={isApplyingBillingEscalationAction || selectedEscalationInvoiceIds.length === 0}
                  className={cn(smallActionBtn, 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100')}
                >
                  ⚠ Escalate
                </button>
                <button
                  type="button"
                  onClick={() => void onApplyEscalationAction('snooze_48h')}
                  disabled={isApplyingBillingEscalationAction || selectedEscalationInvoiceIds.length === 0}
                  className={cn(smallActionBtn, 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100')}
                >
                  ⏸ Snooze 48h
                </button>
                <button
                  type="button"
                  onClick={() => void onApplyEscalationAction('resolve')}
                  disabled={isApplyingBillingEscalationAction || selectedEscalationInvoiceIds.length === 0}
                  className={cn(smallActionBtn, 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}
                >
                  ✓ Resolve
                </button>
                <button
                  type="button"
                  onClick={() => void onApplyEscalationAction('clear')}
                  disabled={isApplyingBillingEscalationAction || selectedEscalationInvoiceIds.length === 0}
                  className={cn(smallActionBtn, 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50')}
                >
                  Clear Tag
                </button>
              </div>
            </div>

            {billingEscalationQueue.queue.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                <p className="text-sm font-medium text-emerald-700">✓ No escalations match the current filter.</p>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-neutral-200/60 bg-neutral-50/40 p-3">
                {billingEscalationQueue.queue.slice(0, 60).map((row) => (
                  <label
                    key={row.invoice_id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEscalationInvoiceIds.includes(row.invoice_id)}
                        onChange={() => onToggleEscalationInvoiceSelection(row.invoice_id)}
                        className="h-4 w-4 rounded border-neutral-300 accent-coral"
                      />
                      <span>
                        <span className="text-sm font-semibold text-neutral-900">{row.invoice_number}</span>
                        <span className="ml-2 text-xs text-neutral-500">{row.user_id.slice(0, 8)}...</span>
                      </span>
                    </span>
                    <span className="text-sm font-medium text-neutral-700">{formatCurrency(row.total_inr)}</span>
                    <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {row.days_since_issued} days
                    </span>
                    {row.needs_escalation && (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        30+ Candidate
                      </span>
                    )}
                    {row.escalated && (
                      <span className="rounded-full border border-red-400 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                        Active
                      </span>
                    )}
                    {row.snoozed && (
                      <span className="rounded-full border border-blue-300 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        Snoozed
                      </span>
                    )}
                    {row.resolved_at && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Resolved
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
            <p className="text-sm text-neutral-500">Click &quot;Refresh&quot; to load the escalation queue.</p>
          </div>
        )}
      </div>

      {/* ── Invoice Ledger ─────────────────────────────────────────────── */}
      <div className={sectionCard}>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">📋</span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Invoice Ledger</h3>
            <p className="text-xs text-neutral-500">All invoices listed below. Select invoices to update their status in bulk.</p>
          </div>
        </div>

        {isFinanceDataLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-neutral-500">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
            <p className="text-sm text-neutral-500">No invoices found matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Bulk status toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/60 bg-neutral-50/80 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={invoices.length > 0 && invoices.every((invoice) => selectedBillingInvoiceIds.includes(invoice.id))}
                  onChange={onToggleSelectAllVisible}
                  className="h-4 w-4 rounded border-neutral-300 accent-coral"
                />
                <span className="text-sm font-medium text-neutral-700">
                  Select all ({invoices.length})
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <select value={billingBulkStatus} onChange={(event) => onBulkStatusChange(event.target.value as BillingInvoiceUpdateStatus)} className={cn(selectField, 'min-w-[150px]')}>
                  <option value="issued">Set as: Issued</option>
                  <option value="paid">Set as: Paid</option>
                  <option value="draft">Set as: Draft</option>
                </select>
                <button
                  type="button"
                  onClick={() => void onApplyBulkStatus()}
                  disabled={isApplyingBillingBulkStatus || selectedBillingInvoiceIds.length === 0}
                  className={primaryBtn}
                >
                  {isApplyingBillingBulkStatus ? 'Applying...' : `Apply to ${selectedBillingInvoiceIds.length} selected`}
                </button>
              </div>
            </div>

            {/* Invoice rows */}
            {invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-neutral-200/60 bg-white p-4 transition-colors hover:border-neutral-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedBillingInvoiceIds.includes(invoice.id)}
                      onChange={() => onToggleInvoiceSelection(invoice.id)}
                      className="h-4 w-4 rounded border-neutral-300 accent-coral"
                    />
                    <span className="text-sm font-semibold text-neutral-900">{invoice.invoice_number}</span>
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold',
                        invoice.status === 'paid'
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                          : invoice.status === 'issued'
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-neutral-300 bg-neutral-100 text-neutral-600',
                      )}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                      {invoice.invoice_type}
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">{formatCurrency(invoice.total_inr)}</span>
                    {(invoice.wallet_credits_applied_inr ?? 0) > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        −{formatCurrency(invoice.wallet_credits_applied_inr ?? 0)} credits
                      </span>
                    )}
                    <span className="text-xs text-neutral-500">{formatDateTime(invoice.created_at)}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void onViewInvoiceDetails(invoice.id)} className={cn(smallActionBtn, 'border-neutral-300 text-neutral-700 hover:bg-neutral-50')}>
                    View Details
                  </button>
                  <button type="button" onClick={() => onDownloadInvoicePdf(invoice.id)} className={cn(smallActionBtn, 'border-coral/40 text-coral hover:bg-coral/5')}>
                    Download PDF
                  </button>
                  <button type="button" onClick={() => void onCopyInvoiceLink(invoice.id)} className={cn(smallActionBtn, 'border-neutral-300 text-neutral-700 hover:bg-neutral-50')}>
                    Copy Link
                  </button>
                  <button type="button" onClick={() => onOpenInvoicePrint(invoice.id)} className={cn(smallActionBtn, 'border-coral/40 text-coral hover:bg-coral/5')}>
                    Print
                  </button>
                </div>
              </div>
            ))}
            <AdminPaginationControls page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
          </div>
        )}
      </div>
    </section>
  );
}
