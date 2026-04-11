'use client';

import { useState, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import ProviderOnboardingModal from '@/components/dashboard/admin/ProviderOnboardingModal';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import ImageUploadField from '@/components/ui/ImageUploadField';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import AdminQuickActionRow from '@/components/dashboard/admin/AdminQuickActionRow';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/dashboard/premium/StatusBadge';
import { Button, Input, Card, Alert, Badge } from '@/components/ui';
import { cn } from '@/lib/design-system';
import type { AdminProviderModerationItem } from '@/lib/provider-management/types';
import type {
  ServiceProviderApplication,
  ServiceProviderApplicationStatus,
} from '@/lib/provider-applications/types';

// ---------------------------------------------------------------------------
// Local types (mirrored from AdminDashboardClient)
// ---------------------------------------------------------------------------

type AdminProviderCalendarResponse = {
  provider: {
    id: number;
    name: string;
  };
  fromDate: string;
  toDate: string;
  days: Array<{
    date: string;
    day_of_week: number;
    availability: Array<{
      id: string;
      start_time: string;
      end_time: string;
      is_available: boolean;
    }>;
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

// ---------------------------------------------------------------------------
// Constants & pure helpers (moved here — only used in providers view)
// ---------------------------------------------------------------------------

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const ADMIN_CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAdminCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not available';
  }
  return ADMIN_CURRENCY_FORMATTER.format(value);
}

function weekdayLabel(dayOfWeek: number) {
  return WEEKDAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ?? `Day ${dayOfWeek}`;
}

function getDefaultAvailabilityDraft() {
  return {
    selected_days: [1],
    start_time: '09:00',
    end_time: '17:00',
  };
}

function getProviderApplicationStatusBadge(status: ServiceProviderApplicationStatus) {
  switch (status) {
    case 'approved':
      return 'border-green-300 bg-green-100 text-green-700';
    case 'rejected':
      return 'border-red-300 bg-red-100 text-red-700';
    case 'under_review':
      return 'border-amber-300 bg-amber-100 text-amber-700';
    default:
      return 'border-blue-300 bg-blue-100 text-blue-700';
  }
}

function locationWarningSuggestion(warning: string) {
  const normalized = warning.toLowerCase();

  if (normalized.includes('pincode and service radius are both missing') || normalized.includes('pincode and service radius are missing')) {
    return 'Add clinic pincode first, then set a realistic service radius baseline.';
  }

  if (normalized.includes('radius is 0 km')) {
    return 'Either increase service radius above 0 km or keep rollout limited to clinic pincode.';
  }

  if (normalized.includes('very small for the current pincode rollout footprint')) {
    return 'Increase service radius or trim non-clinic rollout pincodes.';
  }

  if (normalized.includes('without a service radius baseline')) {
    return 'Set service radius to align with current pincode coverage area.';
  }

  return 'Review location fields and align service radius with rollout pincodes.';
}

function locationWarningActionLabel(warning: string) {
  const normalized = warning.toLowerCase();

  if (normalized.includes('radius is 0 km') || normalized.includes('very small for the current pincode rollout footprint')) {
    return 'Apply safer radius';
  }

  if (normalized.includes('without a service radius baseline') || normalized.includes('pincode and service radius are')) {
    return 'Set baseline values';
  }

  return 'Auto-fix draft';
}

const adminRawFieldClass =
  'rounded-xl border border-neutral-200/60 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1';

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

export type AdminProvidersViewProps = {
  // State: data
  providerRows: AdminProviderModerationItem[];
  filteredProviders: AdminProviderModerationItem[];
  filteredProviderApplications: ServiceProviderApplication[];
  providerApplications: ServiceProviderApplication[];
  providerApplicationStatusFilter: 'all' | ServiceProviderApplicationStatus;
  providerApplicationNotesDraft: Record<string, string>;
  expandedProviderIds: number[];
  providerDetailsLoadingById: Record<number, boolean>;
  providerDetailsLoadedById: Record<number, boolean>;
  availabilityByProvider: Record<number, AdminProviderAvailability[]>;
  servicesByProvider: Record<number, AdminProviderService[]>;
  pincodesByService: Record<string, string[]>;
  providerSearchQuery: string;
  providerTypeFilter: 'all' | 'clinic' | 'home_visit';
  providerStatusFilter: 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';
  availabilityFinderProviderType: 'all' | 'clinic' | 'home_visit';
  availabilityFinderServiceType: string;
  availabilityFinderPincode: string;
  availabilityFinderDate: string;
  availabilityFinderStartTime: string;
  availabilityFinderEndTime: string;
  availabilityFinderExactTimeOnly: boolean;
  availabilityFinderAutoOpenTopMatch: boolean;
  availabilityFinderLoading: boolean;
  availabilityFinderHasRun: boolean;
  availabilityFinderResults: AvailabilityProvider[];
  availabilityFinderSlots: AvailabilitySlot[];
  availabilityFinderServices: AvailabilityServiceSummary[];
  availableServiceTypes: string[];
  calendarProviderId: number | '';
  calendarFromDate: string;
  calendarDays: 7 | 14;
  calendarSelectableProviders: AdminProviderModerationItem[];
  calendarSkeletonCardCount: number;
  selectedCalendarProviderName: string | null;
  isCalendarStale: boolean;
  providerCalendar: AdminProviderCalendarResponse | null;
  isCalendarLoading: boolean;
  serviceDraft: Record<number, ServiceRolloutDraft>;
  availabilityDraft: Record<number, { selected_days: number[]; start_time: string; end_time: string }>;
  locationDraft: Record<number, LocationDraft>;
  providerProfileDraft: Record<number, ProviderProfileDraft>;
  locationCoverageWarnings: Record<number, string[]>;
  locationLastAutoFixNote: Record<number, string>;
  selectedServiceTypesByProvider: Record<number, string[]>;
  deletingProviderId: number | null;
  isOnboardingModalOpen: boolean;
  isPending: boolean;
  // Ref
  providerCardRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  // Setters
  setProviderApplicationStatusFilter: (value: 'all' | ServiceProviderApplicationStatus) => void;
  setProviderSearchQuery: (value: string) => void;
  setProviderTypeFilter: (value: 'all' | 'clinic' | 'home_visit') => void;
  setProviderStatusFilter: (value: 'all' | 'pending' | 'approved' | 'rejected' | 'suspended') => void;
  setAvailabilityFinderProviderType: (value: 'all' | 'clinic' | 'home_visit') => void;
  setAvailabilityFinderServiceType: (value: string) => void;
  setAvailabilityFinderPincode: (value: string) => void;
  setAvailabilityFinderDate: (value: string) => void;
  setAvailabilityFinderStartTime: (value: string) => void;
  setAvailabilityFinderEndTime: (value: string) => void;
  setAvailabilityFinderExactTimeOnly: (value: boolean) => void;
  setAvailabilityFinderAutoOpenTopMatch: (value: boolean) => void;
  setAvailabilityFinderResults: (value: AvailabilityProvider[]) => void;
  setAvailabilityFinderSlots: (value: AvailabilitySlot[]) => void;
  setAvailabilityFinderServices: (value: AvailabilityServiceSummary[]) => void;
  setAvailabilityFinderHasRun: (value: boolean) => void;
  setCalendarProviderId: (value: number | '') => void;
  setCalendarFromDate: (value: string) => void;
  setCalendarDays: (value: 7 | 14) => void;
  setIsOnboardingModalOpen: (value: boolean) => void;
  // Handlers
  refreshProviderApplications: () => Promise<void>;
  setProviderApplicationNote: (applicationId: string, value: string) => void;
  updateProviderApplicationStatus: (applicationId: string, status: ServiceProviderApplicationStatus) => void;
  focusProviderCard: (providerId: number) => void;
  searchAvailableProviders: () => Promise<void>;
  fetchProviderCalendar: () => Promise<void>;
  approveProvider: (providerId: number) => void;
  rejectProvider: (providerId: number) => void;
  moderateProvider: (providerId: number, action: 'enable' | 'disable') => void;
  removeProvider: (providerId: number) => void;
  toggleProviderCard: (providerId: number) => void;
  toggleProviderServices: (providerId: number, enable: boolean) => void;
  copyProviderProfileIntoDraft: (provider: AdminProviderModerationItem) => void;
  saveProviderProfile: (providerId: number) => void;
  cancelProviderProfileEdit: (providerId: number) => void;
  setProviderProfileDraftField: (providerId: number, field: keyof ProviderProfileDraft, value: string | boolean) => void;
  copyLocationIntoDraft: (provider: AdminProviderModerationItem) => void;
  cancelLocationEdit: (providerId: number) => void;
  setLocationDraftField: (providerId: number, field: keyof LocationDraft, value: string) => void;
  saveProviderLocation: (providerId: number) => void;
  applyLocationWarningSuggestion: (provider: AdminProviderModerationItem, warning: string, coveragePincodes: string[]) => void;
  dismissLocationAutoFixNote: (providerId: number) => void;
  toggleAvailabilitySlot: (providerId: number, slotId: string, isAvailable: boolean) => void;
  toggleAvailabilityDraftWeekday: (providerId: number, dayOfWeek: number, checked: boolean) => void;
  setAvailabilityDraftField: (providerId: number, field: 'start_time' | 'end_time', value: string) => void;
  appendAvailabilitySlot: (providerId: number) => void;
  copyServiceIntoDraft: (providerId: number, serviceId: string) => void;
  setAllProviderServiceSelections: (providerId: number, options: string[], selected: boolean) => void;
  toggleProviderServiceSelection: (providerId: number, serviceType: string, checked: boolean, options: string[], existingServices: AdminProviderService[]) => void;
  setServiceDraftField: (providerId: number, field: keyof ServiceRolloutDraft, value: string | boolean) => void;
  submitServiceRollout: (providerId: number, options: string[], existingServices: AdminProviderService[]) => void;
  setProviderServiceActivation: (providerId: number, serviceId: string, isActive: boolean) => void;
  deleteProviderServiceRollout: (providerId: number, serviceId: string) => void;
  handleOnboardingSuccess: (onboardedEmail: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminProvidersView({
  providerRows,
  filteredProviders,
  filteredProviderApplications,
  providerApplications,
  providerApplicationStatusFilter,
  providerApplicationNotesDraft,
  expandedProviderIds,
  providerDetailsLoadingById,
  providerDetailsLoadedById,
  availabilityByProvider,
  servicesByProvider,
  pincodesByService,
  providerSearchQuery,
  providerTypeFilter,
  providerStatusFilter,
  availabilityFinderProviderType,
  availabilityFinderServiceType,
  availabilityFinderPincode,
  availabilityFinderDate,
  availabilityFinderStartTime,
  availabilityFinderEndTime,
  availabilityFinderExactTimeOnly,
  availabilityFinderAutoOpenTopMatch,
  availabilityFinderLoading,
  availabilityFinderHasRun,
  availabilityFinderResults,
  availabilityFinderSlots,
  availabilityFinderServices,
  availableServiceTypes,
  calendarProviderId,
  calendarFromDate,
  calendarDays,
  calendarSelectableProviders,
  calendarSkeletonCardCount,
  selectedCalendarProviderName,
  isCalendarStale,
  providerCalendar,
  isCalendarLoading,
  serviceDraft,
  availabilityDraft,
  locationDraft,
  providerProfileDraft,
  locationCoverageWarnings,
  locationLastAutoFixNote,
  selectedServiceTypesByProvider,
  deletingProviderId,
  isOnboardingModalOpen,
  isPending,
  providerCardRefs,
  setProviderApplicationStatusFilter,
  setProviderSearchQuery,
  setProviderTypeFilter,
  setProviderStatusFilter,
  setAvailabilityFinderProviderType,
  setAvailabilityFinderServiceType,
  setAvailabilityFinderPincode,
  setAvailabilityFinderDate,
  setAvailabilityFinderStartTime,
  setAvailabilityFinderEndTime,
  setAvailabilityFinderExactTimeOnly,
  setAvailabilityFinderAutoOpenTopMatch,
  setAvailabilityFinderResults,
  setAvailabilityFinderSlots,
  setAvailabilityFinderServices,
  setAvailabilityFinderHasRun,
  setCalendarProviderId,
  setCalendarFromDate,
  setCalendarDays,
  setIsOnboardingModalOpen,
  refreshProviderApplications,
  setProviderApplicationNote,
  updateProviderApplicationStatus,
  focusProviderCard,
  searchAvailableProviders,
  fetchProviderCalendar,
  approveProvider,
  rejectProvider,
  moderateProvider,
  removeProvider,
  toggleProviderCard,
  toggleProviderServices,
  copyProviderProfileIntoDraft,
  saveProviderProfile,
  cancelProviderProfileEdit,
  setProviderProfileDraftField,
  copyLocationIntoDraft,
  cancelLocationEdit,
  setLocationDraftField,
  saveProviderLocation,
  applyLocationWarningSuggestion,
  dismissLocationAutoFixNote,
  toggleAvailabilitySlot,
  toggleAvailabilityDraftWeekday,
  setAvailabilityDraftField,
  appendAvailabilitySlot,
  copyServiceIntoDraft,
  setAllProviderServiceSelections,
  toggleProviderServiceSelection,
  setServiceDraftField,
  submitServiceRollout,
  setProviderServiceActivation,
  deleteProviderServiceRollout,
  handleOnboardingSuccess,
}: AdminProvidersViewProps) {
  type ProviderMetrics = {
    total_bookings: number;
    completion_rate: number;
    cancellation_rate: number;
    no_show_rate: number;
    avg_rating: number | null;
    total_revenue_inr: number;
  };
  const [providerMetrics, setProviderMetrics] = useState<Map<number, ProviderMetrics>>(new Map());
  const [deleteServiceDialog, setDeleteServiceDialog] = useState<{
    providerId: number;
    providerName: string;
    serviceId: string;
    serviceType: string;
    mappedPincodeCount: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/admin/providers/performance')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.metrics) return;
        const map = new Map<number, ProviderMetrics>();
        for (const m of data.metrics) {
          map.set(m.provider_id, m);
        }
        setProviderMetrics(map);
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <section className="space-y-6">
        <AdminSectionGuide
          title="How to Use Provider Management"
          subtitle="Onboard, review, and manage service providers"
          steps={[
            { title: 'Review Applications', description: 'New provider applications appear at the top. Review their details and approve or reject them.' },
            { title: 'Onboard a Provider', description: 'Click "+ Onboard New Provider" to manually add a verified provider with their details.' },
            { title: 'Manage Profiles', description: 'View each provider\'s service areas, documents, availability calendar, and performance.' },
            { title: 'Update Documents', description: 'Upload or verify provider documents like ID proof, certifications, and photos.' },
            { title: 'Set Availability', description: 'View and manage provider availability slots and service location assignments.' },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title">Provider Management</h2>
            </div>
            <p className="text-muted">Review, approve, and manage provider profiles, documentation, and service locations</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setIsOnboardingModalOpen(true)}
              disabled={isPending}
            >
              + Onboard New Provider
            </Button>
          </div>
        </div>

        <Card>
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-card-title">Service Provider Applications</h3>
                <p className="text-muted">Incoming applications from the public provider application page.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
                  Total: {providerApplications.length}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  New: {providerApplications.filter((application) => application.status === 'pending').length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void refreshProviderApplications()}
                  disabled={isPending}
                >
                  Refresh Applications
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">Application Status</label>
                <select
                  value={providerApplicationStatusFilter}
                  onChange={(event) =>
                    setProviderApplicationStatusFilter(event.target.value as 'all' | ServiceProviderApplicationStatus)
                  }
                  className="input-field w-full"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <Button
                variant="ghost"
                onClick={() => setProviderApplicationStatusFilter('all')}
                className="sm:w-auto"
              >
                Clear
              </Button>
            </div>

            {filteredProviderApplications.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
                No provider applications found for the selected filter.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredProviderApplications.map((application) => {
                  const statusClass = getProviderApplicationStatusBadge(application.status);
                  const noteDraft =
                    providerApplicationNotesDraft[application.id] !== undefined
                      ? providerApplicationNotesDraft[application.id]
                      : application.admin_notes ?? '';

                  return (
                    <div key={application.id} className="rounded-2xl bg-neutral-50/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-neutral-900">{application.full_name}</p>
                          <p className="text-xs text-neutral-600">
                            {application.provider_type} • {application.years_of_experience} years experience
                          </p>
                          <p className="text-xs text-neutral-500">
                            {application.email} • {application.phone_number}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {application.city}, {application.state}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', statusClass)}>
                            {application.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {new Date(application.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2 rounded-xl bg-neutral-50/70 p-3 text-xs text-neutral-700">
                          <p>
                            <span className="font-semibold text-neutral-900">Service Modes:</span>{' '}
                            {application.service_modes.join(', ') || 'Not specified'}
                          </p>
                          <p>
                            <span className="font-semibold text-neutral-900">Service Areas:</span> {application.service_areas}
                          </p>
                          {application.portfolio_url ? (
                            <p>
                              <span className="font-semibold text-neutral-900">Portfolio:</span>{' '}
                              <a
                                href={application.portfolio_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-900 underline underline-offset-2"
                              >
                                Open link
                              </a>
                            </p>
                          ) : null}
                          {application.motivation ? (
                            <p>
                              <span className="font-semibold text-neutral-900">Motivation:</span> {application.motivation}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                            Admin Notes
                          </label>
                          <textarea
                            value={noteDraft}
                            onChange={(event) => setProviderApplicationNote(application.id, event.target.value)}
                            rows={4}
                            className={`${adminRawFieldClass} w-full`}
                            placeholder="Internal review notes"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateProviderApplicationStatus(application.id, 'under_review')}
                              disabled={isPending}
                            >
                              Mark Under Review
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateProviderApplicationStatus(application.id, 'approved')}
                              disabled={isPending}
                              className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => updateProviderApplicationStatus(application.id, 'rejected')}
                              disabled={isPending}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateProviderApplicationStatus(application.id, 'pending')}
                              disabled={isPending}
                            >
                              Reset to Pending
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Search and Filters */}
        <Card>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-card-title">Provider Management Control Center</h3>
              <p className="text-muted">Search providers and inspect their day-wise schedule in one unified workspace.</p>
            </div>

            <div className="space-y-4 rounded-xl bg-neutral-50/60 p-4">
              <Input
                type="search"
                placeholder="Search by name, ID, email, city..."
                value={providerSearchQuery}
                onChange={(e) => setProviderSearchQuery(e.target.value)}
                label="Search Providers"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-neutral-700 block mb-2">Provider Type</label>
                  <select
                    value={providerTypeFilter}
                    onChange={(e) => setProviderTypeFilter(e.target.value as typeof providerTypeFilter)}
                    className="input-field w-full"
                  >
                    <option value="all">All Types</option>
                    <option value="clinic">Clinics/Centers</option>
                    <option value="home_visit">Home Visit Professionals</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700 block mb-2">Approval Status</label>
                  <select
                    value={providerStatusFilter}
                    onChange={(e) => setProviderStatusFilter(e.target.value as typeof providerStatusFilter)}
                    className="input-field w-full"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setProviderSearchQuery('');
                      setProviderTypeFilter('all');
                      setProviderStatusFilter('all');
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              <p className="text-sm text-neutral-600">
                Showing <span className="font-semibold">{filteredProviders.length}</span> of{' '}
                <span className="font-semibold">{providerRows.length}</span> providers
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-800">Provider Quick View</p>
                {filteredProviders.length === 0 ? (
                  <p className="text-xs text-neutral-500">No providers to preview with current filters.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredProviders.slice(0, 12).map((provider) => {
                      const isProviderExpanded = expandedProviderIds.includes(provider.id);

                      return (
                        <button
                          key={`provider-chip-${provider.id}`}
                          type="button"
                          onClick={() => focusProviderCard(provider.id)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition-colors',
                            isProviderExpanded
                              ? 'border-neutral-300 bg-white text-neutral-900'
                              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-white',
                          )}
                        >
                          {provider.profile_photo_url ? (
                            <span className="relative h-6 w-6 overflow-hidden rounded-full border border-neutral-200/70 bg-neutral-100">
                              <StorageBackedImage
                                value={provider.profile_photo_url}
                                bucket="user-photos"
                                alt={provider.name}
                                fill
                                className="object-cover"
                              />
                            </span>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200/70 bg-neutral-100 text-[10px] font-semibold text-neutral-600">
                              {(provider.name?.trim().charAt(0) || 'P').toUpperCase()}
                            </span>
                          )}
                          <span className="max-w-[11rem] truncate">{provider.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl bg-neutral-50/60 p-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-neutral-900">Provider Schedule Calendar</h4>
                <p className="text-xs text-neutral-600">Day-wise provider availability with live booking status overlays.</p>
              </div>

              <div className="space-y-4 rounded-xl bg-white/80 p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-neutral-900">Availability Finder</h4>
                  <p className="text-xs text-neutral-600">
                    Discover providers by type, service, pincode, date, and time window. Providers with booking conflicts are excluded.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">Provider Type</label>
                    <select
                      value={availabilityFinderProviderType}
                      onChange={(event) => setAvailabilityFinderProviderType(event.target.value as typeof availabilityFinderProviderType)}
                      className="input-field w-full"
                    >
                      <option value="all">All types</option>
                      <option value="clinic">Clinics/Centers</option>
                      <option value="home_visit">Home Visit Professionals</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">Service Providability</label>
                    <select
                      value={availabilityFinderServiceType}
                      onChange={(event) => setAvailabilityFinderServiceType(event.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">Any service</option>
                      {availableServiceTypes.map((serviceType) => (
                        <option key={`finder-service-${serviceType}`} value={serviceType}>
                          {serviceType.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">Pincode</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="560001"
                      value={availabilityFinderPincode}
                      onChange={(event) => setAvailabilityFinderPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="input-field w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">Date</label>
                    <input
                      type="date"
                      value={availabilityFinderDate}
                      onChange={(event) => setAvailabilityFinderDate(event.target.value)}
                      className="input-field w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">Time From</label>
                    <input
                      type="time"
                      value={availabilityFinderStartTime}
                      onChange={(event) => setAvailabilityFinderStartTime(event.target.value)}
                      className="input-field w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">Time To</label>
                    <input
                      type="time"
                      value={availabilityFinderEndTime}
                      onChange={(event) => setAvailabilityFinderEndTime(event.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50/80 px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                      checked={availabilityFinderExactTimeOnly}
                      onChange={(event) => setAvailabilityFinderExactTimeOnly(event.target.checked)}
                    />
                    Exact time only (strictly match Time From)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                      checked={availabilityFinderAutoOpenTopMatch}
                      onChange={(event) => setAvailabilityFinderAutoOpenTopMatch(event.target.checked)}
                    />
                    Auto-open top match in calendar
                  </label>
                </div>

                <p className="text-xs text-neutral-600">
                  {availabilityFinderExactTimeOnly
                    ? availabilityFinderStartTime
                      ? `Filter mode: strict start-time match at ${availabilityFinderStartTime}.`
                      : 'Filter mode: strict start-time match is enabled. Set Time From to apply it.'
                    : availabilityFinderStartTime && availabilityFinderEndTime
                    ? `Filter mode: any open slot between ${availabilityFinderStartTime} and ${availabilityFinderEndTime}.`
                    : availabilityFinderStartTime
                    ? `Filter mode: providers available from ${availabilityFinderStartTime}.`
                    : 'Filter mode: providers with any open slots for the selected date.'}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => void searchAvailableProviders()}
                    disabled={isPending || availabilityFinderLoading}
                  >
                    {availabilityFinderLoading ? 'Searching…' : 'Search Available Providers'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAvailabilityFinderProviderType('all');
                      setAvailabilityFinderServiceType('');
                      setAvailabilityFinderPincode('');
                      setAvailabilityFinderDate(new Date().toISOString().slice(0, 10));
                      setAvailabilityFinderStartTime('');
                      setAvailabilityFinderEndTime('');
                      setAvailabilityFinderExactTimeOnly(false);
                      setAvailabilityFinderAutoOpenTopMatch(true);
                      setAvailabilityFinderServices([]);
                      setAvailabilityFinderSlots([]);
                      setAvailabilityFinderResults([]);
                      setAvailabilityFinderHasRun(false);
                    }}
                    disabled={availabilityFinderLoading}
                  >
                    Reset Finder
                  </Button>
                </div>

                {!availabilityFinderHasRun ? (
                  <p className="text-xs text-neutral-500">Run a search to view conflict-free provider matches.</p>
                ) : availabilityFinderLoading ? (
                  <p className="text-xs text-neutral-500">Finding best available providers…</p>
                ) : availabilityFinderResults.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    No providers are currently free for the selected criteria. Try widening date/time or service constraints.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-600">
                      Found <span className="font-semibold text-neutral-900">{availabilityFinderResults.length}</span> available providers
                      {availabilityFinderSlots.length > 0 ? (
                        <> across <span className="font-semibold text-neutral-900">{availabilityFinderSlots.length}</span> open slots</>
                      ) : null}
                      .
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {availabilityFinderServices.slice(0, 6).map((service) => (
                        <span
                          key={`finder-summary-${service.serviceType}`}
                          className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700"
                        >
                          {service.serviceType.replaceAll('_', ' ')} · {service.providerCount} providers
                        </span>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {availabilityFinderResults.slice(0, 12).map((provider) => (
                        <div key={`finder-provider-${provider.providerServiceId}`} className="rounded-xl bg-neutral-50/70 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">{provider.providerName}</p>
                              <p className="text-xs text-neutral-500">
                                {provider.providerType ?? 'provider'} · {provider.serviceType.replaceAll('_', ' ')}
                              </p>
                            </div>
                            {provider.recommended ? <Badge variant="success">Recommended</Badge> : null}
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-neutral-600">
                            <p>Open slots: {provider.availableSlotCount}</p>
                            <p>Starting price: {formatAdminCurrency(provider.basePrice)}</p>
                            <p>Duration: {provider.serviceDurationMinutes} mins</p>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCalendarProviderId(provider.providerId);
                                setCalendarFromDate(availabilityFinderDate);
                              }}
                            >
                              Open In Calendar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => focusProviderCard(provider.providerId)}
                            >
                              Open Profile
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">Selected Provider</label>
                  <select
                    value={calendarProviderId}
                    onChange={(event) => setCalendarProviderId(event.target.value ? Number(event.target.value) : '')}
                    className="input-field w-full"
                  >
                    <option value="">Select from searched providers</option>
                    {calendarSelectableProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">From Date</label>
                  <input
                    type="date"
                    value={calendarFromDate}
                    onChange={(event) => setCalendarFromDate(event.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">Range</label>
                  <select
                    value={calendarDays}
                    onChange={(event) => setCalendarDays((event.target.value === '14' ? 14 : 7) as 7 | 14)}
                    className="input-field w-full"
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                  </select>
                </div>
                <div className="space-y-2 lg:min-w-[11rem]">
                  <span className="block text-sm font-medium text-neutral-700 opacity-0" aria-hidden="true">
                    Refresh
                  </span>
                  <Button
                    onClick={() => void fetchProviderCalendar()}
                    disabled={isPending || isCalendarLoading}
                    className="w-full"
                  >
                    {isCalendarLoading ? 'Loading…' : 'Refresh Calendar'}
                  </Button>
                </div>
              </div>

              {!calendarProviderId ? (
                <p className="text-body text-neutral-500 text-center py-6">
                  Search providers above, then select one to load the schedule calendar.
                </p>
              ) : (isCalendarLoading && (!providerCalendar || isCalendarStale)) ? (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500 rounded-lg bg-neutral-50/70 px-3 py-2">
                    Loading schedule for {selectedCalendarProviderName ?? 'selected provider'}…
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: calendarSkeletonCardCount }, (_, index) => (
                      <div key={`calendar-skeleton-${index}`} className="rounded-xl bg-white/80 p-3 animate-pulse">
                        <div className="h-4 w-24 rounded bg-neutral-200/70" />
                        <div className="mt-2 h-3 w-12 rounded bg-neutral-200/60" />
                        <div className="mt-4 h-3 w-20 rounded bg-neutral-200/60" />
                        <div className="mt-2 space-y-1">
                          <div className="h-3 rounded bg-neutral-200/60" />
                          <div className="h-3 rounded bg-neutral-200/50" />
                        </div>
                        <div className="mt-4 h-3 w-16 rounded bg-neutral-200/60" />
                        <div className="mt-2 space-y-2">
                          <div className="h-8 rounded bg-neutral-200/55" />
                          <div className="h-8 rounded bg-neutral-200/45" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !providerCalendar ? (
                <p className="text-body text-neutral-500 text-center py-6">
                  {isCalendarLoading ? 'Loading provider calendar…' : 'Choose a provider to view schedule calendar.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {isCalendarLoading ? (
                    <p className="text-xs text-neutral-500 rounded-lg bg-neutral-50/70 px-3 py-2">
                      Refreshing schedule for {selectedCalendarProviderName ?? providerCalendar.provider.name}…
                    </p>
                  ) : null}
                  <p className="text-xs text-neutral-500 rounded-lg bg-neutral-50/70 px-3 py-2">
                    Showing {providerCalendar.provider.name} • {providerCalendar.fromDate} to {providerCalendar.toDate}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {providerCalendar.days.map((day) => (
                      <div key={day.date} className="rounded-xl bg-white/80 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{day.date}</p>
                            <p className="text-xs text-neutral-500">
                              {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                            </p>
                          </div>
                          <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                            {day.bookings.length} bookings
                          </span>
                        </div>

                        <div className="mt-3">
                          <p className="text-[11px] font-semibold text-neutral-700">Availability</p>
                          {day.availability.length === 0 ? (
                            <p className="mt-1 text-[11px] text-neutral-500">No slots</p>
                          ) : (
                            <ul className="mt-1 space-y-1">
                              {day.availability.map((slot) => (
                                <li key={slot.id} className="flex items-center justify-between text-[11px]">
                                  <span className="text-neutral-700">{slot.start_time} - {slot.end_time}</span>
                                  <span
                                    className={cn(
                                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                      slot.is_available
                                        ? 'border-green-300 bg-green-100 text-green-700'
                                        : 'border-neutral-300 bg-neutral-100 text-neutral-600',
                                    )}
                                  >
                                    {slot.is_available ? 'Open' : 'Closed'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="mt-3 border-t border-neutral-200/60 pt-2">
                          <p className="text-[11px] font-semibold text-neutral-700">Bookings</p>
                          {day.bookings.length === 0 ? (
                            <p className="mt-1 text-[11px] text-neutral-500">No bookings</p>
                          ) : (
                            <ul className="mt-1 space-y-2">
                              {day.bookings.map((booking) => (
                                <li key={booking.id} className="rounded-lg bg-neutral-50/70 p-2">
                                  <p className="text-[11px] font-medium text-neutral-800">#{booking.id}</p>
                                  <p className="text-[11px] text-neutral-600">
                                    {(booking.start_time ?? '—')} - {(booking.end_time ?? '—')} • {(booking.service_type ?? 'Service')}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <StatusBadge status={booking.status} />
                                    {booking.status === 'confirmed' && booking.completion_task_status === 'pending' ? (
                                      <Alert variant="warning" className="!p-1 !text-[10px]">Feedback Pending</Alert>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredProviders.length === 0 ? (
            <Card>
              <p className="text-body text-neutral-500 text-center py-8">
                {providerSearchQuery || providerTypeFilter !== 'all' || providerStatusFilter !== 'all'
                  ? 'No providers match your search criteria'
                  : 'No providers found'}
              </p>
            </Card>
          ) : (
            filteredProviders.map((provider) => {
              const isSoftDeletedProvider =
                provider.account_status === 'banned' &&
                provider.admin_approval_status === 'rejected' &&
                provider.verification_status === 'rejected';
              const serviceDraftRow = serviceDraft[provider.id] ?? {
                id: undefined,
                service_pincodes: '',
              };
              const providerAvailabilityRows = availabilityByProvider[provider.id] ?? [];
              const providerServicesRows = servicesByProvider[provider.id] ?? [];
              const isProviderExpanded = expandedProviderIds.includes(provider.id);
              const isProviderDetailsLoading = providerDetailsLoadingById[provider.id] ?? false;
              const isProviderDetailsLoaded = providerDetailsLoadedById[provider.id] ?? false;
              const isEditingLocation = Boolean(locationDraft[provider.id]);
              const locationDraftRow = locationDraft[provider.id] ?? {
                address: provider.address ?? '',
                city: provider.city ?? '',
                state: provider.state ?? '',
                pincode: provider.pincode ?? '',
                latitude: provider.latitude === null ? '' : String(provider.latitude),
                longitude: provider.longitude === null ? '' : String(provider.longitude),
                service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
              };
              const availabilityRowDraft = availabilityDraft[provider.id] ?? getDefaultAvailabilityDraft();
              const coveragePincodes = Array.from(
                new Set(
                  providerServicesRows.flatMap((service) => pincodesByService[service.id] ?? []),
                ),
              );
              const localCoverageWarnings: string[] = [];

              if (coveragePincodes.length > 0) {
                const clinicPincode = provider.pincode?.trim() ?? null;
                const serviceRadius = provider.service_radius_km;
                const nonClinicCoverageCount = clinicPincode
                  ? coveragePincodes.filter((item) => item !== clinicPincode).length
                  : coveragePincodes.length;

                if (!clinicPincode && serviceRadius === null) {
                  localCoverageWarnings.push('Service pincodes are configured, but clinic pincode and service radius are missing.');
                }

                if (clinicPincode && serviceRadius !== null && serviceRadius <= 0 && nonClinicCoverageCount > 0) {
                  localCoverageWarnings.push('Service radius is 0 km, but enabled service pincodes extend beyond clinic pincode.');
                }

                if (serviceRadius !== null && serviceRadius <= 2 && nonClinicCoverageCount >= 3) {
                  localCoverageWarnings.push('Service radius is very small for the current pincode rollout footprint.');
                }

                if (serviceRadius === null && coveragePincodes.length >= 10) {
                  localCoverageWarnings.push('Large pincode rollout is configured without a service radius baseline.');
                }
              }

              const effectiveCoverageWarnings =
                locationCoverageWarnings[provider.id] && locationCoverageWarnings[provider.id].length > 0
                  ? locationCoverageWarnings[provider.id]
                  : localCoverageWarnings;
              const providerServiceTypeOptions = Array.from(
                new Set(
                  [
                    ...availableServiceTypes,
                    ...providerServicesRows.map((service) => service.service_type),
                  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
                ),
              ).sort();
              const selectedServiceTypes = selectedServiceTypesByProvider[provider.id] ?? providerServicesRows.map((service) => service.service_type);
              const normalizedSelectedServiceTypes = new Set(
                selectedServiceTypes.map((value) => value.trim()).filter((value) => value.length > 0),
              );
              const invalidServiceRolloutPincodes = serviceDraftRow.service_pincodes
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
                .filter((value) => !/^[1-9]\d{5}$/.test(value));
              const isEditingProviderProfile = Boolean(providerProfileDraft[provider.id]);
              const providerProfileDraftRow = providerProfileDraft[provider.id] ?? {
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
                number_of_doctors:
                  provider.clinic_details?.number_of_doctors === null || provider.clinic_details?.number_of_doctors === undefined
                    ? ''
                    : String(provider.clinic_details.number_of_doctors),
                hospitalization_available: provider.clinic_details?.hospitalization_available ?? false,
                emergency_services_available: provider.clinic_details?.emergency_services_available ?? false,
              };
              const basicProfileFilledCount = [
                providerProfileDraftRow.name,
                providerProfileDraftRow.email,
                providerProfileDraftRow.provider_type,
                providerProfileDraftRow.business_name,
                providerProfileDraftRow.profile_photo_url,
                providerProfileDraftRow.service_radius_km,
              ].filter((value) => value.trim().length > 0).length;
              const professionalProfileFilledCount =
                [
                  providerProfileDraftRow.license_number,
                  providerProfileDraftRow.specialization,
                  providerProfileDraftRow.equipment_details,
                  providerProfileDraftRow.insurance_document_url,
                ].filter((value) => value.trim().length > 0).length +
                [providerProfileDraftRow.teleconsult_enabled, providerProfileDraftRow.emergency_service_enabled].filter(
                  (value) => typeof value === 'boolean',
                ).length;
              const clinicProfileFilledCount =
                [
                  providerProfileDraftRow.registration_number,
                  providerProfileDraftRow.gst_number,
                  providerProfileDraftRow.number_of_doctors,
                ].filter((value) => value.trim().length > 0).length +
                [providerProfileDraftRow.hospitalization_available, providerProfileDraftRow.emergency_services_available].filter(
                  (value) => typeof value === 'boolean',
                ).length;
              const lastAutoFixNote = locationLastAutoFixNote[provider.id] ?? null;

              return (
                <div
                  key={provider.id}
                  ref={(node) => {
                    providerCardRefs.current[provider.id] = node;
                  }}
                >
                <Card className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {provider.profile_photo_url ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-full border border-neutral-200/70 bg-neutral-100">
                          <StorageBackedImage
                            value={provider.profile_photo_url}
                            bucket="user-photos"
                            alt={provider.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200/70 bg-neutral-100 text-sm font-semibold text-neutral-600">
                          {(provider.name?.trim().charAt(0) || 'P').toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="font-semibold text-neutral-900">Provider #{provider.id} • {provider.name}</p>
                        <p className="text-sm text-neutral-600">
                          Type: <span className="font-medium capitalize">{provider.provider_type.replace(/_/g, ' ')}</span> •
                          {' '}Approval: <span className="font-medium capitalize">{provider.admin_approval_status}</span> •
                          {' '}Account:{' '}
                          <span
                            className={cn(
                              'font-medium capitalize',
                              provider.account_status === 'active' ? 'text-green-700' : 'text-red-700',
                            )}
                          >
                            {isSoftDeletedProvider ? 'deleted (history retained)' : provider.account_status}
                          </span>
                        </p>
                        {isSoftDeletedProvider ? (
                          <p className="text-xs font-medium text-red-700">
                            This provider cannot be hard-deleted because existing bookings reference this record.
                          </p>
                        ) : null}
                        <p className="text-xs text-neutral-500">
                          Documents → Pending: {provider.documentCounts.pending} | Approved: {provider.documentCounts.approved} | Rejected: {provider.documentCounts.rejected}
                        </p>
                        {(() => {
                          const m = providerMetrics.get(provider.id);
                          if (!m) return null;
                          return (
                            <div className="flex flex-wrap gap-3 text-xs mt-1">
                              <span className="text-neutral-600">Bookings: <span className="font-semibold text-neutral-900">{m.total_bookings}</span></span>
                              <span className="text-neutral-600">Completion: <span className="font-semibold text-green-700">{m.completion_rate}%</span></span>
                              <span className="text-neutral-600">Cancel: <span className="font-semibold text-red-600">{m.cancellation_rate}%</span></span>
                              {m.avg_rating != null ? <span className="text-neutral-600">Rating: <span className="font-semibold text-amber-600">★ {m.avg_rating}</span></span> : null}
                              <span className="text-neutral-600">Revenue: <span className="font-semibold text-neutral-900">₹{m.total_revenue_inr.toLocaleString('en-IN')}</span></span>
                            </div>
                          );
                        })()}
                        {isProviderDetailsLoaded && providerServicesRows.length > 0 && (
                          <p className="text-xs text-neutral-500">
                            Services:{' '}
                            <span className="font-medium text-green-700">
                              {providerServicesRows.filter(s => s.is_active).length} active
                            </span>
                            ,{' '}
                            <span className="font-medium text-red-700">
                              {providerServicesRows.filter(s => !s.is_active).length} inactive
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            copyProviderProfileIntoDraft(provider);
                            if (!isProviderExpanded) {
                              toggleProviderCard(provider.id);
                            }
                          }}
                          disabled={isPending}
                        >
                          Edit Provider
                        </Button>
                        <Button
                          size="sm"
                          variant={provider.account_status === 'active' ? 'danger' : 'secondary'}
                          onClick={() => moderateProvider(provider.id, provider.account_status === 'active' ? 'disable' : 'enable')}
                          disabled={isPending || isSoftDeletedProvider}
                          className={provider.account_status === 'active' ? '' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}
                          title={
                            isSoftDeletedProvider
                              ? 'Cannot enable: provider is retained only for historical bookings linked by foreign key.'
                              : undefined
                          }
                        >
                          {isSoftDeletedProvider ? 'Deleted' : provider.account_status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeProvider(provider.id)}
                          disabled={deletingProviderId === provider.id || isSoftDeletedProvider}
                          title={
                            isSoftDeletedProvider
                              ? 'Hard delete blocked: this provider is referenced by existing bookings (history retained).'
                              : undefined
                          }
                        >
                          {isSoftDeletedProvider ? 'Deleted' : deletingProviderId === provider.id ? 'Deleting…' : 'Delete'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleProviderCard(provider.id)}
                          disabled={isPending}
                        >
                          {isProviderExpanded ? 'Hide Details' : 'Load Details'}
                        </Button>
                      </div>
                      {providerServicesRows.length > 0 && (
                        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleProviderServices(provider.id, true)}
                            disabled={isPending || providerServicesRows.every(s => s.is_active)}
                            className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          >
                            Enable All Services
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleProviderServices(provider.id, false)}
                            disabled={isPending || providerServicesRows.every(s => !s.is_active)}
                            className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Disable All Services
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <AdminQuickActionRow
                    providerId={provider.id}
                    providerName={provider.name}
                    adminApprovalStatus={provider.admin_approval_status as 'pending' | 'approved' | 'rejected' | 'under_review'}
                    accountStatus={provider.account_status as 'active' | 'suspended' | 'banned'}
                    disabled={isPending}
                    onApprove={approveProvider}
                    onReject={rejectProvider}
                    onSuspend={(id) => moderateProvider(id, 'disable')}
                    onEnable={(id) => moderateProvider(id, 'enable')}
                  />

                  {isProviderExpanded ? (
                  <>
                  <div className="space-y-3 pt-4 border-t border-neutral-200/60">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="font-semibold text-neutral-900">Provider Profile</p>
                      {!isEditingProviderProfile ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyProviderProfileIntoDraft(provider)}
                          disabled={isPending}
                        >
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => saveProviderProfile(provider.id)}
                            disabled={isPending}
                          >
                            Save Profile
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelProviderProfileEdit(provider.id)}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditingProviderProfile ? (
                      <div className="space-y-4">
                        <details open className="rounded-lg bg-neutral-50/50 p-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
                            {`Basic Details (${basicProfileFilledCount}/6 filled)`}
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Input
                              label="Provider Name"
                              value={providerProfileDraftRow.name}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'name', event.target.value)}
                              placeholder="Provider name"
                            />
                            <Input
                              label="Email"
                              value={providerProfileDraftRow.email}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'email', event.target.value)}
                              placeholder="provider@email.com"
                            />
                            <Input
                              label="Provider Type"
                              value={providerProfileDraftRow.provider_type}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'provider_type', event.target.value)}
                              placeholder="clinic / groomer / custom_type"
                            />
                            <Input
                              label="Business Name"
                              value={providerProfileDraftRow.business_name}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'business_name', event.target.value)}
                              placeholder="Business name"
                            />
                            <Input
                              label="Service Radius (km)"
                              value={providerProfileDraftRow.service_radius_km}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'service_radius_km', event.target.value)}
                              placeholder="Optional"
                            />
                            <ImageUploadField
                              label="Provider Photo"
                              value={providerProfileDraftRow.profile_photo_url}
                              onChange={(url) => setProviderProfileDraftField(provider.id, 'profile_photo_url', url)}
                              bucket="user-photos"
                              placeholder="Upload provider photo"
                              disabled={isPending}
                            />
                          </div>
                        </details>

                        <details open className="rounded-lg bg-neutral-50/50 p-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
                            {`Professional Details (${professionalProfileFilledCount}/6 filled)`}
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Input
                              label="License Number"
                              value={providerProfileDraftRow.license_number}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'license_number', event.target.value)}
                              placeholder="License number"
                            />
                            <Input
                              label="Specialization"
                              value={providerProfileDraftRow.specialization}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'specialization', event.target.value)}
                              placeholder="Specialization"
                            />
                            <Input
                              label="Equipment Details"
                              value={providerProfileDraftRow.equipment_details}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'equipment_details', event.target.value)}
                              placeholder="Optional"
                            />
                            <Input
                              label="Insurance Document URL"
                              value={providerProfileDraftRow.insurance_document_url}
                              onChange={(event) =>
                                setProviderProfileDraftField(provider.id, 'insurance_document_url', event.target.value)
                              }
                              placeholder="https://..."
                            />
                            <label className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-1">
                              <input
                                type="checkbox"
                                checked={providerProfileDraftRow.teleconsult_enabled}
                                onChange={(event) =>
                                  setProviderProfileDraftField(provider.id, 'teleconsult_enabled', event.target.checked)
                                }
                                className="h-4 w-4 rounded border-neutral-300"
                              />
                              Teleconsult enabled
                            </label>
                            <label className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-1">
                              <input
                                type="checkbox"
                                checked={providerProfileDraftRow.emergency_service_enabled}
                                onChange={(event) =>
                                  setProviderProfileDraftField(provider.id, 'emergency_service_enabled', event.target.checked)
                                }
                                className="h-4 w-4 rounded border-neutral-300"
                              />
                              Emergency service enabled
                            </label>
                          </div>
                        </details>

                        <details className="rounded-lg bg-neutral-50/50 p-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
                            {`Clinic Details (${clinicProfileFilledCount}/5 filled)`}
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Input
                              label="Registration Number"
                              value={providerProfileDraftRow.registration_number}
                              onChange={(event) =>
                                setProviderProfileDraftField(provider.id, 'registration_number', event.target.value)
                              }
                              placeholder="Registration number"
                            />
                            <Input
                              label="GST Number"
                              value={providerProfileDraftRow.gst_number}
                              onChange={(event) => setProviderProfileDraftField(provider.id, 'gst_number', event.target.value)}
                              placeholder="GST number"
                            />
                            <Input
                              label="Number of Doctors"
                              value={providerProfileDraftRow.number_of_doctors}
                              onChange={(event) =>
                                setProviderProfileDraftField(provider.id, 'number_of_doctors', event.target.value)
                              }
                              placeholder="Optional"
                            />
                            <div />
                            <label className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-1">
                              <input
                                type="checkbox"
                                checked={providerProfileDraftRow.hospitalization_available}
                                onChange={(event) =>
                                  setProviderProfileDraftField(provider.id, 'hospitalization_available', event.target.checked)
                                }
                                className="h-4 w-4 rounded border-neutral-300"
                              />
                              Hospitalization available
                            </label>
                            <label className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-1">
                              <input
                                type="checkbox"
                                checked={providerProfileDraftRow.emergency_services_available}
                                onChange={(event) =>
                                  setProviderProfileDraftField(provider.id, 'emergency_services_available', event.target.checked)
                                }
                                className="h-4 w-4 rounded border-neutral-300"
                              />
                              Emergency services available
                            </label>
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-neutral-600">
                        <p>
                          Email: <span className="font-medium">{provider.email || 'Not set'}</span>
                        </p>
                        <p>
                          Business: <span className="font-medium">{provider.business_name || 'Not set'}</span>
                        </p>
                        <p>
                          License: <span className="font-medium">{provider.professional_details?.license_number || 'Not set'}</span>
                        </p>
                        <p>
                          Clinic Reg/GST:{' '}
                          <span className="font-medium">
                            {provider.clinic_details?.registration_number || '—'} / {provider.clinic_details?.gst_number || '—'}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-200/60">
                    {isProviderDetailsLoading ? (
                      <div className="rounded-lg bg-neutral-50/80 p-3 text-sm text-neutral-600">
                        Loading provider details…
                      </div>
                    ) : null}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="font-semibold text-neutral-900">Location Moderation</p>
                      {!isEditingLocation ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLocationIntoDraft(provider)}
                          disabled={isPending}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelLocationEdit(provider.id)}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-neutral-600">
                      <p>
                        Current: <span className="font-medium">{[provider.address, provider.city, provider.state, provider.pincode].filter(Boolean).join(', ') || 'Not set'}</span>
                      </p>
                      <p>
                        Coordinates: <span className="font-medium">{provider.latitude ?? '—'}, {provider.longitude ?? '—'}</span> •
                        Radius: <span className="font-medium">{provider.service_radius_km ?? '—'} km</span>
                      </p>
                    </div>

                    {effectiveCoverageWarnings.length > 0 ? (
                      <Alert variant="warning" className="space-y-3">
                        {effectiveCoverageWarnings.map((warning, warningIndex) => (
                          <div key={`${provider.id}:${warningIndex}:${warning}`} className="border-t border-neutral-300/60 pt-2 last:border-t-0 last:pt-0">
                            <p className="text-sm">⚠ {warning}</p>
                            <p className="text-xs text-neutral-800 mt-1">→ {locationWarningSuggestion(warning)}</p>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => applyLocationWarningSuggestion(provider, warning, coveragePincodes)}
                              disabled={isPending}
                              className="mt-2"
                            >
                              {locationWarningActionLabel(warning)}
                            </Button>
                          </div>
                        ))}
                      </Alert>
                    ) : null}

                    {lastAutoFixNote ? (
                      <div className="rounded-lg bg-neutral-50/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-neutral-700">{lastAutoFixNote}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissLocationAutoFixNote(provider.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {isEditingLocation ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            value={locationDraftRow.address}
                            onChange={(event) => setLocationDraftField(provider.id, 'address', event.target.value)}
                            placeholder="Address"
                            label="Address"
                            className="sm:col-span-2"
                          />
                          <Input
                            value={locationDraftRow.city}
                            onChange={(event) => setLocationDraftField(provider.id, 'city', event.target.value)}
                            placeholder="City"
                            label="City"
                          />
                          <Input
                            value={locationDraftRow.state}
                            onChange={(event) => setLocationDraftField(provider.id, 'state', event.target.value)}
                            placeholder="State"
                            label="State"
                          />
                          <Input
                            value={locationDraftRow.pincode}
                            onChange={(event) => setLocationDraftField(provider.id, 'pincode', event.target.value)}
                            placeholder="Pincode"
                            label="Pincode"
                            inputMode="numeric"
                            maxLength={6}
                            error={
                              locationDraftRow.pincode.length > 0 && locationDraftRow.pincode.length !== 6
                                ? 'Enter a valid 6-digit pincode.'
                                : undefined
                            }
                          />
                          <Input
                            value={locationDraftRow.service_radius_km}
                            onChange={(event) => setLocationDraftField(provider.id, 'service_radius_km', event.target.value)}
                            placeholder="Service radius (km)"
                            label="Service Radius (km)"
                          />
                          <Input
                            value={locationDraftRow.latitude}
                            onChange={(event) => setLocationDraftField(provider.id, 'latitude', event.target.value)}
                            placeholder="Latitude"
                            label="Latitude"
                          />
                          <Input
                            value={locationDraftRow.longitude}
                            onChange={(event) => setLocationDraftField(provider.id, 'longitude', event.target.value)}
                            placeholder="Longitude"
                            label="Longitude"
                          />
                        </div>

                        <Button
                          onClick={() => saveProviderLocation(provider.id)}
                          disabled={isPending}
                        >
                          Save Location
                        </Button>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-xl bg-neutral-50/60 p-3">
                    <p className="text-xs font-semibold text-neutral-950">Availability Control</p>
                    {providerAvailabilityRows.length === 0 ? (
                      <p className="mt-2 text-xs text-neutral-600">No availability windows configured yet.</p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {providerAvailabilityRows.map((slot) => (
                          <li key={slot.id} className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                            <span>
                              {weekdayLabel(slot.day_of_week)} • {slot.start_time} - {slot.end_time}
                            </span>
                            <label
                              className={cn(
                                'inline-flex items-center gap-1 font-medium',
                                slot.is_available ? 'text-green-700' : 'text-red-700',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={slot.is_available}
                                onChange={(event) => toggleAvailabilitySlot(provider.id, slot.id, event.target.checked)}
                              />
                              {slot.is_available ? 'Enabled' : 'Disabled'}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 space-y-2">
                      <label className="text-sm font-medium text-neutral-700 block">Weekdays</label>
                      <div className="grid gap-2 sm:grid-cols-4">
                        {WEEKDAY_OPTIONS.map((option) => (
                          <label key={option.value} className="inline-flex items-center gap-2 rounded-md border border-neutral-200/60 bg-neutral-50/60 px-2 py-1 text-xs text-neutral-700">
                            <input
                              type="checkbox"
                              checked={availabilityRowDraft.selected_days.includes(option.value)}
                              onChange={(event) => toggleAvailabilityDraftWeekday(provider.id, option.value, event.target.checked)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Input
                        label="Start Time"
                        value={availabilityRowDraft.start_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'start_time', event.target.value)}
                        placeholder="Start (HH:MM)"
                      />
                      <Input
                        label="End Time"
                        value={availabilityRowDraft.end_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'end_time', event.target.value)}
                        placeholder="End (HH:MM)"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => appendAvailabilitySlot(provider.id)}
                      disabled={isPending}
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                    >
                      Add Availability Slot
                    </Button>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">Service & Pincode Rollout</p>
                        <p className="mt-1 text-xs text-neutral-600">Configure pricing, coverage, and rollout per service for this provider.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          Total: {providerServicesRows.length}
                        </span>
                        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                          Active: {providerServicesRows.filter((item) => item.is_active).length}
                        </span>
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Disabled: {providerServicesRows.filter((item) => !item.is_active).length}
                        </span>
                      </div>
                    </div>

                    {providerServicesRows.length === 0 ? (
                      <div className="mt-3 rounded-lg bg-neutral-50/70 p-3">
                        <p className="text-xs text-neutral-600">No services configured yet. Use the form below to add the first service.</p>
                      </div>
                    ) : (
                      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                        {providerServicesRows.map((service) => (
                          <li key={service.id} className="rounded-lg bg-neutral-50/60 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-neutral-950">{service.service_type}</p>
                                <p className="mt-1 text-xs text-neutral-600">
                                  Base ₹{service.base_price}
                                  {service.surge_price !== null ? ` • Surge ₹${service.surge_price}` : ''}
                                  {service.commission_percentage !== null ? ` • Commission ${service.commission_percentage}%` : ''}
                                </p>
                                <p className="text-xs text-neutral-600">
                                  Duration: {service.service_duration_minutes ?? '—'} mins
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                    service.is_active
                                      ? 'border-green-300 bg-green-100 text-green-700'
                                      : 'border-red-300 bg-red-100 text-red-700',
                                  )}
                                >
                                  {service.is_active ? 'Active' : 'Disabled'}
                                </span>
                                <Button
                                  type="button"
                                  onClick={() => copyServiceIntoDraft(provider.id, service.id)}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => setProviderServiceActivation(provider.id, service.id, !service.is_active)}
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    service.is_active
                                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
                                  )}
                                >
                                  {service.is_active ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() =>
                                    setDeleteServiceDialog({
                                      providerId: provider.id,
                                      providerName: provider.name,
                                      serviceId: service.id,
                                      serviceType: service.service_type,
                                      mappedPincodeCount: (pincodesByService[service.id] ?? []).length,
                                    })
                                  }
                                  variant="ghost"
                                  size="sm"
                                  className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 rounded-md bg-white/80 px-2 py-1.5">
                              <p className="text-[11px] text-neutral-600">
                                Pincodes: {(pincodesByService[service.id] ?? []).join(', ') || 'Not mapped'}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 rounded-lg bg-neutral-100/70 p-3">
                      <p className="text-xs font-semibold text-neutral-900">Add / Update Service Rollout</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-neutral-600">Tick services to rollout for this provider.</p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllProviderServiceSelections(provider.id, providerServiceTypeOptions, true)}
                              disabled={isPending || providerServiceTypeOptions.length === 0}
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllProviderServiceSelections(provider.id, providerServiceTypeOptions, false)}
                              disabled={isPending || providerServiceTypeOptions.length === 0}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {providerServiceTypeOptions.length === 0 ? (
                            <p className="text-xs text-neutral-500">No services available.</p>
                          ) : (
                            providerServiceTypeOptions.map((serviceType) => (
                              <label
                                key={serviceType}
                                className="inline-flex items-center gap-2 rounded-md bg-white/80 px-2 py-1.5 text-xs text-neutral-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={normalizedSelectedServiceTypes.has(serviceType)}
                                  onChange={(event) =>
                                    toggleProviderServiceSelection(
                                      provider.id,
                                      serviceType,
                                      event.target.checked,
                                      providerServiceTypeOptions,
                                      providerServicesRows,
                                    )
                                  }
                                />
                                {serviceType}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-neutral-700 mb-2">Selected Services</p>
                          <p className="rounded-md bg-white/80 px-3 py-2 text-xs text-neutral-600">
                            {normalizedSelectedServiceTypes.size} selected
                          </p>
                        </div>
                      </div>
                      <Input
                        label="Service Pincodes"
                        value={serviceDraftRow.service_pincodes}
                        onChange={(event) => setServiceDraftField(provider.id, 'service_pincodes', event.target.value)}
                        placeholder="Optional, applies to selected services"
                        error={
                          invalidServiceRolloutPincodes.length > 0
                            ? 'Use comma-separated 6-digit pincodes only.'
                            : undefined
                        }
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-neutral-600">This section only enables selected services and applies coverage pincodes. Pricing and commission are managed in Services and Provider setup.</p>
                        <Button
                          type="button"
                          onClick={() => submitServiceRollout(provider.id, providerServiceTypeOptions, providerServicesRows)}
                          disabled={isPending}
                          variant="secondary"
                          size="sm"
                        >
                          Apply Selected Services
                        </Button>
                      </div>
                    </div>
                  </div>
                  </>
                  ) : null}
                </Card>
                </div>
              );
            })
          )}
        </div>
      </section>

      <ProviderOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onSuccess={handleOnboardingSuccess}
      />

      <Modal
        isOpen={Boolean(deleteServiceDialog)}
        onClose={() => {
          if (isPending) {
            return;
          }
          setDeleteServiceDialog(null);
        }}
        size="md"
        title="Delete Service Rollout"
        description="This will remove the service rollout and mapped pincodes for this provider."
      >
        <div className="space-y-4">
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {deleteServiceDialog
              ? `Are you sure you want to delete ${deleteServiceDialog.serviceType} for ${deleteServiceDialog.providerName}?`
              : 'Are you sure you want to delete this service rollout?'}
          </p>
          {deleteServiceDialog ? (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              Mapped pincodes: {deleteServiceDialog.mappedPincodeCount}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteServiceDialog(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isPending || !deleteServiceDialog}
              onClick={() => {
                if (!deleteServiceDialog) {
                  return;
                }

                deleteProviderServiceRollout(deleteServiceDialog.providerId, deleteServiceDialog.serviceId);
                setDeleteServiceDialog(null);
              }}
            >
              Delete Service
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
