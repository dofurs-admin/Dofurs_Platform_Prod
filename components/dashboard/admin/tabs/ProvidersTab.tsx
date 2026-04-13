'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import AdminProvidersView from '@/components/dashboard/admin/views/AdminProvidersView';
import { useToast } from '@/components/ui/ToastProvider';
import { useAdminProviderApprovalRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';
import type { AdminProviderModerationItem } from '@/lib/provider-management/types';
import type {
  ServiceProviderApplication,
  ServiceProviderApplicationStatus,
} from '@/lib/provider-applications/types';
import type { AdminServiceModerationSummaryItem } from '@/lib/provider-management/types';
import type { Service } from '@/lib/service-catalog/types';

// ── Local types ───────────────────────────────────────────────────────────────

type Provider = {
  id: number;
  name: string;
};

type AdminProviderCalendarResponse = {
  provider: { id: number; name: string };
  fromDate: string;
  toDate: string;
  days: Array<{
    date: string;
    day_of_week: number;
    availability: Array<{ id: string; start_time: string; end_time: string; is_available: boolean }>;
    bookings: Array<{
      id: number;
      start_time: string | null;
      end_time: string | null;
      status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
      booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
      service_type: string | null;
      completion_task_status: 'pending' | 'completed' | null;
    }>;
  }>;
};

type AvailabilityServiceSummary = {
  serviceType: string;
  minBasePrice: number;
  maxBasePrice: number;
  providerCount: number;
};

type AvailabilityProvider = {
  providerId: number;
  providerName: string;
  providerType: string | null;
  providerServiceId: string;
  serviceType: string;
  serviceMode: string | null;
  basePrice: number;
  serviceDurationMinutes: number;
  availableSlotCount: number;
  availableForSelectedSlot: boolean;
  recommended: boolean;
  availableSlotStartTimes?: string[];
};

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  availableProviderCount: number;
  recommended: boolean;
};

type AdminFlowAvailabilityResponse = {
  services: AvailabilityServiceSummary[];
  providers: AvailabilityProvider[];
  slotOptions: AvailabilitySlot[];
  recommendedSlotStartTime: string | null;
  recommendedProviderServiceId: string | null;
};

type AdminProviderAvailability = {
  id: string;
  provider_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
};

type AdminProviderService = {
  id: string;
  provider_id: number;
  service_type: string;
  base_price: number;
  surge_price: number | null;
  commission_percentage: number | null;
  service_duration_minutes: number | null;
  is_active: boolean;
};

type ServiceRolloutDraft = {
  id?: string;
  service_pincodes: string;
};

type LocationDraft = {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  service_radius_km: string;
};

