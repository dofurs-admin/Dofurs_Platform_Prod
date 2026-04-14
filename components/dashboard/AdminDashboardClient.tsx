'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import InvoicePDFPreview from '@/components/ui/InvoicePDFPreview';
import type {
  AdminProviderModerationItem,
  AdminServiceModerationSummaryItem,
  PlatformDiscount,
  PlatformDiscountAnalyticsSummary,
} from '@/lib/provider-management/types';
import type {
  ServiceProviderApplication,
  ServiceProviderApplicationStatus,
} from '@/lib/provider-applications/types';
import type { ServiceCategory, Service } from '@/lib/service-catalog/types';
import Modal from '@/components/ui/Modal';
import ConfirmActionModal from '@/components/ui/ConfirmActionModal';
import { useAdminBookingRealtime, useAdminProviderApprovalRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';
import AdminOverviewView from '@/components/dashboard/admin/views/AdminOverviewView';
import AdminAccessView from '@/components/dashboard/admin/views/AdminAccessView';
import AdminHealthView from '@/components/dashboard/admin/views/AdminHealthView';
import AdminPaymentsView from '@/components/dashboard/admin/views/AdminPaymentsView';
import AdminSubscriptionsView from '@/components/dashboard/admin/views/AdminSubscriptionsView';
import AdminServicesView from '@/components/dashboard/admin/views/AdminServicesView';
import AdminUsersView from '@/components/dashboard/admin/views/AdminUsersView';
import AdminBookingsView from '@/components/dashboard/admin/views/AdminBookingsView';
import AdminBillingView from '@/components/dashboard/admin/views/AdminBillingView';
import AdminProvidersView from '@/components/dashboard/admin/views/AdminProvidersView';
import AdminAuditView from '@/components/dashboard/admin/views/AdminAuditView';
import AdminSubscriptionPlansClient from '@/components/dashboard/admin/AdminSubscriptionPlansClient';

// Premium Components
import DashboardPageLayout from './premium/DashboardPageLayout';
import StatCard from './premium/StatCard';

// UI Components
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/design-system';

type AdminBooking = {
  id: number;
  user_id?: string;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
  payment_mode?: string | null;
  cash_collected?: boolean;
  completion_task_status?: 'pending' | 'completed' | null;
  completion_due_at?: string | null;
  completion_completed_at?: string | null;
};

type Provider = {
  id: number;
  name: string;
};

const ADMIN_BOOKING_ALLOWED_TRANSITIONS: Record<AdminBooking['status'], ReadonlyArray<AdminBooking['status']>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

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

type AdminServicePincode = {
  provider_service_id: string;
  pincode: string;
  is_enabled: boolean;
};

type ServiceRolloutDraft = {
  id?: string;
  service_pincodes: string;
};

type GlobalServiceRolloutDraft = {
  service_type: string;
  base_price: string;
  surge_price: string;
  commission_percentage: string;
  service_duration_minutes: string;
  is_active: boolean;
  service_pincodes: string;
  provider_types: string[];
  overwrite_existing: boolean;
};

type DiscountDraft = {
  id?: string;
  code: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'flat';
  discount_value: string;
  max_discount_amount: string;
  min_booking_amount: string;
  applies_to_service_type: string;
  valid_from: string;
  valid_until: string;
  usage_limit_total: string;
  usage_limit_per_user: string;
  first_booking_only: boolean;
  is_active: boolean;
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

type AdminDashboardView =
  | 'overview'
  | 'bookings'
  | 'users'
  | 'providers'
  | 'services'
  | 'access'
  | 'health'
  | 'payments'
  | 'subscriptions'
  | 'billing'
  | 'billing_catalog'
  | 'audit';

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
};

type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  auto_renew?: boolean;
  subscription_plans?: { name?: string | null; code?: string | null } | null;
};

type AdminBillingInvoice = {
  id: string;
  user_id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  total_inr: number;
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

type InvoicePreset = {
  id: 'service_visit' | 'subscription_renewal' | 'credit_adjustment';
  label: string;
  description: string;
  defaults: Pick<AdminManualInvoiceDraft, 'invoiceType' | 'status' | 'description' | 'discountInr' | 'taxInr'>;
};

type AdminFinancePayload<T> = {
  error?: string;
} & T;

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

type BillingReminderRunsHistory = {
  generated_at: string;
  limit: number;
  runs: BillingReminderAutomationRun[];
};
type ServiceCatalogPanel = 'types' | 'services';

function parseServiceCatalogPanel(value: string | null): ServiceCatalogPanel {
  if (value === 'services') {
    return value;
  }

  return 'types';
}

type AdminUserSearchPet = {
  id: string;
  name: string;
  breed: string | null;
  age: number | null;
  gender: string | null;
  color: string | null;
  size_category: string | null;
  energy_level: string | null;
  created_at: string;
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
  pets: AdminUserSearchPet[];
};

type AdminUserCreateDraft = {
  name: string;
  email: string;
  phone: string;
  noEmailInvite: boolean;
};

type SchemaSyncCheck = {
  key: string;
  ok: boolean;
  expected: boolean;
  actual: boolean;
};

type SchemaSyncHealthResponse = {
  healthy: boolean;
  domain: 'schema-contract';
  checks: SchemaSyncCheck[];
  failed_checks: SchemaSyncCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  generated_at: string;
  error?: string;
};

type FunctionalHealthCheck = {
  key: string;
  label: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  durationMs: number | null;
  lastRunAt: string | null;
  error: string | null;
};



const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const ADMIN_CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});


function isTimeInWindow(time: string, start: string, end: string) {
  return time >= start && time < end;
}

function getDefaultAvailabilityDraft() {
  return {
    selected_days: [1],
    start_time: '09:00',
    end_time: '17:00',
  };
}


function formatAdminCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not available';
  }

  return ADMIN_CURRENCY_FORMATTER.format(value);
}

function formatAdminDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return ADMIN_DATE_TIME_FORMATTER.format(date);
}



function groupAvailabilityByProvider(rows: AdminProviderAvailability[]) {
  return rows.reduce<Record<number, AdminProviderAvailability[]>>((accumulator, row) => {
    const current = accumulator[row.provider_id] ?? [];
    current.push(row);
    accumulator[row.provider_id] = current;
    return accumulator;
  }, {});
}

function groupServicesByProvider(rows: AdminProviderService[]) {
  return rows.reduce<Record<number, AdminProviderService[]>>((accumulator, row) => {
    const current = accumulator[row.provider_id] ?? [];
    current.push(row);
    accumulator[row.provider_id] = current;
    return accumulator;
  }, {});
}

function groupPincodesByService(rows: AdminServicePincode[]) {
  return rows.reduce<Record<string, string[]>>((accumulator, row) => {
    if (!row.is_enabled) {
      return accumulator;
    }

    const current = accumulator[row.provider_service_id] ?? [];
    current.push(row.pincode);
    accumulator[row.provider_service_id] = current;
    return accumulator;
  }, {});
}


const adminRawFieldClass =
  'rounded-xl border border-neutral-200/60 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1';

const adminToggleFieldClass =
  'inline-flex items-center gap-2 rounded-xl border border-neutral-200/60 px-3 py-2 text-xs';

function applyLocationWarningToDraft(draft: LocationDraft, warningText: string, coveragePincodes: string[]) {
  const normalized = warningText.toLowerCase();
  const next = { ...draft };
  const firstCoveragePincode = coveragePincodes[0] ?? '';

  if (normalized.includes('pincode and service radius are both missing') || normalized.includes('pincode and service radius are missing')) {
    if (!next.pincode.trim() && firstCoveragePincode) {
      next.pincode = firstCoveragePincode;
    }

    if (!next.service_radius_km.trim()) {
      next.service_radius_km = '3';
    }
  }

  if (normalized.includes('radius is 0 km')) {
    next.service_radius_km = '3';
  }

  if (normalized.includes('very small for the current pincode rollout footprint')) {
    const currentRadius = next.service_radius_km.trim() ? Number(next.service_radius_km) : 0;
    next.service_radius_km = String(Number.isFinite(currentRadius) ? Math.max(currentRadius, 5) : 5);
  }

  if (normalized.includes('without a service radius baseline')) {
    if (!next.service_radius_km.trim()) {
      next.service_radius_km = '5';
    }
  }

  return next;
}

function buildLocationChangeSummary(before: LocationDraft, after: LocationDraft) {
  const trackedFields: Array<keyof LocationDraft> = [
    'address',
    'city',
    'state',
    'pincode',
    'latitude',
    'longitude',
    'service_radius_km',
  ];
  const changedFields = trackedFields.filter((field) => before[field] !== after[field]);

  let summary = changedFields
    .slice(0, 3)
    .map((field) => `${field}: "${before[field] || '—'}" → "${after[field] || '—'}"`)
    .join(' | ');

  if (changedFields.length > 3) {
    summary = `${summary} | +${changedFields.length - 3} more`;
  }

  return summary;
}



