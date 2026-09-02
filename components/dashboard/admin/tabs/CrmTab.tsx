'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Input, Modal, Textarea, useToast } from '@/components/ui';
import type {
  CrmLeadActivityRow,
  CrmLeadSource,
  CrmLeadStatus,
  CrmLeadSummary,
  CrmLeadWithCustomer,
} from '@/lib/crm/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type CrmLeadDetailPayload = {
  lead: CrmLeadWithCustomer;
  activities: CrmLeadActivityRow[];
  converted_booking:
    | { id: number; booking_date: string; start_time: string; status: string; final_price: number | null }
    | null;
};

type CreateLeadDraft = {
  name: string;
  phone: string;
  email: string;
  source: Extract<CrmLeadSource, 'manual' | 'whatsapp' | 'direct' | 'referral'>;
  priority: 'normal' | 'hot';
  note: string;
  pincode: string;
  address: string;
  assignedTo: string;
};

type SheetImportRunRow = {
  id: string;
  trigger_source: 'admin_panel' | 'cron';
  status: 'success' | 'failed';
  dry_run: boolean;
  rows_scanned: number;
  rows_imported: number;
  rows_skipped: number;
  rows_invalid: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

type SheetImportRunResult = {
  dryRun: boolean;
  tabsScanned: number;
  tabTitles: string[];
  rowsScanned: number;
  candidatesFound: number;
  imported: number;
  skippedExisting: number;
  newCustomers: number;
  invalid: number;
  invalidReasons: string[];
  warnings: string[];
};

type CrmStaffUser = { id: string; name: string };

type CrmCustomer360Data = {
  user: { id: string; name: string | null; email: string | null; phone: string | null; createdAt: string | null };
  pets: Array<{ id: number; name: string; breed: string | null; sizeCategory: string | null }>;
  addresses: Array<{ pincode: string | null; city: string | null; line: string | null; isDefault: boolean }>;
  leads: CrmLeadWithCustomer[];
  bookings: Array<{
    id: number;
    bookingDate: string | null;
    startTime: string | null;
    status: string;
    serviceType: string | null;
    finalPrice: number | null;
  }>;
  paymentSummary: { paidTransactions: number; paidAmountInr: number };
  grooming: {
    completedBookings: number;
    lastGroomingDate: string | null;
    nextRecommendedDate: string | null;
    daysSinceLastGrooming: number | null;
  };
};

type CrmRetentionCandidate = {
  userId: string;
  name: string | null;
  phone: string | null;
  lastGroomingDate: string;
  nextRecommendedDate: string;
  daysSinceLastGrooming: number;
  completedBookings: number;
  totalSpentInr: number;
};

type CrmCampaignRow = {
  campaign: string;
  campaignId: string | null;
  source: string;
  totalLeads: number;
  openLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  revenueInr: number;
};

const LOST_REASON_OPTIONS = [
  'No response',
  'Price too high',
  'Booked elsewhere',
  'Out of coverage area',
  'Not interested',
  'Other',
] as const;

const EMPTY_CREATE_DRAFT: CreateLeadDraft = {
  name: '',
  phone: '',
  email: '',
  source: 'manual',
  priority: 'normal',
  note: '',
  pincode: '',
  address: '',
  assignedTo: '',
};

const EMPTY_SUMMARY: CrmLeadSummary = {
  total: 0,
  new: 0,
  contacted: 0,
  interested: 0,
  follow_up: 0,
  converted: 0,
  lost: 0,
  cancelled: 0,
  hot: 0,
  overdue_followups: 0,
  lostReasons: [],
};

// ── Display helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CrmLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  follow_up: 'Follow-up',
  converted: 'Converted',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

const STATUS_BADGE_VARIANTS: Record<CrmLeadStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  new: 'info',
  contacted: 'default',
  interested: 'warning',
  follow_up: 'warning',
  converted: 'success',
  lost: 'error',
  cancelled: 'neutral',
};

const SOURCE_LABELS: Record<CrmLeadSource, string> = {
  meta_lead_form: 'Meta Lead Form',
  google_ads: 'Google Ads',
  website_enquiry: 'Website Enquiry',
  website_booking: 'Website Booking',
  website_abandoned_booking: 'Abandoned Booking',
  whatsapp: 'WhatsApp',
  direct: 'Direct',
  referral: 'Referral',
  manual: 'Manual',
};

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Created',
  note: 'Note',
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  status_change: 'Status',
  assignment: 'Assignment',
  followup_scheduled: 'Follow-up',
  converted: 'Converted',
  lost: 'Lost',
};

