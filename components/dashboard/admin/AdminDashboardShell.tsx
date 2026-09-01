'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CalendarPlus, RefreshCw } from 'lucide-react';
import AdminPageHeader from '@/components/dashboard/admin/AdminPageHeader';
import AdminWorkspaceShell from '@/components/dashboard/admin/AdminWorkspaceShell';
import ConfirmActionModal from '@/components/ui/ConfirmActionModal';
import type {
  AdminProviderModerationItem,
  AdminServiceModerationSummaryItem,
  PlatformDiscount,
  PlatformDiscountAnalyticsSummary,
} from '@/lib/provider-management/types';
import type {
  ServiceProviderApplication,
} from '@/lib/provider-applications/types';
import type { ServiceCategory, Service } from '@/lib/service-catalog/types';
import type { AdminDashboardBusinessStats } from '@/lib/admin/dashboard-stats';
import { countServiceUnitsForBooking } from '@/lib/bookings/included-services';
import type { BookingStatus } from '@/lib/bookings/types';

// ── Shared types ──────────────────────────────────────────────────────────────

export type AdminDashboardView =
  | 'overview'
  | 'bookings'
  | 'users'
  | 'providers'
  | 'services'
  | 'gaze'
  | 'blog'
  | 'access'
  | 'health'
  | 'payments'
  | 'subscriptions'
  | 'billing'
  | 'audit';

export type ConfirmConfig = {
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
};

type AdminBooking = {
  id: number;
  user_id?: string;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: BookingStatus;
  booking_status?: BookingStatus | null;
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  included_services?: string[] | null;
  provider_notes?: string | null;
  internal_notes?: string | null;
  provider_service_id?: string | null;
  admin_price_reference?: number | null;
  price_at_booking?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
  completion_task_status?: 'pending' | 'completed' | null;
  completion_due_at?: string | null;
  completion_completed_at?: string | null;
};

type Provider = {
  id: number;
  name: string;
};

function buildFallbackBusinessStats(
  bookings: AdminBooking[],
  providerCount: number,
  serviceCount: number,
  activeDiscountCount: number,
): AdminDashboardBusinessStats {
  const bookingRiskSummary = {
    inProgress: 0,
    completed: 0,
    pending: 0,
    noShow: 0,
    cancelled: 0,
  };
  const customerKeys = new Set<string>();

  for (const booking of bookings) {
    const status = booking.booking_status ?? booking.status;
    if (status === 'pending') {
      bookingRiskSummary.pending += 1;
      bookingRiskSummary.inProgress += 1;
    } else if (status === 'confirmed' || status === 'in_progress') {
      bookingRiskSummary.inProgress += 1;
    } else if (status === 'completed') {
      bookingRiskSummary.completed += 1;
    } else if (status === 'no_show') {
      bookingRiskSummary.noShow += 1;
    } else if (status === 'cancelled') {
      bookingRiskSummary.cancelled += 1;
    }

    const customerKey = booking.user_id ?? booking.customer_email ?? booking.customer_phone;
    if (customerKey) {
      customerKeys.add(customerKey.toLowerCase());
    }
  }

  return {
    bookingCount: bookings.length,
    bookingServiceUnitCount: bookings.reduce((sum, booking) => sum + countServiceUnitsForBooking(booking), 0),
    bookingRiskSummary,
    providerCount,
    serviceCount,
    customerCount: customerKeys.size,
    activeDiscountCount,
  };
}

// ── Lazy-loaded tab components ────────────────────────────────────────────────

const OverviewTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/OverviewTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const BookingsTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/BookingsTabChunkV2'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const UsersTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/UsersTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const ProvidersTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/ProvidersTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const ServicesTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/ServicesTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const GazeTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/GazeTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const BlogTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/BlogTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const PaymentsTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/PaymentsTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const SubscriptionsTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/SubscriptionsTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const BillingTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/BillingTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const AccessTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/AccessTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const HealthTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/HealthTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const AuditTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/AuditTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-neutral-100" />
      <div className="h-4 w-96 rounded-lg bg-neutral-100" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-neutral-100" />
        <div className="h-24 rounded-2xl bg-neutral-100" />
        <div className="h-24 rounded-2xl bg-neutral-100" />
      </div>
    </div>
  );
}