export default function AdminDashboardClient({
  canManageUserAccess = true,
  view = 'overview',
  initialBookings,
  providers,
  moderationProviders,
  initialProviderApplications,
  initialAvailability,
  initialServices,
  initialServicePincodes,
  initialServiceSummary,
  initialDiscounts,
  initialDiscountAnalytics,
  initialServiceCategories = [],
  initialCatalogServices = [],
}: {
  canManageUserAccess?: boolean;
  view?: AdminDashboardView;
  initialBookings: AdminBooking[];
  providers: Provider[];
  moderationProviders: AdminProviderModerationItem[];
  initialProviderApplications: ServiceProviderApplication[];
  initialAvailability: AdminProviderAvailability[];
  initialServices: AdminProviderService[];
  initialServicePincodes: AdminServicePincode[];
  initialServiceSummary: AdminServiceModerationSummaryItem[];
  initialDiscounts: PlatformDiscount[];
  initialDiscountAnalytics: PlatformDiscountAnalyticsSummary;
  initialServiceCategories?: ServiceCategory[];
  initialCatalogServices?: Service[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const providerFallbackRows: AdminProviderModerationItem[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    email: null,
    profile_photo_url: null,
    provider_type: 'clinic',
    business_name: provider.name,
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
    documentCounts: {
      pending: 0,
      approved: 0,
      rejected: 0,
    },
    professional_details: null,
    clinic_details: null,
  }));

  const [bookings, setBookings] = useState(initialBookings);
  const [providerRows, setProviderRows] = useState(
    moderationProviders.length > 0 ? moderationProviders : providerFallbackRows,
  );
  const [deletingProviderId, setDeletingProviderId] = useState<number | null>(null);

  // Confirm-action modal — single shared instance for all destructive confirmations
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: 'danger' | 'warning' | 'default';
    inputLabel?: string;
    inputPlaceholder?: string;
    inputDefaultValue?: string;
    inputRequired?: boolean;
    requiredInputValue?: string;
    onConfirm: (inputValue?: string) => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });

  function openConfirm(config: Omit<typeof confirmConfig, 'isOpen'>) {
    setConfirmConfig({ ...config, isOpen: true });
  }

  function closeConfirm() {
    setConfirmConfig((c) => ({ ...c, isOpen: false }));
  }
  const { performUpdate: performProviderUpdate } = useOptimisticUpdate(providerRows, setProviderRows);
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<number, AdminProviderAvailability[]>>(
    () => groupAvailabilityByProvider(initialAvailability),
  );
  const [servicesByProvider, setServicesByProvider] = useState<Record<number, AdminProviderService[]>>(() =>
    groupServicesByProvider(initialServices),
  );
  const [pincodesByService, setPincodesByService] = useState<Record<string, string[]>>(() =>
    groupPincodesByService(initialServicePincodes),
  );
  const [expandedProviderIds, setExpandedProviderIds] = useState<number[]>([]);
  const [providerDetailsLoadingById, setProviderDetailsLoadingById] = useState<Record<number, boolean>>({});
  const [providerDetailsLoadedById, setProviderDetailsLoadedById] = useState<Record<number, boolean>>(() => {
    const preloadedServiceProviderIds = new Set(initialServices.map((row) => row.provider_id));
    const preloadedAvailabilityProviderIds = new Set(initialAvailability.map((row) => row.provider_id));
    const merged = new Set<number>([...preloadedServiceProviderIds, ...preloadedAvailabilityProviderIds]);

    return Array.from(merged).reduce<Record<number, boolean>>((accumulator, providerId) => {
      accumulator[providerId] = true;
      return accumulator;
    }, {});
  });
  const [bookingFilter, setBookingFilter] = useState<'all' | 'sla' | 'high-risk'>('all');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingSearchDebounced, setBookingSearchDebounced] = useState('');
  const [providerApplications, setProviderApplications] = useState<ServiceProviderApplication[]>(initialProviderApplications);
  const [providerApplicationStatusFilter, setProviderApplicationStatusFilter] = useState<
    'all' | ServiceProviderApplicationStatus
  >('pending');
  const [providerApplicationNotesDraft, setProviderApplicationNotesDraft] = useState<Record<string, string>>({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<AdminUserSearchResult[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserDraft, setCreateUserDraft] = useState<AdminUserCreateDraft>({
    name: '',
    email: '',
    phone: '',
    noEmailInvite: false,
  });
  const [calendarProviderId, setCalendarProviderId] = useState<number | ''>('');
  const [calendarFromDate, setCalendarFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [calendarDays, setCalendarDays] = useState<7 | 14>(7);
  const [providerCalendar, setProviderCalendar] = useState<AdminProviderCalendarResponse | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'confirmed' | 'completed' | 'cancelled' | 'no_show'>('confirmed');
  const [promoteEmail, setPromoteEmail] = useState('');
  const [serviceDraft, setServiceDraft] = useState<Record<number, ServiceRolloutDraft>>({});
  const [selectedServiceTypesByProvider, setSelectedServiceTypesByProvider] = useState<Record<number, string[]>>({});
  const [serviceSummary, setServiceSummary] = useState(initialServiceSummary);
  const [globalServiceDraft, setGlobalServiceDraft] = useState<GlobalServiceRolloutDraft>({
    service_type: '',
    base_price: '0',
    surge_price: '',
    commission_percentage: '',
    service_duration_minutes: '60',
    is_active: true,
    service_pincodes: '',
    provider_types: [],
    overwrite_existing: false,
  });
  const [discounts, setDiscounts] = useState<PlatformDiscount[]>(initialDiscounts);
  const [discountAnalytics, setDiscountAnalytics] = useState<PlatformDiscountAnalyticsSummary>(initialDiscountAnalytics);
  const [showRolloutConfiguration, setShowRolloutConfiguration] = useState(false);
  const [showDiscountEditor, setShowDiscountEditor] = useState(false);
  const [locationDraft, setLocationDraft] = useState<Record<number, LocationDraft>>({});
  const [providerProfileDraft, setProviderProfileDraft] = useState<Record<number, ProviderProfileDraft>>({});
  const [locationCoverageWarnings, setLocationCoverageWarnings] = useState<Record<number, string[]>>({});
  const [locationLastAutoFixNote, setLocationLastAutoFixNote] = useState<Record<number, string>>({});
  const [discountDraft, setDiscountDraft] = useState<DiscountDraft>({
    code: '',
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_discount_amount: '',
    min_booking_amount: '',
    applies_to_service_type: '',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: '',
    usage_limit_total: '',
    usage_limit_per_user: '',
    first_booking_only: false,
    is_active: true,
  });
  const [availabilityDraft, setAvailabilityDraft] = useState<Record<number, { selected_days: number[]; start_time: string; end_time: string }>>({});
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [providerTypeFilter, setProviderTypeFilter] = useState<'all' | 'clinic' | 'home_visit'>('all');
  const [providerStatusFilter, setProviderStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('all');
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
  const [serviceCatalogPanel, setServiceCatalogPanel] = useState<ServiceCatalogPanel>(
    parseServiceCatalogPanel(searchParams.get('catalog')),
  );
  const [schemaSyncHealth, setSchemaSyncHealth] = useState<SchemaSyncHealthResponse | null>(null);
  const [schemaSyncDurationMs, setSchemaSyncDurationMs] = useState<number | null>(null);
  const [isSchemaSyncChecking, setIsSchemaSyncChecking] = useState(false);
  const [hasAutoRunSchemaHealth, setHasAutoRunSchemaHealth] = useState(false);
  const [functionalHealthChecks, setFunctionalHealthChecks] = useState<FunctionalHealthCheck[]>([
    {
      key: 'admin.providers.read',
      label: 'Providers API',
      endpoint: '/api/admin/providers',
      status: 'unknown',
      durationMs: null,
      lastRunAt: null,
      error: null,
    },
    {
      key: 'admin.bookings.read',
      label: 'Bookings API',
      endpoint: '/api/admin/bookings',
      status: 'unknown',
      durationMs: null,
      lastRunAt: null,
      error: null,
    },
    {
      key: 'admin.services.read',
      label: 'Services API',
      endpoint: '/api/admin/services',
      status: 'unknown',
      durationMs: null,
      lastRunAt: null,
      error: null,
    },
  ]);
  const [isFunctionalHealthChecking, setIsFunctionalHealthChecking] = useState(false);
  const [bookingModerationActivity, setBookingModerationActivity] = useState<string | null>(null);
  const ADMIN_PAGE_SIZE = 30;
  const [paymentTransactions, setPaymentTransactions] = useState<AdminPaymentTransaction[]>([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [billingInvoices, setBillingInvoices] = useState<AdminBillingInvoice[]>([]);
  const [billingInvoicePage, setBillingInvoicePage] = useState(1);
  const [billingInvoiceTotal, setBillingInvoiceTotal] = useState(0);
  const [billingStatusFilter, setBillingStatusFilter] = useState<'all' | BillingInvoiceUpdateStatus>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<'all' | 'service' | 'subscription'>('all');
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [billingSearchDebounced, setBillingSearchDebounced] = useState('');
  const [billingFromDate, setBillingFromDate] = useState('');
  const [billingToDate, setBillingToDate] = useState('');
  const [selectedBillingInvoiceIds, setSelectedBillingInvoiceIds] = useState<string[]>([]);
  const [billingBulkStatus, setBillingBulkStatus] = useState<BillingInvoiceUpdateStatus>('issued');
  const [isApplyingBillingBulkStatus, setIsApplyingBillingBulkStatus] = useState(false);
  const [billingReconciliation, setBillingReconciliation] = useState<BillingReconciliationSummary | null>(null);
  const [isBillingReconciliationLoading, setIsBillingReconciliationLoading] = useState(false);
  const [billingReconciliationCandidates, setBillingReconciliationCandidates] =
    useState<BillingReconciliationCandidates | null>(null);
  const [isBillingReconciliationCandidatesLoading, setIsBillingReconciliationCandidatesLoading] = useState(false);
  const [billingBulkAutoMatchConfidence, setBillingBulkAutoMatchConfidence] = useState(75);
  const [isRunningBillingBulkAutoMatch, setIsRunningBillingBulkAutoMatch] = useState(false);
  const [billingReminderQueue, setBillingReminderQueue] = useState<BillingReminderQueue | null>(null);
  const [isBillingReminderLoading, setIsBillingReminderLoading] = useState(false);
  const [billingReminderScheduleStatus, setBillingReminderScheduleStatus] =
    useState<BillingReminderScheduleStatus | null>(null);
  const [billingReminderRunsHistory, setBillingReminderRunsHistory] = useState<BillingReminderRunsHistory | null>(null);
  const [billingRunsStatusFilter, setBillingRunsStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [billingRunsSourceFilter, setBillingRunsSourceFilter] = useState<'all' | 'admin_panel' | 'scheduler'>('all');
  const [billingRunsModeFilter, setBillingRunsModeFilter] = useState<'all' | 'preview' | 'live'>('all');
  const [selectedReminderInvoiceIds, setSelectedReminderInvoiceIds] = useState<string[]>([]);
  const [billingReminderTemplate, setBillingReminderTemplate] = useState<'due_soon' | 'overdue_7' | 'overdue_14'>('due_soon');
  const [billingReminderChannel, setBillingReminderChannel] = useState<'email' | 'whatsapp'>('whatsapp');
  const [billingReminderEnforceCadence, setBillingReminderEnforceCadence] = useState(true);
  const [isSendingBillingReminders, setIsSendingBillingReminders] = useState(false);
  const [billingAutoRunBucket, setBillingAutoRunBucket] = useState<'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'all'>('all');
  const [billingAutoRunDryRun, setBillingAutoRunDryRun] = useState(false);
  const [isRunningBillingAutoReminders, setIsRunningBillingAutoReminders] = useState(false);
  const [billingEscalationQueue, setBillingEscalationQueue] = useState<BillingEscalationQueue | null>(null);
  const [billingEscalationStateFilter, setBillingEscalationStateFilter] = useState<'active' | 'resolved' | 'all' | 'candidates'>('active');
  const [selectedEscalationInvoiceIds, setSelectedEscalationInvoiceIds] = useState<string[]>([]);
  const [billingEscalationActionNote, setBillingEscalationActionNote] = useState('');
  const [isBillingEscalationLoading, setIsBillingEscalationLoading] = useState(false);
  const [isApplyingBillingEscalationAction, setIsApplyingBillingEscalationAction] = useState(false);
  const [isResolvingReconciliation, setIsResolvingReconciliation] = useState(false);
  const [billingCollectionsMetrics, setBillingCollectionsMetrics] = useState<BillingCollectionsMetrics | null>(null);
  const [isBillingCollectionsMetricsLoading, setIsBillingCollectionsMetricsLoading] = useState(false);
  const [isFinanceDataLoading, setIsFinanceDataLoading] = useState(false);
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isInvoiceDetailsModalOpen, setIsInvoiceDetailsModalOpen] = useState(false);
  const [isInvoiceDetailsLoading, setIsInvoiceDetailsLoading] = useState(false);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<AdminBillingInvoiceDetail | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<AdminBillingInvoiceItem[]>([]);
  const [selectedInvoicePresetId, setSelectedInvoicePresetId] = useState<InvoicePreset['id'] | null>('service_visit');
  const [billingUserLookupQuery, setBillingUserLookupQuery] = useState('');
  const [billingUserLookupDebounced, setBillingUserLookupDebounced] = useState('');
  const [billingUserLookupResults, setBillingUserLookupResults] = useState<AdminUserSearchResult[]>([]);
  const [isBillingUserLookupLoading, setIsBillingUserLookupLoading] = useState(false);
  const [manualInvoiceDraft, setManualInvoiceDraft] = useState<AdminManualInvoiceDraft>({
    userId: '',
    invoiceType: 'service',
    status: 'issued',
    subtotalInr: '',
    discountInr: '0',
    taxInr: '0',
    cgstInr: '0',
    sgstInr: '0',
    igstInr: '0',
    gstin: '',
    hsnSacCode: '',
    description: '',
    bookingId: '',
    userSubscriptionId: '',
  });
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const providerCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const bookingActivityTimeoutRef = useRef<number | null>(null);

  const availableServiceTypes = useMemo(() => {
    const catalogServiceTypes = initialCatalogServices
      .map((service) => service.service_type)
      .filter((value) => value?.trim());
    const summaryServiceTypes = serviceSummary
      .map((service) => service.service_type)
      .filter((value) => value?.trim());

    return Array.from(new Set([...catalogServiceTypes, ...summaryServiceTypes])).sort();
  }, [initialCatalogServices, serviceSummary]);
  const rolloutTargetScopeLabel = useMemo(() => {
    if (globalServiceDraft.provider_types.length === 0) {
      return 'Target: All approved active providers';
    }

    const names = globalServiceDraft.provider_types.map((type) => type.replaceAll('_', ' '));

    if (names.length <= 2) {
      return `Target: ${names.join(', ')}`;
    }

    return `Target: ${names.length} provider types selected`;
  }, [globalServiceDraft.provider_types]);
  const rolloutProviderTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const provider of providerRows) {
      const providerType = String(provider.provider_type ?? '').trim().toLowerCase();
      if (!providerType) {
        continue;
      }

      counts.set(providerType, (counts.get(providerType) ?? 0) + 1);
    }

    for (const selectedType of globalServiceDraft.provider_types) {
      const normalizedType = String(selectedType).trim().toLowerCase();
      if (!normalizedType) {
        continue;
      }

      if (!counts.has(normalizedType)) {
        counts.set(normalizedType, 0);
      }
    }

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [providerRows, globalServiceDraft.provider_types]);

  const filteredBillingReminderRuns = useMemo(() => {
    const runs = billingReminderRunsHistory?.runs ?? [];
    return runs.filter((run) => {
      if (billingRunsStatusFilter !== 'all' && run.status !== billingRunsStatusFilter) {
        return false;
      }

      if (billingRunsSourceFilter !== 'all' && run.trigger_source !== billingRunsSourceFilter) {
        return false;
      }

      if (billingRunsModeFilter === 'preview' && !run.dry_run) {
        return false;
      }

      if (billingRunsModeFilter === 'live' && run.dry_run) {
        return false;
      }

      return true;
    });
  }, [billingReminderRunsHistory, billingRunsModeFilter, billingRunsSourceFilter, billingRunsStatusFilter]);

  // Realtime subscriptions for bookings and provider approvals
  const refreshBookings = useCallback(async (searchQuery?: string) => {
    try {
      const params = new URLSearchParams();
      const normalizedSearch = (searchQuery ?? '').trim();

      if (normalizedSearch) {
        params.set('q', normalizedSearch);
      }

      params.set('limit', '300');

      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, []);

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
        const data = (await response.json()) as { applications?: ServiceProviderApplication[] };
        setProviderApplications(data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh provider applications:', error);
    }
  }, []);

  useAdminBookingRealtime(refreshBookings);
  useAdminProviderApprovalRealtime(refreshProviders);

  const visibleBookings = useMemo(() => {
    const normalizedSearch = bookingSearchDebounced.trim().toLowerCase();

    let filtered = bookings;

    if (normalizedSearch) {
      filtered = filtered.filter((booking) => {
        const status = (booking.booking_status ?? booking.status ?? '').replace('_', ' ');
        return [
          booking.id.toString(),
          booking.user_id ?? '',
          booking.provider_id.toString(),
          booking.customer_name ?? '',
          booking.customer_email ?? '',
          booking.customer_phone ?? '',
          booking.provider_name ?? '',
          booking.service_type ?? '',
          status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      });
    }

    if (bookingFilter === 'all') {
      return filtered;
    }

    if (bookingFilter === 'sla') {
      return filtered.filter((booking) => (booking.booking_status ?? booking.status) === 'pending');
    }

    return filtered.filter((booking) => {
      const status = booking.booking_status ?? booking.status;
      return status === 'no_show' || status === 'cancelled';
    });
  }, [bookings, bookingFilter, bookingSearchDebounced]);

  const bookingRiskSummary = useMemo(() => {
    return {
      inProgress: bookings.filter((booking) => {
        const status = booking.booking_status ?? booking.status;
        return status === 'pending' || status === 'confirmed';
      }).length,
      completed: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'completed').length,
      pending: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'pending').length,
      noShow: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'no_show').length,
      cancelled: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'cancelled').length,
    };
  }, [bookings]);

  const totalCustomers = useMemo(() => {
    const customerKeys = new Set<string>();

    for (const booking of bookings) {
      const stableKey = booking.user_id ?? booking.customer_email ?? booking.customer_phone;

      if (stableKey) {
        customerKeys.add(stableKey.toLowerCase());
      }
    }

    return customerKeys.size;
  }, [bookings]);

  const isOverviewView = view === 'overview';
  const isBookingsView = view === 'bookings';
  const isUsersView = view === 'users';
  const isAccessView = view === 'access';
  const isProvidersView = view === 'providers';
  const isServicesView = view === 'services';
  const isHealthView = view === 'health';
  const isPaymentsView = view === 'payments';
  const isSubscriptionsView = view === 'subscriptions';
  const isBillingView = view === 'billing';
  const isBillingCatalogView = view === 'billing_catalog';
  const isAuditView = view === 'audit';

  const invoicePresets = useMemo<InvoicePreset[]>(
    () => [
      {
        id: 'service_visit',
        label: 'Service Visit Invoice',
        description: 'Standard post-service invoice with immediate issue state.',
        defaults: {
          invoiceType: 'service',
          status: 'issued',
          description: 'Professional service visit charge',
          discountInr: '0',
          taxInr: '0',
        },
      },
      {
        id: 'subscription_renewal',
        label: 'Subscription Renewal',
        description: 'Recurring subscription billing record, typically paid online.',
        defaults: {
          invoiceType: 'subscription',
          status: 'paid',
          description: 'Subscription renewal',
          discountInr: '0',
          taxInr: '0',
        },
      },
      {
        id: 'credit_adjustment',
        label: 'Credit Adjustment',
        description: 'Manual adjustment invoice for goodwill or operational correction.',
        defaults: {
          invoiceType: 'service',
          status: 'issued',
          description: 'Manual billing adjustment',
          discountInr: '0',
          taxInr: '0',
        },
      },
    ],
    [],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBillingSearchDebounced(billingSearchQuery.trim());
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [billingSearchQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBillingUserLookupDebounced(billingUserLookupQuery.trim());
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [billingUserLookupQuery]);

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
        const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{ users?: AdminUserSearchResult[] }>;

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to search users.');
        }

        setBillingUserLookupResults(payload.users ?? []);
      } catch (err) { console.error(err);
        if (isMounted) {
          setBillingUserLookupResults([]);
        }
      } finally {
        if (isMounted) {
          setIsBillingUserLookupLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [billingUserLookupDebounced, isCreateInvoiceModalOpen]);

  useEffect(() => {
    if (!isServicesView) {
      return;
    }

    const nextPanel = parseServiceCatalogPanel(searchParams.get('catalog'));
    setServiceCatalogPanel((current) => (current === nextPanel ? current : nextPanel));
  }, [isServicesView, searchParams]);

  function updateServiceCatalogPanel(panel: ServiceCatalogPanel) {
    setServiceCatalogPanel(panel);

    const params = new URLSearchParams(searchParams.toString());
    if (panel === 'types') {
      params.delete('catalog');
    } else {
      params.set('catalog', panel);
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  // Paginated billing invoice fetch — called both from refreshFinanceData and directly on page change
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
    if (!res.ok) return;
    const data = (await res.json()) as AdminFinancePayload<{ invoices?: AdminBillingInvoice[]; total?: number }>;
    const nextInvoices = data.invoices ?? [];
    setBillingInvoices(nextInvoices);
    setBillingInvoiceTotal(data.total ?? 0);
    setSelectedBillingInvoiceIds((current) =>
      current.filter((invoiceId) => nextInvoices.some((invoice) => invoice.id === invoiceId)),
    );
  }, [billingFromDate, billingSearchDebounced, billingStatusFilter, billingToDate, billingTypeFilter]);

  const refreshFinanceData = useCallback(async () => {
    setIsFinanceDataLoading(true);
    try {
      setBillingInvoicePage(1);
      setPaymentPage(1);
      setSubscriptionPage(1);

      const [paymentsRes, subscriptionsRes] = await Promise.all([
        fetch('/api/admin/payments/transactions?limit=100'),
        fetch('/api/admin/subscriptions?limit=100'),
      ]);

      if (paymentsRes.ok) {
        const data = (await paymentsRes.json()) as AdminFinancePayload<{ transactions?: AdminPaymentTransaction[] }>;
        setPaymentTransactions(data.transactions ?? []);
      }

      if (subscriptionsRes.ok) {
        const data = (await subscriptionsRes.json()) as AdminFinancePayload<{ subscriptions?: AdminSubscriptionRow[] }>;
        setSubscriptions(data.subscriptions ?? []);
      }

      await fetchBillingInvoices(1);
    } catch (err) { console.error(err);
      showToast('Unable to load finance operations data.', 'error');
    } finally {
      setIsFinanceDataLoading(false);
    }
  }, [fetchBillingInvoices, showToast]);

  const refreshBillingReconciliation = useCallback(async () => {
    setIsBillingReconciliationLoading(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation?limit=400', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<BillingReconciliationSummary>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load reconciliation summary.');
      }

      setBillingReconciliation(payload);
    } catch (error) {
      setBillingReconciliation(null);
      showToast(error instanceof Error ? error.message : 'Unable to load reconciliation summary.', 'error');
    } finally {
      setIsBillingReconciliationLoading(false);
    }
  }, [showToast]);

  const refreshBillingReconciliationCandidates = useCallback(async () => {
    setIsBillingReconciliationCandidatesLoading(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation/candidates?limit=120', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<BillingReconciliationCandidates>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load reconciliation candidates.');
      }

      setBillingReconciliationCandidates(payload);
    } catch (error) {
      setBillingReconciliationCandidates(null);
      showToast(error instanceof Error ? error.message : 'Unable to load reconciliation candidates.', 'error');
    } finally {
      setIsBillingReconciliationCandidatesLoading(false);
    }
  }, [showToast]);

  const refreshBillingReminders = useCallback(async () => {
    setIsBillingReminderLoading(true);
    try {
      const [queueResponse, scheduleResponse, runsResponse] = await Promise.all([
        fetch('/api/admin/billing/reminders?limit=300', { cache: 'no-store' }),
        fetch('/api/admin/billing/reminders/schedule', { cache: 'no-store' }),
        fetch('/api/admin/billing/reminders/runs?limit=20', { cache: 'no-store' }),
      ]);

      const payload = (await queueResponse.json().catch(() => ({}))) as AdminFinancePayload<BillingReminderQueue>;
      const schedulePayload =
        (await scheduleResponse.json().catch(() => ({}))) as AdminFinancePayload<BillingReminderScheduleStatus>;
      const runsPayload = (await runsResponse.json().catch(() => ({}))) as AdminFinancePayload<BillingReminderRunsHistory>;

      if (!queueResponse.ok) {
        throw new Error(payload.error ?? 'Unable to load billing reminder queue.');
      }

      setBillingReminderQueue(payload);
      setSelectedReminderInvoiceIds((current) =>
        current.filter((id) => (payload.queue ?? []).some((row) => row.invoice_id === id)),
      );

      if (scheduleResponse.ok) {
        setBillingReminderScheduleStatus(schedulePayload);
      }

      if (runsResponse.ok) {
        setBillingReminderRunsHistory(runsPayload);
      }
    } catch (error) {
      setBillingReminderQueue(null);
      setBillingReminderScheduleStatus(null);
      setBillingReminderRunsHistory(null);
      showToast(error instanceof Error ? error.message : 'Unable to load billing reminder queue.', 'error');
    } finally {
      setIsBillingReminderLoading(false);
    }
  }, [showToast]);

  const refreshBillingCollectionsMetrics = useCallback(async () => {
    setIsBillingCollectionsMetricsLoading(true);
    try {
      const response = await fetch('/api/admin/billing/metrics?limit=800', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<BillingCollectionsMetrics>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load collections metrics.');
      }

      setBillingCollectionsMetrics(payload);
    } catch (error) {
      setBillingCollectionsMetrics(null);
      showToast(error instanceof Error ? error.message : 'Unable to load collections metrics.', 'error');
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
      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<BillingEscalationQueue>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load escalation queue.');
      }

      setBillingEscalationQueue(payload);
      setSelectedEscalationInvoiceIds((current) =>
        current.filter((id) => (payload.queue ?? []).some((row) => row.invoice_id === id)),
      );
    } catch (error) {
      setBillingEscalationQueue(null);
      showToast(error instanceof Error ? error.message : 'Unable to load escalation queue.', 'error');
    } finally {
      setIsBillingEscalationLoading(false);
    }
  }, [billingEscalationStateFilter, showToast]);

  function toggleReminderInvoiceSelection(invoiceId: string) {
    setSelectedReminderInvoiceIds((current) =>
      current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId],
    );
  }

  async function sendBillingReminders() {
    if (selectedReminderInvoiceIds.length === 0) {
      showToast('Select at least one reminder target invoice.', 'error');
      return;
    }

    setIsSendingBillingReminders(true);
    try {
      const response = await fetch('/api/admin/billing/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: selectedReminderInvoiceIds,
          template: billingReminderTemplate,
          channel: billingReminderChannel,
          enforceCadence: billingReminderEnforceCadence,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{
        sent?: number;
        skipped?: Array<{ invoice_id: string; reason: 'cadence' | 'cooldown' }>;
      }>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to send reminders.');
      }

      const skippedCount = payload.skipped?.length ?? 0;
      const sentCount = payload.sent ?? selectedReminderInvoiceIds.length;
      showToast(
        skippedCount > 0
          ? `Reminders queued: ${sentCount}. Skipped: ${skippedCount} (cadence/cooldown).`
          : `Reminder dispatch queued for ${sentCount} invoice(s).`,
        'success',
      );
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
        body: JSON.stringify({
          bucket: billingAutoRunBucket,
          channel: billingReminderChannel,
          enforceCadence: billingReminderEnforceCadence,
          enforceCooldown: true,
          dryRun: billingAutoRunDryRun,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{
        scanned?: number;
        sent?: number;
        skippedCadence?: number;
        skippedCooldown?: number;
        escalated?: number;
      }>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to run auto reminder batch.');
      }

      showToast(
        billingAutoRunDryRun
          ? `Preview: would scan ${payload.scanned ?? 0}, send ${payload.sent ?? 0}, escalate ${payload.escalated ?? 0}.`
          : `Auto-run: scanned ${payload.scanned ?? 0}, sent ${payload.sent ?? 0}, escalated ${payload.escalated ?? 0}.`,
        'success',
      );

      await Promise.all([refreshBillingReminders(), refreshBillingEscalations()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to run auto reminder batch.', 'error');
    } finally {
      setIsRunningBillingAutoReminders(false);
    }
  }

  function toggleEscalationInvoiceSelection(invoiceId: string) {
    setSelectedEscalationInvoiceIds((current) =>
      current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId],
    );
  }

  async function applyBillingEscalationAction(action: 'escalate' | 'resolve' | 'snooze_48h' | 'clear') {
    if (selectedEscalationInvoiceIds.length === 0) {
      showToast('Select at least one escalation invoice.', 'error');
      return;
    }

    if (action === 'escalate' || action === 'resolve') {
      const count = selectedEscalationInvoiceIds.length;
      openConfirm({
        title: action === 'escalate' ? 'Escalate Invoices' : 'Resolve Escalations',
        description: action === 'escalate'
          ? `This will escalate ${count} invoice(s) for manual follow-up.`
          : `This will mark ${count} invoice(s) as resolved.`,
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
        body: JSON.stringify({
          invoiceIds: selectedEscalationInvoiceIds,
          action,
          note: billingEscalationActionNote,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{ updated?: number }>;
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to apply escalation action.');
      }

      showToast(`Escalation action applied to ${payload.updated ?? selectedEscalationInvoiceIds.length} invoice(s).`, 'success');
      setSelectedEscalationInvoiceIds([]);
      setBillingEscalationActionNote('');
      await Promise.all([refreshBillingEscalations(), refreshBillingReminders()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to apply escalation action.', 'error');
    } finally {
      setIsApplyingBillingEscalationAction(false);
    }
  }

  async function resolveReconciliationMismatch(
    action:
      | 'link_payment_reference'
      | 'clear_payment_reference'
      | 'sync_invoice_total_to_payment'
      | 'auto_match_missing_reference',
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
    action:
      | 'link_payment_reference'
      | 'clear_payment_reference'
      | 'sync_invoice_total_to_payment'
      | 'auto_match_missing_reference',
    invoiceId: string,
    paymentTransactionId: string | undefined,
  ) {
    setIsResolvingReconciliation(true);
    try {
      const response = await fetch('/api/admin/billing/reconciliation/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          invoiceId,
          paymentTransactionId,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{ success?: boolean }>;
      if (!response.ok) {
        const confidenceValue = typeof (payload as { confidence?: unknown }).confidence === 'number'
          ? Number((payload as { confidence?: number }).confidence)
          : null;
        const candidateCountValue = typeof (payload as { candidateCount?: unknown }).candidateCount === 'number'
          ? Number((payload as { candidateCount?: number }).candidateCount)
          : null;

        const detail =
          confidenceValue !== null
            ? ` (confidence ${confidenceValue}${candidateCountValue !== null ? `, candidates ${candidateCountValue}` : ''})`
            : '';

        throw new Error((payload.error ?? 'Unable to resolve reconciliation mismatch.') + detail);
      }

      showToast('Reconciliation resolution applied.', 'success');
      await Promise.all([refreshBillingReconciliation(), refreshBillingReconciliationCandidates(), refreshFinanceData()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to resolve reconciliation mismatch.', 'error');
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
        body: JSON.stringify({
          minConfidence: billingBulkAutoMatchConfidence,
          limit: 40,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{
        matched?: number;
        considered?: number;
        skipped?: Array<{ invoice_id: string; reason: string }>;
      }>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to run bulk auto-match.');
      }

      showToast(
        `Bulk auto-match: matched ${payload.matched ?? 0} of ${payload.considered ?? 0}, skipped ${payload.skipped?.length ?? 0}.`,
        'success',
      );

      await Promise.all([refreshBillingReconciliation(), refreshBillingReconciliationCandidates(), refreshFinanceData()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to run bulk auto-match.', 'error');
    } finally {
      setIsRunningBillingBulkAutoMatch(false);
    }
  }

  useEffect(() => {
    if (!isPaymentsView && !isSubscriptionsView && !isBillingView) {
      return;
    }

    void refreshFinanceData();
    if (isBillingView) {
      void refreshBillingReconciliation();
      void refreshBillingReconciliationCandidates();
      void refreshBillingReminders();
      void refreshBillingCollectionsMetrics();
      void refreshBillingEscalations();
    }
  }, [
    isPaymentsView,
    isSubscriptionsView,
    isBillingView,
    refreshBillingReconciliation,
    refreshBillingReconciliationCandidates,
    refreshBillingReminders,
    refreshBillingCollectionsMetrics,
    refreshBillingEscalations,
    refreshFinanceData,
  ]);

  function updateAdminView(nextView: AdminDashboardView) {
    const route = nextView === 'overview' ? '/dashboard/admin' : `/dashboard/admin/${nextView}`;
    router.push(route);
  }

  function resetCreateUserDraft() {
    setCreateUserDraft({
      name: '',
      email: '',
      phone: '',
      noEmailInvite: false,
    });
  }

  async function createDirectoryUser(options?: { openBookingsAfterCreate?: boolean }) {
    const name = createUserDraft.name.trim();
    const email = createUserDraft.email.trim().toLowerCase();
    const phone = createUserDraft.phone.trim();
    const noEmailInvite = createUserDraft.noEmailInvite;

    if (name.length < 2) {
      showToast('Name should be at least 2 characters.', 'error');
      return;
    }

    if (!noEmailInvite && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    if (phone.replace(/\D/g, '').length < 10) {
      showToast('Enter a valid phone number.', 'error');
      return;
    }

    setIsCreatingUser(true);

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email: noEmailInvite ? '' : email,
          phone,
          noEmailInvite,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            inviteSent?: boolean;
            user?: { id: string; name: string; email: string | null; phone: string };
          }
        | null;

      if (!response.ok || !payload?.success || !payload.user) {
        throw new Error(payload?.error ?? 'Unable to create user.');
      }

      setIsCreateUserModalOpen(false);
      resetCreateUserDraft();
      setUserSearchQuery(payload.user.email || payload.user.phone || payload.user.id);
      showToast(
        payload.inviteSent
          ? 'User added successfully. Invitation email sent.'
          : 'User added successfully without email invite.',
        'success',
      );

      if (options?.openBookingsAfterCreate) {
        updateAdminView('bookings');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create user.', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function createManualInvoice() {
    const subtotal = Number(manualInvoiceDraft.subtotalInr || '0');
    const discount = Number(manualInvoiceDraft.discountInr || '0');
    const tax = Number(manualInvoiceDraft.taxInr || '0');
    const cgst = Number(manualInvoiceDraft.cgstInr || '0');
    const sgst = Number(manualInvoiceDraft.sgstInr || '0');
    const igst = Number(manualInvoiceDraft.igstInr || '0');

    if (!manualInvoiceDraft.userId.trim()) {
      showToast('User ID is required to create an invoice.', 'error');
      return;
    }

    if (!manualInvoiceDraft.description.trim()) {
      showToast('Description is required.', 'error');
      return;
    }

    if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(discount) || discount < 0 || !Number.isFinite(tax) || tax < 0) {
      showToast('Subtotal, discount and tax must be valid non-negative numbers.', 'error');
      return;
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
          cgstInr: cgst,
          sgstInr: sgst,
          igstInr: igst,
          gstin: manualInvoiceDraft.gstin.trim() || undefined,
          hsnSacCode: manualInvoiceDraft.hsnSacCode.trim() || undefined,
          description: manualInvoiceDraft.description.trim(),
          bookingId: manualInvoiceDraft.bookingId.trim() ? Number(manualInvoiceDraft.bookingId) : undefined,
          userSubscriptionId: manualInvoiceDraft.userSubscriptionId.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{ invoice?: AdminBillingInvoice }>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to create invoice.');
      }

      if (payload.invoice) {
        setBillingInvoices((current) => [payload.invoice!, ...current]);
      } else {
        await refreshFinanceData();
      }

      setIsCreateInvoiceModalOpen(false);
      resetManualInvoiceComposer();
      showToast('Manual invoice created successfully.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create invoice.', 'error');
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  function resetManualInvoiceComposer() {
    setManualInvoiceDraft({
      userId: '',
      invoiceType: 'service',
      status: 'issued',
      subtotalInr: '',
      discountInr: '0',
      taxInr: '0',
      cgstInr: '0',
      sgstInr: '0',
      igstInr: '0',
      gstin: '',
      hsnSacCode: '',
      description: '',
      bookingId: '',
      userSubscriptionId: '',
    });
    setSelectedInvoicePresetId(null);
    setBillingUserLookupQuery('');
    setBillingUserLookupDebounced('');
    setBillingUserLookupResults([]);
  }

  function applyInvoicePreset(presetId: InvoicePreset['id']) {
    const preset = invoicePresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setSelectedInvoicePresetId(presetId);
    setManualInvoiceDraft((current) => ({
      ...current,
      invoiceType: preset.defaults.invoiceType,
      status: preset.defaults.status,
      description: preset.defaults.description,
      discountInr: preset.defaults.discountInr,
      taxInr: preset.defaults.taxInr,
    }));
  }

  function selectBillingUser(user: AdminUserSearchResult) {
    setManualInvoiceDraft((current) => ({
      ...current,
      userId: user.id,
    }));
    setBillingUserLookupQuery(user.email ?? user.phone ?? user.name ?? user.id);
    setBillingUserLookupResults([]);
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

  function openInvoicePrint(invoiceId: string) {
    window.open(`/api/admin/billing/invoices/${invoiceId}/print`, '_blank', 'noopener,noreferrer');
  }

  function downloadInvoicePdf(invoiceId: string) {
    window.open(`/api/admin/billing/invoices/${invoiceId}/pdf`, '_blank', 'noopener,noreferrer');
  }

  async function openInvoiceDetails(invoiceId: string) {
    setIsInvoiceDetailsModalOpen(true);
    setIsInvoiceDetailsLoading(true);
    setSelectedInvoiceDetails(null);
    setSelectedInvoiceItems([]);

    try {
      const response = await fetch(`/api/admin/billing/invoices/${invoiceId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{
        invoice?: AdminBillingInvoiceDetail;
        items?: AdminBillingInvoiceItem[];
      }>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load invoice details.');
      }

      if (!payload.invoice) {
        throw new Error('Invoice details are unavailable.');
      }

      setSelectedInvoiceDetails(payload.invoice);
      setSelectedInvoiceItems(payload.items ?? []);
    } catch (error) {
      setIsInvoiceDetailsModalOpen(false);
      showToast(error instanceof Error ? error.message : 'Unable to load invoice details.', 'error');
    } finally {
      setIsInvoiceDetailsLoading(false);
    }
  }

  function toggleBillingInvoiceSelection(invoiceId: string) {
    setSelectedBillingInvoiceIds((current) =>
      current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId],
    );
  }

  function toggleSelectAllVisibleBillingInvoices() {
    const visibleIds = billingInvoices.map((invoice) => invoice.id);

    setSelectedBillingInvoiceIds((current) => {
      if (visibleIds.length > 0 && visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
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

  async function applyBillingBulkStatus() {
    if (selectedBillingInvoiceIds.length === 0) {
      showToast('Select at least one invoice first.', 'error');
      return;
    }

    openConfirm({
      title: 'Update Invoice Status',
      description: `Update ${selectedBillingInvoiceIds.length} invoice(s) to status "${billingBulkStatus}"? This will overwrite their current status.`,
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
        body: JSON.stringify({
          invoiceIds: selectedBillingInvoiceIds,
          status: billingBulkStatus,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AdminFinancePayload<{
        updated?: number;
        invoices?: AdminBillingInvoice[];
      }>;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to update invoice statuses.');
      }

      const updatedInvoices = payload.invoices ?? [];
      if (updatedInvoices.length > 0) {
        const updatedById = new Map(updatedInvoices.map((invoice) => [invoice.id, invoice]));
        setBillingInvoices((current) =>
          current.map((invoice) => updatedById.get(invoice.id) ?? invoice),
        );
      }

      setSelectedBillingInvoiceIds([]);
      showToast(`Updated ${payload.updated ?? updatedInvoices.length} invoice(s) to ${billingBulkStatus}.`, 'success');
      await refreshFinanceData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update invoice statuses.', 'error');
    } finally {
      setIsApplyingBillingBulkStatus(false);
    }
  }

  function exportBillingCsv() {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams();
    params.set('limit', '5000');

    if (billingStatusFilter !== 'all') {
      params.set('status', billingStatusFilter);
    }

    if (billingTypeFilter !== 'all') {
      params.set('invoiceType', billingTypeFilter);
    }

    if (billingSearchDebounced) {
      params.set('q', billingSearchDebounced);
    }

    if (billingFromDate) {
      params.set('fromDate', billingFromDate);
    }

    if (billingToDate) {
      params.set('toDate', billingToDate);
    }

    window.open(`/api/admin/billing/invoices/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  function exportBillingFollowupsCsv() {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams();
    params.set('limit', '10000');
    params.set('bucket', billingAutoRunBucket);

    window.open(`/api/admin/billing/followups/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  async function updateSubscriptionStatus(subscriptionId: string, status: 'active' | 'paused' | 'expired' | 'cancelled') {
    if (status === 'cancelled' || status === 'paused') {
      openConfirm({
        title: status === 'cancelled' ? 'Cancel Subscription' : 'Pause Subscription',
        description: status === 'cancelled'
          ? 'This will cancel the subscription. The customer will lose access to all subscription benefits.'
          : 'This will pause the subscription. The customer will not be charged until it is resumed.',
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
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Unable to update subscription status.');
      }

      setSubscriptions((current) =>
        current.map((row) => (row.id === subscriptionId ? { ...row, status } : row)),
      );
      showToast(`Subscription marked as ${status}.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update subscription status.', 'error');
    }
  }

  // Filter providers based on search and filters
  const filteredProviders = useMemo(() => {
    return providerRows.filter((provider) => {
      // Search filter
      if (providerSearchQuery.trim()) {
        const query = providerSearchQuery.toLowerCase();
        const matchesSearch =
          provider.name.toLowerCase().includes(query) ||
          (provider.email?.toLowerCase() || '').includes(query) ||
          (provider.business_name?.toLowerCase() || '').includes(query) ||
          provider.id.toString().includes(query) ||
          (provider.city?.toLowerCase() || '').includes(query);
        
        if (!matchesSearch) return false;
      }

      // Type filter
      if (providerTypeFilter !== 'all') {
        if (providerTypeFilter === 'clinic' && provider.provider_type !== 'clinic') return false;
        if (providerTypeFilter === 'home_visit' && provider.provider_type === 'clinic') return false;
      }

      // Status filter
      if (providerStatusFilter !== 'all') {
        if (providerStatusFilter === 'pending' && provider.admin_approval_status !== 'pending') return false;
        if (providerStatusFilter === 'approved' && provider.admin_approval_status !== 'approved') return false;
        if (providerStatusFilter === 'rejected' && provider.admin_approval_status !== 'rejected') return false;
        if (providerStatusFilter === 'suspended' && provider.account_status !== 'suspended') return false;
      }

      return true;
    });
  }, [providerRows, providerSearchQuery, providerTypeFilter, providerStatusFilter]);

  const filteredProviderApplications = useMemo(() => {
    if (providerApplicationStatusFilter === 'all') {
      return providerApplications;
    }

    return providerApplications.filter((application) => application.status === providerApplicationStatusFilter);
  }, [providerApplicationStatusFilter, providerApplications]);

  const calendarSelectableProviders = filteredProviders.length > 0 ? filteredProviders : providerRows;
  const selectedCalendarProviderName = calendarProviderId
    ? calendarSelectableProviders.find((provider) => provider.id === calendarProviderId)?.name ?? `Provider #${calendarProviderId}`
    : null;
  const isCalendarStale = Boolean(
    calendarProviderId && providerCalendar && providerCalendar.provider.id !== calendarProviderId,
  );
  const calendarSkeletonCardCount = calendarDays === 14 ? 8 : 4;

  async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    } | null;

    if (!response.ok) {
      const fieldErrors = payload?.details?.fieldErrors;
      const firstFieldError =
        fieldErrors && Object.keys(fieldErrors).length > 0
          ? `${Object.keys(fieldErrors)[0]}: ${Object.values(fieldErrors)[0]?.[0]}`
          : null;
      throw new Error(firstFieldError ?? payload?.error ?? 'Request failed');
    }

    return payload as T;
  }

  function setProviderApplicationNote(applicationId: string, value: string) {
    setProviderApplicationNotesDraft((current) => ({
      ...current,
      [applicationId]: value,
    }));
  }

  function updateProviderApplicationStatus(applicationId: string, status: ServiceProviderApplicationStatus) {
    const note = providerApplicationNotesDraft[applicationId] ?? '';

    startTransition(async () => {
      try {
        const response = await adminRequest<{ application: ServiceProviderApplication }>(
          `/api/admin/provider-applications/${applicationId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status,
              admin_notes: note,
            }),
          },
        );

        setProviderApplications((current) =>
          current.map((item) => (item.id === applicationId ? response.application : item)),
        );
        showToast(`Application marked as ${status.replace('_', ' ')}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update application status.', 'error');
      }
    });
  }

  const fetchProviderCalendar = useCallback(async () => {
    if (!calendarProviderId) {
      setProviderCalendar(null);
      return;
    }

    setIsCalendarLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('providerId', String(calendarProviderId));
      params.set('fromDate', calendarFromDate);
      params.set('days', String(calendarDays));

      const request = await fetch(`/api/admin/providers/calendar?${params.toString()}`);
      const payload = (await request.json().catch(() => null)) as
        | AdminProviderCalendarResponse
        | { error?: string }
        | null;

      if (!request.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to load provider calendar.');
      }

      const response = payload as AdminProviderCalendarResponse;
      setProviderCalendar(response);
    } catch (error) {
      setProviderCalendar(null);
      showToast(error instanceof Error ? error.message : 'Unable to load provider calendar.', 'error');
    } finally {
      setIsCalendarLoading(false);
    }
  }, [calendarDays, calendarFromDate, calendarProviderId, showToast]);

  const searchAvailableProviders = useCallback(async () => {
    const pincode = availabilityFinderPincode.trim();

    if (!/^[1-9]\d{5}$/.test(pincode)) {
      showToast('Enter a valid 6-digit pincode to search availability.', 'error');
      return;
    }

    if (!availabilityFinderDate) {
      showToast('Select a booking date to search providers.', 'error');
      return;
    }

    if (
      availabilityFinderStartTime &&
      availabilityFinderEndTime &&
      availabilityFinderEndTime <= availabilityFinderStartTime
    ) {
      showToast('Time range end must be after start time.', 'error');
      return;
    }

    setAvailabilityFinderLoading(true);
    setAvailabilityFinderHasRun(true);

    try {
      const params = new URLSearchParams();
      params.set('pincode', pincode);
      params.set('bookingDate', availabilityFinderDate);

      if (availabilityFinderServiceType.trim()) {
        params.set('serviceType', availabilityFinderServiceType.trim());
      }

      if (availabilityFinderStartTime) {
        params.set('startTime', availabilityFinderStartTime);
      }

      const request = await fetch(`/api/bookings/admin-flow-availability?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await request.json().catch(() => null)) as
        | AdminFlowAvailabilityResponse
        | { error?: string }
        | null;

      if (!request.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to search available providers.');
      }

      const response = payload as AdminFlowAvailabilityResponse;

      let providers = response.providers;

      if (availabilityFinderProviderType === 'clinic') {
        providers = providers.filter((provider) => provider.providerType === 'clinic');
      }

      if (availabilityFinderProviderType === 'home_visit') {
        providers = providers.filter((provider) => provider.providerType !== 'clinic');
      }

      // Enforce availability in the requested time window. This excludes providers with booking conflicts.
      if (availabilityFinderExactTimeOnly && availabilityFinderStartTime) {
        providers = providers.filter((provider) => provider.availableForSelectedSlot);
      } else if (availabilityFinderStartTime && availabilityFinderEndTime) {
        providers = providers.filter((provider) =>
          (provider.availableSlotStartTimes ?? []).some((time) =>
            isTimeInWindow(time, availabilityFinderStartTime, availabilityFinderEndTime),
          ),
        );
      } else if (availabilityFinderStartTime) {
        providers = providers.filter((provider) => provider.availableForSelectedSlot);
      } else {
        providers = providers.filter((provider) => provider.availableSlotCount > 0);
      }

      providers = [...providers].sort((left, right) => {
        if (left.recommended !== right.recommended) {
          return left.recommended ? -1 : 1;
        }

        if (left.availableSlotCount !== right.availableSlotCount) {
          return right.availableSlotCount - left.availableSlotCount;
        }

        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        return left.providerName.localeCompare(right.providerName);
      });

      const slots = availabilityFinderStartTime && availabilityFinderEndTime
        ? response.slotOptions.filter((slot) => isTimeInWindow(slot.startTime, availabilityFinderStartTime, availabilityFinderEndTime))
        : response.slotOptions;

      setAvailabilityFinderServices(response.services ?? []);
      setAvailabilityFinderSlots(slots);
      setAvailabilityFinderResults(providers);

      if (availabilityFinderAutoOpenTopMatch && providers.length > 0) {
        setCalendarProviderId(providers[0].providerId);
        setCalendarFromDate(availabilityFinderDate);
      }
    } catch (error) {
      setAvailabilityFinderServices([]);
      setAvailabilityFinderSlots([]);
      setAvailabilityFinderResults([]);
      showToast(error instanceof Error ? error.message : 'Unable to search available providers.', 'error');
    } finally {
      setAvailabilityFinderLoading(false);
    }
  }, [
    availabilityFinderDate,
    availabilityFinderExactTimeOnly,
    availabilityFinderEndTime,
    availabilityFinderAutoOpenTopMatch,
    availabilityFinderPincode,
    availabilityFinderProviderType,
    availabilityFinderServiceType,
    availabilityFinderStartTime,
    showToast,
  ]);

  const fetchAdminUsers = useCallback(async () => {
    if (!isUsersView) {
      return;
    }

    if (!userSearchDebounced) {
      setUserSearchResults([]);
      setIsUserSearchLoading(false);
      return;
    }

    setIsUserSearchLoading(true);

    try {
      const params = new URLSearchParams();
      if (userSearchDebounced) {
        params.set('q', userSearchDebounced);
      }
      params.set('limit', '25');

      const response = await fetch(`/api/admin/users/search?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { users?: AdminUserSearchResult[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to load users.');
      }

      setUserSearchResults(payload?.users ?? []);
    } catch (error) {
      setUserSearchResults([]);
      showToast(error instanceof Error ? error.message : 'Unable to load users.', 'error');
    } finally {
      setIsUserSearchLoading(false);
    }
  }, [isUsersView, showToast, userSearchDebounced]);

  useEffect(() => {
    if (!isProvidersView) {
      return;
    }

    if (calendarProviderId) {
      const stillVisible = calendarSelectableProviders.some((provider) => provider.id === calendarProviderId);

      if (!stillVisible) {
        setCalendarProviderId('');
        setProviderCalendar(null);
      }

      return;
    }

    if (providerSearchQuery.trim() && calendarSelectableProviders.length === 1) {
      setCalendarProviderId(calendarSelectableProviders[0].id);
      return;
    }

    if (!providerSearchQuery.trim() && !calendarProviderId) {
      setProviderCalendar(null);
    }
  }, [
    isProvidersView,
    calendarProviderId,
    calendarSelectableProviders,
    providerSearchQuery,
  ]);

  useEffect(() => {
    if (!isProvidersView || !calendarProviderId) {
      return;
    }

    void fetchProviderCalendar();
  }, [isProvidersView, calendarProviderId, calendarFromDate, calendarDays, fetchProviderCalendar]);

  function overrideStatus(bookingId: number, status: Exclude<AdminBooking['status'], 'pending'>) {
    if (status === 'cancelled' || status === 'no_show') {
      openConfirm({
        title: status === 'cancelled' ? 'Cancel Booking' : 'Mark as No-Show',
        description: status === 'cancelled'
          ? `This will cancel booking #${bookingId}. The customer will be notified.`
          : `This will mark booking #${bookingId} as no-show.`,
        confirmLabel: status === 'cancelled' ? 'Cancel Booking' : 'Mark No-Show',
        confirmVariant: status === 'cancelled' ? 'danger' : 'warning',
        onConfirm: () =>
          applyBookingStatusForIds(
            [bookingId],
            status,
            `Booking #${bookingId} marked ${status.replace('_', ' ')}.`,
          ),
      });
      return;
    }
    applyBookingStatusForIds(
      [bookingId],
      status,
      `Booking #${bookingId} marked ${status.replace('_', ' ')}.`,
    );
  }

  function applyBookingStatusForIds(
    bookingIds: number[],
    status: Exclude<typeof bulkStatus, 'pending'>,
    successMessage: string,
  ) {
    if (bookingIds.length === 0) {
      showToast('Select at least one booking first.', 'error');
      return;
    }

    const selectedBookings = bookingIds
      .map((bookingId) => bookings.find((booking) => booking.id === bookingId))
      .filter((booking): booking is AdminBooking => Boolean(booking));

    const eligibleBookingIds: number[] = [];
    const ineligibleBookings: Array<{ id: number; currentStatus: AdminBooking['status']; reason: 'noop' | 'transition' }> = [];

    for (const booking of selectedBookings) {
      const currentStatus = booking.booking_status ?? booking.status;

      if (currentStatus === status) {
        ineligibleBookings.push({ id: booking.id, currentStatus, reason: 'noop' });
        continue;
      }

      const allowedTransitions = ADMIN_BOOKING_ALLOWED_TRANSITIONS[currentStatus];
      if (!allowedTransitions.includes(status)) {
        ineligibleBookings.push({ id: booking.id, currentStatus, reason: 'transition' });
        continue;
      }

      eligibleBookingIds.push(booking.id);
    }

    if (eligibleBookingIds.length === 0) {
      const sample = ineligibleBookings[0];
      if (sample?.reason === 'transition') {
        showToast(
          `No eligible bookings selected. ${sample.currentStatus.replace('_', ' ')} bookings cannot move directly to ${status.replace('_', ' ')}.`,
          'error',
        );
        return;
      }

      showToast(`No changes applied. Selected bookings are already ${status.replace('_', ' ')}.`, 'error');
      return;
    }

    if (ineligibleBookings.length > 0) {
      showToast(
        `Skipped ${ineligibleBookings.length} booking(s) that cannot be moved to ${status.replace('_', ' ')} from their current status.`,
        'error',
      );
    }

    setBookings((current) =>
      current.map((booking) =>
        eligibleBookingIds.includes(booking.id)
          ? {
              ...booking,
              status,
              booking_status: status,
            }
          : booking,
      ),
    );

    startTransition(async () => {
      try {
        const payload = await adminRequest<{
          success: boolean;
          updated: number;
          failed: number;
          results?: Array<{ bookingId: number; success: boolean; error?: string }>;
        }>('/api/admin/bookings/bulk-status', {
          method: 'PATCH',
          body: JSON.stringify({
            bookingIds: eligibleBookingIds,
            status,
          }),
        });

        await refreshBookings(bookingSearchDebounced);

        if ((payload.failed ?? 0) > 0) {
          const firstFailure = payload.results?.find((result) => !result.success);
          throw new Error(firstFailure?.error ?? `${payload.failed} booking update(s) were rejected by transition rules.`);
        }

        setSelectedBookingIds((current) => current.filter((id) => !eligibleBookingIds.includes(id)));
        showToast(successMessage, 'success');
        logBookingModerationActivity(`${eligibleBookingIds.length} booking(s) updated to ${status.replace('_', ' ')}.`);
      } catch (error) {
        await refreshBookings(bookingSearchDebounced);
        showToast(error instanceof Error ? error.message : 'Bulk update failed.', 'error');
      }
    });
  }

  function toggleBookingSelection(bookingId: number) {
    setSelectedBookingIds((current) =>
      current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId],
    );
  }

  function applyBulkStatus() {
    if (bulkStatus === 'cancelled' || bulkStatus === 'no_show') {
      const count = selectedBookingIds.length;
      openConfirm({
        title: bulkStatus === 'cancelled' ? 'Cancel Selected Bookings' : 'Mark Selected as No-Show',
        description: bulkStatus === 'cancelled'
          ? `This will cancel ${count} selected booking(s).`
          : `This will mark ${count} selected booking(s) as no-show.`,
        confirmLabel: bulkStatus === 'cancelled' ? 'Cancel Bookings' : 'Mark No-Show',
        confirmVariant: bulkStatus === 'cancelled' ? 'danger' : 'warning',
        onConfirm: () =>
          applyBookingStatusForIds(selectedBookingIds, bulkStatus, `Status updated to ${bulkStatus.replace('_', ' ')}.`),
      });
      return;
    }
    applyBookingStatusForIds(selectedBookingIds, bulkStatus, `Status updated to ${bulkStatus.replace('_', ' ')}.`);
  }

  function clearSelectedSla() {
    const pendingSelectedIds = bookings
      .filter((booking) => selectedBookingIds.includes(booking.id) && (booking.booking_status ?? booking.status) === 'pending')
      .map((booking) => booking.id);

    if (pendingSelectedIds.length === 0) {
      showToast('Select at least one pending booking to clear SLA.', 'error');
      return;
    }

    applyBookingStatusForIds(
      pendingSelectedIds,
      'confirmed',
      `SLA cleared for ${pendingSelectedIds.length} booking(s).`,
    );
  }

  function promoteUserToRole(role: 'admin' | 'provider' | 'staff') {
    const normalizedEmail = promoteEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await adminRequest<{ success: true; user: { id: string; email: string | null; role: 'admin' | 'provider' | 'staff' } }>(
          '/api/admin/users/promote',
          {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail, role }),
          },
        );
        setPromoteEmail('');
        showToast(`User promoted to ${role}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : `Unable to promote user to ${role}.`, 'error');
      }
    });
  }

  function reassignProvider(bookingId: number, providerId: number) {
    const previous = bookings;
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              provider_id: providerId,
              status: 'pending',
              booking_status: 'pending',
            }
          : booking,
      ),
    );

    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/reassign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Reassign failed.', 'error');
        return;
      }

      showToast('Provider reassigned.', 'success');
    });
  }

  function applyBookingAdjustment(bookingId: number) {
    openConfirm({
      title: 'Apply Booking Adjustment',
      description: 'This will cancel the booking and record an adjustment for the direct provider payment model.',
      confirmLabel: 'Apply Adjustment',
      confirmVariant: 'warning',
      inputLabel: 'Adjustment note',
      inputDefaultValue: 'Booking cancelled by admin (direct provider payment model)',
      onConfirm: (reason) =>
        doApplyBookingAdjustment(
          bookingId,
          reason?.trim() || 'Booking cancelled by admin (direct provider payment model)',
        ),
    });
  }

  function doApplyBookingAdjustment(bookingId: number, reason: string) {
    startTransition(async () => {
      try {
        await adminRequest<{ success: true; booking: AdminBooking }>(`/api/admin/bookings/${bookingId}/adjustment`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });

        setBookings((current) =>
          current.map((booking) => (booking.id === bookingId ? { ...booking, status: 'cancelled', booking_status: 'cancelled' } : booking)),
        );
        showToast('Booking adjustment applied and status set to cancelled.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to apply booking adjustment.', 'error');
      }
    });
  }

  function markCashPaymentReceived(bookingId: number) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) {
      showToast('Booking not found.', 'error');
      return;
    }

    if (booking.payment_mode !== 'direct_to_provider') {
      showToast('Manual collection is only available for direct-to-provider payments.', 'error');
      return;
    }

    if (booking.cash_collected) {
      showToast('Payment is already marked as received.', 'success');
      return;
    }

    openConfirm({
      title: 'Mark Cash As Received',
      description: `Confirm cash has been collected for booking #${bookingId}. This will allow completion.`,
      confirmLabel: 'Mark Received',
      confirmVariant: 'warning',
      onConfirm: () => doMarkCashPaymentReceived(bookingId),
    });
  }

  function doMarkCashPaymentReceived(bookingId: number) {

    setBookings((current) =>
      current.map((item) => (item.id === bookingId ? { ...item, cash_collected: true } : item)),
    );

    startTransition(async () => {
      try {
        const response = await fetch(`/api/payments/bookings/${bookingId}/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionMode: 'cash' }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to mark payment as received.');
        }

        await refreshBookings(bookingSearchDebounced);
        showToast(`Cash payment received for booking #${bookingId}.`, 'success');
      } catch (error) {
        await refreshBookings(bookingSearchDebounced);
        showToast(error instanceof Error ? error.message : 'Unable to mark payment as received.', 'error');
      }
    });
  }

  function moderateProvider(providerId: number, action: 'enable' | 'disable') {
    if (action === 'disable') {
      openConfirm({
        title: 'Suspend Provider',
        description: "This will suspend the provider's account. They will not be able to receive new bookings.",
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
      (current) => current.map((row) => {
        if (row.id !== providerId) {
          return row;
        }
        if (action === 'enable') {
          return {
            ...row,
            account_status: 'active',
          };
        }

        return {
          ...row,
          account_status: 'suspended',
        };
      }),
      async () => {
        const routeAction = action === 'disable' ? 'suspend' : 'enable';
        const response = await fetch(`/api/admin/providers/${providerId}/${routeAction}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to ${action} provider`);
        }
      },
      () => showToast(`Provider ${action}d successfully.`, 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function approveProvider(providerId: number) {
    performProviderUpdate(
      (current) =>
        current.map((row) =>
          row.id !== providerId ? row : { ...row, admin_approval_status: 'approved', account_status: 'active' },
        ),
      async () => {
        const response = await fetch(`/api/admin/providers/${providerId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Unable to approve provider');
      },
      () => showToast('Provider approved.', 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function rejectProvider(providerId: number) {
    openConfirm({
      title: 'Reject Provider',
      description: 'This will mark the provider application as rejected. The provider will be notified.',
      confirmLabel: 'Reject Provider',
      confirmVariant: 'danger',
      onConfirm: () => doRejectProvider(providerId),
    });
  }

  function doRejectProvider(providerId: number) {
    performProviderUpdate(
      (current) =>
        current.map((row) =>
          row.id !== providerId ? row : { ...row, admin_approval_status: 'rejected' },
        ),
      async () => {
        const response = await fetch(`/api/admin/providers/${providerId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Unable to reject provider');
      },
      () => showToast('Provider rejected.', 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function removeProvider(providerId: number) {
    if (deletingProviderId === providerId) {
      return;
    }

    openConfirm({
      title: 'Delete Provider Permanently',
      description:
        'This will permanently delete the provider and all associated data. This action cannot be undone.',
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

    setProviderRows((current) => current.filter((row) => row.id !== providerId));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/providers/${providerId}/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let message = 'Unable to delete provider';

          try {
            const payload = await response.json();
            if (payload && typeof payload.error === 'string' && payload.error.trim()) {
              message = payload.error;
            }
          } catch (err) { console.error(err);
            // Ignore JSON parse errors and keep default message
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
    const action = enable ? 'enable' : 'disable';

    // Optimistically update UI
    setServicesByProvider((current) => ({
      ...current,
      [providerId]: previousServices.map((service) => ({
        ...service,
        is_active: enable,
      })),
    }));

    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/providers/${providerId}/services/toggle`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: enable }),
        });
        showToast(`Provider services ${action}d successfully.`, 'success');
      } catch (error) {
        // Revert on error
        setServicesByProvider((current) => ({
          ...current,
          [providerId]: previousServices,
        }));
        showToast(error instanceof Error ? error.message : `Unable to ${action} provider services.`, 'error');
      }
    });
  }

  function handleOnboardingSuccess(onboardedEmail: string) {
    // Refresh provider list
    refreshProviders();
    showToast(`Provider onboarded and invite email sent to ${onboardedEmail}.`, 'success');
  }

  async function loadProviderOperationalData(providerId: number) {
    if (providerDetailsLoadingById[providerId] || providerDetailsLoadedById[providerId]) {
      return;
    }

    setProviderDetailsLoadingById((current) => ({
      ...current,
      [providerId]: true,
    }));

    try {
      const [availabilityResponse, servicesResponse] = await Promise.all([
        adminRequest<{ availability: AdminProviderAvailability[] }>(`/api/admin/providers/${providerId}/availability`, {
          method: 'GET',
        }),
        adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'GET',
          },
        ),
      ]);

      // Deduplicate by day|start(HH:MM)|end(HH:MM) — the DB may already have
      // duplicates from prior adds. Dedup on load so the UI is immediately correct,
      // then auto-save the clean list to purge the stale rows from the DB.
      const rawRows = availabilityResponse.availability;
      const dedupedOnLoad = Array.from(
        new Map(
          rawRows.map((row) => [
            `${row.day_of_week}|${row.start_time.slice(0, 5)}|${row.end_time.slice(0, 5)}`,
            row,
          ]),
        ).values(),
      );

      setAvailabilityByProvider((current) => ({
        ...current,
        [providerId]: dedupedOnLoad,
      }));

      if (dedupedOnLoad.length < rawRows.length) {
        // Stale duplicates detected — persist the deduplicated list to DB immediately.
        saveAvailability(providerId, dedupedOnLoad);
      }

      setServicesByProvider((current) => ({
        ...current,
        [providerId]: servicesResponse.services,
      }));

      setPincodesByService((current) => {
        const next = { ...current };

        for (const service of servicesResponse.services) {
          next[service.id] = service.service_pincodes ?? [];
        }

        return next;
      });

      setProviderDetailsLoadedById((current) => ({
        ...current,
        [providerId]: true,
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load provider details.', 'error');
    } finally {
      setProviderDetailsLoadingById((current) => ({
        ...current,
        [providerId]: false,
      }));
    }
  }

  function toggleProviderCard(providerId: number) {
    const isExpanded = expandedProviderIds.includes(providerId);

    if (isExpanded) {
      setExpandedProviderIds((current) => current.filter((id) => id !== providerId));
      return;
    }

    setExpandedProviderIds((current) => [...current, providerId]);
    void loadProviderOperationalData(providerId);
  }

  function focusProviderCard(providerId: number) {
    const isExpanded = expandedProviderIds.includes(providerId);

    if (!isExpanded) {
      setExpandedProviderIds((current) => [...current, providerId]);
      void loadProviderOperationalData(providerId);
    }

    window.setTimeout(() => {
      const target = providerCardRefs.current[providerId];
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, isExpanded ? 20 : 140);
  }

  const runSchemaSyncHealthCheck = useCallback(() => {
    setIsSchemaSyncChecking(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/health/schema-sync', {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json().catch(() => null)) as SchemaSyncHealthResponse | { error?: string } | null;

        if (!response.ok) {
          const errorMessage = payload && 'error' in payload && payload.error ? payload.error : 'Schema health check failed';
          throw new Error(errorMessage);
        }

        const health = payload as SchemaSyncHealthResponse;
        setSchemaSyncHealth(health);
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setSchemaSyncDurationMs(Math.round(finishedAt - startedAt));

        if (health.healthy) {
          showToast('Schema sync check passed.', 'success');
          return;
        }

        showToast(`Schema sync check found ${health.summary.failed} issue(s).`, 'error');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Schema health check failed';
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setSchemaSyncDurationMs(Math.round(finishedAt - startedAt));
        setSchemaSyncHealth({
          healthy: false,
          domain: 'schema-contract',
          checks: [],
          failed_checks: [],
          summary: {
            total: 0,
            passed: 0,
            failed: 0,
          },
          generated_at: new Date().toISOString(),
          error: message,
        });
        showToast(message, 'error');
      } finally {
        setIsSchemaSyncChecking(false);
      }
    });
  }, [showToast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBookingSearchDebounced(bookingSearchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [bookingSearchQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setUserSearchDebounced(userSearchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [userSearchQuery]);

  useEffect(() => {
    if (!isBookingsView) {
      return;
    }

    refreshBookings(bookingSearchDebounced);
  }, [bookingSearchDebounced, isBookingsView, refreshBookings]);

  useEffect(() => {
    if (!isUsersView) {
      return;
    }

    void fetchAdminUsers();
  }, [fetchAdminUsers, isUsersView]);

  useEffect(() => {
    return () => {
      if (bookingActivityTimeoutRef.current !== null) {
        window.clearTimeout(bookingActivityTimeoutRef.current);
      }
    };
  }, []);

  const logBookingModerationActivity = useCallback((message: string) => {
    setBookingModerationActivity(message);

    if (bookingActivityTimeoutRef.current !== null) {
      window.clearTimeout(bookingActivityTimeoutRef.current);
    }

    bookingActivityTimeoutRef.current = window.setTimeout(() => {
      setBookingModerationActivity(null);
      bookingActivityTimeoutRef.current = null;
    }, 8000);
  }, []);

  function downloadSchemaHealthReport() {
    if (!schemaSyncHealth || typeof window === 'undefined') {
      return;
    }

    const reportPayload = {
      ...schemaSyncHealth,
      duration_ms: schemaSyncDurationMs,
      downloaded_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `schema-health-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  const runFunctionalHealthChecks = useCallback(() => {
    setIsFunctionalHealthChecking(true);

    startTransition(async () => {
      try {
        const nextChecks = await Promise.all(
          functionalHealthChecks.map(async (check) => {
            const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

            try {
              const response = await fetch(check.endpoint, {
                method: 'GET',
                cache: 'no-store',
              });

              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const durationMs = Math.round(finishedAt - startedAt);

              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                return {
                  ...check,
                  status: 'unhealthy' as const,
                  durationMs,
                  lastRunAt: new Date().toISOString(),
                  error: payload?.error ?? `HTTP ${response.status}`,
                };
              }

              return {
                ...check,
                status: 'healthy' as const,
                durationMs,
                lastRunAt: new Date().toISOString(),
                error: null,
              };
            } catch (error) {
              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const durationMs = Math.round(finishedAt - startedAt);

              return {
                ...check,
                status: 'unhealthy' as const,
                durationMs,
                lastRunAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Request failed',
              };
            }
          }),
        );

        setFunctionalHealthChecks(nextChecks);

        const unhealthyCount = nextChecks.filter((check) => check.status === 'unhealthy').length;
        if (unhealthyCount === 0) {
          showToast('All functional health checks passed.', 'success');
        } else {
          showToast(`${unhealthyCount} functional check(s) failed.`, 'error');
        }
      } finally {
        setIsFunctionalHealthChecking(false);
      }
    });
  }, [functionalHealthChecks, showToast]);

  useEffect(() => {
    if (!isHealthView || hasAutoRunSchemaHealth || isSchemaSyncChecking) {
      return;
    }

    setHasAutoRunSchemaHealth(true);
    runSchemaSyncHealthCheck();
    runFunctionalHealthChecks();
  }, [hasAutoRunSchemaHealth, isHealthView, isSchemaSyncChecking, runFunctionalHealthChecks, runSchemaSyncHealthCheck]);

  function setServiceDraftField(providerId: number, field: keyof ServiceRolloutDraft, value: string | boolean) {
    const normalizedValue =
      field === 'service_pincodes' && typeof value === 'string'
        ? value.replace(/[^\d,\s]/g, '')
        : value;

    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: current[providerId]?.id,
        service_pincodes: current[providerId]?.service_pincodes ?? '',
        [field]: normalizedValue,
      },
    }));
  }

  function parseServicePincodeCsv(value: string) {
    const entries = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const invalid = entries.filter((item) => !/^[1-9]\d{5}$/.test(item));
    return { entries, invalid };
  }

  function copyServiceIntoDraft(providerId: number, serviceId: string) {
    const service = (servicesByProvider[providerId] ?? []).find((item) => item.id === serviceId);

    if (!service) {
      return;
    }

    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: service.id,
        service_pincodes: (pincodesByService[service.id] ?? []).join(', '),
      },
    }));

    setSelectedServiceTypesByProvider((current) => ({
      ...current,
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
    setSelectedServiceTypesByProvider((current) => {
      const fallbackSelection = providerServicesRows.map((service) => service.service_type);
      const currentSelection = current[providerId] ?? fallbackSelection;
      const normalizedCurrent = new Set(currentSelection.map((value) => value.trim()).filter((value) => value.length > 0));
      const normalizedServiceType = serviceType.trim();

      if (!normalizedServiceType) {
        return current;
      }

      if (isChecked) {
        normalizedCurrent.add(normalizedServiceType);
      } else {
        normalizedCurrent.delete(normalizedServiceType);
      }

      const nextSelection = providerServiceTypeOptions.filter((value) => normalizedCurrent.has(value.trim()));

      return {
        ...current,
        [providerId]: nextSelection,
      };
    });
  }

  function setAllProviderServiceSelections(
    providerId: number,
    providerServiceTypeOptions: string[],
    isSelected: boolean,
  ) {
    setSelectedServiceTypesByProvider((current) => ({
      ...current,
      [providerId]: isSelected ? [...providerServiceTypeOptions] : [],
    }));
  }

  function submitServiceRollout(
    providerId: number,
    providerServiceTypeOptions: string[],
    providerServicesRows: AdminProviderService[],
  ) {
    const draft = serviceDraft[providerId];
    const selectedServiceTypes = selectedServiceTypesByProvider[providerId] ?? providerServicesRows.map((service) => service.service_type);

    const normalizedSelectedServiceTypes = Array.from(
      new Set(selectedServiceTypes.map((value) => value.trim()).filter((value) => value.length > 0)),
    ).filter((value) => providerServiceTypeOptions.includes(value));

    if (normalizedSelectedServiceTypes.length === 0) {
      showToast('Select at least one service to apply rollout.', 'error');
      return;
    }

    if (!draft) {
      showToast('Provide service configuration before saving.', 'error');
      return;
    }

    const existingServiceByType = new Map<string, AdminProviderService>();
    for (const service of providerServicesRows) {
      existingServiceByType.set(service.service_type.trim().toLowerCase(), service);
    }

    const { entries: servicePincodes, invalid: invalidPincodes } = parseServicePincodeCsv(draft.service_pincodes);

    if (invalidPincodes.length > 0) {
      showToast(
        `Service pincodes must be valid 6-digit numbers. Invalid: ${invalidPincodes.slice(0, 3).join(', ')}${invalidPincodes.length > 3 ? '...' : ''}`,
        'error',
      );
      return;
    }

    startTransition(async () => {
      try {
        const rolloutPayload = normalizedSelectedServiceTypes.map((serviceType) => {
          const existingService = existingServiceByType.get(serviceType.toLowerCase());
          const existingPincodes = existingService ? pincodesByService[existingService.id] ?? [] : [];

          return {
            id: existingService?.id,
            service_type: serviceType,
            is_active: true,
            service_pincodes: servicePincodes.length > 0 ? servicePincodes : existingPincodes,
          };
        });

        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'PUT',
            body: JSON.stringify(rolloutPayload),
          },
        );

        setServicesByProvider((current) => ({ ...current, [providerId]: response.services }));
        setPincodesByService((current) => {
          const next = { ...current };
          for (const service of response.services) {
            next[service.id] = service.service_pincodes ?? [];
          }
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

  function setGlobalServiceDraftField(field: keyof GlobalServiceRolloutDraft, value: string | boolean | string[]) {
    const normalizedValue =
      field === 'service_pincodes' && typeof value === 'string'
        ? value.replace(/[^\d,\s]/g, '')
        : value;

    setGlobalServiceDraft((current) => ({
      ...current,
      [field]: normalizedValue,
    }));
  }

  function toggleGlobalRolloutProviderType(providerType: string, checked: boolean) {
    setGlobalServiceDraft((current) => {
      const next = new Set(current.provider_types);
      if (checked) {
        next.add(providerType);
      } else {
        next.delete(providerType);
      }

      return {
        ...current,
        provider_types: Array.from(next),
      };
    });
  }

  function setServiceActivation(serviceType: string, isActive: boolean) {
    startTransition(async () => {
      try {
        const response = await adminRequest<{ summary: AdminServiceModerationSummaryItem[] }>(
          '/api/admin/services/moderation',
          {
            method: 'PATCH',
            body: JSON.stringify({
              service_type: serviceType,
              is_active: isActive,
            }),
          },
        );
        setServiceSummary(response.summary);
        showToast(`Service ${serviceType} ${isActive ? 'enabled' : 'disabled'} globally.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service activation.', 'error');
      }
    });
  }

  function rolloutGlobalService() {
    if (!globalServiceDraft.service_type.trim()) {
      showToast('Service type is required.', 'error');
      return;
    }

    const selectedServiceType = globalServiceDraft.service_type.trim();

    if (!selectedServiceType) {
      showToast('Service type is required.', 'error');
      return;
    }

    const basePrice = Number(globalServiceDraft.base_price);
    const surgePrice = globalServiceDraft.surge_price.trim() ? Number(globalServiceDraft.surge_price) : null;
    const commission = globalServiceDraft.commission_percentage.trim()
      ? Number(globalServiceDraft.commission_percentage)
      : null;
    const serviceDuration = globalServiceDraft.service_duration_minutes.trim()
      ? Number(globalServiceDraft.service_duration_minutes)
      : null;

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      showToast('Base price must be a valid non-negative number.', 'error');
      return;
    }

    if (surgePrice !== null && (!Number.isFinite(surgePrice) || surgePrice < 0)) {
      showToast('Surge price must be a valid non-negative number.', 'error');
      return;
    }

    if (commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
      showToast('Commission must be between 0 and 100.', 'error');
      return;
    }

    if (serviceDuration !== null && (!Number.isFinite(serviceDuration) || serviceDuration <= 0)) {
      showToast('Duration must be a positive number.', 'error');
      return;
    }

    const { entries: servicePincodes, invalid: invalidPincodes } = parseServicePincodeCsv(globalServiceDraft.service_pincodes);

    if (invalidPincodes.length > 0) {
      showToast(
        `Service pincodes must be valid 6-digit numbers. Invalid: ${invalidPincodes.slice(0, 3).join(', ')}${invalidPincodes.length > 3 ? '...' : ''}`,
        'error',
      );
      return;
    }

    const providerTypes = globalServiceDraft.provider_types
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    startTransition(async () => {
      try {
        const response = await adminRequest<{ summary: AdminServiceModerationSummaryItem[] }>(
          '/api/admin/services/moderation',
          {
            method: 'POST',
            body: JSON.stringify({
              service_type: selectedServiceType,
              base_price: basePrice,
              surge_price: surgePrice,
              commission_percentage: commission,
              service_duration_minutes: serviceDuration,
              is_active: true,
              service_pincodes: servicePincodes,
              provider_types: providerTypes.length > 0 ? providerTypes : undefined,
              overwrite_existing: globalServiceDraft.overwrite_existing,
            }),
          },
        );

        setServiceSummary(response.summary);
        setShowRolloutConfiguration(false);
        showToast('Global service rollout completed.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to rollout service globally.', 'error');
      }
    });
  }

  function setDiscountDraftField(field: keyof DiscountDraft, value: string | boolean) {
    setDiscountDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function refreshDiscountModeration() {
    const response = await adminRequest<{ discounts: PlatformDiscount[]; analytics: PlatformDiscountAnalyticsSummary }>(
      '/api/admin/discounts',
      {
        method: 'GET',
      },
    );

    setDiscounts(response.discounts);
    setDiscountAnalytics(response.analytics);
  }

  function loadDiscountInDraft(discount: PlatformDiscount) {
    setShowDiscountEditor(true);
    setDiscountDraft({
      id: discount.id,
      code: discount.code,
      title: discount.title,
      description: discount.description ?? '',
      discount_type: discount.discount_type,
      discount_value: String(discount.discount_value),
      max_discount_amount: discount.max_discount_amount === null ? '' : String(discount.max_discount_amount),
      min_booking_amount: discount.min_booking_amount === null ? '' : String(discount.min_booking_amount),
      applies_to_service_type: discount.applies_to_service_type ?? '',
      valid_from: discount.valid_from.slice(0, 16),
      valid_until: discount.valid_until ? discount.valid_until.slice(0, 16) : '',
      usage_limit_total: discount.usage_limit_total === null ? '' : String(discount.usage_limit_total),
      usage_limit_per_user: discount.usage_limit_per_user === null ? '' : String(discount.usage_limit_per_user),
      first_booking_only: discount.first_booking_only,
      is_active: discount.is_active,
    });
  }

  function resetDiscountDraft() {
    setDiscountDraft({
      code: '',
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      max_discount_amount: '',
      min_booking_amount: '',
      applies_to_service_type: '',
      valid_from: new Date().toISOString().slice(0, 16),
      valid_until: '',
      usage_limit_total: '',
      usage_limit_per_user: '',
      first_booking_only: false,
      is_active: true,
    });
  }

  function saveDiscount() {
    if (!discountDraft.code.trim() || !discountDraft.title.trim()) {
      showToast('Discount code and title are required.', 'error');
      return;
    }

    const discountValue = Number(discountDraft.discount_value);

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      showToast('Discount value must be a positive number.', 'error');
      return;
    }

    const maxDiscountAmount = discountDraft.max_discount_amount.trim() ? Number(discountDraft.max_discount_amount) : null;
    const minBookingAmount = discountDraft.min_booking_amount.trim() ? Number(discountDraft.min_booking_amount) : null;
    const usageLimitTotal = discountDraft.usage_limit_total.trim() ? Number(discountDraft.usage_limit_total) : null;
    const usageLimitPerUser = discountDraft.usage_limit_per_user.trim() ? Number(discountDraft.usage_limit_per_user) : null;

    const validFromDate = new Date(discountDraft.valid_from);
    const validUntilDate = discountDraft.valid_until.trim() ? new Date(discountDraft.valid_until) : null;

    if (!discountDraft.valid_from || Number.isNaN(validFromDate.getTime())) {
      showToast('Provide a valid start date and time.', 'error');
      return;
    }

    if (validUntilDate && Number.isNaN(validUntilDate.getTime())) {
      showToast('Provide a valid end date and time.', 'error');
      return;
    }

    const validFromIso = validFromDate.toISOString();
    const validUntilIso = validUntilDate ? validUntilDate.toISOString() : null;

    startTransition(async () => {
      try {
        const response = await adminRequest<{ discount: PlatformDiscount }>('/api/admin/discounts', {
          method: 'POST',
          body: JSON.stringify({
            id: discountDraft.id,
            code: discountDraft.code.trim().toUpperCase(),
            title: discountDraft.title.trim(),
            description: discountDraft.description.trim() || null,
            discount_type: discountDraft.discount_type,
            discount_value: discountValue,
            max_discount_amount: maxDiscountAmount,
            min_booking_amount: minBookingAmount,
            applies_to_service_type: discountDraft.applies_to_service_type.trim() || null,
            valid_from: validFromIso,
            valid_until: validUntilIso,
            usage_limit_total: usageLimitTotal,
            usage_limit_per_user: usageLimitPerUser,
            first_booking_only: discountDraft.first_booking_only,
            is_active: discountDraft.is_active,
          }),
        });

        setDiscounts((current) => {
          const existingIndex = current.findIndex((discount) => discount.id === response.discount.id);

          if (existingIndex === -1) {
            return [response.discount, ...current];
          }

          const next = [...current];
          next[existingIndex] = response.discount;
          return next;
        });
        await refreshDiscountModeration();

        resetDiscountDraft();
        setShowDiscountEditor(false);
        showToast('Discount saved.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to save discount.', 'error');
      }
    });
  }

  function toggleDiscount(discountId: string, isActive: boolean) {
    startTransition(async () => {
      try {
        const response = await adminRequest<{ discount: PlatformDiscount }>(`/api/admin/discounts/${discountId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: isActive }),
        });

        setDiscounts((current) => current.map((item) => (item.id === discountId ? response.discount : item)));
        await refreshDiscountModeration();
        showToast(`Discount ${isActive ? 'enabled' : 'disabled'}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update discount.', 'error');
      }
    });
  }

  function removeDiscount(discountId: string) {
    openConfirm({
      title: 'Delete Discount',
      description: 'This will permanently delete the discount code. Any existing redemptions will be unaffected.',
      confirmLabel: 'Delete Discount',
      confirmVariant: 'danger',
      onConfirm: () => doRemoveDiscount(discountId),
    });
  }

  function doRemoveDiscount(discountId: string) {
    startTransition(async () => {
      try {
        await adminRequest<{ success: true }>(`/api/admin/discounts/${discountId}`, {
          method: 'DELETE',
        });

        setDiscounts((current) => current.filter((item) => item.id !== discountId));
        if (discountDraft.id === discountId) {
          resetDiscountDraft();
          setShowDiscountEditor(false);
        }
        await refreshDiscountModeration();
        showToast('Discount deleted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete discount.', 'error');
      }
    });
  }

  function setLocationDraftField(providerId: number, field: keyof LocationDraft, value: string) {
    const normalizedValue = field === 'pincode' ? value.replace(/\D/g, '').slice(0, 6) : value;

    setLocationDraft((current) => ({
      ...current,
      [providerId]: {
        address: current[providerId]?.address ?? '',
        city: current[providerId]?.city ?? '',
        state: current[providerId]?.state ?? '',
        pincode: current[providerId]?.pincode ?? '',
        latitude: current[providerId]?.latitude ?? '',
        longitude: current[providerId]?.longitude ?? '',
        service_radius_km: current[providerId]?.service_radius_km ?? '',
        [field]: normalizedValue,
      },
    }));
  }

  function copyLocationIntoDraft(provider: AdminProviderModerationItem) {
    setLocationDraft((current) => ({
      ...current,
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
    setLocationDraft((current) => {
      if (!current[providerId]) {
        return current;
      }

      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function getLocationDraftForProvider(provider: AdminProviderModerationItem, current: Record<number, LocationDraft>) {
    return current[provider.id] ?? {
      address: provider.address ?? '',
      city: provider.city ?? '',
      state: provider.state ?? '',
      pincode: provider.pincode ?? '',
      latitude: provider.latitude === null ? '' : String(provider.latitude),
      longitude: provider.longitude === null ? '' : String(provider.longitude),
      service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
    };
  }

  function applyLocationWarningSuggestion(
    provider: AdminProviderModerationItem,
    warning: string,
    coveragePincodes: string[],
  ) {
    let changeSummary = '';

    setLocationDraft((current) => {
      const existing = getLocationDraftForProvider(provider, current);
      const next = applyLocationWarningToDraft(existing, warning, coveragePincodes);
      changeSummary = buildLocationChangeSummary(existing, next);

      return {
        ...current,
        [provider.id]: next,
      };
    });

    showToast(
      changeSummary
        ? `Suggestion applied: ${changeSummary}`
        : 'Suggestion applied (no field changes were required).',
      'success',
    );
    setLocationLastAutoFixNote((current) => ({
      ...current,
      [provider.id]: changeSummary
        ? `Last auto-fix: ${changeSummary}`
        : 'Last auto-fix: No field changes were required.',
    }));
  }

  function dismissLocationAutoFixNote(providerId: number) {
    setLocationLastAutoFixNote((current) => {
      if (!current[providerId]) {
        return current;
      }

      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function copyProviderProfileIntoDraft(provider: AdminProviderModerationItem) {
    setProviderProfileDraft((current) => ({
      ...current,
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
        number_of_doctors:
          provider.clinic_details?.number_of_doctors === null || provider.clinic_details?.number_of_doctors === undefined
            ? ''
            : String(provider.clinic_details.number_of_doctors),
        hospitalization_available: provider.clinic_details?.hospitalization_available ?? false,
        emergency_services_available: provider.clinic_details?.emergency_services_available ?? false,
      },
    }));
  }

  function setProviderProfileDraftField(
    providerId: number,
    field: keyof ProviderProfileDraft,
    value: string | boolean,
  ) {
    setProviderProfileDraft((current) => ({
      ...current,
      [providerId]: {
        name: current[providerId]?.name ?? '',
        email: current[providerId]?.email ?? '',
        provider_type: current[providerId]?.provider_type ?? '',
        business_name: current[providerId]?.business_name ?? '',
        profile_photo_url: current[providerId]?.profile_photo_url ?? '',
        service_radius_km: current[providerId]?.service_radius_km ?? '',
        license_number: current[providerId]?.license_number ?? '',
        specialization: current[providerId]?.specialization ?? '',
        teleconsult_enabled: current[providerId]?.teleconsult_enabled ?? false,
        emergency_service_enabled: current[providerId]?.emergency_service_enabled ?? false,
        equipment_details: current[providerId]?.equipment_details ?? '',
        insurance_document_url: current[providerId]?.insurance_document_url ?? '',
        registration_number: current[providerId]?.registration_number ?? '',
        gst_number: current[providerId]?.gst_number ?? '',
        number_of_doctors: current[providerId]?.number_of_doctors ?? '',
        hospitalization_available: current[providerId]?.hospitalization_available ?? false,
        emergency_services_available: current[providerId]?.emergency_services_available ?? false,
        [field]: value,
      },
    }));
  }

  function cancelProviderProfileEdit(providerId: number) {
    setProviderProfileDraft((current) => {
      if (!current[providerId]) {
        return current;
      }

      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function saveProviderProfile(providerId: number) {
    const provider = providerRows.find((row) => row.id === providerId);

    if (!provider) {
      showToast('Provider not found.', 'error');
      return;
    }

    const draft = providerProfileDraft[providerId];

    if (!draft) {
      showToast('No profile changes to save.', 'error');
      return;
    }

    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    const providerType = draft.provider_type.trim();
    const serviceRadiusKm = draft.service_radius_km.trim() ? Number(draft.service_radius_km) : null;
    const numberOfDoctors = draft.number_of_doctors.trim() ? Number(draft.number_of_doctors) : null;

    if (!name) {
      showToast('Provider name is required.', 'error');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Provide a valid email address.', 'error');
      return;
    }

    if (!providerType) {
      showToast('Provider type is required.', 'error');
      return;
    }

    if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0)) {
      showToast('Service radius must be a valid non-negative number.', 'error');
      return;
    }

    if (numberOfDoctors !== null && (!Number.isFinite(numberOfDoctors) || numberOfDoctors < 0)) {
      showToast('Number of doctors must be a valid non-negative number.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await adminRequest<{
          provider: {
            id: number;
            name: string;
            email: string | null;
            profile_photo_url: string | null;
            provider_type: string;
            business_name: string | null;
            service_radius_km: number | null;
            updated_at: string;
            professional_details: {
              license_number: string | null;
              specialization: string | null;
              teleconsult_enabled: boolean;
              emergency_service_enabled: boolean;
              equipment_details: string | null;
              insurance_document_url: string | null;
            } | null;
            clinic_details: {
              registration_number: string | null;
              gst_number: string | null;
              number_of_doctors: number | null;
              hospitalization_available: boolean;
              emergency_services_available: boolean;
            } | null;
          };
        }>(`/api/admin/providers/${providerId}/profile`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            email: email || null,
            provider_type: providerType,
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
        });

        setProviderRows((current) =>
          current.map((row) =>
            row.id === providerId
              ? {
                  ...row,
                  name: response.provider.name,
                  email: response.provider.email,
                  profile_photo_url: response.provider.profile_photo_url,
                  provider_type: response.provider.provider_type as AdminProviderModerationItem['provider_type'],
                  business_name: response.provider.business_name,
                  service_radius_km: response.provider.service_radius_km,
                  updated_at: response.provider.updated_at,
                  professional_details: response.provider.professional_details,
                  clinic_details: response.provider.clinic_details,
                }
              : row,
          ),
        );

        cancelProviderProfileEdit(providerId);
        showToast('Provider profile updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update provider profile.', 'error');
      }
    });
  }

  function saveProviderLocation(providerId: number) {
    const provider = providerRows.find((row) => row.id === providerId);

    if (!provider) {
      showToast('Provider not found.', 'error');
      return;
    }

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

    if ((latitude === null) !== (longitude === null)) {
      showToast('Latitude and longitude should be provided together.', 'error');
      return;
    }

    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
      showToast('Latitude must be between -90 and 90.', 'error');
      return;
    }

    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      showToast('Longitude must be between -180 and 180.', 'error');
      return;
    }

    if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0)) {
      showToast('Service radius must be a valid non-negative number.', 'error');
      return;
    }

    const pincode = draft.pincode.trim();
    const address = draft.address.trim();
    const city = draft.city.trim();
    const state = draft.state.trim();

    if (pincode && !/^\d{6}$/.test(pincode)) {
      showToast('Pincode should be a valid 6-digit Indian pincode.', 'error');
      return;
    }

    if (latitude !== null && longitude !== null && (!address || !city || !state || !pincode)) {
      showToast('Address, city, state and pincode are required when coordinates are provided.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await adminRequest<{
          location: {
            provider_id: number;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            service_radius_km: number | null;
          };
          coverageWarnings?: string[];
        }>(`/api/admin/providers/${providerId}/location`, {
          method: 'PATCH',
          body: JSON.stringify({
            address: address || null,
            city: city || null,
            state: state || null,
            pincode: pincode || null,
            latitude,
            longitude,
            service_radius_km: serviceRadiusKm,
          }),
        });

        setProviderRows((current) =>
          current.map((row) =>
            row.id === providerId
              ? {
                  ...row,
                  address: response.location.address,
                  city: response.location.city,
                  state: response.location.state,
                  pincode: response.location.pincode,
                  latitude: response.location.latitude,
                  longitude: response.location.longitude,
                  service_radius_km: response.location.service_radius_km,
                }
              : row,
          ),
        );
        setLocationCoverageWarnings((current) => ({
          ...current,
          [providerId]: response.coverageWarnings ?? [],
        }));
        setLocationDraft((current) => {
          if (!current[providerId]) {
            return current;
          }

          const next = { ...current };
          delete next[providerId];
          return next;
        });
        setLocationLastAutoFixNote((current) => {
          const next = { ...current };
          delete next[providerId];
          return next;
        });

        showToast('Location moderation updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update location moderation.', 'error');
      }
    });
  }

  function setAvailabilityDraftField(
    providerId: number,
    field: 'start_time' | 'end_time',
    value: string,
  ) {
    setAvailabilityDraft((current) => ({
      ...current,
      [providerId]: {
        selected_days: current[providerId]?.selected_days ?? [1],
        start_time: current[providerId]?.start_time ?? '09:00',
        end_time: current[providerId]?.end_time ?? '17:00',
        [field]: value,
      },
    }));
  }

  function toggleAvailabilityDraftWeekday(providerId: number, dayOfWeek: number, checked: boolean) {
    setAvailabilityDraft((current) => {
      const draft = current[providerId] ?? getDefaultAvailabilityDraft();
      const selectedDays = checked
        ? Array.from(new Set([...draft.selected_days, dayOfWeek])).sort((a, b) => a - b)
        : draft.selected_days.filter((day) => day !== dayOfWeek);

      return {
        ...current,
        [providerId]: {
          ...draft,
          selected_days: selectedDays,
        },
      };
    });
  }

  function saveAvailability(providerId: number, nextRows: AdminProviderAvailability[]) {
    // Deduplicate by day|start(HH:MM)|end(HH:MM) — keeps last writer, matching the
    // schema's superRefine key so the API never sees a duplicate-key payload.
    const deduped = Array.from(
      new Map(
        nextRows.map((row) => [
          `${row.day_of_week}|${row.start_time.slice(0, 5)}|${row.end_time.slice(0, 5)}`,
          row,
        ]),
      ).values(),
    );

    setAvailabilityByProvider((current) => ({ ...current, [providerId]: deduped }));

    startTransition(async () => {
      try {
        const response = await adminRequest<{ availability: AdminProviderAvailability[] }>(
          `/api/admin/providers/${providerId}/availability`,
          {
            method: 'PUT',
            body: JSON.stringify(
              deduped.map((row) => ({
                id: row.id,
                day_of_week: row.day_of_week,
                start_time: row.start_time,
                end_time: row.end_time,
                is_available: row.is_available,
              })),
            ),
          },
        );

        setAvailabilityByProvider((current) => ({ ...current, [providerId]: response.availability }));
        showToast('Availability updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update availability.', 'error');
      }
    });
  }

  function appendAvailabilitySlot(providerId: number) {
    const draft = availabilityDraft[providerId] ?? getDefaultAvailabilityDraft();

    const selectedDays = draft.selected_days.filter(
      (dayOfWeek) => Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6,
    );

    if (selectedDays.length === 0) {
      showToast('Please select a valid weekday.', 'error');
      return;
    }

    if (!draft.start_time || !draft.end_time || draft.start_time >= draft.end_time) {
      showToast('Provide a valid availability window.', 'error');
      return;
    }

    const current = availabilityByProvider[providerId] ?? [];

    const nextSlots: AdminProviderAvailability[] = selectedDays.map((dayOfWeek) => ({
      id: crypto.randomUUID(),
      provider_id: providerId,
      day_of_week: dayOfWeek,
      start_time: draft.start_time,
      end_time: draft.end_time,
      is_available: true,
    }));

    // Replace any existing entry for the same day — one row per weekday.
    const daysBeingAdded = new Set(selectedDays);
    const retained = current.filter((row) => !daysBeingAdded.has(row.day_of_week));

    saveAvailability(providerId, [...retained, ...nextSlots]);
  }

  function toggleAvailabilitySlot(providerId: number, slotId: string, isAvailable: boolean) {
    const current = availabilityByProvider[providerId] ?? [];
    const nextRows = current.map((row) => (row.id === slotId ? { ...row, is_available: isAvailable } : row));
    saveAvailability(providerId, nextRows);
  }

  return (
    <DashboardPageLayout
      title="Admin Operation Dashboard"
      description="Centralized platform control for providers, services, and access management."
      tabs={[
        { id: 'overview', label: 'Overview', href: '/dashboard/admin' },
        { id: 'bookings', label: 'Bookings', href: '/dashboard/admin/bookings' },
        { id: 'users', label: 'Users', href: '/dashboard/admin/users' },
        { id: 'providers', label: 'Providers', href: '/dashboard/admin/providers' },
        { id: 'services', label: 'Services', href: '/dashboard/admin/services' },
        { id: 'payments', label: 'Payments', href: '/dashboard/admin/payments' },
        { id: 'subscriptions', label: 'Subscriptions', href: '/dashboard/admin/subscriptions' },
        { id: 'billing', label: 'Billing', href: '/dashboard/admin/billing' },
        { id: 'billing_catalog', label: 'Billing Catalog', href: '/dashboard/admin/billing-catalog' },
        { id: 'access', label: 'Access', href: '/dashboard/admin/access' },
        { id: 'health', label: 'Health', href: '/dashboard/admin/health' },
        { id: 'audit', label: 'Audit Log', href: '/dashboard/admin/audit' },
      ]}
      activeTab={view}
    >
      <div className="space-y-8">
      {/* Content sections below */}

      {isOverviewView ? (
        <AdminOverviewView
          bookingCount={bookings.length}
          bookingRiskSummary={bookingRiskSummary}
          providerCount={providerRows.length}
          serviceCount={initialCatalogServices.length}
          customerCount={totalCustomers}
          activeDiscountCount={discountAnalytics.total_active_discounts}
          onNavigate={updateAdminView}
        />
      ) : null}

      {isBookingsView ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Booking Operations</h2>
          <p className="text-muted">Monitor booking pipeline, SLA risk, and fulfillment actions in one place</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="All Bookings"
            value={bookings.length}
            icon="calendar"
            description="Live pipeline volume"
          />
          <StatCard
            label="Bookings in Progress"
            value={bookingRiskSummary.inProgress}
            icon="trending-up"
            description="Pending and confirmed bookings"
          />
          <StatCard
            label="Completed Bookings"
            value={bookingRiskSummary.completed}
            icon="award"
            description="Successfully fulfilled bookings"
          />
          <StatCard
            label="No-show Bookings"
            value={bookingRiskSummary.noShow}
            icon="x-circle"
            description="Provider or customer no-show"
          />
          <StatCard
            label="Cancelled Bookings"
            value={bookingRiskSummary.cancelled}
            icon="x"
            description="Cancelled from pipeline"
          />
        </div>
      </section>
      ) : null}

      {isPaymentsView ? (
        <AdminPaymentsView
          transactions={paymentTransactions}
          isLoading={isFinanceDataLoading}
          page={paymentPage}
          onPageChange={setPaymentPage}
        />
      ) : null}

      {isSubscriptionsView ? (
        <AdminSubscriptionsView
          subscriptions={subscriptions}
          isLoading={isFinanceDataLoading}
          page={subscriptionPage}
          onPageChange={setSubscriptionPage}
          onUpdateStatus={updateSubscriptionStatus}
        />
      ) : null}

      {isBillingCatalogView ? (
        <AdminSubscriptionPlansClient />
      ) : null}

      {isBillingView ? (
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
          collectionsState={{
            metrics: billingCollectionsMetrics,
            isLoading: isBillingCollectionsMetricsLoading,
          }}
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
          onCreateInvoice={() => {
            resetManualInvoiceComposer();
            setIsCreateInvoiceModalOpen(true);
          }}
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
          onPageChange={(page) => {
            setBillingInvoicePage(page);
            void fetchBillingInvoices(page);
          }}
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
      ) : null}

      {isServicesView ? (
        <AdminServicesView
          serviceCatalogPanel={serviceCatalogPanel}
          onPanelChange={updateServiceCatalogPanel}
          initialServiceCategories={initialServiceCategories}
          initialCatalogServices={initialCatalogServices}
        />
      ) : null}

      {canManageUserAccess && isAccessView ? (
        <AdminAccessView
          promoteEmail={promoteEmail}
          onPromoteEmailChange={setPromoteEmail}
          onPromoteToRole={promoteUserToRole}
          isPending={isPending}
        />
      ) : null}

      {isHealthView ? (
        <AdminHealthView
          schemaSyncHealth={schemaSyncHealth}
          schemaSyncDurationMs={schemaSyncDurationMs}
          isSchemaSyncChecking={isSchemaSyncChecking}
          functionalHealthChecks={functionalHealthChecks}
          isFunctionalHealthChecking={isFunctionalHealthChecking}
          isPending={isPending}
          onRunSchemaSyncHealthCheck={runSchemaSyncHealthCheck}
          onRunFunctionalHealthChecks={runFunctionalHealthChecks}
          onDownloadSchemaHealthReport={downloadSchemaHealthReport}
        />
      ) : null}

      {isAuditView ? <AdminAuditView /> : null}

      {isBookingsView ? (
      <AdminBookingsView
        bookingRiskSummary={bookingRiskSummary}
        bookingSearchQuery={bookingSearchQuery}
        onSearchChange={setBookingSearchQuery}
        bookingFilter={bookingFilter}
        onFilterChange={setBookingFilter}
        bulkStatus={bulkStatus}
        onBulkStatusChange={setBulkStatus}
        onApplyBulkStatus={applyBulkStatus}
        selectedBookingIds={selectedBookingIds}
        onToggleBookingSelection={toggleBookingSelection}
        onClearSelectedSla={clearSelectedSla}
        bookingModerationActivity={bookingModerationActivity}
        visibleBookings={visibleBookings}
        providers={providers}
        isPending={isPending}
        onReassignProvider={reassignProvider}
        onOverrideStatus={overrideStatus}
        onApplyBookingAdjustment={applyBookingAdjustment}
        onMarkCashPaymentReceived={markCashPaymentReceived}
      />
      ) : null}

      {isUsersView ? (
        <AdminUsersView
          userSearchQuery={userSearchQuery}
          onSearchChange={setUserSearchQuery}
          isLoading={isUserSearchLoading}
          searchDebounced={userSearchDebounced}
          searchResults={userSearchResults}
          onAddUser={() => setIsCreateUserModalOpen(true)}
        />
      ) : null}

      {isProvidersView ? (
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
      ) : null}

      {isServicesView ? (
      <section className="rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-neutral-950">Service Catalog Management</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-600">Control service availability and rollout new services across the platform.</p>

        <div className="mt-4 rounded-xl bg-neutral-50/60 p-3">
          <p className="text-xs font-semibold text-neutral-950">Service Catalog Control</p>
          {serviceSummary.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No services found yet.</p>
          ) : (
            <div className="mt-2 max-h-[28rem] overflow-y-auto pr-1">
              <div className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap items-center gap-2 bg-neutral-50/95 px-1 py-1 text-[11px] text-neutral-700 backdrop-blur">
                <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 font-medium text-green-700">Enabled</span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">Disabled</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Partial / No rollout</span>
              </div>
              <ul className="grid gap-2">
                {serviceSummary.map((service) => {
                const isFullyEnabled = service.active_count > 0 && service.inactive_count === 0;
                const isFullyDisabled = service.inactive_count > 0 && service.active_count === 0;
                const statusLabel = isFullyEnabled
                  ? 'Enabled'
                  : isFullyDisabled
                    ? 'Disabled'
                    : service.active_count > 0 && service.inactive_count > 0
                      ? 'Partially enabled'
                      : 'No provider rollout';

                  return (
                    <li key={service.service_type} className="rounded-lg bg-white/70 p-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                            isFullyEnabled
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : isFullyDisabled
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700',
                          )}
                        >
                          {statusLabel}
                        </span>
                        <p className="font-medium text-neutral-950">
                          {service.service_type} • Providers: {service.provider_count} • Active:{' '}
                          <span className="text-green-700">{service.active_count}</span> • Inactive:{' '}
                          <span className="text-red-700">{service.inactive_count}</span> • Avg Price: ₹{service.average_base_price}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => setServiceActivation(service.service_type, true)}
                          disabled={isPending || isFullyEnabled}
                          variant="secondary"
                          size="sm"
                          className={cn(
                            'border-green-200 text-green-700',
                            isFullyEnabled ? 'bg-green-100' : 'bg-green-50 hover:bg-green-100',
                          )}
                        >
                          Enable
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setServiceActivation(service.service_type, false)}
                          disabled={isPending || isFullyDisabled}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'border-red-200 text-red-700',
                            isFullyDisabled ? 'bg-red-100' : 'bg-red-50 hover:bg-red-100',
                          )}
                        >
                          Disable
                        </Button>
                      </div>
                    </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl bg-neutral-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Global Service Rollout</p>
              <p className="mt-1 text-xs text-[#6b6b6b]">Deploy a service configuration across selected providers or the full network.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink">
                {rolloutTargetScopeLabel}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink">
                Service Types: {availableServiceTypes.length}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink">
                Saves as Active
              </span>
              <button
                type="button"
                onClick={() => setShowRolloutConfiguration(true)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                Edit Rollout
              </button>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {isServicesView ? (
      <section className="rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Offers & Discounts</h2>
            <p className="mt-1 text-xs text-[#6b6b6b]">Create, manage, and track promotional offers and discount codes.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetDiscountDraft();
              setShowDiscountEditor(true);
            }}
            className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95"
          >
            Create Discount
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-neutral-50/60 p-3 text-xs">
            <p className="text-[#6b6b6b]">Total Discounts</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_discounts}</p>
          </div>
          <div className="rounded-xl bg-neutral-50/60 p-3 text-xs">
            <p className="text-[#6b6b6b]">Active Discounts</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_active_discounts}</p>
          </div>
          <div className="rounded-xl bg-neutral-50/60 p-3 text-xs">
            <p className="text-[#6b6b6b]">Total Redemptions (Completed)</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_redemptions}</p>
          </div>
          <div className="rounded-xl bg-neutral-50/60 p-3 text-xs">
            <p className="text-[#6b6b6b]">Booking Redemption Rate (Completed)</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.booking_redemption_rate}%</p>
          </div>
        </div>
        <div className="mt-2 rounded-xl bg-neutral-50/70 p-3 text-xs text-[#6b6b6b]">
          Total discount amount issued: <span className="font-semibold text-ink">₹{discountAnalytics.total_discount_amount}</span>
          {discountAnalytics.top_discounts.length > 0 ? (
            <span>
              {' '}
              • Top codes:{' '}
              {discountAnalytics.top_discounts
                .map((item) => `${item.code} (${item.redemption_count})`)
                .join(', ')}
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl bg-neutral-50/60 p-3">
          <p className="text-xs font-semibold text-ink">Existing Discounts</p>
          {discounts.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No discounts configured yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {discounts.map((discount) => (
                <li key={discount.id} className="rounded-lg bg-white/80 p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {discount.code} • {discount.title} • {discount.discount_type} {discount.discount_value}
                    </p>
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        discount.is_active
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-red-200 bg-red-50 text-red-700',
                      )}
                    >
                      {discount.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6b6b6b]">
                    Valid: {formatAdminDateTime(discount.valid_from)} -{' '}
                    {discount.valid_until ? formatAdminDateTime(discount.valid_until) : 'No expiry'}
                  </p>
                  {discount.first_booking_only ? (
                    <p className="mt-1 text-[11px] font-medium text-ink">Applies to first booking only</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadDiscountInDraft(discount)}
                      disabled={isPending}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDiscount(discount.id, !discount.is_active)}
                      disabled={isPending}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60',
                        discount.is_active
                          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
                      )}
                    >
                      {discount.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDiscount(discount.id)}
                      disabled={isPending}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}

      {!canManageUserAccess && isAccessView ? (
        <section className="rounded-2xl bg-white p-6">
          <p className="text-sm text-neutral-600">Admin access controls are available only to admin role users.</p>
        </section>
      ) : null}
      </div>

      <Modal
        isOpen={isCreateUserModalOpen}
        onClose={() => {
          if (isCreatingUser) {
            return;
          }
          setIsCreateUserModalOpen(false);
          resetCreateUserDraft();
        }}
        size="md"
        title="Add New Customer"
        description="Create a customer profile from admin dashboard, with optional no-email fallback."
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={createUserDraft.name}
            onChange={(event) =>
              setCreateUserDraft((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Customer full name"
          />
          {!createUserDraft.noEmailInvite ? (
            <Input
              label="Email"
              type="email"
              value={createUserDraft.email}
              onChange={(event) =>
                setCreateUserDraft((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="customer@example.com"
            />
          ) : null}
          <Input
            label="Phone"
            value={createUserDraft.phone}
            onChange={(event) =>
              setCreateUserDraft((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="9876543210 or +919876543210"
          />

          <label className="inline-flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              checked={createUserDraft.noEmailInvite}
              onChange={(event) =>
                setCreateUserDraft((current) => ({
                  ...current,
                  noEmailInvite: event.target.checked,
                  email: event.target.checked ? '' : current.email,
                }))
              }
              className="mt-0.5"
            />
            <span>Customer has no email. Create a phone-only profile without sending invite.</span>
          </label>

          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            {createUserDraft.noEmailInvite
              ? 'No invite email will be sent. Continue to Bookings and search by phone.'
              : 'The user will receive an invitation email. Continue to Bookings and search by email or phone.'}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (isCreatingUser) {
                  return;
                }
                setIsCreateUserModalOpen(false);
                resetCreateUserDraft();
              }}
              disabled={isCreatingUser}
              className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createDirectoryUser()}
              disabled={isCreatingUser}
              className="rounded-full border border-[#f2dfcf] bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#fff7f0] disabled:opacity-60"
            >
              {isCreatingUser ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => void createDirectoryUser({ openBookingsAfterCreate: true })}
              disabled={isCreatingUser}
              className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingUser ? 'Creating...' : 'Create & Open Bookings'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRolloutConfiguration}
        onClose={() => {
          setShowRolloutConfiguration(false);
        }}
        size="xl"
        title="Edit Global Rollout"
        description="Configure and deploy service pricing settings across providers."
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Available Service</label>
              <select
                value={globalServiceDraft.service_type}
                onChange={(event) => setGlobalServiceDraftField('service_type', event.target.value)}
                className="input-field w-full"
              >
                <option value="">Select a service</option>
                {availableServiceTypes.map((serviceType) => (
                  <option key={serviceType} value={serviceType}>
                    {serviceType}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Base Price"
              value={globalServiceDraft.base_price}
              onChange={(event) => setGlobalServiceDraftField('base_price', event.target.value)}
              placeholder="0"
            />
            <Input
              label="Surge Price"
              value={globalServiceDraft.surge_price}
              onChange={(event) => setGlobalServiceDraftField('surge_price', event.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Commission %"
              value={globalServiceDraft.commission_percentage}
              onChange={(event) => setGlobalServiceDraftField('commission_percentage', event.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Duration (minutes)"
              value={globalServiceDraft.service_duration_minutes}
              onChange={(event) => setGlobalServiceDraftField('service_duration_minutes', event.target.value)}
              placeholder="e.g. 60"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              label="Service Pincodes"
              value={globalServiceDraft.service_pincodes}
              onChange={(event) => setGlobalServiceDraftField('service_pincodes', event.target.value)}
              placeholder="Indian pincodes (comma separated)"
            />
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Target Provider Types</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGlobalServiceDraftField('provider_types', [])}
                  className="rounded-full border border-[#f2dfcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-[#fff7f0]"
                >
                  Target All
                </button>
              </div>

              <div className="grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-[#f2dfcf] bg-white p-2 sm:grid-cols-2">
                {rolloutProviderTypeOptions.map((providerTypeOption) => {
                  const checked = globalServiceDraft.provider_types.includes(providerTypeOption.value);
                  return (
                    <label
                      key={providerTypeOption.value}
                      className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-ink hover:bg-[#fff7f0]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleGlobalRolloutProviderType(providerTypeOption.value, event.target.checked)}
                      />
                      <span>
                        {providerTypeOption.value.replaceAll('_', ' ')} ({providerTypeOption.count})
                      </span>
                    </label>
                  );
                })}
              </div>

              {rolloutProviderTypeOptions.length === 0 ? (
                <p className="text-[11px] text-[#6b6b6b]">
                  No onboarded provider types found yet. Rollout will apply to all approved active providers.
                </p>
              ) : null}

              <p className="text-[11px] text-[#6b6b6b]">
                {globalServiceDraft.provider_types.length > 0
                  ? `Selected: ${globalServiceDraft.provider_types.map((type) => type.replaceAll('_', ' ')).join(', ')}`
                  : 'No type selected: rollout applies to all approved active providers.'}
              </p>
              <p className="text-[11px] font-medium text-ink">{rolloutTargetScopeLabel}</p>
            </div>
          </div>

          <label className={cn('mt-2', adminToggleFieldClass)}>
            <input
              type="checkbox"
              checked={globalServiceDraft.overwrite_existing}
              onChange={(event) => setGlobalServiceDraftField('overwrite_existing', event.target.checked)}
            />
            Overwrite existing service config for targeted providers
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#6b6b6b]">If no provider types are selected, rollout applies to all approved active providers.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRolloutConfiguration(false);
                }}
                className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={rolloutGlobalService}
                disabled={isPending}
                className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rollout Service Globally
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDiscountEditor}
        onClose={() => {
          resetDiscountDraft();
          setShowDiscountEditor(false);
        }}
        size="xl"
        title={discountDraft.id ? 'Edit Discount' : 'Create Discount'}
        description="Create, update, and schedule promotional discount codes."
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={discountDraft.code}
              onChange={(event) => setDiscountDraftField('code', event.target.value.toUpperCase())}
              placeholder="Code (e.g. PET20)"
              className={adminRawFieldClass}
              disabled={Boolean(discountDraft.id)}
            />
            <input
              value={discountDraft.title}
              onChange={(event) => setDiscountDraftField('title', event.target.value)}
              placeholder="Title"
              className={adminRawFieldClass}
            />
            <select
              value={discountDraft.discount_type}
              onChange={(event) => setDiscountDraftField('discount_type', event.target.value as 'percentage' | 'flat')}
              className={adminRawFieldClass}
            >
              <option value="percentage">Percentage</option>
              <option value="flat">Flat</option>
            </select>
            <input
              value={discountDraft.discount_value}
              onChange={(event) => setDiscountDraftField('discount_value', event.target.value)}
              placeholder="Discount value"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.max_discount_amount}
              onChange={(event) => setDiscountDraftField('max_discount_amount', event.target.value)}
              placeholder="Max discount amount"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.min_booking_amount}
              onChange={(event) => setDiscountDraftField('min_booking_amount', event.target.value)}
              placeholder="Min booking amount"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.applies_to_service_type}
              onChange={(event) => setDiscountDraftField('applies_to_service_type', event.target.value)}
              placeholder="Service type (optional)"
              className={adminRawFieldClass}
            />
            <input
              type="datetime-local"
              value={discountDraft.valid_from}
              onChange={(event) => setDiscountDraftField('valid_from', event.target.value)}
              className={adminRawFieldClass}
            />
            <input
              type="datetime-local"
              value={discountDraft.valid_until}
              onChange={(event) => setDiscountDraftField('valid_until', event.target.value)}
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.usage_limit_total}
              onChange={(event) => setDiscountDraftField('usage_limit_total', event.target.value)}
              placeholder="Usage limit total"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.usage_limit_per_user}
              onChange={(event) => setDiscountDraftField('usage_limit_per_user', event.target.value)}
              placeholder="Usage limit per user"
              className={adminRawFieldClass}
            />
            <label className={adminToggleFieldClass}>
              <input
                type="checkbox"
                checked={discountDraft.first_booking_only}
                onChange={(event) => setDiscountDraftField('first_booking_only', event.target.checked)}
              />
              First Booking Only
            </label>
            <label
              className={cn(
                adminToggleFieldClass,
                discountDraft.is_active
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700',
              )}
            >
              <input
                type="checkbox"
                checked={discountDraft.is_active}
                onChange={(event) => setDiscountDraftField('is_active', event.target.checked)}
              />
              {discountDraft.is_active ? 'Discount Active' : 'Discount Inactive'}
            </label>
          </div>

          <textarea
            value={discountDraft.description}
            onChange={(event) => setDiscountDraftField('description', event.target.value)}
            placeholder="Description"
            rows={2}
            className={cn('w-full', adminRawFieldClass)}
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                resetDiscountDraft();
                setShowDiscountEditor(false);
              }}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDiscount}
              disabled={isPending}
              className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {discountDraft.id ? 'Update Discount' : 'Create Discount'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isInvoiceDetailsModalOpen}
        onClose={() => {
          if (isInvoiceDetailsLoading) {
            return;
          }
          setIsInvoiceDetailsModalOpen(false);
        }}
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

      <Modal
        isOpen={isCreateInvoiceModalOpen}
        onClose={() => {
          if (isCreatingInvoice) {
            return;
          }
          resetManualInvoiceComposer();
          setIsCreateInvoiceModalOpen(false);
        }}
        size="xl"
        title="Create Manual Invoice"
        description="Generate an invoice for a specific user with full control over status, amounts, and linkage."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Invoice Presets</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {invoicePresets.map((preset) => {
                const isSelected = selectedInvoicePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyInvoicePreset(preset.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'border-coral bg-coral/10'
                        : 'border-neutral-200 bg-white hover:border-neutral-300',
                    )}
                  >
                    <p className="text-xs font-semibold text-neutral-900">{preset.label}</p>
                    <p className="mt-1 text-[11px] text-neutral-600">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">User Lookup</p>
            <input
              value={billingUserLookupQuery}
              onChange={(event) => setBillingUserLookupQuery(event.target.value)}
              placeholder="Search by name, email, phone, or user id"
              className={adminRawFieldClass}
            />
            {isBillingUserLookupLoading ? (
              <p className="text-xs text-neutral-500">Searching users...</p>
            ) : null}
            {!isBillingUserLookupLoading && billingUserLookupDebounced && billingUserLookupResults.length === 0 ? (
              <p className="text-xs text-neutral-500">No matching users found.</p>
            ) : null}
            {billingUserLookupResults.length > 0 ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2">
                {billingUserLookupResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => selectBillingUser(user)}
                    className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-left hover:border-neutral-300"
                  >
                    <p className="text-xs font-semibold text-neutral-900">
                      {user.name ?? 'Unnamed user'}
                      <span className="ml-2 rounded-full border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">
                        {user.profile_type}
                      </span>
                    </p>
                    <p className="text-[11px] text-neutral-600">{user.email ?? user.phone ?? user.id}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={manualInvoiceDraft.userId}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, userId: event.target.value }))}
              placeholder="User ID (uuid)"
              className={adminRawFieldClass}
            />
            <select
              value={manualInvoiceDraft.invoiceType}
              onChange={(event) =>
                setManualInvoiceDraft((current) => ({ ...current, invoiceType: event.target.value as 'service' | 'subscription' }))
              }
              className={adminRawFieldClass}
            >
              <option value="service">Service Invoice</option>
              <option value="subscription">Subscription Invoice</option>
            </select>
            <select
              value={manualInvoiceDraft.status}
              onChange={(event) =>
                setManualInvoiceDraft((current) => ({ ...current, status: event.target.value as 'draft' | 'issued' | 'paid' }))
              }
              className={adminRawFieldClass}
            >
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
            </select>
            <input
              value={manualInvoiceDraft.subtotalInr}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, subtotalInr: event.target.value }))}
              placeholder="Subtotal (INR)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.discountInr}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, discountInr: event.target.value }))}
              placeholder="Discount (INR)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.taxInr}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, taxInr: event.target.value }))}
              placeholder="Tax (INR) — or use CGST/SGST below"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.cgstInr}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, cgstInr: event.target.value }))}
              placeholder="CGST (INR)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.sgstInr}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, sgstInr: event.target.value }))}
              placeholder="SGST (INR)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.igstInr}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, igstInr: event.target.value }))}
              placeholder="IGST (INR, inter-state)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.gstin}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, gstin: event.target.value }))}
              placeholder="GSTIN (optional)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.hsnSacCode}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, hsnSacCode: event.target.value }))}
              placeholder="HSN/SAC Code (optional)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.bookingId}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, bookingId: event.target.value }))}
              placeholder="Booking ID (optional)"
              className={adminRawFieldClass}
            />
            <input
              value={manualInvoiceDraft.userSubscriptionId}
              onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, userSubscriptionId: event.target.value }))}
              placeholder="User Subscription ID (optional)"
              className={adminRawFieldClass}
            />
          </div>

          <textarea
            rows={2}
            value={manualInvoiceDraft.description}
            onChange={(event) => setManualInvoiceDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Line item description"
            className={cn('w-full', adminRawFieldClass)}
          />

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            Invoice total preview:{' '}
            {formatAdminCurrency(
              Math.max(
                0,
                Number(manualInvoiceDraft.subtotalInr || '0') - Number(manualInvoiceDraft.discountInr || '0') + Number(manualInvoiceDraft.taxInr || '0') + Number(manualInvoiceDraft.cgstInr || '0') + Number(manualInvoiceDraft.sgstInr || '0') + Number(manualInvoiceDraft.igstInr || '0'),
              ),
            )}
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetManualInvoiceComposer();
                setIsCreateInvoiceModalOpen(false);
              }}
              disabled={isCreatingInvoice}
              className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createManualInvoice()}
              disabled={isCreatingInvoice}
              className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Shared confirmation modal for destructive admin actions */}
      <ConfirmActionModal
        isOpen={confirmConfig.isOpen}
        onClose={closeConfirm}
        onConfirm={(inputValue) => {
          closeConfirm();
          confirmConfig.onConfirm(inputValue);
        }}
        title={confirmConfig.title}
        description={confirmConfig.description}
        confirmLabel={confirmConfig.confirmLabel}
        confirmVariant={confirmConfig.confirmVariant}
        inputLabel={confirmConfig.inputLabel}
        inputPlaceholder={confirmConfig.inputPlaceholder}
        inputDefaultValue={confirmConfig.inputDefaultValue}
        inputRequired={confirmConfig.inputRequired}
        requiredInputValue={confirmConfig.requiredInputValue}
      />
    </DashboardPageLayout>
  );
}
