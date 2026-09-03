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
import {
  RETENTION_DEFAULT_RECOMMENDED_DAYS,
  RETENTION_LEAD_TIME_DAYS,
  RETENTION_RECOMMENDED_DAY_OPTIONS,
  type RetentionRecommendedDays,
} from '@/lib/crm/types';
import {
  CRM_ACTIVITY_LABELS as ACTIVITY_LABELS,
  CRM_LOST_REASON_OPTIONS as LOST_REASON_OPTIONS,
  CRM_SOURCE_LABELS as SOURCE_LABELS,
  CRM_STATUS_LABELS as STATUS_LABELS,
  formatLeadTimestamp,
} from '@/lib/crm/labels';
import { isCrmLeadSource, isCrmLeadStatus } from '@/lib/crm/types';
import type {
  CrmAutomationJobHealth as AutomationJobHealth,
  CrmAutomationStatus as AutomationStatusSnapshot,
} from '@/lib/crm/automation-status';
import type {
  RunMetaSheetImportResult as SheetImportRunResult,
  SheetImportRunRow as SheetImportRunRowBase,
} from '@/lib/crm/service';
import { adminRequest } from '@/lib/api/admin-fetch';
import { useSearchParams } from 'next/navigation';

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

// Shared server shapes are imported from the CRM domain modules — the client
// must never re-declare them by convention (drift risk). See
// lib/crm/automation-status.ts and lib/crm/service.ts.
type SheetImportRunRow = SheetImportRunRowBase & { id: string };

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

// Lost-reason vocabulary: lib/crm/labels.ts (CRM_LOST_REASON_OPTIONS).

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

/** Humanizes a minutes count as "45m", "3h 20m", or "2d" for response-health display. */
function formatDurationFromMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${Math.round(minutes / (60 * 24))}d`;
}

/** WhatsApp deep link (wa.me) for an Indian phone number — null when unusable. */
function buildWhatsAppHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `https://wa.me/91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `https://wa.me/${digits}`;
  return null;
}

/** Follow-up quick presets (C4) — computed in the viewer's local time (staff are IST). */
function buildFollowupPresets(): Array<{ label: string; value: string }> {
  const toInputValue = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const threeDays = new Date(tomorrow);
  threeDays.setDate(threeDays.getDate() + 2);

  const oneWeek = new Date(tomorrow);
  oneWeek.setDate(oneWeek.getDate() + 6);

  return [
    { label: 'Tomorrow 10:00', value: toInputValue(tomorrow) },
    { label: '+3 days 10:00', value: toInputValue(threeDays) },
    { label: '+1 week 10:00', value: toInputValue(oneWeek) },
  ];
}

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
  truncated: false,
  avgFirstResponseMinutes: null,
  medianFirstResponseMinutes: null,
  newUncontactedOver24h: 0,
};

// ── Display helpers ────────────────────────────────────────────────────────────

// Status labels: lib/crm/labels.ts (CRM_STATUS_LABELS).

const STATUS_BADGE_VARIANTS: Record<CrmLeadStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  new: 'info',
  contacted: 'default',
  interested: 'warning',
  follow_up: 'warning',
  converted: 'success',
  lost: 'error',
  cancelled: 'neutral',
};

// Source labels: lib/crm/labels.ts (CRM_SOURCE_LABELS).

// Activity labels: lib/crm/labels.ts (CRM_ACTIVITY_LABELS).

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

// formatLeadTimestamp: lib/crm/labels.ts (IST-explicit).

// ── Automation health panel (cron import + sweep observability) ────────────────

const AUTOMATION_JOB_LABELS: Record<AutomationJobHealth['job'], string> = {
  meta_sheet_import: 'Meta sheet import',
  abandoned_bookings_sweep: 'Abandoned-booking sweep',
};

const AUTOMATION_STATUS_LABELS: Record<AutomationJobHealth['status'], string> = {
  healthy: 'Healthy',
  stale: 'Stale',
  failing: 'Failing',
  not_reporting: 'Not reporting',
  misconfigured: 'Misconfigured',
};

const AUTOMATION_SEVERITY_BADGE_VARIANTS: Record<AutomationJobHealth['severity'], 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warn: 'warning',
  critical: 'error',
};

