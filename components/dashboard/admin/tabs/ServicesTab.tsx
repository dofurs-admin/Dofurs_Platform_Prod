'use client';

import { useMemo, useState, useTransition } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import AdminServicesView from '@/components/dashboard/admin/views/AdminServicesView';
import Modal from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';
import type { ServiceCategory, Service } from '@/lib/service-catalog/types';
import type { AdminServiceModerationSummaryItem, PlatformDiscount, PlatformDiscountAnalyticsSummary } from '@/lib/provider-management/types';
import type { AdminProviderModerationItem } from '@/lib/provider-management/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceCatalogPanel = 'types' | 'services';

function parseServiceCatalogPanel(value: string | null): ServiceCatalogPanel {
  return value === 'services' ? 'services' : 'types';
}

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

const adminRawFieldClass =
  'rounded-xl border border-neutral-200/60 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1';
const adminToggleFieldClass =
  'inline-flex items-center gap-2 rounded-xl border border-neutral-200/60 px-3 py-2 text-xs';

const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

function formatAdminDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return ADMIN_DATE_TIME_FORMATTER.format(date);
}

// ── Props ─────────────────────────────────────────────────────────────────────

type ServicesTabProps = {
  initialServiceCategories: ServiceCategory[];
  initialCatalogServices: Service[];
  initialServiceSummary: AdminServiceModerationSummaryItem[];
  initialDiscounts: PlatformDiscount[];
  initialDiscountAnalytics: PlatformDiscountAnalyticsSummary;
  moderationProviders: AdminProviderModerationItem[];
  openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ServicesTab({
  initialServiceCategories,
  initialCatalogServices,
  initialServiceSummary,
  initialDiscounts,
  initialDiscountAnalytics,
  moderationProviders,
  openConfirm,
}: ServicesTabProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [serviceSummary, setServiceSummary] = useState(initialServiceSummary);
  const [discounts, setDiscounts] = useState<PlatformDiscount[]>(initialDiscounts);
  const [discountAnalytics, setDiscountAnalytics] = useState<PlatformDiscountAnalyticsSummary>(initialDiscountAnalytics);
  const [showRolloutConfiguration, setShowRolloutConfiguration] = useState(false);
  const [showDiscountEditor, setShowDiscountEditor] = useState(false);
  const [serviceCatalogPanel, setServiceCatalogPanel] = useState<ServiceCatalogPanel>(
    parseServiceCatalogPanel(searchParams.get('catalog')),
  );

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

  const availableServiceTypes = useMemo(() => {
    const catalogTypes = initialCatalogServices.map((s) => s.service_type).filter((v): v is string => Boolean(v?.trim()));
    const summaryTypes = serviceSummary.map((s) => s.service_type).filter((v) => Boolean(v?.trim()));
    return Array.from(new Set([...catalogTypes, ...summaryTypes])).sort();
  }, [initialCatalogServices, serviceSummary]);

  const rolloutTargetScopeLabel = useMemo(() => {
    if (globalServiceDraft.provider_types.length === 0) return 'Target: All approved active providers';
    const names = globalServiceDraft.provider_types.map((t) => t.replaceAll('_', ' '));
    if (names.length <= 2) return `Target: ${names.join(', ')}`;
    return `Target: ${names.length} provider types selected`;
  }, [globalServiceDraft.provider_types]);

  const rolloutProviderTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of moderationProviders) {
      const type = String(p.provider_type ?? '').trim().toLowerCase();
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    for (const t of globalServiceDraft.provider_types) {
      const normalized = t.trim().toLowerCase();
      if (normalized && !counts.has(normalized)) counts.set(normalized, 0);
    }
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  }, [moderationProviders, globalServiceDraft.provider_types]);

  function updateServiceCatalogPanel(panel: ServiceCatalogPanel) {
    setServiceCatalogPanel(panel);
    const params = new URLSearchParams(searchParams.toString());
    if (panel === 'types') params.delete('catalog');
    else params.set('catalog', panel);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? 'Request failed');
    return payload as T;
  }

  async function refreshDiscountModeration() {
    const response = await adminRequest<{ discounts: PlatformDiscount[]; analytics: PlatformDiscountAnalyticsSummary }>('/api/admin/discounts');
    setDiscounts(response.discounts);
    setDiscountAnalytics(response.analytics);
  }

  function setServiceActivation(serviceType: string, isActive: boolean) {
    startTransition(async () => {
      try {
        const response = await adminRequest<{ summary: AdminServiceModerationSummaryItem[] }>(
          '/api/admin/services/moderation',
          { method: 'PATCH', body: JSON.stringify({ service_type: serviceType, is_active: isActive }) },
        );
        setServiceSummary(response.summary);
        showToast(`Service ${serviceType} ${isActive ? 'enabled' : 'disabled'} globally.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service activation.', 'error');
      }
    });
  }

  function setGlobalServiceDraftField(field: keyof GlobalServiceRolloutDraft, value: string | boolean | string[]) {
    setGlobalServiceDraft((c) => ({ ...c, [field]: value }));
  }

  function toggleGlobalRolloutProviderType(providerType: string, checked: boolean) {
    setGlobalServiceDraft((c) => {
      const next = new Set(c.provider_types);
      if (checked) next.add(providerType);
      else next.delete(providerType);
      return { ...c, provider_types: Array.from(next) };
    });
  }

  function rolloutGlobalService() {
    if (!globalServiceDraft.service_type.trim()) { showToast('Service type is required.', 'error'); return; }
    const basePrice = Number(globalServiceDraft.base_price);
    const surgePrice = globalServiceDraft.surge_price.trim() ? Number(globalServiceDraft.surge_price) : null;
    const commission = globalServiceDraft.commission_percentage.trim() ? Number(globalServiceDraft.commission_percentage) : null;
    const serviceDuration = globalServiceDraft.service_duration_minutes.trim() ? Number(globalServiceDraft.service_duration_minutes) : null;

    if (!Number.isFinite(basePrice) || basePrice < 0) { showToast('Base price must be a valid non-negative number.', 'error'); return; }
    if (surgePrice !== null && (!Number.isFinite(surgePrice) || surgePrice < 0)) { showToast('Surge price must be valid.', 'error'); return; }
    if (commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) { showToast('Commission must be between 0 and 100.', 'error'); return; }
    if (serviceDuration !== null && (!Number.isFinite(serviceDuration) || serviceDuration <= 0)) { showToast('Duration must be positive.', 'error'); return; }

    const servicePincodes = globalServiceDraft.service_pincodes.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
    const providerTypes = globalServiceDraft.provider_types.map((v) => v.trim()).filter((v) => v.length > 0);

    startTransition(async () => {
      try {
        const response = await adminRequest<{ summary: AdminServiceModerationSummaryItem[] }>(
          '/api/admin/services/moderation',
          {
            method: 'POST',
            body: JSON.stringify({
              service_type: globalServiceDraft.service_type.trim(),
              base_price: basePrice, surge_price: surgePrice, commission_percentage: commission,
              service_duration_minutes: serviceDuration, is_active: true,
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
    setDiscountDraft((c) => ({ ...c, [field]: value }));
  }

  function resetDiscountDraft() {
    setDiscountDraft({
      code: '', title: '', description: '', discount_type: 'percentage', discount_value: '',
      max_discount_amount: '', min_booking_amount: '', applies_to_service_type: '',
      valid_from: new Date().toISOString().slice(0, 16), valid_until: '',
      usage_limit_total: '', usage_limit_per_user: '', first_booking_only: false, is_active: true,
    });
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

  function saveDiscount() {
    if (!discountDraft.code.trim() || !discountDraft.title.trim()) {
      showToast('Discount code and title are required.', 'error'); return;
    }
    const discountValue = Number(discountDraft.discount_value);
    if (!Number.isFinite(discountValue) || discountValue <= 0) { showToast('Discount value must be positive.', 'error'); return; }
    const validFromDate = new Date(discountDraft.valid_from);
    const validUntilDate = discountDraft.valid_until.trim() ? new Date(discountDraft.valid_until) : null;
    if (!discountDraft.valid_from || Number.isNaN(validFromDate.getTime())) { showToast('Provide a valid start date.', 'error'); return; }
    if (validUntilDate && Number.isNaN(validUntilDate.getTime())) { showToast('Provide a valid end date.', 'error'); return; }

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
            max_discount_amount: discountDraft.max_discount_amount.trim() ? Number(discountDraft.max_discount_amount) : null,
            min_booking_amount: discountDraft.min_booking_amount.trim() ? Number(discountDraft.min_booking_amount) : null,
            applies_to_service_type: discountDraft.applies_to_service_type.trim() || null,
            valid_from: validFromDate.toISOString(),
            valid_until: validUntilDate ? validUntilDate.toISOString() : null,
            usage_limit_total: discountDraft.usage_limit_total.trim() ? Number(discountDraft.usage_limit_total) : null,
            usage_limit_per_user: discountDraft.usage_limit_per_user.trim() ? Number(discountDraft.usage_limit_per_user) : null,
            first_booking_only: discountDraft.first_booking_only,
            is_active: discountDraft.is_active,
          }),
        });

        setDiscounts((c) => {
          const idx = c.findIndex((d) => d.id === response.discount.id);
          if (idx === -1) return [response.discount, ...c];
          const next = [...c];
          next[idx] = response.discount;
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
        setDiscounts((c) => c.map((d) => d.id === discountId ? response.discount : d));
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
      description: 'Permanently delete the discount code. Existing redemptions will be unaffected.',
      confirmLabel: 'Delete Discount',
      confirmVariant: 'danger',
      onConfirm: () => doRemoveDiscount(discountId),
    });
  }

  function doRemoveDiscount(discountId: string) {
    startTransition(async () => {
      try {
        await adminRequest<{ success: true }>(`/api/admin/discounts/${discountId}`, { method: 'DELETE' });
        setDiscounts((c) => c.filter((d) => d.id !== discountId));
        if (discountDraft.id === discountId) { resetDiscountDraft(); setShowDiscountEditor(false); }
        await refreshDiscountModeration();
        showToast('Discount deleted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete discount.', 'error');
      }
    });
  }

  return (
    <>
      {/* Services catalog view (service types + catalog manager) */}
      <AdminServicesView
        serviceCatalogPanel={serviceCatalogPanel}
        onPanelChange={updateServiceCatalogPanel}
        initialServiceCategories={initialServiceCategories}
        initialCatalogServices={initialCatalogServices}
      />

      {/* Service Catalog Control panel (service summary + global rollout) */}
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
            <ul className="mt-2 grid gap-2">
              {serviceSummary.map((service) => (
                <li key={service.service_type} className="rounded-lg bg-white/70 p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-neutral-950">
                      {service.service_type} • Providers: {service.provider_count} • Active:{' '}
                      <span className="text-green-700">{service.active_count}</span> • Inactive:{' '}
                      <span className="text-red-700">{service.inactive_count}</span> • Avg Price: ₹{service.average_base_price}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => setServiceActivation(service.service_type, true)}
                        disabled={isPending}
                        variant="secondary"
                        size="sm"
                        className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      >
                        Enable
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setServiceActivation(service.service_type, false)}
                        disabled={isPending}
                        variant="ghost"
                        size="sm"
                        className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        Disable
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-xl bg-neutral-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Advanced Bulk Rollout</p>
              <p className="mt-1 text-xs text-[#6b6b6b]">Use this for controlled bulk updates. For daily operations, edit provider rollout and pincodes in the Providers tab.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink">{rolloutTargetScopeLabel}</span>
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink">Service Types: {availableServiceTypes.length}</span>
              <button
                type="button"
                onClick={() => setShowRolloutConfiguration(true)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                Configure Bulk Rollout
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Discounts section */}
      <section className="rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Offers &amp; Discounts</h2>
            <p className="mt-1 text-xs text-[#6b6b6b]">Create, manage, and track promotional offers and discount codes.</p>
          </div>
          <button
            type="button"
            onClick={() => { resetDiscountDraft(); setShowDiscountEditor(true); }}
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
                    <span className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                      discount.is_active ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700',
                    )}>
                      {discount.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6b6b6b]">
                    Valid: {formatAdminDateTime(discount.valid_from)} -{' '}
                    {discount.valid_until ? formatAdminDateTime(discount.valid_until) : 'No expiry'}
                  </p>
                  {discount.first_booking_only ? <p className="mt-1 text-[11px] font-medium text-ink">Applies to first booking only</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => loadDiscountInDraft(discount)} disabled={isPending} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-60">Edit</button>
                    <button type="button" onClick={() => toggleDiscount(discount.id, !discount.is_active)} disabled={isPending} className={cn('rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60', discount.is_active ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100')}>
                      {discount.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" onClick={() => removeDiscount(discount.id)} disabled={isPending} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-60">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Global Rollout Modal */}
      <Modal
        isOpen={showRolloutConfiguration}
        onClose={() => setShowRolloutConfiguration(false)}
        size="xl"
        title="Edit Global Rollout"
        description="Advanced operation: configure and deploy service settings across multiple providers."
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Available Service</label>
              <select value={globalServiceDraft.service_type} onChange={(e) => setGlobalServiceDraftField('service_type', e.target.value)} className="input-field w-full">
                <option value="">Select a service</option>
                {availableServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <Input label="Base Price" value={globalServiceDraft.base_price} onChange={(e) => setGlobalServiceDraftField('base_price', e.target.value)} placeholder="0" />
            <Input label="Surge Price" value={globalServiceDraft.surge_price} onChange={(e) => setGlobalServiceDraftField('surge_price', e.target.value)} placeholder="Optional" />
            <Input label="Commission %" value={globalServiceDraft.commission_percentage} onChange={(e) => setGlobalServiceDraftField('commission_percentage', e.target.value)} placeholder="Optional" />
            <Input label="Duration (minutes)" value={globalServiceDraft.service_duration_minutes} onChange={(e) => setGlobalServiceDraftField('service_duration_minutes', e.target.value)} placeholder="e.g. 60" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input label="Service Pincodes" value={globalServiceDraft.service_pincodes} onChange={(e) => setGlobalServiceDraftField('service_pincodes', e.target.value)} placeholder="Indian pincodes (comma separated)" />
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Target Provider Types</label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setGlobalServiceDraftField('provider_types', [])} className="rounded-full border border-[#f2dfcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-[#fff7f0]">Target All</button>
              </div>
              <div className="grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-[#f2dfcf] bg-white p-2 sm:grid-cols-2">
                {rolloutProviderTypeOptions.map((option) => {
                  const checked = globalServiceDraft.provider_types.includes(option.value);
                  return (
                    <label key={option.value} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-ink hover:bg-[#fff7f0]">
                      <input type="checkbox" checked={checked} onChange={(e) => toggleGlobalRolloutProviderType(option.value, e.target.checked)} />
                      <span>{option.value.replaceAll('_', ' ')} ({option.count})</span>
                    </label>
                  );
                })}
              </div>
              {rolloutProviderTypeOptions.length === 0 ? <p className="text-[11px] text-[#6b6b6b]">No onboarded provider types found. Rollout applies to all approved active providers.</p> : null}
              <p className="text-[11px] font-medium text-ink">{rolloutTargetScopeLabel}</p>
            </div>
          </div>

          <label className={cn('mt-2', adminToggleFieldClass)}>
            <input type="checkbox" checked={globalServiceDraft.overwrite_existing} onChange={(e) => setGlobalServiceDraftField('overwrite_existing', e.target.checked)} />
            Overwrite existing service config for targeted providers
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#6b6b6b]">No provider types selected means rollout applies to all approved active providers.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowRolloutConfiguration(false)} className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0]">Cancel</button>
              <button type="button" onClick={rolloutGlobalService} disabled={isPending} className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">Rollout Service Globally</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Discount Editor Modal */}
      <Modal
        isOpen={showDiscountEditor}
        onClose={() => { resetDiscountDraft(); setShowDiscountEditor(false); }}
        size="xl"
        title={discountDraft.id ? 'Edit Discount' : 'Create Discount'}
        description="Create, update, and schedule promotional discount codes."
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={discountDraft.code} onChange={(e) => setDiscountDraftField('code', e.target.value.toUpperCase())} placeholder="Code (e.g. PET20)" className={adminRawFieldClass} disabled={Boolean(discountDraft.id)} />
            <input value={discountDraft.title} onChange={(e) => setDiscountDraftField('title', e.target.value)} placeholder="Title" className={adminRawFieldClass} />
            <select value={discountDraft.discount_type} onChange={(e) => setDiscountDraftField('discount_type', e.target.value as 'percentage' | 'flat')} className={adminRawFieldClass}>
              <option value="percentage">Percentage</option>
              <option value="flat">Flat</option>
            </select>
            <input value={discountDraft.discount_value} onChange={(e) => setDiscountDraftField('discount_value', e.target.value)} placeholder="Discount value" className={adminRawFieldClass} />
            <input value={discountDraft.max_discount_amount} onChange={(e) => setDiscountDraftField('max_discount_amount', e.target.value)} placeholder="Max discount amount" className={adminRawFieldClass} />
            <input value={discountDraft.min_booking_amount} onChange={(e) => setDiscountDraftField('min_booking_amount', e.target.value)} placeholder="Min booking amount" className={adminRawFieldClass} />
            <input value={discountDraft.applies_to_service_type} onChange={(e) => setDiscountDraftField('applies_to_service_type', e.target.value)} placeholder="Service type (optional)" className={adminRawFieldClass} />
            <input type="datetime-local" value={discountDraft.valid_from} onChange={(e) => setDiscountDraftField('valid_from', e.target.value)} className={adminRawFieldClass} />
            <input type="datetime-local" value={discountDraft.valid_until} onChange={(e) => setDiscountDraftField('valid_until', e.target.value)} className={adminRawFieldClass} />
            <input value={discountDraft.usage_limit_total} onChange={(e) => setDiscountDraftField('usage_limit_total', e.target.value)} placeholder="Usage limit total" className={adminRawFieldClass} />
            <input value={discountDraft.usage_limit_per_user} onChange={(e) => setDiscountDraftField('usage_limit_per_user', e.target.value)} placeholder="Usage limit per user" className={adminRawFieldClass} />
            <label className={adminToggleFieldClass}>
              <input type="checkbox" checked={discountDraft.first_booking_only} onChange={(e) => setDiscountDraftField('first_booking_only', e.target.checked)} />
              First Booking Only
            </label>
            <label className={cn(adminToggleFieldClass, discountDraft.is_active ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700')}>
              <input type="checkbox" checked={discountDraft.is_active} onChange={(e) => setDiscountDraftField('is_active', e.target.checked)} />
              {discountDraft.is_active ? 'Discount Active' : 'Discount Inactive'}
            </label>
          </div>

          <textarea value={discountDraft.description} onChange={(e) => setDiscountDraftField('description', e.target.value)} placeholder="Description" rows={2} className={cn('w-full', adminRawFieldClass)} />

          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { resetDiscountDraft(); setShowDiscountEditor(false); }} disabled={isPending} className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0] disabled:opacity-60">Cancel</button>
            <button type="button" onClick={saveDiscount} disabled={isPending} className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
              {discountDraft.id ? 'Update Discount' : 'Create Discount'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
