'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import ImageUploadField from '@/components/ui/ImageUploadField';
import Modal from '@/components/ui/Modal';
import type { Service, ServiceCategory } from '@/lib/service-catalog/types';
import { toSlug } from '@/lib/utils/slug';

type ServiceBuilderProps = {
  initialServices: Service[];
  categories: ServiceCategory[];
};

type ServiceDraft = {
  id?: string;
  provider_id?: string;
  category_id: string;
  service_type: string;
  slug: string;
  short_description: string;
  full_description: string;
  service_mode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  icon_url: string;
  banner_image_url: string;
  base_price: string;
  surge_price: string;
  commission_percentage: string;
  service_duration_minutes: string;
  display_order: string;
  is_featured: boolean;
  is_active: boolean;
  requires_pet_details: boolean;
  requires_location: boolean;
};

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ServiceBuilder({ initialServices, categories }: ServiceBuilderProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>({
    provider_id: '',
    category_id: '',
    service_type: '',
    slug: '',
    short_description: '',
    full_description: '',
    service_mode: 'home_visit',
    icon_url: '',
    banner_image_url: '',
    base_price: '0',
    surge_price: '0',
    commission_percentage: '20',
    service_duration_minutes: '60',
    display_order: '0',
    is_featured: false,
    is_active: true,
    requires_pet_details: true,
    requires_location: true,
  });

  function setServiceDraftField<K extends keyof ServiceDraft>(field: K, value: ServiceDraft[K]) {
    setServiceDraft((current) => ({ ...current, [field]: value }));
  }

  function setServiceTypeWithSlug(serviceType: string) {
    setServiceDraft((current) => {
      const currentAutoSlug = toSlug(current.service_type);
      const nextAutoSlug = toSlug(serviceType);
      const shouldAutoUpdateSlug = !current.slug.trim() || current.slug === currentAutoSlug;

      return {
        ...current,
        service_type: serviceType,
        slug: shouldAutoUpdateSlug ? nextAutoSlug : current.slug,
      };
    });
  }

  function resetServiceDraft() {
    setServiceDraft({
      provider_id: '',
      category_id: '',
      service_type: '',
      slug: '',
      short_description: '',
      full_description: '',
      service_mode: 'home_visit',
      icon_url: '',
      banner_image_url: '',
      base_price: '0',
      surge_price: '0',
      commission_percentage: '20',
      service_duration_minutes: '60',
      display_order: '0',
      is_featured: false,
      is_active: true,
      requires_pet_details: true,
      requires_location: true,
    });
  }

  function openCreateServiceModal() {
    resetServiceDraft();
    setIsEditorOpen(true);
  }

  function closeServiceModal() {
    setIsEditorOpen(false);
  }

  function loadServiceInDraft(service: Service) {
    setServiceDraft({
      id: service.id,
      provider_id: service.provider_id?.toString(),
      category_id: service.category_id || '',
      service_type: service.service_type,
      slug: service.slug || '',
      short_description: service.short_description || '',
      full_description: service.full_description || '',
      service_mode: service.service_mode,
      icon_url: service.icon_url || '',
      banner_image_url: service.banner_image_url || '',
      base_price: service.base_price.toString(),
      surge_price: service.surge_price?.toString() || '0',
      commission_percentage: service.commission_percentage?.toString() || '20',
      service_duration_minutes: service.service_duration_minutes?.toString() || '60',
      display_order: service.display_order.toString(),
      is_featured: service.is_featured,
      is_active: service.is_active,
      requires_pet_details: service.requires_pet_details,
      requires_location: service.requires_location,
    });
  }

  function saveService() {
    if (!serviceDraft.service_type.trim()) {
      showToast('Service type is required.', 'error');
      return;
    }

    const providerId = serviceDraft.provider_id?.trim() ? Number(serviceDraft.provider_id) : null;
    const basePrice = Number(serviceDraft.base_price);
    const surgePrice = parseOptionalNumber(serviceDraft.surge_price);
    const commissionPercentage = parseOptionalNumber(serviceDraft.commission_percentage);
    const serviceDurationMinutes = parseOptionalInteger(serviceDraft.service_duration_minutes);
    const displayOrder = parseOptionalInteger(serviceDraft.display_order) ?? 0;

    if (providerId !== null && (!Number.isInteger(providerId) || providerId <= 0)) {
      showToast('Please select a valid provider.', 'error');
      return;
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      showToast('Base price must be a valid non-negative number.', 'error');
      return;
    }

    if (surgePrice !== null && surgePrice < 0) {
      showToast('Surge price must be a valid non-negative number.', 'error');
      return;
    }

    if (commissionPercentage !== null && (commissionPercentage < 0 || commissionPercentage > 100)) {
      showToast('Commission percentage must be between 0 and 100.', 'error');
      return;
    }

    if (serviceDurationMinutes !== null && serviceDurationMinutes <= 0) {
      showToast('Duration must be a positive integer.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          provider_id: providerId,
          category_id: serviceDraft.category_id || null,
          service_type: serviceDraft.service_type.trim(),
          slug: serviceDraft.slug.trim().toLowerCase() || null,
          short_description: serviceDraft.short_description.trim() || null,
          full_description: serviceDraft.full_description.trim() || null,
          service_mode: serviceDraft.service_mode,
          icon_url: serviceDraft.icon_url.trim() || null,
          banner_image_url: serviceDraft.banner_image_url.trim() || null,
          base_price: basePrice,
          surge_price: surgePrice,
          commission_percentage: commissionPercentage,
          service_duration_minutes: serviceDurationMinutes,
          display_order: displayOrder,
          is_featured: serviceDraft.is_featured,
          is_active: serviceDraft.is_active,
          requires_pet_details: serviceDraft.requires_pet_details,
          requires_location: serviceDraft.requires_location,
        };

        const url = serviceDraft.id
          ? `/api/admin/services/${serviceDraft.id}`
          : '/api/admin/services';

        const method = serviceDraft.id ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to save service');
        }

        if (serviceDraft.id) {
          setServices((current) =>
            current.map((s) => (s.id === serviceDraft.id ? result.service : s))
          );
          showToast('Service updated successfully.', 'success');
        } else {
          setServices((current) => [...current, result.service]);
          showToast('Service created successfully.', 'success');
        }

        resetServiceDraft();
        closeServiceModal();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to save service.', 'error');
      }
    });
  }

  function deleteService(serviceId: string) {
    if (!confirm('Are you sure you want to delete this service?')) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/services/${serviceId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to delete service');
        }

        setServices((current) => current.filter((s) => s.id !== serviceId));
        showToast('Service deleted successfully.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to delete service.', 'error');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#e8ccb3] bg-gradient-to-b from-[#fffdfb] to-white p-6 shadow-premium-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Services</h2>
            <p className="mt-1 text-xs text-[#6b6b6b]">
              Manage all service offerings in one clean, searchable list.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-2.5 py-1 text-[11px] font-semibold text-ink">
              {services.length} total
            </span>
            <button
              type="button"
              onClick={openCreateServiceModal}
              className="rounded-full bg-[#1f1f1f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#353535]"
            >
              + Add New Service
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-ink">Existing Services</p>
          {services.length === 0 ? (
            <p className="text-xs text-[#6b6b6b]">No services created yet.</p>
          ) : (
            <ul className="grid gap-2">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="rounded-xl border border-[#e8ccb3] bg-white/80 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-ink">
                        {service.service_type}{' '}
                        {service.is_featured ? (
                          <span className="ml-1 text-[10px] text-[#6b6b6b]">★ Featured</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-[#6b6b6b]">
                        {service.service_mode.replace('_', ' ')} • ₹{service.base_price} • {service.service_duration_minutes || 60}min
                      </p>
                      {service.short_description ? (
                        <p className="mt-1.5 text-[11px] text-[#6b6b6b]">{service.short_description}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        service.is_active
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {service.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        loadServiceInDraft(service);
                        setIsEditorOpen(true);
                      }}
                      disabled={isPending}
                      className="rounded-full border border-[#e8ccb3] px-2.5 py-1 text-[10px] font-semibold text-ink hover:bg-[#fff4e6]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteService(service.id)}
                      disabled={isPending}
                      className="rounded-full border border-[#e8ccb3] bg-white px-2.5 py-1 text-[10px] font-semibold text-ink transition hover:bg-[#fff4e6]"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEditorOpen}
        onClose={closeServiceModal}
        size="xl"
        title={serviceDraft.id ? 'Edit Service' : 'Add New Service'}
        description="Configure service details, pricing, media, and availability settings in one popup."
      >
        <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={serviceDraft.category_id}
                onChange={(event) => setServiceDraftField('category_id', event.target.value)}
                className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
              >
                <option value="">Select Category (Optional)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={serviceDraft.service_mode}
                onChange={(event) =>
                  setServiceDraftField('service_mode', event.target.value as ServiceDraft['service_mode'])
                }
                className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
              >
                <option value="home_visit">Home Visit</option>
                <option value="clinic_visit">Clinic Visit</option>
                <option value="teleconsult">Teleconsult</option>
              </select>
            </div>

            <input
              value={serviceDraft.service_type}
              onChange={(event) => setServiceTypeWithSlug(event.target.value)}
              placeholder="Service Type (e.g., Dog Grooming, Vet Consultation)"
              className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />

            <input
              value={serviceDraft.slug}
              onChange={(event) => setServiceDraftField('slug', toSlug(event.target.value))}
              placeholder="Slug (e.g., dog-grooming)"
              className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />

            <textarea
              value={serviceDraft.short_description}
              onChange={(event) => setServiceDraftField('short_description', event.target.value)}
              placeholder="Short Description (for cards and previews)"
              rows={2}
              className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />

            <textarea
              value={serviceDraft.full_description}
              onChange={(event) => setServiceDraftField('full_description', event.target.value)}
              placeholder="Full Description (detailed service information)"
              rows={4}
              className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />

            <ImageUploadField
              label="Icon Image"
              value={serviceDraft.icon_url}
              onChange={(url) => setServiceDraftField('icon_url', url)}
              bucket="service-images"
              placeholder="Upload icon or enter URL"
            />

            <ImageUploadField
              label="Banner Image"
              value={serviceDraft.banner_image_url}
              onChange={(url) => setServiceDraftField('banner_image_url', url)}
              bucket="service-images"
              placeholder="Upload banner or enter URL"
            />

            <div className="space-y-4 rounded-xl border border-[#e8ccb3] bg-[#fff4e6] p-4">
              <div>
                <p className="font-medium text-ink">Pricing & Duration</p>
                <p className="text-xs text-[#6b6b6b]">Configure service pricing and estimated duration</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Base Price (₹)</label>
                  <input
                    value={serviceDraft.base_price}
                    onChange={(event) => setServiceDraftField('base_price', event.target.value)}
                    placeholder="e.g., 500"
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-[#6b6b6b]">Standard price for this service</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Surge Price (₹) - Optional</label>
                  <input
                    value={serviceDraft.surge_price}
                    onChange={(event) => setServiceDraftField('surge_price', event.target.value)}
                    placeholder="e.g., 750"
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-[#6b6b6b]">Higher price during peak hours or high demand</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Commission % - Optional</label>
                  <input
                    value={serviceDraft.commission_percentage}
                    onChange={(event) => setServiceDraftField('commission_percentage', event.target.value)}
                    placeholder="e.g., 20"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-[#6b6b6b]">Platform commission percentage (0-100%)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Duration (minutes)</label>
                  <input
                    value={serviceDraft.service_duration_minutes}
                    onChange={(event) => setServiceDraftField('service_duration_minutes', event.target.value)}
                    placeholder="e.g., 60"
                    type="number"
                    min="0"
                    className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-[#6b6b6b]">Estimated time to complete service (in minutes)</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Display Order</label>
              <input
                value={serviceDraft.display_order}
                onChange={(event) => setServiceDraftField('display_order', event.target.value)}
                placeholder="0 = show first"
                type="number"
                min="0"
                className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs w-full"
              />
              <p className="text-[10px] text-[#6b6b6b]">Order in which services appear (0 = first, lower numbers appear first)</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={serviceDraft.is_featured}
                  onChange={(event) =>
                    setServiceDraftField('is_featured', event.target.checked)
                  }
                />
                Featured
              </label>

              <label
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  serviceDraft.is_active
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={serviceDraft.is_active}
                  onChange={(event) =>
                    setServiceDraftField('is_active', event.target.checked)
                  }
                />
                {serviceDraft.is_active ? 'Active' : 'Inactive'}
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={serviceDraft.requires_pet_details}
                  onChange={(event) =>
                    setServiceDraftField('requires_pet_details', event.target.checked)
                  }
                />
                Requires Pet Details
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={serviceDraft.requires_location}
                  onChange={(event) =>
                    setServiceDraftField('requires_location', event.target.checked)
                  }
                />
                Requires Location
              </label>
            </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveService}
            disabled={isPending}
            className="rounded-full bg-[#1f1f1f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#353535] disabled:opacity-60"
          >
            {serviceDraft.id ? 'Update Service' : 'Create Service'}
          </button>
          <button
            type="button"
            onClick={closeServiceModal}
            disabled={isPending}
            className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffecd7]"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