type ProviderProfileDraft = {
  name: string;
  email: string;
  provider_type: string;
  business_name: string;
  profile_photo_url: string;
  service_radius_km: string;
  license_number: string;
  specialization: string;
  teleconsult_enabled: boolean;
  emergency_service_enabled: boolean;
  equipment_details: string;
  insurance_document_url: string;
  registration_number: string;
  gst_number: string;
  number_of_doctors: string;
  hospitalization_available: boolean;
  emergency_services_available: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTimeInWindow(time: string, start: string, end: string) {
  return time >= start && time < end;
}

function getDefaultAvailabilityDraft() {
  return { selected_days: [1], start_time: '09:00', end_time: '17:00' };
}

function buildLocationChangeSummary(before: LocationDraft, after: LocationDraft): string {
  const fields = ['address', 'city', 'state', 'pincode', 'latitude', 'longitude', 'service_radius_km'] as const;
  const changed = fields.filter((f) => before[f] !== after[f]);
  let summary = changed
    .slice(0, 3)
    .map((f) => `${f}: "${before[f] || '—'}" → "${after[f] || '—'}"`)
    .join(' | ');
  if (changed.length > 3) summary += ` | +${changed.length - 3} more`;
  return summary;
}

function applyLocationWarningToDraft(draft: LocationDraft, warning: string, coveragePincodes: string[]): LocationDraft {
  const normalized = warning.toLowerCase();
  const next = { ...draft };
  const firstPin = coveragePincodes[0] ?? '';
  if (normalized.includes('pincode and service radius are both missing') || normalized.includes('pincode and service radius are missing')) {
    if (!next.pincode.trim() && firstPin) next.pincode = firstPin;
    if (!next.service_radius_km.trim()) next.service_radius_km = '3';
  }
  if (normalized.includes('radius is 0 km')) next.service_radius_km = '3';
  if (normalized.includes('very small for the current pincode rollout footprint')) {
    const cur = next.service_radius_km.trim() ? Number(next.service_radius_km) : 0;
    next.service_radius_km = String(Number.isFinite(cur) ? Math.max(cur, 5) : 5);
  }
  if (normalized.includes('without a service radius baseline') && !next.service_radius_km.trim()) {
    next.service_radius_km = '5';
  }
  return next;
}

// ── Component ─────────────────────────────────────────────────────────────────

type ProvidersTabProps = {
  providers: Provider[];
  moderationProviders: AdminProviderModerationItem[];
  initialProviderApplications: ServiceProviderApplication[];
  initialCatalogServices: Service[];
  initialServiceSummary: AdminServiceModerationSummaryItem[];
  openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
};

export default function ProvidersTab({
  providers,
  moderationProviders,
  initialProviderApplications,
  initialCatalogServices,
  openConfirm,
}: ProvidersTabProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const providerFallbackRows: AdminProviderModerationItem[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    email: null,
    profile_photo_url: null,
    provider_type: 'clinic',
    business_name: p.name,
    admin_approval_status: 'pending',
    verification_status: 'pending',
    account_status: 'active',
    average_rating: 0,
    total_bookings: 0,
    address: null,
    city: null,
    state: null,
    pincode: null,
    latitude: null,
    longitude: null,
    service_radius_km: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    documentCounts: { pending: 0, approved: 0, rejected: 0 },
    professional_details: null,
    clinic_details: null,
  }));

  const [providerRows, setProviderRows] = useState<AdminProviderModerationItem[]>(
    moderationProviders.length > 0 ? moderationProviders : providerFallbackRows,
  );
  const [deletingProviderId, setDeletingProviderId] = useState<number | null>(null);
  const [expandedProviderIds, setExpandedProviderIds] = useState<number[]>([]);
  const [providerDetailsLoadingById, setProviderDetailsLoadingById] = useState<Record<number, boolean>>({});
  const [providerDetailsLoadedById, setProviderDetailsLoadedById] = useState<Record<number, boolean>>({});
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<number, AdminProviderAvailability[]>>({});
  const [servicesByProvider, setServicesByProvider] = useState<Record<number, AdminProviderService[]>>({});
  const [pincodesByService, setPincodesByService] = useState<Record<string, string[]>>({});
  const [providerApplications, setProviderApplications] = useState<ServiceProviderApplication[]>(initialProviderApplications);
  const [providerApplicationStatusFilter, setProviderApplicationStatusFilter] = useState<'all' | ServiceProviderApplicationStatus>('pending');
  const [providerApplicationNotesDraft, setProviderApplicationNotesDraft] = useState<Record<string, string>>({});
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [providerTypeFilter, setProviderTypeFilter] = useState<'all' | 'clinic' | 'home_visit'>('all');
  const [providerStatusFilter, setProviderStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('all');
  const [availabilityDraft, setAvailabilityDraft] = useState<Record<number, { selected_days: number[]; start_time: string; end_time: string }>>({});
  const [serviceDraft, setServiceDraft] = useState<Record<number, ServiceRolloutDraft>>({});
  const [selectedServiceTypesByProvider, setSelectedServiceTypesByProvider] = useState<Record<number, string[]>>({});
  const [locationDraft, setLocationDraft] = useState<Record<number, LocationDraft>>({});
  const [providerProfileDraft, setProviderProfileDraft] = useState<Record<number, ProviderProfileDraft>>({});
  const [locationCoverageWarnings, setLocationCoverageWarnings] = useState<Record<number, string[]>>({});
  const [locationLastAutoFixNote, setLocationLastAutoFixNote] = useState<Record<number, string>>({});
  const [calendarProviderId, setCalendarProviderId] = useState<number | ''>('');
  const [calendarFromDate, setCalendarFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [calendarDays, setCalendarDays] = useState<7 | 14>(7);
  const [providerCalendar, setProviderCalendar] = useState<AdminProviderCalendarResponse | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [availabilityFinderProviderType, setAvailabilityFinderProviderType] = useState<'all' | 'clinic' | 'home_visit'>('all');
  const [availabilityFinderServiceType, setAvailabilityFinderServiceType] = useState('');
  const [availabilityFinderPincode, setAvailabilityFinderPincode] = useState('');
  const [availabilityFinderDate, setAvailabilityFinderDate] = useState(new Date().toISOString().slice(0, 10));
  const [availabilityFinderStartTime, setAvailabilityFinderStartTime] = useState('');
  const [availabilityFinderEndTime, setAvailabilityFinderEndTime] = useState('');
  const [availabilityFinderExactTimeOnly, setAvailabilityFinderExactTimeOnly] = useState(false);
  const [availabilityFinderAutoOpenTopMatch, setAvailabilityFinderAutoOpenTopMatch] = useState(true);
  const [availabilityFinderLoading, setAvailabilityFinderLoading] = useState(false);
  const [availabilityFinderHasRun, setAvailabilityFinderHasRun] = useState(false);
  const [availabilityFinderResults, setAvailabilityFinderResults] = useState<AvailabilityProvider[]>([]);
  const [availabilityFinderSlots, setAvailabilityFinderSlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityFinderServices, setAvailabilityFinderServices] = useState<AvailabilityServiceSummary[]>([]);

  const providerCardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { performUpdate: performProviderUpdate } = useOptimisticUpdate(providerRows, setProviderRows);

  const refreshProviders = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/providers');
      if (response.ok) {
        const data = await response.json();
        setProviderRows(data.providers ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh providers:', error);
    }
  }, []);

  const refreshProviderApplications = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/provider-applications', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json() as { applications?: ServiceProviderApplication[] };
        setProviderApplications(data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh provider applications:', error);
    }
  }, []);

  useAdminProviderApprovalRealtime(refreshProviders);

  const availableServiceTypes = useMemo(() => {
    const types = initialCatalogServices.map((s) => s.service_type).filter((v): v is string => Boolean(v?.trim()));
    return Array.from(new Set(types)).sort();
  }, [initialCatalogServices]);

  const filteredProviders = useMemo(() => {
    return providerRows.filter((p) => {
      if (providerSearchQuery.trim()) {
        const q = providerSearchQuery.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.email?.toLowerCase() || '').includes(q) ||
          (p.business_name?.toLowerCase() || '').includes(q) ||
          p.id.toString().includes(q) ||
          (p.city?.toLowerCase() || '').includes(q);
        if (!matches) return false;
      }
      if (providerTypeFilter !== 'all') {
        if (providerTypeFilter === 'clinic' && p.provider_type !== 'clinic') return false;
        if (providerTypeFilter === 'home_visit' && p.provider_type === 'clinic') return false;
      }
      if (providerStatusFilter !== 'all') {
        if (providerStatusFilter === 'pending' && p.admin_approval_status !== 'pending') return false;
        if (providerStatusFilter === 'approved' && p.admin_approval_status !== 'approved') return false;
        if (providerStatusFilter === 'rejected' && p.admin_approval_status !== 'rejected') return false;
        if (providerStatusFilter === 'suspended' && p.account_status !== 'suspended') return false;
      }
      return true;
    });
  }, [providerRows, providerSearchQuery, providerTypeFilter, providerStatusFilter]);

  const filteredProviderApplications = useMemo(() => {
    if (providerApplicationStatusFilter === 'all') return providerApplications;
    return providerApplications.filter((app) => app.status === providerApplicationStatusFilter);
  }, [providerApplicationStatusFilter, providerApplications]);

  const calendarSelectableProviders = filteredProviders.length > 0 ? filteredProviders : providerRows;
  const selectedCalendarProviderName = calendarProviderId
    ? calendarSelectableProviders.find((p) => p.id === calendarProviderId)?.name ?? `Provider #${calendarProviderId}`
    : null;
  const isCalendarStale = Boolean(calendarProviderId && providerCalendar && providerCalendar.provider.id !== calendarProviderId);
  const calendarSkeletonCardCount = calendarDays === 14 ? 8 : 4;

  // Auto-select single match from search
  useEffect(() => {
    if (!calendarProviderId) {
      if (providerSearchQuery.trim() && calendarSelectableProviders.length === 1) {
        setCalendarProviderId(calendarSelectableProviders[0].id);
        return;
      }
      if (!providerSearchQuery.trim()) setProviderCalendar(null);
      return;
    }
    const stillVisible = calendarSelectableProviders.some((p) => p.id === calendarProviderId);
    if (!stillVisible) {
      setCalendarProviderId('');
      setProviderCalendar(null);
    }
  }, [calendarProviderId, calendarSelectableProviders, providerSearchQuery]);

  const fetchProviderCalendar = useCallback(async () => {
    if (!calendarProviderId) { setProviderCalendar(null); return; }
    setIsCalendarLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('providerId', String(calendarProviderId));
      params.set('fromDate', calendarFromDate);
      params.set('days', String(calendarDays));
      const request = await fetch(`/api/admin/providers/calendar?${params.toString()}`);
      const payload = await request.json().catch(() => null) as AdminProviderCalendarResponse | { error?: string } | null;
      if (!request.ok) throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to load calendar.');
      setProviderCalendar(payload as AdminProviderCalendarResponse);
    } catch (error) {
      setProviderCalendar(null);
      showToast(error instanceof Error ? error.message : 'Unable to load calendar.', 'error');
    } finally {
      setIsCalendarLoading(false);
    }
  }, [calendarProviderId, calendarFromDate, calendarDays, showToast]);

  useEffect(() => {
    if (!calendarProviderId) return;
    void fetchProviderCalendar();
  }, [calendarProviderId, calendarFromDate, calendarDays, fetchProviderCalendar]);

  async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null) as { error?: string; details?: { fieldErrors?: Record<string, string[]> } } | null;
    if (!response.ok) {
      const fieldErrors = payload?.details?.fieldErrors;
      const firstFieldError = fieldErrors && Object.keys(fieldErrors).length > 0
        ? `${Object.keys(fieldErrors)[0]}: ${Object.values(fieldErrors)[0]?.[0]}`
        : null;
      throw new Error(firstFieldError ?? payload?.error ?? 'Request failed');
    }
    return payload as T;
  }

  async function loadProviderOperationalData(providerId: number) {
    if (providerDetailsLoadingById[providerId] || providerDetailsLoadedById[providerId]) return;
    setProviderDetailsLoadingById((c) => ({ ...c, [providerId]: true }));
    try {
      const [availRes, svcRes] = await Promise.all([
        adminRequest<{ availability: AdminProviderAvailability[] }>(`/api/admin/providers/${providerId}/availability`),
        adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(`/api/admin/providers/${providerId}/services`),
      ]);

      const rawRows = availRes.availability;
      const deduped = Array.from(
        new Map(rawRows.map((r) => [`${r.day_of_week}|${r.start_time.slice(0, 5)}|${r.end_time.slice(0, 5)}`, r])).values(),
      );
      setAvailabilityByProvider((c) => ({ ...c, [providerId]: deduped }));
      if (deduped.length < rawRows.length) saveAvailability(providerId, deduped);

      setServicesByProvider((c) => ({ ...c, [providerId]: svcRes.services }));
      setPincodesByService((c) => {
        const next = { ...c };
        for (const svc of svcRes.services) next[svc.id] = svc.service_pincodes ?? [];
        return next;
      });
      setProviderDetailsLoadedById((c) => ({ ...c, [providerId]: true }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load provider details.', 'error');
    } finally {
      setProviderDetailsLoadingById((c) => ({ ...c, [providerId]: false }));
    }
  }

  function toggleProviderCard(providerId: number) {
    const isExpanded = expandedProviderIds.includes(providerId);
    if (isExpanded) {
      setExpandedProviderIds((c) => c.filter((id) => id !== providerId));
      return;
    }
    setExpandedProviderIds((c) => [...c, providerId]);
    void loadProviderOperationalData(providerId);
  }

  function focusProviderCard(providerId: number) {
    const isExpanded = expandedProviderIds.includes(providerId);
    if (!isExpanded) {
      setExpandedProviderIds((c) => [...c, providerId]);
      void loadProviderOperationalData(providerId);
    }
    window.setTimeout(() => {
      const target = providerCardRefs.current[providerId];
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, isExpanded ? 20 : 140);
  }

  function approveProvider(providerId: number) {
    performProviderUpdate(
      (c) => c.map((r) => r.id !== providerId ? r : { ...r, admin_approval_status: 'approved', account_status: 'active' }),
      async () => {
        const r = await fetch(`/api/admin/providers/${providerId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!r.ok) throw new Error('Unable to approve provider');
      },
      () => showToast('Provider approved.', 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function rejectProvider(providerId: number) {
    openConfirm({
      title: 'Reject Provider',
      description: 'Mark the provider application as rejected. The provider will be notified.',
      confirmLabel: 'Reject Provider',
      confirmVariant: 'danger',
      onConfirm: () => doRejectProvider(providerId),
    });
  }

  function doRejectProvider(providerId: number) {
    performProviderUpdate(
      (c) => c.map((r) => r.id !== providerId ? r : { ...r, admin_approval_status: 'rejected' }),
      async () => {
        const r = await fetch(`/api/admin/providers/${providerId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!r.ok) throw new Error('Unable to reject provider');
      },
      () => showToast('Provider rejected.', 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function moderateProvider(providerId: number, action: 'enable' | 'disable') {
    if (action === 'disable') {
      openConfirm({
        title: 'Suspend Provider',
        description: "Suspend the provider's account. They will not receive new bookings.",
        confirmLabel: 'Suspend Provider',
        confirmVariant: 'danger',
        onConfirm: () => doModerateProvider(providerId, action),
      });
      return;
    }
    doModerateProvider(providerId, action);
  }

  function doModerateProvider(providerId: number, action: 'enable' | 'disable') {
    performProviderUpdate(
      (c) => c.map((r) => {
        if (r.id !== providerId) return r;
        return { ...r, account_status: action === 'enable' ? 'active' : 'suspended' };
      }),
      async () => {
        const routeAction = action === 'disable' ? 'suspend' : 'enable';
        const r = await fetch(`/api/admin/providers/${providerId}/${routeAction}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!r.ok) throw new Error(`Unable to ${action} provider`);
      },
      () => showToast(`Provider ${action}d successfully.`, 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function removeProvider(providerId: number) {
    if (deletingProviderId === providerId) return;
    openConfirm({
      title: 'Delete Provider Permanently',
      description: 'Permanently delete the provider and all associated data. This cannot be undone.',
      confirmLabel: 'Delete Provider',
      confirmVariant: 'danger',
      requiredInputValue: 'DELETE',
      inputPlaceholder: 'DELETE',
      onConfirm: () => doRemoveProvider(providerId),
    });
  }

  function doRemoveProvider(providerId: number) {
    const previousRows = providerRows;
    setDeletingProviderId(providerId);
    setProviderRows((c) => c.filter((r) => r.id !== providerId));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/providers/${providerId}/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          let message = 'Unable to delete provider';
          try {
            const payload = await response.json();
            if (payload?.error?.trim()) message = payload.error;
          } catch (error) {
            console.error('Failed to parse provider delete error response', error);
          }
          throw new Error(message);
        }
        showToast('Provider deleted successfully.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete provider.';
        const normalized = message.toLowerCase();
        if (normalized.includes('already deleted') || normalized.includes('provider not found')) {
          showToast('Provider was already deleted. Refreshing list.', 'success');
          void refreshProviders();
        } else {
          setProviderRows(previousRows);
          showToast(message, 'error');
        }
      } finally {
        setDeletingProviderId(null);
      }
    });
  }

  function toggleProviderServices(providerId: number, enable: boolean) {
    const previousServices = servicesByProvider[providerId] || [];
    setServicesByProvider((c) => ({
      ...c,
      [providerId]: previousServices.map((s) => ({ ...s, is_active: enable })),
    }));
    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/providers/${providerId}/services/toggle`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: enable }),
        });
        showToast(`Provider services ${enable ? 'enable' : 'disable'}d successfully.`, 'success');
      } catch (error) {
        setServicesByProvider((c) => ({ ...c, [providerId]: previousServices }));
        showToast(error instanceof Error ? error.message : 'Unable to update services.', 'error');
      }
    });
  }

  function setProviderApplicationNote(applicationId: string, value: string) {
    setProviderApplicationNotesDraft((c) => ({ ...c, [applicationId]: value }));
  }

  function updateProviderApplicationStatus(applicationId: string, status: ServiceProviderApplicationStatus) {
    const note = providerApplicationNotesDraft[applicationId] ?? '';
    startTransition(async () => {
      try {
        const response = await adminRequest<{ application: ServiceProviderApplication }>(
          `/api/admin/provider-applications/${applicationId}`,
          { method: 'PATCH', body: JSON.stringify({ status, admin_notes: note }) },
        );
        setProviderApplications((c) => c.map((item) => item.id === applicationId ? response.application : item));
        showToast(`Application marked as ${status.replace('_', ' ')}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update application status.', 'error');
      }
    });
  }

  const searchAvailableProviders = useCallback(async () => {
    const pincode = availabilityFinderPincode.trim();
    if (!/^[1-9]\d{5}$/.test(pincode)) { showToast('Enter a valid 6-digit pincode.', 'error'); return; }
    if (!availabilityFinderDate) { showToast('Select a booking date.', 'error'); return; }
    if (availabilityFinderStartTime && availabilityFinderEndTime && availabilityFinderEndTime <= availabilityFinderStartTime) {
      showToast('End time must be after start time.', 'error'); return;
    }

    setAvailabilityFinderLoading(true);
    setAvailabilityFinderHasRun(true);

    try {
      const params = new URLSearchParams();
      params.set('pincode', pincode);
      params.set('bookingDate', availabilityFinderDate);
      if (availabilityFinderServiceType.trim()) params.set('serviceType', availabilityFinderServiceType.trim());
      if (availabilityFinderStartTime) params.set('startTime', availabilityFinderStartTime);

      const request = await fetch(`/api/bookings/admin-flow-availability?${params.toString()}`, { cache: 'no-store' });
      const payload = await request.json().catch(() => null) as AdminFlowAvailabilityResponse | { error?: string } | null;
      if (!request.ok) throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to search providers.');

      const response = payload as AdminFlowAvailabilityResponse;
      let filteredProviders = response.providers;

      if (availabilityFinderProviderType === 'clinic') filteredProviders = filteredProviders.filter((p) => p.providerType === 'clinic');
      if (availabilityFinderProviderType === 'home_visit') filteredProviders = filteredProviders.filter((p) => p.providerType !== 'clinic');

      if (availabilityFinderExactTimeOnly && availabilityFinderStartTime) {
        filteredProviders = filteredProviders.filter((p) => p.availableForSelectedSlot);
      } else if (availabilityFinderStartTime && availabilityFinderEndTime) {
        filteredProviders = filteredProviders.filter((p) =>
          (p.availableSlotStartTimes ?? []).some((t) => isTimeInWindow(t, availabilityFinderStartTime, availabilityFinderEndTime)),
        );
      } else if (availabilityFinderStartTime) {
        filteredProviders = filteredProviders.filter((p) => p.availableForSelectedSlot);
      } else {
        filteredProviders = filteredProviders.filter((p) => p.availableSlotCount > 0);
      }

      filteredProviders = [...filteredProviders].sort((a, b) => {
        if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
        if (a.availableSlotCount !== b.availableSlotCount) return b.availableSlotCount - a.availableSlotCount;
        if (a.basePrice !== b.basePrice) return a.basePrice - b.basePrice;
        return a.providerName.localeCompare(b.providerName);
      });

      const slots = availabilityFinderStartTime && availabilityFinderEndTime
        ? response.slotOptions.filter((s) => isTimeInWindow(s.startTime, availabilityFinderStartTime, availabilityFinderEndTime))
        : response.slotOptions;

      setAvailabilityFinderServices(response.services ?? []);
      setAvailabilityFinderSlots(slots);
      setAvailabilityFinderResults(filteredProviders);

      if (availabilityFinderAutoOpenTopMatch && filteredProviders.length > 0) {
        setCalendarProviderId(filteredProviders[0].providerId);
        setCalendarFromDate(availabilityFinderDate);
      }
    } catch (error) {
      setAvailabilityFinderServices([]);
      setAvailabilityFinderSlots([]);
      setAvailabilityFinderResults([]);
      showToast(error instanceof Error ? error.message : 'Unable to search providers.', 'error');
    } finally {
      setAvailabilityFinderLoading(false);
    }
  }, [
    availabilityFinderDate, availabilityFinderEndTime, availabilityFinderExactTimeOnly,
    availabilityFinderAutoOpenTopMatch, availabilityFinderPincode, availabilityFinderProviderType,
    availabilityFinderServiceType, availabilityFinderStartTime, showToast,
  ]);

  // Availability management
  function saveAvailability(providerId: number, nextRows: AdminProviderAvailability[]) {
    const deduped = Array.from(
      new Map(nextRows.map((r) => [`${r.day_of_week}|${r.start_time.slice(0, 5)}|${r.end_time.slice(0, 5)}`, r])).values(),
    );
    setAvailabilityByProvider((c) => ({ ...c, [providerId]: deduped }));
    startTransition(async () => {
      try {
        const response = await adminRequest<{ availability: AdminProviderAvailability[] }>(
          `/api/admin/providers/${providerId}/availability`,
          { method: 'PUT', body: JSON.stringify(deduped.map((r) => ({ id: r.id, day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time, is_available: r.is_available }))) },
        );
        setAvailabilityByProvider((c) => ({ ...c, [providerId]: response.availability }));
        showToast('Availability updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update availability.', 'error');
      }
    });
  }

  function appendAvailabilitySlot(providerId: number) {
    const draft = availabilityDraft[providerId] ?? getDefaultAvailabilityDraft();
    const selectedDays = draft.selected_days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (selectedDays.length === 0) { showToast('Please select a valid weekday.', 'error'); return; }
    if (!draft.start_time || !draft.end_time || draft.start_time >= draft.end_time) {
      showToast('Provide a valid availability window.', 'error'); return;
    }
    const current = availabilityByProvider[providerId] ?? [];
    const nextSlots: AdminProviderAvailability[] = selectedDays.map((day) => ({
      id: crypto.randomUUID(),
      provider_id: providerId,
      day_of_week: day,
      start_time: draft.start_time,
      end_time: draft.end_time,
      is_available: true,
    }));
    const daysBeingAdded = new Set(selectedDays);
    const retained = current.filter((r) => !daysBeingAdded.has(r.day_of_week));
    saveAvailability(providerId, [...retained, ...nextSlots]);
  }

  function toggleAvailabilitySlot(providerId: number, slotId: string, isAvailable: boolean) {
    const current = availabilityByProvider[providerId] ?? [];
    saveAvailability(providerId, current.map((r) => r.id === slotId ? { ...r, is_available: isAvailable } : r));
  }

  function setAvailabilityDraftField(providerId: number, field: 'start_time' | 'end_time', value: string) {
    setAvailabilityDraft((c) => ({
      ...c,
      [providerId]: {
        selected_days: c[providerId]?.selected_days ?? [1],
        start_time: c[providerId]?.start_time ?? '09:00',
        end_time: c[providerId]?.end_time ?? '17:00',
        [field]: value,
      },
    }));
  }

  function toggleAvailabilityDraftWeekday(providerId: number, dayOfWeek: number, checked: boolean) {
    setAvailabilityDraft((c) => {
      const draft = c[providerId] ?? getDefaultAvailabilityDraft();
      const selectedDays = checked
        ? Array.from(new Set([...draft.selected_days, dayOfWeek])).sort((a, b) => a - b)
        : draft.selected_days.filter((d) => d !== dayOfWeek);
      return { ...c, [providerId]: { ...draft, selected_days: selectedDays } };
    });
  }

  // Service rollout management
  function setServiceDraftField(providerId: number, field: keyof ServiceRolloutDraft, value: string | boolean) {
    setServiceDraft((c) => ({
      ...c,
      [providerId]: {
        id: c[providerId]?.id,
        service_pincodes: c[providerId]?.service_pincodes ?? '',
        [field]: value,
      },
    }));
  }

  function copyServiceIntoDraft(providerId: number, serviceId: string) {
    const service = (servicesByProvider[providerId] ?? []).find((s) => s.id === serviceId);
    if (!service) return;
    setServiceDraft((c) => ({
      ...c,
      [providerId]: { id: service.id, service_pincodes: (pincodesByService[service.id] ?? []).join(', ') },
    }));

    setSelectedServiceTypesByProvider((c) => ({
      ...c,
      [providerId]: [service.service_type],
    }));
  }

  function toggleProviderServiceSelection(
    providerId: number,
    serviceType: string,
    isChecked: boolean,
    providerServiceTypeOptions: string[],
    providerServicesRows: AdminProviderService[],
  ) {
    setSelectedServiceTypesByProvider((c) => {
      const fallback = providerServicesRows.map((s) => s.service_type);
      const current = c[providerId] ?? fallback;
      const normalized = new Set(current.map((v) => v.trim()).filter((v) => v.length > 0));
      const svcType = serviceType.trim();
      if (!svcType) return c;
      if (isChecked) normalized.add(svcType);
      else normalized.delete(svcType);
      const next = providerServiceTypeOptions.filter((v) => normalized.has(v.trim()));
      return { ...c, [providerId]: next };
    });
  }

  function setAllProviderServiceSelections(providerId: number, options: string[], isSelected: boolean) {
    setSelectedServiceTypesByProvider((c) => ({ ...c, [providerId]: isSelected ? [...options] : [] }));
  }

  function submitServiceRollout(
    providerId: number,
    providerServiceTypeOptions: string[],
    providerServicesRows: AdminProviderService[],
  ) {
    const draft = serviceDraft[providerId];
    const selectedServiceTypes = selectedServiceTypesByProvider[providerId] ?? providerServicesRows.map((s) => s.service_type);
    const normalized = Array.from(
      new Set(selectedServiceTypes.map((v) => v.trim()).filter((v) => v.length > 0)),
    ).filter((v) => providerServiceTypeOptions.includes(v));

    if (normalized.length === 0) { showToast('Select at least one service to apply rollout.', 'error'); return; }
    if (!draft) { showToast('Provide service configuration before saving.', 'error'); return; }

    const existingByType = new Map<string, AdminProviderService>();
    for (const svc of providerServicesRows) existingByType.set(svc.service_type.trim().toLowerCase(), svc);

    const servicePincodes = draft.service_pincodes.split(',').map((v) => v.trim()).filter((v) => v.length > 0);

    startTransition(async () => {
      try {
        const rolloutPayload = normalized.map((serviceType) => {
          const existing = existingByType.get(serviceType.toLowerCase());
          const existingPincodes = existing ? pincodesByService[existing.id] ?? [] : [];
          return { id: existing?.id, service_type: serviceType, is_active: true, service_pincodes: servicePincodes.length > 0 ? servicePincodes : existingPincodes };
        });

        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          { method: 'PUT', body: JSON.stringify(rolloutPayload) },
        );
        setServicesByProvider((c) => ({ ...c, [providerId]: response.services }));
        setPincodesByService((c) => {
          const next = { ...c };
          for (const svc of response.services) next[svc.id] = svc.service_pincodes ?? [];
          return next;
        });
        showToast('Service rollout updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service rollout.', 'error');
      }
    });
  }

  function setProviderServiceActivation(providerId: number, serviceId: string, isActive: boolean) {
    const providerServicesRows = servicesByProvider[providerId] ?? [];
    const service = providerServicesRows.find((row) => row.id === serviceId);

    if (!service) {
      showToast('Service rollout not found for this provider.', 'error');
      return;
    }

    const currentPincodes = pincodesByService[service.id] ?? [];

    startTransition(async () => {
      try {
        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'PUT',
            body: JSON.stringify([
              {
                id: service.id,
                service_type: service.service_type,
                is_active: isActive,
                service_pincodes: currentPincodes,
              },
            ]),
          },
        );

        setServicesByProvider((current) => ({ ...current, [providerId]: response.services }));
        setPincodesByService((current) => {
          const next = { ...current };
          for (const serviceRow of response.services) {
            next[serviceRow.id] = serviceRow.service_pincodes ?? [];
          }
          return next;
        });

        showToast(`Service ${isActive ? 'enabled' : 'disabled'} successfully.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service status.', 'error');
      }
    });
  }

  function deleteProviderServiceRollout(providerId: number, serviceId: string) {
    startTransition(async () => {
      try {
        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'DELETE',
            body: JSON.stringify({ serviceId }),
          },
        );

        setServicesByProvider((current) => ({ ...current, [providerId]: response.services }));
        setPincodesByService((current) => {
          const next = { ...current };
          delete next[serviceId];
          for (const serviceRow of response.services) {
            next[serviceRow.id] = serviceRow.service_pincodes ?? [];
          }
          return next;
        });

        setServiceDraft((current) => {
          const draft = current[providerId];
          if (!draft || draft.id !== serviceId) {
            return current;
          }

          const next = { ...current };
          delete next[providerId];
          return next;
        });

        showToast('Service rollout deleted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete service rollout.', 'error');
      }
    });
  }

  // Location management
  function setLocationDraftField(providerId: number, field: keyof LocationDraft, value: string) {
    setLocationDraft((c) => ({
      ...c,
      [providerId]: {
        address: c[providerId]?.address ?? '',
        city: c[providerId]?.city ?? '',
        state: c[providerId]?.state ?? '',
        pincode: c[providerId]?.pincode ?? '',
        latitude: c[providerId]?.latitude ?? '',
        longitude: c[providerId]?.longitude ?? '',
        service_radius_km: c[providerId]?.service_radius_km ?? '',
        [field]: value,
      },
    }));
  }

  function copyLocationIntoDraft(provider: AdminProviderModerationItem) {
    setLocationDraft((c) => ({
      ...c,
      [provider.id]: {
        address: provider.address ?? '',
        city: provider.city ?? '',
        state: provider.state ?? '',
        pincode: provider.pincode ?? '',
        latitude: provider.latitude === null ? '' : String(provider.latitude),
        longitude: provider.longitude === null ? '' : String(provider.longitude),
        service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
      },
    }));
  }

  function cancelLocationEdit(providerId: number) {
    setLocationDraft((c) => {
      if (!c[providerId]) return c;
      const next = { ...c };
      delete next[providerId];
      return next;
    });
  }

  function applyLocationWarningSuggestion(provider: AdminProviderModerationItem, warning: string, coveragePincodes: string[]) {
    let changeSummary = '';
    setLocationDraft((c) => {
      const existing = c[provider.id] ?? {
        address: provider.address ?? '',
        city: provider.city ?? '',
        state: provider.state ?? '',
        pincode: provider.pincode ?? '',
        latitude: provider.latitude === null ? '' : String(provider.latitude),
        longitude: provider.longitude === null ? '' : String(provider.longitude),
        service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
      };
      const next = applyLocationWarningToDraft(existing, warning, coveragePincodes);
      changeSummary = buildLocationChangeSummary(existing, next);
      return { ...c, [provider.id]: next };
    });
    showToast(changeSummary ? `Suggestion applied: ${changeSummary}` : 'Suggestion applied (no changes needed).', 'success');
    setLocationLastAutoFixNote((c) => ({
      ...c,
      [provider.id]: changeSummary ? `Last auto-fix: ${changeSummary}` : 'Last auto-fix: No field changes were required.',
    }));
  }

  function dismissLocationAutoFixNote(providerId: number) {
    setLocationLastAutoFixNote((c) => {
      if (!c[providerId]) return c;
      const next = { ...c };
      delete next[providerId];
      return next;
    });
  }

  function saveProviderLocation(providerId: number) {
    const provider = providerRows.find((r) => r.id === providerId);
    if (!provider) { showToast('Provider not found.', 'error'); return; }

    const draft = locationDraft[providerId] ?? {
      address: provider.address ?? '',
      city: provider.city ?? '',
      state: provider.state ?? '',
      pincode: provider.pincode ?? '',
      latitude: provider.latitude === null ? '' : String(provider.latitude),
      longitude: provider.longitude === null ? '' : String(provider.longitude),
      service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
    };

    const latitude = draft.latitude.trim() ? Number(draft.latitude) : null;
    const longitude = draft.longitude.trim() ? Number(draft.longitude) : null;
    const serviceRadiusKm = draft.service_radius_km.trim() ? Number(draft.service_radius_km) : null;

    if ((latitude === null) !== (longitude === null)) { showToast('Lat and lng must be provided together.', 'error'); return; }
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) { showToast('Latitude must be between -90 and 90.', 'error'); return; }
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) { showToast('Longitude must be between -180 and 180.', 'error'); return; }
    if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0)) { showToast('Service radius must be non-negative.', 'error'); return; }

    const pincode = draft.pincode.trim();
    if (pincode && !/^[1-9]\d{5}$/.test(pincode)) { showToast('Pincode should be a valid 6-digit Indian pincode.', 'error'); return; }

    startTransition(async () => {
      try {
        const response = await adminRequest<{
          location: {
            provider_id: number; address: string | null; city: string | null;
            state: string | null; pincode: string | null; latitude: number | null;
            longitude: number | null; service_radius_km: number | null;
          };
          coverageWarnings?: string[];
        }>(`/api/admin/providers/${providerId}/location`, {
          method: 'PATCH',
          body: JSON.stringify({
            address: draft.address.trim() || null,
            city: draft.city.trim() || null,
            state: draft.state.trim() || null,
            pincode: pincode || null,
            latitude, longitude, service_radius_km: serviceRadiusKm,
          }),
        });

        setProviderRows((c) => c.map((r) => r.id !== providerId ? r : {
          ...r,
          address: response.location.address,
          city: response.location.city,
          state: response.location.state,
          pincode: response.location.pincode,
          latitude: response.location.latitude,
          longitude: response.location.longitude,
          service_radius_km: response.location.service_radius_km,
        }));
        setLocationCoverageWarnings((c) => ({ ...c, [providerId]: response.coverageWarnings ?? [] }));
        setLocationDraft((c) => {
          const next = { ...c };
          delete next[providerId];
          return next;
        });
        setLocationLastAutoFixNote((c) => {
          const next = { ...c };
          delete next[providerId];
          return next;
        });
        showToast('Location moderation updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update location.', 'error');
      }
    });
  }

  // Provider profile management
  function copyProviderProfileIntoDraft(provider: AdminProviderModerationItem) {
    setProviderProfileDraft((c) => ({
      ...c,
      [provider.id]: {
        name: provider.name ?? '',
        email: provider.email ?? '',
        provider_type: provider.provider_type ?? '',
        business_name: provider.business_name ?? '',
        profile_photo_url: provider.profile_photo_url ?? '',
        service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
        license_number: provider.professional_details?.license_number ?? '',
        specialization: provider.professional_details?.specialization ?? '',
        teleconsult_enabled: provider.professional_details?.teleconsult_enabled ?? false,
        emergency_service_enabled: provider.professional_details?.emergency_service_enabled ?? false,
        equipment_details: provider.professional_details?.equipment_details ?? '',
        insurance_document_url: provider.professional_details?.insurance_document_url ?? '',
        registration_number: provider.clinic_details?.registration_number ?? '',
        gst_number: provider.clinic_details?.gst_number ?? '',
        number_of_doctors: provider.clinic_details?.number_of_doctors === null || provider.clinic_details?.number_of_doctors === undefined
          ? '' : String(provider.clinic_details.number_of_doctors),
        hospitalization_available: provider.clinic_details?.hospitalization_available ?? false,
        emergency_services_available: provider.clinic_details?.emergency_services_available ?? false,
      },
    }));
  }

  function setProviderProfileDraftField(providerId: number, field: keyof ProviderProfileDraft, value: string | boolean) {
    setProviderProfileDraft((c) => ({
      ...c,
      [providerId]: {
        name: c[providerId]?.name ?? '',
        email: c[providerId]?.email ?? '',
        provider_type: c[providerId]?.provider_type ?? '',
        business_name: c[providerId]?.business_name ?? '',
        profile_photo_url: c[providerId]?.profile_photo_url ?? '',
        service_radius_km: c[providerId]?.service_radius_km ?? '',
        license_number: c[providerId]?.license_number ?? '',
        specialization: c[providerId]?.specialization ?? '',
        teleconsult_enabled: c[providerId]?.teleconsult_enabled ?? false,
        emergency_service_enabled: c[providerId]?.emergency_service_enabled ?? false,
        equipment_details: c[providerId]?.equipment_details ?? '',
        insurance_document_url: c[providerId]?.insurance_document_url ?? '',
        registration_number: c[providerId]?.registration_number ?? '',
        gst_number: c[providerId]?.gst_number ?? '',
        number_of_doctors: c[providerId]?.number_of_doctors ?? '',
        hospitalization_available: c[providerId]?.hospitalization_available ?? false,
        emergency_services_available: c[providerId]?.emergency_services_available ?? false,
        [field]: value,
      },
    }));
  }

  function cancelProviderProfileEdit(providerId: number) {
    setProviderProfileDraft((c) => {
      if (!c[providerId]) return c;
      const next = { ...c };
      delete next[providerId];
      return next;
    });
  }

  function saveProviderProfile(providerId: number) {
    const provider = providerRows.find((r) => r.id === providerId);
    if (!provider) { showToast('Provider not found.', 'error'); return; }
    const draft = providerProfileDraft[providerId];
    if (!draft) { showToast('No profile changes to save.', 'error'); return; }

    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    const providerType = draft.provider_type.trim();
    const serviceRadiusKm = draft.service_radius_km.trim() ? Number(draft.service_radius_km) : null;
    const numberOfDoctors = draft.number_of_doctors.trim() ? Number(draft.number_of_doctors) : null;

    if (!name) { showToast('Provider name is required.', 'error'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Provide a valid email address.', 'error'); return; }
    if (!providerType) { showToast('Provider type is required.', 'error'); return; }
    if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0)) { showToast('Service radius must be valid.', 'error'); return; }
    if (numberOfDoctors !== null && (!Number.isFinite(numberOfDoctors) || numberOfDoctors < 0)) { showToast('Number of doctors must be valid.', 'error'); return; }

    startTransition(async () => {
      try {
        type ProviderProfileResponse = {
          provider: {
            id: number; name: string; email: string | null; profile_photo_url: string | null;
            provider_type: string; business_name: string | null; service_radius_km: number | null;
            updated_at: string;
            professional_details: {
              license_number: string | null; specialization: string | null;
              teleconsult_enabled: boolean; emergency_service_enabled: boolean;
              equipment_details: string | null; insurance_document_url: string | null;
            } | null;
            clinic_details: {
              registration_number: string | null; gst_number: string | null;
              number_of_doctors: number | null; hospitalization_available: boolean;
              emergency_services_available: boolean;
            } | null;
          };
        };
        const response = await adminRequest<ProviderProfileResponse>(
          `/api/admin/providers/${providerId}/profile`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name, email: email || null, provider_type: providerType,
              business_name: draft.business_name.trim() || null,
              profile_photo_url: draft.profile_photo_url.trim() || null,
              service_radius_km: serviceRadiusKm,
              professional_details: {
                license_number: draft.license_number.trim() || null,
                specialization: draft.specialization.trim() || null,
                teleconsult_enabled: draft.teleconsult_enabled,
                emergency_service_enabled: draft.emergency_service_enabled,
                equipment_details: draft.equipment_details.trim() || null,
                insurance_document_url: draft.insurance_document_url.trim() || null,
              },
              clinic_details: {
                registration_number: draft.registration_number.trim() || null,
                gst_number: draft.gst_number.trim() || null,
                number_of_doctors: numberOfDoctors,
                hospitalization_available: draft.hospitalization_available,
                emergency_services_available: draft.emergency_services_available,
              },
            }),
          },
        );

        setProviderRows((c) => c.map((r) => r.id !== providerId ? r : {
          ...r,
          name: response.provider.name,
          email: response.provider.email,
          profile_photo_url: response.provider.profile_photo_url,
          provider_type: response.provider.provider_type as AdminProviderModerationItem['provider_type'],
          business_name: response.provider.business_name,
          service_radius_km: response.provider.service_radius_km,
          updated_at: response.provider.updated_at,
          professional_details: response.provider.professional_details,
          clinic_details: response.provider.clinic_details,
        }));

        cancelProviderProfileEdit(providerId);
        showToast('Provider profile updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update provider profile.', 'error');
      }
    });
  }

  function handleOnboardingSuccess(onboardedEmail: string) {
    void refreshProviders();
    showToast(`Provider onboarded and invite email sent to ${onboardedEmail}.`, 'success');
  }

  return (
    <AdminProvidersView
      providerRows={providerRows}
      filteredProviders={filteredProviders}
      filteredProviderApplications={filteredProviderApplications}
      providerApplications={providerApplications}
      providerApplicationStatusFilter={providerApplicationStatusFilter}
      providerApplicationNotesDraft={providerApplicationNotesDraft}
      expandedProviderIds={expandedProviderIds}
      providerDetailsLoadingById={providerDetailsLoadingById}
      providerDetailsLoadedById={providerDetailsLoadedById}
      availabilityByProvider={availabilityByProvider}
      servicesByProvider={servicesByProvider}
      pincodesByService={pincodesByService}
      providerSearchQuery={providerSearchQuery}
      providerTypeFilter={providerTypeFilter}
      providerStatusFilter={providerStatusFilter}
      availabilityFinderProviderType={availabilityFinderProviderType}
      availabilityFinderServiceType={availabilityFinderServiceType}
      availabilityFinderPincode={availabilityFinderPincode}
      availabilityFinderDate={availabilityFinderDate}
      availabilityFinderStartTime={availabilityFinderStartTime}
      availabilityFinderEndTime={availabilityFinderEndTime}
      availabilityFinderExactTimeOnly={availabilityFinderExactTimeOnly}
      availabilityFinderAutoOpenTopMatch={availabilityFinderAutoOpenTopMatch}
      availabilityFinderLoading={availabilityFinderLoading}
      availabilityFinderHasRun={availabilityFinderHasRun}
      availabilityFinderResults={availabilityFinderResults}
      availabilityFinderSlots={availabilityFinderSlots}
      availabilityFinderServices={availabilityFinderServices}
      availableServiceTypes={availableServiceTypes}
      calendarProviderId={calendarProviderId}
      calendarFromDate={calendarFromDate}
      calendarDays={calendarDays}
      calendarSelectableProviders={calendarSelectableProviders}
      calendarSkeletonCardCount={calendarSkeletonCardCount}
      selectedCalendarProviderName={selectedCalendarProviderName}
      isCalendarStale={isCalendarStale}
      providerCalendar={providerCalendar}
      isCalendarLoading={isCalendarLoading}
      serviceDraft={serviceDraft}
      availabilityDraft={availabilityDraft}
      locationDraft={locationDraft}
      providerProfileDraft={providerProfileDraft}
      locationCoverageWarnings={locationCoverageWarnings}
      locationLastAutoFixNote={locationLastAutoFixNote}
      selectedServiceTypesByProvider={selectedServiceTypesByProvider}
      deletingProviderId={deletingProviderId}
      isOnboardingModalOpen={isOnboardingModalOpen}
      isPending={isPending}
      providerCardRefs={providerCardRefs}
      setProviderApplicationStatusFilter={setProviderApplicationStatusFilter}
      setProviderSearchQuery={setProviderSearchQuery}
      setProviderTypeFilter={setProviderTypeFilter}
      setProviderStatusFilter={setProviderStatusFilter}
      setAvailabilityFinderProviderType={setAvailabilityFinderProviderType}
      setAvailabilityFinderServiceType={setAvailabilityFinderServiceType}
      setAvailabilityFinderPincode={setAvailabilityFinderPincode}
      setAvailabilityFinderDate={setAvailabilityFinderDate}
      setAvailabilityFinderStartTime={setAvailabilityFinderStartTime}
      setAvailabilityFinderEndTime={setAvailabilityFinderEndTime}
      setAvailabilityFinderExactTimeOnly={setAvailabilityFinderExactTimeOnly}
      setAvailabilityFinderAutoOpenTopMatch={setAvailabilityFinderAutoOpenTopMatch}
      setAvailabilityFinderResults={setAvailabilityFinderResults}
      setAvailabilityFinderSlots={setAvailabilityFinderSlots}
      setAvailabilityFinderServices={setAvailabilityFinderServices}
      setAvailabilityFinderHasRun={setAvailabilityFinderHasRun}
      setCalendarProviderId={setCalendarProviderId}
      setCalendarFromDate={setCalendarFromDate}
      setCalendarDays={setCalendarDays}
      setIsOnboardingModalOpen={setIsOnboardingModalOpen}
      refreshProviderApplications={refreshProviderApplications}
      setProviderApplicationNote={setProviderApplicationNote}
      updateProviderApplicationStatus={updateProviderApplicationStatus}
      focusProviderCard={focusProviderCard}
      searchAvailableProviders={searchAvailableProviders}
      fetchProviderCalendar={fetchProviderCalendar}
      approveProvider={approveProvider}
      rejectProvider={rejectProvider}
      moderateProvider={moderateProvider}
      removeProvider={removeProvider}
      toggleProviderCard={toggleProviderCard}
      toggleProviderServices={toggleProviderServices}
      copyProviderProfileIntoDraft={copyProviderProfileIntoDraft}
      saveProviderProfile={saveProviderProfile}
      cancelProviderProfileEdit={cancelProviderProfileEdit}
      setProviderProfileDraftField={setProviderProfileDraftField}
      copyLocationIntoDraft={copyLocationIntoDraft}
      cancelLocationEdit={cancelLocationEdit}
      setLocationDraftField={setLocationDraftField}
      saveProviderLocation={saveProviderLocation}
      applyLocationWarningSuggestion={applyLocationWarningSuggestion}
      dismissLocationAutoFixNote={dismissLocationAutoFixNote}
      toggleAvailabilitySlot={toggleAvailabilitySlot}
      toggleAvailabilityDraftWeekday={toggleAvailabilityDraftWeekday}
      setAvailabilityDraftField={setAvailabilityDraftField}
      appendAvailabilitySlot={appendAvailabilitySlot}
      copyServiceIntoDraft={copyServiceIntoDraft}
      setAllProviderServiceSelections={setAllProviderServiceSelections}
      toggleProviderServiceSelection={toggleProviderServiceSelection}
      setServiceDraftField={setServiceDraftField}
      submitServiceRollout={submitServiceRollout}
      setProviderServiceActivation={setProviderServiceActivation}
      deleteProviderServiceRollout={deleteProviderServiceRollout}
      handleOnboardingSuccess={handleOnboardingSuccess}
    />
  );
}