const ATTRIBUTION_LABELS: Array<{ key: string; label: string }> = [
  { key: 'campaign', label: 'Campaign' },
  { key: 'campaign_id', label: 'Campaign ID' },
  { key: 'adset', label: 'Ad set' },
  { key: 'adset_id', label: 'Ad set ID' },
  { key: 'ad', label: 'Ad' },
  { key: 'ad_id', label: 'Ad ID' },
  { key: 'form', label: 'Lead form' },
  { key: 'form_id', label: 'Form ID' },
  { key: 'platform', label: 'Platform' },
  { key: 'city', label: 'Area' },
  { key: 'pet_info', label: 'Pet' },
  { key: 'is_organic', label: 'Organic' },
  { key: 'meta_lead_status', label: 'Meta lead status' },
  { key: 'created_time', label: 'Lead created (source)' },
  { key: 'imported_from', label: 'Imported from' },
];

function formatAttributionValue(key: string, value: unknown) {
  if (key === 'imported_from' && value === 'google_sheet') {
    return 'Google Sheet';
  }
  return String(value);
}

type AttributionEntry = { label: string; value: string };

function buildAttributionEntries(sourceDetails: Record<string, unknown> | null | undefined): AttributionEntry[] {
  if (!sourceDetails || typeof sourceDetails !== 'object') {
    return [];
  }

  const entries: AttributionEntry[] = [];

  for (const { key, label } of ATTRIBUTION_LABELS) {
    const value = sourceDetails[key];
    if (value !== null && value !== undefined && value !== '') {
      entries.push({ label, value: formatAttributionValue(key, value) });
    }
  }

  const extraFields = sourceDetails.extra_fields;
  if (extraFields && typeof extraFields === 'object' && !Array.isArray(extraFields)) {
    for (const [key, value] of Object.entries(extraFields as Record<string, unknown>)) {
      if (value !== null && value !== undefined && value !== '') {
        entries.push({ label: key, value: String(value) });
      }
    }
  }

  return entries;
}

function formatLeadTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CrmTab() {
  const { showToast } = useToast();

  const [leads, setLeads] = useState<CrmLeadWithCustomer[]>([]);
  const [summary, setSummary] = useState<CrmLeadSummary>(EMPTY_SUMMARY);
  const [staffUsers, setStaffUsers] = useState<CrmStaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | CrmLeadStatus | 'due'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateLeadDraft>(EMPTY_CREATE_DRAFT);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<CrmLeadDetailPayload | null>(null);
  const [isLeadDetailLoading, setIsLeadDetailLoading] = useState(false);
  const [activityDraft, setActivityDraft] = useState('');
  const [activityType, setActivityType] = useState<'note' | 'call' | 'whatsapp' | 'email'>('note');
  const [followupDraft, setFollowupDraft] = useState('');
  const [isLeadBusy, setIsLeadBusy] = useState(false);
  const [locationDraft, setLocationDraft] = useState({ pincode: '', address: '' });
  const [lostForm, setLostForm] = useState<{ open: boolean; reason: string; custom: string }>({
    open: false,
    reason: 'No response',
    custom: '',
  });
  const [reassignDraft, setReassignDraft] = useState('');

  const [customer360UserId, setCustomer360UserId] = useState<string | null>(null);
  const [customer360Data, setCustomer360Data] = useState<CrmCustomer360Data | null>(null);
  const [isCustomer360Loading, setIsCustomer360Loading] = useState(false);
  const [retentionCandidates, setRetentionCandidates] = useState<CrmRetentionCandidate[]>([]);
  const [campaignRows, setCampaignRows] = useState<CrmCampaignRow[]>([]);
  const [isRetentionBusy, setIsRetentionBusy] = useState(false);

  const [lastImportRun, setLastImportRun] = useState<SheetImportRunRow | null>(null);
  const [isImportRunning, setIsImportRunning] = useState(false);
  const [importDryRunResult, setImportDryRunResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/crm/imports/meta-sheet', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as { runs?: SheetImportRunRow[] } | null;
        if (!cancelled) {
          setLastImportRun(payload?.runs?.[0] ?? null);
        }
      } catch {
        // History is optional context — silently ignore.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (statusFilter === 'due') {
        params.set('due', 'true');
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (debouncedSearch) params.set('q', debouncedSearch);

      const response = await fetch(`/api/admin/crm/leads?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | {
            leads?: CrmLeadWithCustomer[];
            summary?: CrmLeadSummary;
            staffUsers?: CrmStaffUser[];
            error?: string;
          }
        | null;

      if (!response.ok) throw new Error(payload?.error ?? 'Unable to load leads.');
      setLeads(payload?.leads ?? []);
      setSummary(payload?.summary ?? EMPTY_SUMMARY);
      if (payload?.staffUsers) {
        setStaffUsers(payload.staffUsers);
      }
    } catch (error) {
      setLeads([]);
      showToast(error instanceof Error ? error.message : 'Unable to load leads.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, debouncedSearch, showToast]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const openLeadDetail = useCallback(async (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsLeadDetailLoading(true);
    setActivityDraft('');
    setFollowupDraft('');
    try {
      const response = await fetch(`/api/admin/crm/leads/${leadId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as CrmLeadDetailPayload & { error?: string } | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? 'Unable to load lead.');
      setLeadDetail(payload);
      setLocationDraft({
        pincode: payload.lead.pincode ?? '',
        address: payload.lead.address ?? '',
      });
      setLostForm({ open: false, reason: 'No response', custom: '' });
      setReassignDraft('');
    } catch (error) {
      setLeadDetail(null);
      showToast(error instanceof Error ? error.message : 'Unable to load lead.', 'error');
    } finally {
      setIsLeadDetailLoading(false);
    }
  }, [showToast]);

  function closeLeadDetail() {
    setSelectedLeadId(null);
    setLeadDetail(null);
  }

  async function patchLead(leadId: string, body: Record<string, unknown>, successMessage: string) {
    setIsLeadBusy(true);
    try {
      const response = await fetch(`/api/admin/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to update lead.');

      showToast(successMessage, 'success');
      await Promise.all([fetchLeads(), openLeadDetail(leadId)]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update lead.', 'error');
    } finally {
      setIsLeadBusy(false);
    }
  }

  const openCustomer360 = useCallback(async (userId: string) => {
    setCustomer360UserId(userId);
    setIsCustomer360Loading(true);
    setCustomer360Data(null);
    try {
      const response = await fetch(`/api/admin/crm/customers/${userId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as CrmCustomer360Data & { error?: string } | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? 'Unable to load customer.');
      setCustomer360Data(payload);
    } catch (error) {
      setCustomer360UserId(null);
      showToast(error instanceof Error ? error.message : 'Unable to load customer.', 'error');
    } finally {
      setIsCustomer360Loading(false);
    }
  }, [showToast]);

  const loadRetentionAndCampaigns = useCallback(async () => {
    try {
      const [retentionResponse, campaignsResponse] = await Promise.all([
        fetch('/api/admin/crm/retention', { cache: 'no-store' }),
        fetch('/api/admin/crm/analytics/campaigns', { cache: 'no-store' }),
      ]);

      if (retentionResponse.ok) {
        const retentionPayload = (await retentionResponse.json().catch(() => null)) as
          | { candidates?: CrmRetentionCandidate[] }
          | null;
        setRetentionCandidates(retentionPayload?.candidates ?? []);
      }

      if (campaignsResponse.ok) {
        const campaignPayload = (await campaignsResponse.json().catch(() => null)) as
          | { campaigns?: CrmCampaignRow[] }
          | null;
        setCampaignRows(campaignPayload?.campaigns ?? []);
      }
    } catch {
      // Retention and campaign panels are supplementary — silent skip.
    }
  }, []);

  useEffect(() => {
    void loadRetentionAndCampaigns();
  }, [loadRetentionAndCampaigns]);

  async function createRetentionLead(candidate: CrmRetentionCandidate) {
    setIsRetentionBusy(true);
    try {
      const response = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: candidate.name ?? 'Pet Owner',
          phone: candidate.phone ?? '',
          source: 'manual',
          priority: 'normal',
          note: `Retention follow-up: last grooming ${candidate.lastGroomingDate} (${candidate.daysSinceLastGrooming} days ago), next recommended ${candidate.nextRecommendedDate}. Completed bookings: ${candidate.completedBookings}. Lifetime value ₹${candidate.totalSpentInr}.`,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to create follow-up lead.');

      showToast('Retention follow-up lead created.', 'success');
      await Promise.all([fetchLeads(), loadRetentionAndCampaigns()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create follow-up lead.', 'error');
    } finally {
      setIsRetentionBusy(false);
    }
  }

  async function exportLeadsCsv() {
    try {
      const response = await fetch('/api/admin/crm/leads/export', { cache: 'no-store' });
      if (!response.ok) throw new Error('Export failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dofurs-crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Leads CSV downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Export failed.', 'error');
    }
  }

  async function saveLeadLocation() {
    if (!selectedLeadId) return;
    const pincode = locationDraft.pincode.trim();
    if (pincode && !/^[0-9]{6}$/.test(pincode)) {
      showToast('Pincode must be exactly 6 digits (or leave it empty to clear).', 'error');
      return;
    }

    await patchLead(selectedLeadId, { pincode, address: locationDraft.address.trim() }, 'Lead location updated.');
  }

  async function toggleLeadPriority() {
    if (!selectedLeadId || !leadDetail) return;
    const nextPriority = leadDetail.lead.priority === 'hot' ? 'normal' : 'hot';
    await patchLead(
      selectedLeadId,
      { priority: nextPriority },
      nextPriority === 'hot' ? 'Lead marked hot.' : 'Lead priority set to normal.',
    );
  }

  async function submitActivity() {
    if (!selectedLeadId) return;
    const body = activityDraft.trim();
    if (!body) {
      showToast('Write a note or outcome first.', 'error');
      return;
    }

    const followupIso = followupDraft ? new Date(followupDraft).toISOString() : undefined;
    if (followupDraft && Number.isNaN(new Date(followupIso ?? '').getTime())) {
      showToast('Enter a valid follow-up date and time.', 'error');
      return;
    }

    setIsLeadBusy(true);
    try {
      const response = await fetch(`/api/admin/crm/leads/${selectedLeadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType,
          body,
          ...(followupIso ? { nextFollowupAt: followupIso } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to add activity.');

      setActivityDraft('');
      setFollowupDraft('');
      showToast('Activity logged.', 'success');
      await Promise.all([fetchLeads(), openLeadDetail(selectedLeadId)]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to add activity.', 'error');
    } finally {
      setIsLeadBusy(false);
    }
  }

  async function createLead() {
    const name = createDraft.name.trim();
    const phone = createDraft.phone.trim();
    const email = createDraft.email.trim().toLowerCase();

    if (name.length < 2) {
      showToast('Enter the customer name (min 2 characters).', 'error');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      showToast('Enter a valid phone number.', 'error');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Enter a valid email address or leave it empty.', 'error');
      return;
    }
    const pincode = createDraft.pincode.trim();
    if (pincode && !/^[0-9]{6}$/.test(pincode)) {
      showToast('Pincode must be exactly 6 digits (or leave it empty).', 'error');
      return;
    }

    setIsCreatingLead(true);
    try {
      const response = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          source: createDraft.source,
          priority: createDraft.priority,
          note: createDraft.note.trim() || undefined,
          pincode: pincode || undefined,
          address: createDraft.address.trim() || undefined,
          assignedTo: createDraft.assignedTo || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { lead?: CrmLeadWithCustomer; isNewCustomer?: boolean; error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to create lead.');

      setIsCreateModalOpen(false);
      setCreateDraft(EMPTY_CREATE_DRAFT);
      showToast(
        payload?.isNewCustomer ? 'Lead created for a new customer.' : 'Lead created for an existing customer.',
        'success',
      );
      await fetchLeads();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create lead.', 'error');
    } finally {
      setIsCreatingLead(false);
    }
  }

  async function runMetaSheetImport(dryRun: boolean) {
    setIsImportRunning(true);
    setImportDryRunResult(null);
    try {
      const response = await fetch('/api/admin/crm/imports/meta-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; result?: SheetImportRunResult; error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Import request failed.');

      const result = payload?.result;
      if (dryRun) {
        setImportDryRunResult(
          result
            ? `Dry run: ${result.candidatesFound} importable lead(s) across ${result.tabsScanned} tab(s) (${result.tabTitles.join(', ')}) out of ${result.rowsScanned} rows · ${result.invalid} invalid · ${result.skippedExisting} already in CRM.${result.warnings.length > 0 ? ` Warnings: ${result.warnings.join(' ')}` : ''}`
            : 'Dry run complete.',
        );
        showToast('Dry run complete — no leads were written.', 'success');
      } else {
        showToast(
          result
            ? `Imported ${result.imported} lead(s) · ${result.newCustomers} new customer(s) · ${result.skippedExisting} already in CRM.`
            : 'Import complete.',
          'success',
        );
        await fetchLeads();
      }

      // Refresh last-run status.
      const historyResponse = await fetch('/api/admin/crm/imports/meta-sheet', { cache: 'no-store' });
      if (historyResponse.ok) {
        const historyPayload = (await historyResponse.json().catch(() => null)) as { runs?: SheetImportRunRow[] } | null;
        setLastImportRun(historyPayload?.runs?.[0] ?? null);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Import failed.', 'error');
    } finally {
      setIsImportRunning(false);
    }
  }

  const statusFilters: Array<'all' | CrmLeadStatus | 'due'> = [
    'all',
    'new',
    'contacted',
    'interested',
    'follow_up',
    'due',
    'converted',
    'lost',
    'cancelled',
  ];

  const summaryCards = [
    { label: 'New', value: summary.new, tone: 'text-blue-700' },
    { label: 'Contacted', value: summary.contacted, tone: 'text-neutral-700' },
    { label: 'Interested', value: summary.interested, tone: 'text-amber-700' },
    { label: 'Follow-ups', value: summary.follow_up, tone: 'text-amber-700' },
    { label: 'Hot leads', value: summary.hot, tone: 'text-red-700' },
    { label: 'Overdue follow-ups', value: summary.overdue_followups, tone: 'text-red-700' },
    { label: 'Converted', value: summary.converted, tone: 'text-emerald-700' },
    { label: 'Lost', value: summary.lost, tone: 'text-neutral-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === status
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
              }`}
            >
              {status === 'all'
                ? 'All leads'
                : status === 'due'
                  ? `Due follow-ups${summary.overdue_followups > 0 ? ` (${summary.overdue_followups})` : ''}`
                  : STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex w-full max-w-xs items-center gap-2 sm:w-auto">
          <Input
            type="search"
            placeholder="Search name, phone, email…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-coral px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#cf8448]"
          >
            New lead
          </button>
          <button
            type="button"
            onClick={() => void exportLeadsCsv()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Lost reasons (when any exist) */}
      {summary.lostReasons.length > 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Top lost reasons ({summary.lost} lost)
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {summary.lostReasons.map((entry) => (
              <span key={entry.reason} className="text-xs text-neutral-600">
                {entry.reason} <span className="font-semibold text-neutral-800">×{entry.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Retention — repeat grooming due (Phase 6) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Repeat grooming due</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Customers whose last completed grooming is 25+ days old (30-day recommendation), without an open lead.
            </p>
          </div>
        </div>
        {retentionCandidates.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {retentionCandidates.slice(0, 5).map((candidate) => (
              <li key={candidate.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-neutral-800">
                    {candidate.name ?? 'Pet Owner'} · {candidate.phone ?? '—'}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Last grooming {candidate.lastGroomingDate} ({candidate.daysSinceLastGrooming}d ago) ·{' '}
                    {candidate.completedBookings} completed · ₹{candidate.totalSpentInr} lifetime
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRetentionBusy}
                  onClick={() => void createRetentionLead(candidate)}
                  className="shrink-0 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
                >
                  Create follow-up lead
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">No repeat-grooming follow-ups are due right now.</p>
        )}
      </div>

      {/* Campaign performance (Phase 7) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-semibold text-neutral-900">Campaign performance</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Leads → conversion → revenue per campaign (converted leads linked to booking value).
        </p>
        {campaignRows.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-neutral-400">
                  <th className="pb-2 pr-3 font-semibold">Campaign</th>
                  <th className="pb-2 pr-3 font-semibold">Leads</th>
                  <th className="pb-2 pr-3 font-semibold">Open</th>
                  <th className="pb-2 pr-3 font-semibold">Converted</th>
                  <th className="pb-2 pr-3 font-semibold">Lost</th>
                  <th className="pb-2 pr-3 font-semibold">Conv. %</th>
                  <th className="pb-2 font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.slice(0, 8).map((row) => (
                  <tr key={`${row.campaignId ?? row.campaign}`} className="border-t border-neutral-100">
                    <td className="py-1.5 pr-3 font-semibold text-neutral-800">
                      {row.campaign}
                      <span className="ml-1 font-normal text-neutral-400">({row.source.replace(/_/g, ' ')})</span>
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-600">{row.totalLeads}</td>
                    <td className="py-1.5 pr-3 text-neutral-600">{row.openLeads}</td>
                    <td className="py-1.5 pr-3 text-emerald-700">{row.convertedLeads}</td>
                    <td className="py-1.5 pr-3 text-neutral-500">{row.lostLeads}</td>
                    <td className="py-1.5 pr-3 text-neutral-600">{Math.round(row.conversionRate * 100)}%</td>
                    <td className="py-1.5 font-semibold text-neutral-800">₹{row.revenueInr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">No campaign data yet.</p>
        )}
      </div>

      {/* Meta leads — Google Sheet import */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Meta leads — Google Sheet import</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {lastImportRun
                ? `Last run ${formatLeadTimestamp(lastImportRun.started_at)} (${lastImportRun.trigger_source}${lastImportRun.dry_run ? ', dry run' : ''}) — ${
                    lastImportRun.status === 'success'
                      ? `${lastImportRun.rows_imported} imported, ${lastImportRun.rows_skipped} skipped, ${lastImportRun.rows_invalid} invalid`
                      : `failed: ${lastImportRun.error_message ?? 'unknown error'}`
                  }`
                : 'No import runs recorded yet. Dry run first to preview what would be imported.'}
            </p>
            {importDryRunResult ? (
              <p className="mt-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">{importDryRunResult}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void runMetaSheetImport(true)}
              disabled={isImportRunning}
              className="min-h-10 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImportRunning ? 'Running…' : 'Dry run'}
            </button>
            <button
              type="button"
              onClick={() => void runMetaSheetImport(false)}
              disabled={isImportRunning}
              className="min-h-10 rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Import now
            </button>
          </div>
        </div>
      </div>

      {/* Leads table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/60">
            <tr className="text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Assigned</th>
              <th className="px-4 py-3 font-semibold">Next follow-up</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
                  Loading leads…
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
                  No leads found. Capture enquiries with the New lead button.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50">
                  <td className="px-4 py-3 text-xs text-neutral-500">{formatLeadTimestamp(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void openCustomer360(lead.user_id)}
                      className="text-left"
                      title="Open Customer 360"
                    >
                      <p className="text-sm font-semibold text-neutral-900 hover:text-coral">
                        {lead.customer.name ?? 'Pet Owner'}
                      </p>
                      <p className="text-xs text-neutral-500">{lead.customer.phone ?? '—'}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-600">{SOURCE_LABELS[lead.source]}</span>
                      {lead.priority === 'hot' ? <Badge variant="error" size="sm">Hot</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE_VARIANTS[lead.status]} size="sm">{STATUS_LABELS[lead.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{lead.assigned_user?.name ?? 'Unassigned'}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {lead.next_followup_at ? formatLeadTimestamp(lead.next_followup_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openLeadDetail(lead.id)}
                      className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create lead modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New lead"
        description="Captures a manual, WhatsApp, direct, or referral enquiry. Existing customers are matched automatically by phone or email."
      >
        <div className="space-y-3">
          <Input
            label="Customer name"
            placeholder="e.g. Ravi Kumar"
            value={createDraft.name}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, name: event.target.value }))}
          />
          <Input
            label="Phone"
            placeholder="10-digit Indian mobile number"
            value={createDraft.phone}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, phone: event.target.value }))}
          />
          <Input
            label="Email (optional)"
            placeholder="name@example.com"
            value={createDraft.email}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, email: event.target.value }))}
          />
          <Input
            label="Pincode (optional)"
            placeholder="6-digit pincode — plots the lead on Gaze"
            value={createDraft.pincode}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, pincode: event.target.value }))}
          />
          <Input
            label="Address (optional)"
            placeholder="Street / landmark for follow-ups"
            value={createDraft.address}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, address: event.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="crm-lead-source" className="text-sm font-medium text-neutral-700">Source</label>
              <select
                id="crm-lead-source"
                value={createDraft.source}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, source: event.target.value as CreateLeadDraft['source'] }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              >
                <option value="manual">Manual</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="direct">Direct</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="crm-lead-priority" className="text-sm font-medium text-neutral-700">Priority</label>
              <select
                id="crm-lead-priority"
                value={createDraft.priority}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, priority: event.target.value as 'normal' | 'hot' }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              >
                <option value="normal">Normal</option>
                <option value="hot">Hot</option>
              </select>
            </div>
          </div>
          {staffUsers.length > 0 ? (
            <div className="space-y-2">
              <label htmlFor="crm-lead-assignee" className="text-sm font-medium text-neutral-700">
                Assign to (optional — least-loaded staff is picked automatically otherwise)
              </label>
              <select
                id="crm-lead-assignee"
                value={createDraft.assignedTo}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, assignedTo: event.target.value }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              >
                <option value="">Auto-assign</option>
                {staffUsers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Textarea
            label="Notes (optional)"
            placeholder="What did the customer ask for? Pet breed, preferred area, service…"
            value={createDraft.note}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, note: event.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="min-h-10 rounded-xl border border-neutral-200 px-4 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createLead()}
              disabled={isCreatingLead}
              className="min-h-10 rounded-xl bg-coral px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingLead ? 'Creating…' : 'Create lead'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Lead detail modal */}
      <Modal
        isOpen={selectedLeadId !== null}
        onClose={closeLeadDetail}
        title="Lead detail"
        description="Lead information, activity history, and next actions."
        size="lg"
      >
        {isLeadDetailLoading || !leadDetail ? (
          <div className="py-10 text-center text-sm text-neutral-500">Loading lead…</div>
        ) : (
          <div className="space-y-4">
            {/* Lead info */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    {leadDetail.lead.customer.name ?? 'Pet Owner'}
                    {leadDetail.lead.priority === 'hot' ? (
                      <Badge variant="error" size="sm" className="ml-2">Hot</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {leadDetail.lead.customer.phone ?? '—'}
                    {leadDetail.lead.customer.email ? ` · ${leadDetail.lead.customer.email}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={STATUS_BADGE_VARIANTS[leadDetail.lead.status]} size="sm">
                    {STATUS_LABELS[leadDetail.lead.status]}
                  </Badge>
                  <p className="mt-1 text-xs text-neutral-500">
                    Source: {SOURCE_LABELS[leadDetail.lead.source]}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 sm:grid-cols-4">
                <div>
                  <p className="font-semibold text-neutral-500">Created</p>
                  <p>{formatLeadTimestamp(leadDetail.lead.created_at)}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">Assigned</p>
                  <p>{leadDetail.lead.assigned_user?.name ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">First contact</p>
                  <p>{formatLeadTimestamp(leadDetail.lead.first_contacted_at)}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">Next follow-up</p>
                  <p>{formatLeadTimestamp(leadDetail.lead.next_followup_at)}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">Pincode</p>
                  <p>{leadDetail.lead.pincode ?? '—'}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="font-semibold text-neutral-500">Address</p>
                  <p className="break-words">{leadDetail.lead.address ?? '—'}</p>
                </div>
              </div>
              {leadDetail.converted_booking ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  Converted to booking #{leadDetail.converted_booking.id} ·{' '}
                  {leadDetail.converted_booking.booking_date} · ₹{leadDetail.converted_booking.final_price ?? '—'}
                </p>
              ) : null}
              {leadDetail.lead.lost_reason ? (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  Lost reason: {leadDetail.lead.lost_reason}
                </p>
              ) : null}
            </div>

            {/* Attribution & source details */}
            {(() => {
              const attributionEntries = buildAttributionEntries(leadDetail.lead.source_details);
              if (attributionEntries.length === 0) return null;
              return (
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <p className="text-sm font-semibold text-neutral-900">Attribution & lead details</p>
                  <div className="mt-2 grid gap-x-4 gap-y-2 text-xs text-neutral-600 sm:grid-cols-2">
                    {attributionEntries.map((entry) => (
                      <div key={entry.label} className="min-w-0">
                        <p className="font-semibold text-neutral-500">{entry.label}</p>
                        <p className="break-words">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Actions (only while the lead is open) */}
            {(leadDetail.lead.status === 'new' ||
              leadDetail.lead.status === 'contacted' ||
              leadDetail.lead.status === 'interested' ||
              leadDetail.lead.status === 'follow_up') ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(event) => {
                    const next = event.target.value as CrmLeadStatus;
                    if (!next || !selectedLeadId) return;
                    void patchLead(selectedLeadId, { status: next }, `Lead moved to ${STATUS_LABELS[next]}.`);
                  }}
                  className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none"
                >
                  <option value="">Move status…</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  type="button"
                  disabled={isLeadBusy}
                  onClick={() => {
                    if (!selectedLeadId) return;
                    void patchLead(selectedLeadId, { assignedTo: 'self' }, 'Lead assigned to you.');
                  }}
                  className="min-h-10 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Assign to me
                </button>
                <button
                  type="button"
                  disabled={isLeadBusy}
                  onClick={() => {
                    if (!selectedLeadId) return;
                    setLostForm({ open: true, reason: 'No response', custom: '' });
                  }}
                  className="min-h-10 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                >
                  Mark lost
                </button>
                {staffUsers.length > 0 ? (
                  <select
                    aria-label="Reassign lead"
                    value={reassignDraft}
                    onChange={(event) => setReassignDraft(event.target.value)}
                    className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none"
                  >
                    <option value="">Reassign to…</option>
                    {staffUsers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {reassignDraft ? (
                  <button
                    type="button"
                    disabled={isLeadBusy}
                    onClick={() => {
                      if (!selectedLeadId) return;
                      void patchLead(selectedLeadId, { assignedTo: reassignDraft }, 'Lead reassigned.');
                    }}
                    className="min-h-10 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                  >
                    Apply
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void openCustomer360(leadDetail.lead.user_id)}
                  className="min-h-10 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Customer 360
                </button>
              </div>
            ) : null}

            {/* Inline lost-reason form (open leads only) */}
            {lostForm.open &&
            (leadDetail.lead.status === 'new' ||
              leadDetail.lead.status === 'contacted' ||
              leadDetail.lead.status === 'interested' ||
              leadDetail.lead.status === 'follow_up') ? (
              <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50/40 p-4">
                <p className="text-sm font-semibold text-neutral-900">Why was this lead lost?</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    aria-label="Lost reason"
                    value={lostForm.reason}
                    onChange={(event) => setLostForm((draft) => ({ ...draft, reason: event.target.value }))}
                    className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none"
                  >
                    {LOST_REASON_OPTIONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  {lostForm.reason === 'Other' ? (
                    <Input
                      placeholder="Custom reason"
                      value={lostForm.custom}
                      onChange={(event) => setLostForm((draft) => ({ ...draft, custom: event.target.value }))}
                    />
                  ) : (
                    <span className="self-center text-[11px] text-neutral-400">
                      Lost reasons feed the top-lost-reasons summary on the Leads dashboard.
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLostForm((draft) => ({ ...draft, open: false }))}
                    className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isLeadBusy || (lostForm.reason === 'Other' && !lostForm.custom.trim())}
                    onClick={() => {
                      if (!selectedLeadId) return;
                      const reason =
                        lostForm.reason === 'Other' ? lostForm.custom.trim() : lostForm.reason;
                      if (!reason) return;
                      void patchLead(selectedLeadId, { status: 'lost', lostReason: reason }, 'Lead marked lost.');
                      setLostForm((draft) => ({ ...draft, open: false }));
                    }}
                    className="min-h-10 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Confirm lost
                  </button>
                </div>
              </div>
            ) : null}

            {/* Location & priority (open leads only) */}
            {(leadDetail.lead.status === 'new' ||
              leadDetail.lead.status === 'contacted' ||
              leadDetail.lead.status === 'interested' ||
              leadDetail.lead.status === 'follow_up') ? (
              <div className="space-y-2.5 rounded-2xl border border-neutral-200 p-4">
                <p className="text-sm font-semibold text-neutral-900">Location &amp; priority</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="6-digit pincode"
                    value={locationDraft.pincode}
                    onChange={(event) => setLocationDraft((draft) => ({ ...draft, pincode: event.target.value }))}
                  />
                  <Input
                    placeholder="Street / landmark"
                    value={locationDraft.address}
                    onChange={(event) => setLocationDraft((draft) => ({ ...draft, address: event.target.value }))}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isLeadBusy}
                    onClick={() => void saveLeadLocation()}
                    className="min-h-10 rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save location
                  </button>
                  <button
                    type="button"
                    disabled={isLeadBusy}
                    onClick={() => void toggleLeadPriority()}
                    className="min-h-10 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {leadDetail.lead.priority === 'hot' ? 'Clear hot' : 'Mark hot'}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  A pincode links this lead to a Gaze area so it appears in the map lead analysis.
                </p>
              </div>
            ) : null}

            {/* Activity form */}
            <div className="space-y-2 rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-900">Log activity</p>
              <div className="flex flex-wrap gap-1.5">
                {(['note', 'call', 'whatsapp', 'email'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivityType(type)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      activityType === type
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {ACTIVITY_LABELS[type]}
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Call outcome, conversation summary, next steps…"
                value={activityDraft}
                onChange={(event) => setActivityDraft(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  aria-label="Next follow-up (optional)"
                  value={followupDraft}
                  onChange={(event) => setFollowupDraft(event.target.value)}
                  className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void submitActivity()}
                  disabled={isLeadBusy}
                  className="min-h-10 rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLeadBusy ? 'Saving…' : 'Save activity'}
                </button>
              </div>
            </div>

            {/* Activity timeline */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-900">History</p>
              {leadDetail.activities.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500">
                  No activity yet.
                </p>
              ) : (
                leadDetail.activities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border border-neutral-100 bg-white px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-800">
                        {ACTIVITY_LABELS[activity.activity_type] ?? activity.activity_type}
                      </span>
                      <span className="text-[11px] text-neutral-400">{formatLeadTimestamp(activity.created_at)}</span>
                    </div>
                    {activity.body ? <p className="mt-1 text-xs text-neutral-600">{activity.body}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Customer 360 modal (Phase 5) */}
      <Modal
        isOpen={customer360UserId !== null}
        onClose={() => {
          setCustomer360UserId(null);
          setCustomer360Data(null);
        }}
        title="Customer 360"
        description="Pets, leads, bookings, payments, and grooming cadence in one view."
        size="lg"
      >
        {isCustomer360Loading || !customer360Data ? (
          <div className="py-10 text-center text-sm text-neutral-500">Loading customer…</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-neutral-900">{customer360Data.user.name ?? 'Pet Owner'}</p>
                  <p className="text-xs text-neutral-500">
                    {customer360Data.user.phone ?? '—'}
                    {customer360Data.user.email ? ` · ${customer360Data.user.email}` : ''}
                  </p>
                </div>
                <p className="text-[11px] text-neutral-400">Customer ID: {customer360Data.user.id.slice(0, 8)}…</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 sm:grid-cols-4">
                <div>
                  <p className="font-semibold text-neutral-500">Completed groomings</p>
                  <p>{customer360Data.grooming.completedBookings}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">Lifetime paid</p>
                  <p>₹{customer360Data.paymentSummary.paidAmountInr}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">Last grooming</p>
                  <p>{customer360Data.grooming.lastGroomingDate ?? '—'}</p>
                </div>
                <div>
                  <p className="font-semibold text-neutral-500">Next recommended</p>
                  <p className={customer360Data.grooming.daysSinceLastGrooming !== null && customer360Data.grooming.daysSinceLastGrooming > 30 ? 'font-semibold text-red-700' : ''}>
                    {customer360Data.grooming.nextRecommendedDate ?? '—'}
                    {customer360Data.grooming.daysSinceLastGrooming !== null
                      ? ` (${customer360Data.grooming.daysSinceLastGrooming}d ago)`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {customer360Data.pets.map((pet) => (
                  <span key={pet.id} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                    {pet.name}
                    {pet.breed ? ` · ${pet.breed}` : ''}
                  </span>
                ))}
                {customer360Data.addresses.map((address, index) => (
                  <span key={`address-${index}`} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                    {address.isDefault ? 'Default address' : 'Address'}
                    {address.pincode ? ` · ${address.pincode}` : ''}
                    {address.city ? ` · ${address.city}` : ''}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-900">Leads</p>
              {customer360Data.leads.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-500">No leads yet.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {customer360Data.leads.slice(0, 6).map((lead) => (
                    <li key={lead.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-white px-3 py-2 text-xs">
                      <span className="font-semibold text-neutral-800">{SOURCE_LABELS[lead.source]}</span>
                      <span className="text-neutral-500">
                        {STATUS_LABELS[lead.status]} · {formatLeadTimestamp(lead.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-900">Bookings</p>
              {customer360Data.bookings.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-500">No bookings yet.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {customer360Data.bookings.slice(0, 8).map((booking) => (
                    <li key={booking.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-white px-3 py-2 text-xs">
                      <span className="font-semibold text-neutral-800">
                        #{booking.id} · {booking.bookingDate ?? 'date pending'}
                        {booking.startTime ? ` ${booking.startTime}` : ''}
                      </span>
                      <span className="text-neutral-500">
                        {booking.status.replace(/_/g, ' ')}
                        {booking.finalPrice != null ? ` · ₹${booking.finalPrice}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