const viewCopy: Record<AdminDashboardView, { title: string; description: string }> = {
  overview: {
    title: 'Admin Operations Overview',
    description: 'Monitor service delivery, customer activity, provider coverage, and finance signals from one focused workspace.',
  },
  bookings: {
    title: 'Booking Operations',
    description: 'Track booking queues, clear SLA items, reassign providers, and resolve customer service exceptions.',
  },
  users: {
    title: 'Customer & User Records',
    description: 'Search account records, review profiles, and keep customer operations coordinated.',
  },
  providers: {
    title: 'Provider Management',
    description: 'Review applications, manage provider readiness, and coordinate service rollout.',
  },
  services: {
    title: 'Service Catalog',
    description: 'Maintain service types, catalog templates, add-ons, discounts, and provider-facing rollout controls.',
  },
  gaze: {
    title: 'Gaze — Geographic Operations',
    description: 'Watch the whole operation from above: booking demand by area, groomer footprint, coverage, and gaps on one live map.',
  },
  blog: {
    title: 'Blog Publishing',
    description: 'Write, upload, publish, and archive public blog posts from the admin operations console.',
  },
  payments: {
    title: 'Payment Operations',
    description: 'Review payment states and transaction health across online and direct collection flows.',
  },
  subscriptions: {
    title: 'Subscription Operations',
    description: 'Manage plans, customer subscriptions, credits, and recurring value workflows.',
  },
  billing: {
    title: 'Billing Command Center',
    description: 'Issue invoices, reconcile payments, send reminders, and manage overdue escalation queues.',
  },
  access: {
    title: 'Access Control',
    description: 'Control staff and admin access with clear role boundaries.',
  },
  health: {
    title: 'System Health',
    description: 'Check schema readiness, operational configuration, and platform health indicators.',
  },
  audit: {
    title: 'Audit Log',
    description: 'Review administrative activity and operational change history.',
  },
};

function AdminHeaderActions() {
  return (
    <>
      <Link
        href="/dashboard/admin/bookings"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Create booking
      </Link>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-coral px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#cf8448]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Refresh
      </button>
    </>
  );
}

// ── Shell component ───────────────────────────────────────────────────────────

export default function AdminDashboardShell({
  canManageUserAccess = true,
  view = 'overview',
  initialBookings,
  providers,
  moderationProviders,
  initialProviderApplications,
  initialServiceSummary,
  initialDiscounts,
  initialDiscountAnalytics,
  initialBusinessStats,
  initialServiceCategories = [],
  initialCatalogServices = [],
}: {
  canManageUserAccess?: boolean;
  view?: AdminDashboardView;
  initialBookings: AdminBooking[];
  providers: Provider[];
  moderationProviders: AdminProviderModerationItem[];
  initialProviderApplications: ServiceProviderApplication[];
  initialServiceSummary: AdminServiceModerationSummaryItem[];
  initialDiscounts: PlatformDiscount[];
  initialDiscountAnalytics: PlatformDiscountAnalyticsSummary;
  initialBusinessStats?: AdminDashboardBusinessStats | null;
  initialServiceCategories?: ServiceCategory[];
  initialCatalogServices?: Service[];
}) {
  // Shared confirm modal — injected via prop into each tab
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });

  function openConfirm(config: Omit<ConfirmConfig, 'isOpen'>) {
    setConfirmConfig({ ...config, isOpen: true });
  }

  function closeConfirm() {
    setConfirmConfig((c) => ({ ...c, isOpen: false }));
  }

  const activeCopy = viewCopy[view];

  return (
    <AdminWorkspaceShell activeView={view}>
      <div className="space-y-5">
        <AdminPageHeader
          title={activeCopy.title}
          description={activeCopy.description}
          actions={<AdminHeaderActions />}
        />

        {view === 'overview' && (
          <OverviewTab
            initialBusinessStats={initialBusinessStats ?? buildFallbackBusinessStats(
              initialBookings,
              moderationProviders.length > 0 ? moderationProviders.length : providers.length,
              initialCatalogServices.length,
              initialDiscountAnalytics.total_active_discounts,
            )}
          />
        )}

        {view === 'bookings' && (
          <BookingsTab
            initialBookings={initialBookings}
            providers={providers}
            openConfirm={openConfirm}
          />
        )}

        {view === 'users' && (
          <UsersTab />
        )}

        {view === 'providers' && (
          <ProvidersTab
            providers={providers}
            moderationProviders={moderationProviders}
            initialProviderApplications={initialProviderApplications}
            initialCatalogServices={initialCatalogServices}
            initialServiceSummary={initialServiceSummary}
            openConfirm={openConfirm}
          />
        )}

        {view === 'services' && (
          <ServicesTab
            initialServiceCategories={initialServiceCategories}
            initialCatalogServices={initialCatalogServices}
            initialServiceSummary={initialServiceSummary}
            initialDiscounts={initialDiscounts}
            initialDiscountAnalytics={initialDiscountAnalytics}
            moderationProviders={moderationProviders}
            openConfirm={openConfirm}
          />
        )}

        {view === 'gaze' && (
          <GazeTab />
        )}

        {view === 'blog' && (
          <BlogTab openConfirm={openConfirm} />
        )}

        {view === 'payments' && (
          <PaymentsTab />
        )}

        {view === 'subscriptions' && (
          <SubscriptionsTab openConfirm={openConfirm} />
        )}

        {view === 'billing' && (
          <BillingTab openConfirm={openConfirm} />
        )}

        {view === 'access' && (
          <AccessTab canManageUserAccess={canManageUserAccess} />
        )}

        {view === 'health' && (
          <HealthTab />
        )}

        {view === 'audit' && (
          <AuditTab />
        )}
      </div>

      {/* Shared confirmation modal */}
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
    </AdminWorkspaceShell>
  );
}
