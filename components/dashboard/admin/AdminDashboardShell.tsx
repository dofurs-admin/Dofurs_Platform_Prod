'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import DashboardPageLayout from '@/components/dashboard/premium/DashboardPageLayout';
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

// ── Shared types ──────────────────────────────────────────────────────────────

export type AdminDashboardView =
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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
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

// ── Lazy-loaded tab components ────────────────────────────────────────────────

const OverviewTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/OverviewTab'),
  { loading: () => <TabSkeleton />, ssr: false },
);

const BookingsTab = dynamic(
  () => import('@/components/dashboard/admin/tabs/BookingsTab'),
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

  const tabs = [
    { id: 'overview', label: 'Overview', href: '/dashboard/admin' },
    { id: 'bookings', label: 'Bookings', href: '/dashboard/admin/bookings' },
    { id: 'users', label: 'Users', href: '/dashboard/admin/users' },
    { id: 'providers', label: 'Providers', href: '/dashboard/admin/providers' },
    { id: 'services', label: 'Services', href: '/dashboard/admin/services' },
    { id: 'payments', label: 'Payments', href: '/dashboard/admin/payments' },
    { id: 'subscriptions', label: 'Subscriptions', href: '/dashboard/admin/subscriptions' },
    { id: 'billing', label: 'Billing', href: '/dashboard/admin/billing' },
    { id: 'access', label: 'Access', href: '/dashboard/admin/access' },
    { id: 'health', label: 'Health', href: '/dashboard/admin/health' },
    { id: 'audit', label: 'Audit Log', href: '/dashboard/admin/audit' },
  ] as const;

  return (
    <DashboardPageLayout
      title="Admin Operation Dashboard"
      description="Centralized platform control for providers, services, and access management."
      tabs={tabs.map((t) => ({ id: t.id, label: t.label, href: t.href }))}
      activeTab={view}
    >
      <div className="space-y-8">
        {view === 'overview' && (
          <OverviewTab
            initialBookings={initialBookings}
            providerCount={moderationProviders.length > 0 ? moderationProviders.length : providers.length}
            initialServiceCategories={initialServiceCategories}
            initialCatalogServices={initialCatalogServices}
            initialDiscountAnalytics={initialDiscountAnalytics}
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
    </DashboardPageLayout>
  );
}