function formatAutomationMinutesAgo(minutes: number | null): string {
  if (minutes === null) return 'never';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m ago` : `${hours}h ago`;
}

/** Compact run counts from the last heartbeat summary (e.g. "12 imported · 3 skipped"). */
function summarizeAutomationHeartbeat(summary: Record<string, unknown> | null | undefined): string {
  if (!summary) return '';
  const parts: string[] = [];
  if (typeof summary.imported === 'number') parts.push(`${summary.imported} imported`);
  if (typeof summary.skipped === 'number') parts.push(`${summary.skipped} skipped`);
  if (typeof summary.scanned === 'number') parts.push(`${summary.scanned} scanned`);
  if (typeof summary.abandonedLeads === 'number') parts.push(`${summary.abandonedLeads} hot lead(s)`);
  return parts.length > 0 ? parts.join(' · ') : '';
}

/** Leads per page on the CRM dashboard table (the API supports offset pagination). */
const PAGE_SIZE = 50;

/** Retention candidates per page in the "Repeat grooming due" card. */
const RETENTION_PAGE_SIZE = 10;

// ── Component ──────────────────────────────────────────────────────────────────

export default function CrmTab() {
  const { showToast } = useToast();

  const [leads, setLeads] = useState<CrmLeadWithCustomer[]>([]);
  const [summary, setSummary] = useState<CrmLeadSummary>(EMPTY_SUMMARY);
  const [staffUsers, setStaffUsers] = useState<CrmStaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // C2: filters live in the URL — refresh-stable views, back/forward, and deep
  // links (Gaze lead bubbles link here with ?area=…&status=open).
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<'all' | CrmLeadStatus | 'due'>(() => {
    const value = searchParams.get('status');
    return value === 'due' || (value !== null && isCrmLeadStatus(value)) ? value : 'all';
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(() => {
    const value = Number(searchParams.get('page'));
    return Number.isSafeInteger(value) && value >= 1 ? value - 1 : 0;
  });
  const [assignedFilter, setAssignedFilter] = useState<string>(() => searchParams.get('assigned') ?? 'all');
  const [sourceFilter, setSourceFilter] = useState<'all' | CrmLeadSource>(() => {
    const value = searchParams.get('source');
    return value !== null && isCrmLeadSource(value) ? value : 'all';
  });
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'hot'>(() =>
    searchParams.get('priority') === 'hot' ? 'hot' : 'all',
  );
  const [areaFilter, setAreaFilter] = useState<string | null>(() => searchParams.get('area'));
  const [areaFilterName, setAreaFilterName] = useState<string | null>(() => searchParams.get('areaName'));
  const [totalLeads, setTotalLeads] = useState(0);

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
  const [convertForm, setConvertForm] = useState<{
    open: boolean;
    bookings: CrmCustomer360Data['bookings'];
    bookingId: string;
    isLoadingBookings: boolean;
  }>({ open: false, bookings: [], bookingId: '', isLoadingBookings: false });

  const [customer360UserId, setCustomer360UserId] = useState<string | null>(null);
  const [customer360Data, setCustomer360Data] = useState<CrmCustomer360Data | null>(null);
  const [isCustomer360Loading, setIsCustomer360Loading] = useState(false);
  const [retentionCandidates, setRetentionCandidates] = useState<CrmRetentionCandidate[]>([]);
  const [retentionTotal, setRetentionTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState<RetentionRecommendedDays>(RETENTION_DEFAULT_RECOMMENDED_DAYS);
  const [retentionPage, setRetentionPage] = useState(0);
  const [isRetentionExpanded, setIsRetentionExpanded] = useState(false);
  const [isRetentionLoading, setIsRetentionLoading] = useState(false);
  const [campaignWindow, setCampaignWindow] = useState<'30' | '90' | 'all'>('all');
  const [campaignRows, setCampaignRows] = useState<CrmCampaignRow[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [bulkStatusDraft, setBulkStatusDraft] = useState<'' | CrmLeadStatus>('');
  const [bulkLostReason, setBulkLostReason] = useState<string>('No response');
  const [isRetentionBusy, setIsRetentionBusy] = useState(false);

  const [lastImportRun, setLastImportRun] = useState<SheetImportRunRow | null>(null);
  const [isImportRunning, setIsImportRunning] = useState(false);
  const [importDryRunResult, setImportDryRunResult] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatusSnapshot | null>(null);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [importHistoryError, setImportHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const payload = await adminRequest<{ runs?: SheetImportRunRow[] }>('/api/admin/crm/imports/meta-sheet');
        if (!cancelled) {
          setLastImportRun(payload.runs?.[0] ?? null);
          setImportHistoryError(null);
        }
      } catch (error) {
        // Loud, never silent — the panel otherwise implies "no import runs recorded".
        console.warn('[crm] Import run history failed to load:', error);
        if (!cancelled) {
          setImportHistoryError('Import run history failed to load.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAutomationStatus = useCallback(async () => {
    try {
      const payload = await adminRequest<AutomationStatusSnapshot>('/api/admin/crm/automation/status');
      setAutomationStatus(payload);
      setAutomationError(null);
    } catch (error) {
      // Loud, never silent — a stuck "loading…" health panel hides cron outages.
      console.warn('[crm] Automation status failed to load:', error);
      setAutomationError('Automation status failed to load.');
    }
  }, []);

  useEffect(() => {
    void fetchAutomationStatus();
    // Keep the panel current while the tab is open (the crons run every 5 min;
    // heartbeats land within seconds of each attempt).
    const interval = window.setInterval(() => void fetchAutomationStatus(), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchAutomationStatus]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  // Mirror the active filters into the URL via the native history API — no
  // navigation round-trip (no server refetch), refresh restores the view.
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (areaFilter) {
      params.set('area', areaFilter);
      if (areaFilterName) params.set('areaName', areaFilterName);
    }
    if (page > 0) params.set('page', String(page + 1));
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [areaFilter, areaFilterName, assignedFilter, debouncedSearch, page, priorityFilter, sourceFilter, statusFilter]);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (statusFilter === 'due') {
        params.set('due', 'true');
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (assignedFilter !== 'all') params.set('assignedTo', assignedFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (areaFilter) params.set('area', areaFilter);

      const payload = await adminRequest<{
        leads?: CrmLeadWithCustomer[];
        summary?: CrmLeadSummary;
        staffUsers?: CrmStaffUser[];
        pagination?: { limit: number; offset: number; total: number | null };
      }>(`/api/admin/crm/leads?${params.toString()}`);
      const fetchedLeads = payload.leads ?? [];
      const total = payload.pagination?.total;

      // If the active page is past the last one (e.g. the result set shrank after
      // leads changed state), snap back to the final page instead of showing a blank table.
      if (fetchedLeads.length === 0 && page > 0 && typeof total === 'number' && total > 0) {
        const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
        if (lastPage < page) {
          setPage(lastPage);
          return;
        }
      }

      setLeads(fetchedLeads);
      setSummary(payload.summary ?? EMPTY_SUMMARY);
      setTotalLeads(typeof total === 'number' ? total : fetchedLeads.length);
      if (payload.staffUsers) {
        setStaffUsers(payload.staffUsers);
      }
    } catch (error) {
      setLeads([]);
      setTotalLeads(0);
      showToast(error instanceof Error ? error.message : 'Unable to load leads.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [areaFilter, assignedFilter, debouncedSearch, page, priorityFilter, sourceFilter, statusFilter, showToast]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const openLeadDetail = useCallback(async (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsLeadDetailLoading(true);
    setActivityDraft('');
    setFollowupDraft('');
    try {
      const payload = await adminRequest<CrmLeadDetailPayload>(`/api/admin/crm/leads/${leadId}`);
      setLeadDetail(payload);
      setLocationDraft({
        pincode: payload.lead.pincode ?? '',
        address: payload.lead.address ?? '',
      });
      setLostForm({ open: false, reason: 'No response', custom: '' });
      setReassignDraft('');
      setConvertForm({ open: false, bookings: [], bookingId: '', isLoadingBookings: false });
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
      await adminRequest<{ success: boolean }>(`/api/admin/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

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
      const payload = await adminRequest<CrmCustomer360Data>(`/api/admin/crm/customers/${userId}`);
      setCustomer360Data(payload);
    } catch (error) {
      setCustomer360UserId(null);
      showToast(error instanceof Error ? error.message : 'Unable to load customer.', 'error');
    } finally {
      setIsCustomer360Loading(false);
    }
  }, [showToast]);

  // B8 deep-link entry: /dashboard/admin/crm?customer=<userId> opens Customer 360
  // directly (linked from UsersTab rows, BookingDetailModal, and the palette).
  useEffect(() => {
    const customerParam = searchParams.get('customer');
    if (customerParam) {
      void openCustomer360(customerParam);
    }
    // Deliberately once per mount — modal state changes must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // C6 deep-link entry: /dashboard/admin/crm?lead=<leadId> opens the lead detail
  // modal directly (linked from the command palette's entity search).
  useEffect(() => {
    const leadParam = searchParams.get('lead');
    if (leadParam) {
      void openLeadDetail(leadParam);
    }
    // Deliberately once per mount — modal state changes must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conversion is guarded service-side (requires a booking id belonging to the
  // same customer), so the UI collects the booking before patching the status.
  const openConvertForm = useCallback(async (userId: string) => {
    setConvertForm({ open: true, bookings: [], bookingId: '', isLoadingBookings: true });
    try {
      const payload = await adminRequest<CrmCustomer360Data>(`/api/admin/crm/customers/${userId}`);
      setConvertForm({ open: true, bookings: payload.bookings, bookingId: '', isLoadingBookings: false });
    } catch (error) {
      setConvertForm({ open: false, bookings: [], bookingId: '', isLoadingBookings: false });
      showToast(error instanceof Error ? error.message : 'Unable to load customer bookings.', 'error');
    }
  }, [showToast]);

  const loadRetention = useCallback(async () => {
    setIsRetentionLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(retentionDays));
      params.set('limit', String(RETENTION_PAGE_SIZE));
      params.set('offset', String(retentionPage * RETENTION_PAGE_SIZE));
      const payload = await adminRequest<{ candidates?: CrmRetentionCandidate[]; total?: number }>(
        `/api/admin/crm/retention?${params.toString()}`,
      );
      const candidates = payload.candidates ?? [];
      const total = payload.total;

      // If the active page emptied (e.g. a follow-up lead removed the customer
      // from the list), snap back to the final page instead of a blank list.
      if (candidates.length === 0 && retentionPage > 0 && typeof total === 'number' && total > 0) {
        const lastPage = Math.max(0, Math.ceil(total / RETENTION_PAGE_SIZE) - 1);
        if (lastPage < retentionPage) {
          setRetentionPage(lastPage);
          return;
        }
      }

      setRetentionCandidates(candidates);
      setRetentionTotal(typeof total === 'number' ? total : candidates.length);
      setRetentionError(null);
    } catch (error) {
      // Loud, never silent — a dead retention panel must not read as "no follow-ups due".
      console.warn('[crm] Retention panel failed to load:', error);
      setRetentionError('Retention panel failed to load.');
    } finally {
      setIsRetentionLoading(false);
    }
  }, [retentionDays, retentionPage]);

  const loadCampaigns = useCallback(async () => {
    try {
      // B6: optional window — 30d / 90d chips (default all-time).
      const params = new URLSearchParams();
      if (campaignWindow !== 'all') params.set('days', campaignWindow);
      const query = params.toString();
      const payload = await adminRequest<{ campaigns?: CrmCampaignRow[] }>(
        `/api/admin/crm/analytics/campaigns${query ? `?${query}` : ''}`,
      );
      setCampaignRows(payload.campaigns ?? []);
      setCampaignsError(null);
    } catch (error) {
      // Loud, never silent — campaign analytics silently disappearing is undiagnosable.
      console.warn('[crm] Campaign panel failed to load:', error);
      setCampaignsError('Campaign panel failed to load.');
    }
  }, [campaignWindow]);

  useEffect(() => {
    void loadRetention();
  }, [loadRetention]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  async function createRetentionLead(candidate: CrmRetentionCandidate) {
    setIsRetentionBusy(true);
    try {
      await adminRequest('/api/admin/crm/leads', {
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

      showToast('Retention follow-up lead created.', 'success');
      await Promise.all([fetchLeads(), loadRetention()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create follow-up lead.', 'error');
    } finally {
      setIsRetentionBusy(false);
    }
  }

  async function exportLeadsCsv() {
    try {
      // Export what you're looking at: mirror the active list filters.
      const params = new URLSearchParams();
      if (statusFilter === 'due') {
        params.set('due', 'true');
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (debouncedSearch) {
        params.set('q', debouncedSearch);
      }
      if (assignedFilter !== 'all') {
        params.set('assignedTo', assignedFilter);
      }
      if (sourceFilter !== 'all') {
        params.set('source', sourceFilter);
      }
      if (priorityFilter !== 'all') {
        params.set('priority', priorityFilter);
      }
      if (areaFilter) {
        params.set('area', areaFilter);
      }
      const query = params.toString();
      const response = await fetch(`/api/admin/crm/leads/export${query ? `?${query}` : ''}`, { cache: 'no-store' });
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

  // ── Bulk actions (B3) — assign / status across the selected worklist ────────
  async function runBulkUpdate(
    action: { type: 'assign'; assignedTo: string } | { type: 'status'; status: CrmLeadStatus; lostReason?: string },
  ) {
    if (selectedLeadIds.size === 0 || isBulkBusy) return;
    setIsBulkBusy(true);
    try {
      const payload = await adminRequest<{
        result?: { requested: number; updated: number; skipped: Array<{ leadId: string; reason: string }> };
      }>('/api/admin/crm/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeadIds), action }),
      });
      const result = payload.result;
      showToast(
        result
          ? `Updated ${result.updated}/${result.requested} lead(s)${result.skipped.length > 0 ? ` · ${result.skipped.length} skipped (guards held)` : ''}.`
          : 'Bulk update done.',
        result && result.skipped.length > 0 ? 'error' : 'success',
      );
      setSelectedLeadIds(new Set());
      setBulkStatusDraft('');
      setBulkLostReason('No response');
      await fetchLeads();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Bulk update failed.', 'error');
    } finally {
      setIsBulkBusy(false);
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
      await adminRequest(`/api/admin/crm/leads/${selectedLeadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType,
          body,
          ...(followupIso ? { nextFollowupAt: followupIso } : {}),
        }),
      });

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

      // Refresh the automation health panel (a manual run lands as an
      // admin-panel run, but the heartbeat-side view may also update).
      void fetchAutomationStatus();
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

      {/* Response health — speed-to-lead, aging, and scan-cap honesty */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-xs text-neutral-600">
        <span className="font-semibold text-neutral-900">Response health</span>
        {summary.avgFirstResponseMinutes != null ? (
          <span>
            Avg first response{' '}
            <span className="font-semibold text-neutral-900">
              {formatDurationFromMinutes(summary.avgFirstResponseMinutes)}
            </span>
            {' · median '}
            <span className="font-semibold text-neutral-900">
              {formatDurationFromMinutes(summary.medianFirstResponseMinutes ?? summary.avgFirstResponseMinutes)}
            </span>
          </span>
        ) : (
          <span className="text-neutral-500">Speed-to-lead appears once leads have a first contact.</span>
        )}
        {summary.newUncontactedOver24h > 0 ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
            {summary.newUncontactedOver24h} new lead(s) uncontacted over 24h
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            No new leads aging past 24h
          </span>
        )}
        {/* B7: promote the retention worklist — one click jumps to it. */}
        <button
          type="button"
          onClick={() => {
            setIsRetentionExpanded(true);
            requestAnimationFrame(() => {
              document.getElementById('crm-retention')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }}
          className="rounded-full bg-[#fff7f0] px-2.5 py-1 font-semibold text-ink transition hover:bg-[#ffefe0]"
        >
          Repeat grooming due ({retentionTotal})
        </button>
        {summary.truncated ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            Summary scans the latest 5,000 leads — counts are a lower bound
          </span>
        ) : null}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(0);
              }}
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

        {/* Refine row — assignee / source / priority (B1) + triage preset + area chip (B4) */}
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <select
            aria-label="Filter by assignee"
            value={assignedFilter}
            onChange={(event) => {
              setAssignedFilter(event.target.value);
              setPage(0);
            }}
            className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            <option value="all">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {staffUsers.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by source"
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value as 'all' | CrmLeadSource);
              setPage(0);
            }}
            className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            <option value="all">All sources</option>
            {(Object.keys(SOURCE_LABELS) as CrmLeadSource[]).map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value as 'all' | 'hot');
              setPage(0);
            }}
            className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            <option value="all">Any priority</option>
            <option value="hot">Hot only</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setAssignedFilter('unassigned');
              setStatusFilter('new');
              setPage(0);
            }}
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Needs triage
          </button>
          {areaFilter ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-3 py-1.5 text-xs font-semibold text-ink">
              Area: {areaFilterName ?? areaFilter}
              <button
                type="button"
                aria-label="Clear area filter"
                onClick={() => {
                  setAreaFilter(null);
                  setAreaFilterName(null);
                  setPage(0);
                }}
                className="text-neutral-500 transition hover:text-neutral-800"
              >
                ✕
              </button>
            </span>
          ) : null}
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

      {/* Bulk actions bar (B3) — appears only when leads are selected */}
      {selectedLeadIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-2.5 text-xs text-white">
          <span className="font-semibold">{selectedLeadIds.size} selected</span>
          <select
            aria-label="Bulk assign to"
            defaultValue=""
            disabled={isBulkBusy}
            onChange={(event) => {
              const value = event.target.value;
              if (value) void runBulkUpdate({ type: 'assign', assignedTo: value });
              event.target.value = '';
            }}
            className="min-h-8 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="" disabled className="text-neutral-900">
              Assign to…
            </option>
            {staffUsers.map((staff) => (
              <option key={staff.id} value={staff.id} className="text-neutral-900">
                {staff.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Bulk set status"
            value={bulkStatusDraft}
            disabled={isBulkBusy}
            onChange={(event) => setBulkStatusDraft(event.target.value as '' | CrmLeadStatus)}
            className="min-h-8 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="" className="text-neutral-900">
              Set status…
            </option>
            {(['contacted', 'interested', 'follow_up', 'lost', 'cancelled'] as const).map((status) => (
              <option key={status} value={status} className="text-neutral-900">
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          {bulkStatusDraft === 'lost' ? (
            <select
              aria-label="Bulk lost reason"
              value={bulkLostReason}
              disabled={isBulkBusy}
              onChange={(event) => setBulkLostReason(event.target.value)}
              className="min-h-8 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {LOST_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason} className="text-neutral-900">
                  {reason}
                </option>
              ))}
            </select>
          ) : null}
          {bulkStatusDraft !== '' ? (
            <button
              type="button"
              disabled={isBulkBusy}
              onClick={() =>
                void runBulkUpdate({
                  type: 'status',
                  status: bulkStatusDraft,
                  ...(bulkStatusDraft === 'lost' ? { lostReason: bulkLostReason } : {}),
                })
              }
              className="min-h-8 rounded-lg bg-coral px-3 py-1 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
            >
              {isBulkBusy ? 'Applying…' : `Apply ${STATUS_LABELS[bulkStatusDraft]}`}
            </button>
          ) : null}
          <button
            type="button"
            disabled={isBulkBusy}
            onClick={() => setSelectedLeadIds(new Set())}
            className="ml-auto min-h-8 rounded-lg border border-white/20 px-3 py-1 font-semibold text-white/80 transition hover:text-white disabled:opacity-60"
          >
            Clear selection
          </button>
        </div>
      ) : null}

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

      {/* Retention — repeat grooming due (Phase 6); minimized by default, expandable */}
      <div id="crm-retention" className="rounded-2xl border border-neutral-200 bg-white p-4 scroll-mt-24">
        <button
          type="button"
          onClick={() => setIsRetentionExpanded((open) => !open)}
          aria-expanded={isRetentionExpanded}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              Repeat grooming due{retentionTotal > 0 ? ` (${retentionTotal})` : ''}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {isRetentionExpanded
                ? `Last completed grooming ${Math.max(retentionDays - RETENTION_LEAD_TIME_DAYS, 7)}+ days ago (${retentionDays}-day recommendation), without an open lead.`
                : 'Minimized — expand to review and act on repeat-grooming follow-ups.'}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {isRetentionExpanded ? 'Hide ▲' : 'Show ▼'}
          </span>
        </button>

        {retentionError ? (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {retentionError}{' '}
            <button type="button" onClick={() => void loadRetention()} className="underline underline-offset-2">
              Retry
            </button>
          </p>
        ) : null}

        {isRetentionExpanded ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Recommended every
              </span>
              {RETENTION_RECOMMENDED_DAY_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setRetentionDays(days);
                    setRetentionPage(0);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    retentionDays === days
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>

            {retentionCandidates.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {retentionCandidates.map((candidate) => (
                  <li key={candidate.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-neutral-800">
                        {candidate.name ?? 'Pet Owner'} · {candidate.phone ?? '—'}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Last grooming {candidate.lastGroomingDate} ({candidate.daysSinceLastGrooming}d ago) · next rec.{' '}
                        {candidate.nextRecommendedDate} · {candidate.completedBookings} completed · ₹{candidate.totalSpentInr} lifetime
                      </p>
                      {candidate.daysSinceLastGrooming > retentionDays * 1.5 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          At risk
                        </span>
                      ) : null}
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
              <p className="mt-3 text-xs text-neutral-500">
                {isRetentionLoading
                  ? 'Loading repeat-grooming candidates…'
                  : `No repeat-grooming follow-ups are due for the ${retentionDays}-day cadence right now.`}
              </p>
            )}

            {retentionTotal > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                <p className="text-[11px] text-neutral-500">
                  {retentionCandidates.length > 0
                    ? `Showing ${retentionPage * RETENTION_PAGE_SIZE + 1}–${retentionPage * RETENTION_PAGE_SIZE + retentionCandidates.length} of ${retentionTotal}`
                    : 'Loading…'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRetentionPage((current) => Math.max(0, current - 1))}
                    disabled={retentionPage === 0 || isRetentionLoading}
                    className="min-h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setRetentionPage((current) => current + 1)}
                    disabled={isRetentionLoading || (retentionPage + 1) * RETENTION_PAGE_SIZE >= retentionTotal}
                    className="min-h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Campaign performance (Phase 7) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-semibold text-neutral-900">Campaign performance</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(['30', '90', 'all'] as const).map((window) => (
            <button
              key={window}
              type="button"
              onClick={() => setCampaignWindow(window)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                campaignWindow === window
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
              }`}
            >
              {window === 'all' ? 'All time' : `Last ${window} days`}
            </button>
          ))}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          Leads → conversion → revenue per campaign (converted leads linked to booking value).
        </p>
        {campaignsError ? (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {campaignsError}{' '}
            <button type="button" onClick={() => void loadCampaigns()} className="underline underline-offset-2">
              Retry
            </button>
          </p>
        ) : null}
        {campaignRows.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-neutral-400">
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

      {/* Automation health — cron import + sweep observability */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-semibold text-neutral-900">Automation health</p>
            {automationStatus ? (
              <Badge variant={AUTOMATION_SEVERITY_BADGE_VARIANTS[automationStatus.overall.severity]} size="sm">
                {AUTOMATION_STATUS_LABELS[automationStatus.overall.status]}
              </Badge>
            ) : (
              <span className="text-xs text-neutral-400">loading…</span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {automationStatus
              ? `Crons expected every ${automationStatus.expectedCadenceMinutes} min · auto-refreshes every minute`
              : 'Cron import + sweep monitoring'}
          </p>
        </div>

        {automationError ? (
          <p className="mt-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {automationError}{' '}
            <button
              type="button"
              onClick={() => void fetchAutomationStatus()}
              className="underline underline-offset-2"
            >
              Retry
            </button>
          </p>
        ) : null}

        {automationStatus ? (
          <>
            <p
              className={`mt-1.5 text-xs ${
                automationStatus.overall.severity === 'ok' ? 'text-neutral-500' : 'font-medium text-red-600'
              }`}
            >
              {automationStatus.overall.detail}
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {automationStatus.jobs.map((job) => {
                const lastSummary = summarizeAutomationHeartbeat(job.recentHeartbeats[0]?.summary);
                return (
                  <div key={job.job} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-neutral-800">{AUTOMATION_JOB_LABELS[job.job]}</p>
                      <Badge variant={AUTOMATION_SEVERITY_BADGE_VARIANTS[job.severity]} size="sm">
                        {AUTOMATION_STATUS_LABELS[job.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Last report {formatAutomationMinutesAgo(job.minutesSinceLastHeartbeat)}
                      {job.lastHeartbeatAt ? ` · ${formatLeadTimestamp(job.lastHeartbeatAt)}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-600">{job.detail}</p>
                    {job.lastHeartbeatOk && lastSummary ? (
                      <p className="mt-0.5 text-[11px] text-neutral-500">{lastSummary}</p>
                    ) : null}
                    {job.severity !== 'ok' && job.recentHeartbeats.some((heartbeat) => !heartbeat.ok) ? (
                      <ul className="mt-1.5 space-y-1">
                        {job.recentHeartbeats
                          .filter((heartbeat) => !heartbeat.ok)
                          .slice(0, 3)
                          .map((heartbeat) => (
                            <li key={heartbeat.id} className="text-[11px] text-red-600">
                              {formatLeadTimestamp(heartbeat.created_at)} —{' '}
                              {heartbeat.error_message ?? `HTTP ${heartbeat.http_status ?? '??'}`}
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {automationStatus.config.map((check) => (
                <span
                  key={check.key}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {check.label}
                  {check.hint ? ` · ${check.hint}` : ''}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">Loading automation status…</p>
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
            {importHistoryError ? (
              <p className="mt-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{importHistoryError}</p>
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
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all leads on this page"
                  checked={leads.length > 0 && leads.every((lead) => selectedLeadIds.has(lead.id))}
                  onChange={(event) => {
                    setSelectedLeadIds((current) => {
                      const next = new Set(current);
                      for (const lead of leads) {
                        if (event.target.checked) next.add(lead.id);
                        else next.delete(lead.id);
                      }
                      return next;
                    });
                  }}
                />
              </th>
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
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">
                  Loading leads…
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">
                  No leads found. Capture enquiries with the New lead button.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.customer.name ?? 'lead'} for bulk actions`}
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={(event) => {
                        setSelectedLeadIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(lead.id);
                          else next.delete(lead.id);
                          return next;
                        });
                      }}
                    />
                  </td>
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
                      <p className="text-xs text-neutral-500">
                      {lead.customer.phone ? (
                        <a href={`tel:${lead.customer.phone}`} className="transition hover:text-coral">
                          {lead.customer.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </p>
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
        {totalLeads > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
            <p className="text-xs text-neutral-500">
              {leads.length > 0
                ? `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + leads.length} of ${totalLeads} leads`
                : 'Loading leads…'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0 || isLoading}
                className="min-h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={isLoading || (page + 1) * PAGE_SIZE >= totalLeads}
                className="min-h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                    {leadDetail.lead.customer.phone ? (
                      <>
                        <a
                          href={`tel:${leadDetail.lead.customer.phone}`}
                          className="font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-2 transition hover:text-coral"
                        >
                          {leadDetail.lead.customer.phone}
                        </a>
                        <a
                          href={buildWhatsAppHref(leadDetail.lead.customer.phone) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : (
                      '—'
                    )}
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

            {/* Status actions (only while the lead is open) */}
            {(leadDetail.lead.status === 'new' ||
              leadDetail.lead.status === 'contacted' ||
              leadDetail.lead.status === 'interested' ||
              leadDetail.lead.status === 'follow_up') ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(event) => {
                    const next = event.target.value as CrmLeadStatus;
                    if (!next || !selectedLeadId || !leadDetail) return;
                    if (next === 'converted') {
                      // Conversion requires a same-customer booking (service contract),
                      // so collect the booking link instead of patching the status directly.
                      void openConvertForm(leadDetail.lead.user_id);
                      return;
                    }
                    void patchLead(selectedLeadId, { status: next }, `Lead moved to ${STATUS_LABELS[next]}.`);
                  }}
                  className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                >
                  <option value="">Move status…</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="converted">Converted</option>
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
                    className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
              </div>
            ) : null}

            {/* Customer 360 (read-only; available for every lead with a linked customer,
                including converted/lost/cancelled — not gated to open leads) */}
            {leadDetail.lead.user_id ? (
              <div className="flex flex-wrap items-center gap-2">
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
                    className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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

            {/* Inline convert form (open leads only) — conversion requires a same-customer booking */}
            {convertForm.open &&
            (leadDetail.lead.status === 'new' ||
              leadDetail.lead.status === 'contacted' ||
              leadDetail.lead.status === 'interested' ||
              leadDetail.lead.status === 'follow_up') ? (
              <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-sm font-semibold text-neutral-900">Which booking converted this lead?</p>
                {convertForm.isLoadingBookings ? (
                  <p className="text-xs text-neutral-500">Loading bookings…</p>
                ) : convertForm.bookings.length === 0 ? (
                  <p className="text-xs text-neutral-600">
                    No bookings found for this customer. A lead can only be marked converted by linking a booking that
                    belongs to the same customer — create the booking first, then convert.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        aria-label="Converted booking"
                        value={convertForm.bookingId}
                        onChange={(event) =>
                          setConvertForm((draft) => ({ ...draft, bookingId: event.target.value }))
                        }
                        className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                      >
                        <option value="">Select booking…</option>
                        {convertForm.bookings.map((booking) => (
                          <option key={booking.id} value={String(booking.id)}>
                            #{booking.id} · {booking.bookingDate ?? '—'} · {booking.serviceType ?? 'Service'} ·{' '}
                            {booking.status} · {booking.finalPrice != null ? `₹${booking.finalPrice}` : '—'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setConvertForm({ open: false, bookings: [], bookingId: '', isLoadingBookings: false })
                        }
                        className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isLeadBusy || !convertForm.bookingId}
                        onClick={() => {
                          if (!selectedLeadId || !convertForm.bookingId) return;
                          void patchLead(
                            selectedLeadId,
                            { status: 'converted', convertedBookingId: Number(convertForm.bookingId) },
                            'Lead marked converted.',
                          );
                          setConvertForm({ open: false, bookings: [], bookingId: '', isLoadingBookings: false });
                        }}
                        className="min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Confirm converted
                      </button>
                    </div>
                  </>
                )}
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
                {/* Quick presets (C4) — one click beats datetime-local archaeology. */}
                <div className="flex flex-wrap gap-1.5">
                  {buildFollowupPresets().map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFollowupDraft(preset.value)}
                      className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  aria-label="Next follow-up (optional)"
                  value={followupDraft}
                  onChange={(event) => setFollowupDraft(event.target.value)}
                  className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                    {customer360Data.user.phone ? (
                      <>
                        <a
                          href={`tel:${customer360Data.user.phone}`}
                          className="font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-2 transition hover:text-coral"
                        >
                          {customer360Data.user.phone}
                        </a>
                        <a
                          href={buildWhatsAppHref(customer360Data.user.phone) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : (
                      '—'
                    )}
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

