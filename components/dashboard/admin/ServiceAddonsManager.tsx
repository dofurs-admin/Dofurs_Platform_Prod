'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import type { Service } from '@/lib/service-catalog/types';
import type { AddonTemplate, ProviderServiceAddonMapping } from '@/lib/addons/types';

type ServiceAddonsManagerProps = {
  services: Service[];
};

type AddonTemplatePayload = {
  name: string;
  slug?: string;
  description?: string | null;
  default_price: number;
  default_duration_minutes?: number | null;
  is_active?: boolean;
};

type MappingRow = ProviderServiceAddonMapping & {
  addon_templates?: AddonTemplate | null;
};

function toCurrency(value: number) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export default function ServiceAddonsManager({ services }: ServiceAddonsManagerProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [templates, setTemplates] = useState<AddonTemplate[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [templatesError, setTemplatesError] = useState<string>('');
  const [mappingsError, setMappingsError] = useState<string>('');

  const [templateDraft, setTemplateDraft] = useState<AddonTemplatePayload>({
    name: '',
    description: '',
    default_price: 0,
    default_duration_minutes: null,
    is_active: true,
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [mappingPriceOverride, setMappingPriceOverride] = useState<string>('');
  const [mappingDefaultQuantity, setMappingDefaultQuantity] = useState<string>('1');
  const [mappingMaxQuantity, setMappingMaxQuantity] = useState<string>('10');

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId],
  );

  async function fetchTemplates() {
    setTemplatesError('');
    const response = await fetch('/api/admin/addons/templates?includeInactive=true');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to load addon templates');
    }

    setTemplates((result.data ?? []) as AddonTemplate[]);
  }

  async function fetchMappingsForService(serviceId: string) {
    setMappingsError('');
    const response = await fetch(`/api/admin/addons/mappings?providerServiceId=${serviceId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to load addon mappings');
    }

    setMappings((result.data ?? []) as MappingRow[]);
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        await fetchTemplates();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load add-ons.';
        setTemplatesError(message);
        showToast(message, 'error');
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setMappings([]);
      return;
    }

    startTransition(async () => {
      try {
        await fetchMappingsForService(selectedServiceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load mappings.';
        setMappingsError(message);
        showToast(message, 'error');
      }
    });
  }, [selectedServiceId]);

  function setTemplateField<K extends keyof AddonTemplatePayload>(key: K, value: AddonTemplatePayload[K]) {
    setTemplateDraft((current) => ({ ...current, [key]: value }));
  }

  function resetTemplateDraft() {
    setTemplateDraft({
      name: '',
      description: '',
      default_price: 0,
      default_duration_minutes: null,
      is_active: true,
    });
  }

  function createTemplate() {
    if (!templateDraft.name.trim()) {
      showToast('Template name is required.', 'error');
      return;
    }

    if (!Number.isFinite(templateDraft.default_price) || templateDraft.default_price < 0) {
      showToast('Default price must be a valid non-negative number.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/addons/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...templateDraft,
            moderation_status: 'approved',
          }),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to create template');
        }

        setTemplates((current) => [...current, result.data as AddonTemplate]);
        resetTemplateDraft();
        showToast('Addon template created.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create template.', 'error');
      }
    });
  }

  function retireTemplate(templateId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/addons/templates/${templateId}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to retire template');
        }

        setTemplates((current) =>
          current.map((template) =>
            template.id === templateId
              ? { ...template, is_active: false, moderation_status: 'retired' }
              : template,
          ),
        );
        showToast('Addon template retired.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to retire template.', 'error');
      }
    });
  }

  function reactivateTemplate(templateId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/addons/templates/${templateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true, moderation_status: 'approved' }),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to reactivate template');
        }

        setTemplates((current) =>
          current.map((template) =>
            template.id === templateId
              ? { ...template, ...(result.data as AddonTemplate), is_active: true, moderation_status: 'approved' }
              : template,
          ),
        );
        showToast('Addon template reactivated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to reactivate template.', 'error');
      }
    });
  }

  function hardDeleteTemplate(templateId: string) {
    const confirmed = window.confirm('Delete this add-on template permanently? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/addons/templates/${templateId}?hard=true`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to delete template permanently');
        }

        setTemplates((current) => current.filter((template) => template.id !== templateId));

        if (selectedTemplateId === templateId) {
          setSelectedTemplateId('');
        }

        showToast('Addon template deleted permanently.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to delete template permanently.', 'error');
      }
    });
  }

  function addMapping() {
    if (!selectedServiceId) {
      showToast('Select a service first.', 'error');
      return;
    }

    if (!selectedTemplateId) {
      showToast('Choose an add-on template to attach.', 'error');
      return;
    }

    const defaultQuantity = Number.parseInt(mappingDefaultQuantity, 10);
    const maxQuantity = Number.parseInt(mappingMaxQuantity, 10);

    if (!Number.isFinite(defaultQuantity) || defaultQuantity < 0) {
      showToast('Default quantity must be 0 or more.', 'error');
      return;
    }

    if (!Number.isFinite(maxQuantity) || maxQuantity < 1) {
      showToast('Max quantity must be at least 1.', 'error');
      return;
    }

    if (defaultQuantity > maxQuantity) {
      showToast('Default quantity cannot exceed max quantity.', 'error');
      return;
    }

    const override = mappingPriceOverride.trim() ? Number(mappingPriceOverride) : null;

    if (override !== null && (!Number.isFinite(override) || override < 0)) {
      showToast('Price override must be a non-negative number.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/addons/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider_service_id: selectedServiceId,
            addon_template_id: selectedTemplateId,
            price_override: override,
            min_quantity: 0,
            default_quantity: defaultQuantity,
            max_quantity: maxQuantity,
            is_required: false,
            is_active: true,
            display_order: 0,
            moderation_status: 'approved',
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to add mapping');
        }

        await fetchMappingsForService(selectedServiceId);
        setSelectedTemplateId('');
        setMappingPriceOverride('');
        setMappingDefaultQuantity('1');
        setMappingMaxQuantity('10');
        showToast('Addon attached to service.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to add mapping.', 'error');
      }
    });
  }

  function retireMapping(mappingId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/addons/mappings/${mappingId}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to remove mapping');
        }

        setMappings((current) =>
          current.map((mapping) =>
            mapping.id === mappingId
              ? { ...mapping, is_active: false, moderation_status: 'retired' }
              : mapping,
          ),
        );
        showToast('Addon mapping retired.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to remove mapping.', 'error');
      }
    });
  }

  function reactivateMapping(mappingId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/addons/mappings/${mappingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true, moderation_status: 'approved' }),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to reactivate mapping');
        }

        setMappings((current) =>
          current.map((mapping) =>
            mapping.id === mappingId
              ? { ...mapping, ...(result.data as MappingRow), is_active: true, moderation_status: 'approved' }
              : mapping,
          ),
        );
        showToast('Addon mapping reactivated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to reactivate mapping.', 'error');
      }
    });
  }

  function hardDeleteMapping(mappingId: string) {
    const confirmed = window.confirm('Delete this mapping permanently? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/addons/mappings/${mappingId}?hard=true`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to delete mapping permanently');
        }

        setMappings((current) => current.filter((mapping) => mapping.id !== mappingId));
        showToast('Addon mapping deleted permanently.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to delete mapping permanently.', 'error');
      }
    });
  }

  return (
    <div className="space-y-6 rounded-3xl border border-[#e8ccb3] bg-gradient-to-b from-[#fffdfb] to-white p-6 shadow-premium-md">
      <div>
        <h2 className="text-xl font-semibold text-ink">Add-ons</h2>
        <p className="mt-1 text-xs text-[#6b6b6b]">
          Create reusable add-on templates, then attach them to catalog services from this panel.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-[#e8ccb3] bg-white/80 p-4">
        <h3 className="text-sm font-semibold text-ink">1) Add-on Template Library</h3>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={templateDraft.name}
            onChange={(event) => setTemplateField('name', event.target.value)}
            placeholder="Template name"
            className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
          />
          <input
            value={templateDraft.default_price}
            onChange={(event) => setTemplateField('default_price', Number(event.target.value) || 0)}
            placeholder="Default price"
            type="number"
            min="0"
            step="0.01"
            className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
          />
          <input
            value={templateDraft.default_duration_minutes ?? ''}
            onChange={(event) =>
              setTemplateField(
                'default_duration_minutes',
                event.target.value.trim() ? Number.parseInt(event.target.value, 10) : null,
              )
            }
            placeholder="Duration minutes"
            type="number"
            min="1"
            className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={createTemplate}
            disabled={isPending}
            className="rounded-xl bg-coral px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#cf8650] disabled:opacity-60"
          >
            Add Template
          </button>
        </div>

        <textarea
          value={templateDraft.description ?? ''}
          onChange={(event) => setTemplateField('description', event.target.value)}
          placeholder="Short description"
          rows={2}
          className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
        />

        <ul className="grid gap-2">
          {templates.map((template) => (
            <li key={template.id} className="rounded-xl border border-[#f2dfcf] bg-[#fffaf5] p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{template.name}</p>
                  <p className="text-[11px] text-[#6b6b6b]">
                    {toCurrency(template.default_price)}
                    {template.default_duration_minutes ? ` • ${template.default_duration_minutes} min` : ''}
                    {template.description ? ` • ${template.description}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      template.is_active
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {template.is_active ? 'Active' : 'Retired'}
                  </span>
                  {template.is_active ? (
                    <button
                      type="button"
                      onClick={() => retireTemplate(template.id)}
                      disabled={isPending}
                      className="rounded-full border border-[#e8ccb3] bg-white px-2.5 py-1 text-[10px] font-semibold text-ink hover:bg-[#fff4e6]"
                    >
                      Retire
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => reactivateTemplate(template.id)}
                      disabled={isPending}
                      className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100"
                    >
                      Enable
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => hardDeleteTemplate(template.id)}
                    disabled={isPending}
                    className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
          {templates.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#e8ccb3] p-3 text-xs text-[#6b6b6b]">
              No templates yet.
            </li>
          ) : null}
        </ul>

        {templatesError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Unable to load add-on templates: {templatesError}. If this is a fresh environment, run the latest Supabase migrations first.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-[#e8ccb3] bg-white/80 p-4">
        <h3 className="text-sm font-semibold text-ink">2) Attach Templates to Services</h3>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={selectedServiceId}
            onChange={(event) => setSelectedServiceId(event.target.value)}
            className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
          >
            <option value="">Select service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.service_type}
              </option>
            ))}
          </select>

          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className="rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
          >
            <option value="">Select template</option>
            {templates
              .filter((template) => template.is_active)
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </select>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#5a4a3f]">Service-specific price (optional)</label>
            <input
              value={mappingPriceOverride}
              onChange={(event) => setMappingPriceOverride(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave empty to use template price"
              className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#5a4a3f]">Preselected qty</label>
              <input
                value={mappingDefaultQuantity}
                onChange={(event) => setMappingDefaultQuantity(event.target.value)}
                type="number"
                min="0"
                placeholder="Shown by default"
                className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#5a4a3f]">Maximum qty</label>
              <input
                value={mappingMaxQuantity}
                onChange={(event) => setMappingMaxQuantity(event.target.value)}
                type="number"
                min="1"
                placeholder="User can select up to"
                className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addMapping}
            disabled={isPending || !selectedServiceId}
            className="rounded-xl bg-coral px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#cf8650] disabled:opacity-60"
          >
            Attach
          </button>
        </div>
        <p className="text-[11px] text-[#6b6b6b]">
          Price is per unit. Example: preselected qty 1 and maximum qty 3 lets customers start with 1 add-on and increase up to 3.
        </p>

        <div className="rounded-xl border border-[#f2dfcf] bg-[#fffaf5] p-3">
          <p className="text-xs font-semibold text-ink">
            {selectedService ? `Mappings for: ${selectedService.service_type}` : 'Select a service to view mappings'}
          </p>

          <ul className="mt-2 grid gap-2">
            {mappings.map((mapping) => {
              const template = mapping.addon_templates;
              const effectivePrice = mapping.price_override ?? template?.default_price ?? 0;
              return (
                <li key={mapping.id} className="rounded-xl border border-[#e8ccb3] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{template?.name ?? 'Unknown template'}</p>
                      <p className="text-[11px] text-[#6b6b6b]">
                        {toCurrency(effectivePrice)} • Default qty {mapping.default_quantity} • Max qty {mapping.max_quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          mapping.is_active
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {mapping.is_active ? 'Active' : 'Retired'}
                      </span>
                      {mapping.is_active ? (
                        <button
                          type="button"
                          onClick={() => retireMapping(mapping.id)}
                          disabled={isPending}
                          className="rounded-full border border-[#e8ccb3] bg-white px-2.5 py-1 text-[10px] font-semibold text-ink hover:bg-[#fff4e6]"
                        >
                          Retire
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reactivateMapping(mapping.id)}
                          disabled={isPending}
                          className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100"
                        >
                          Enable
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => hardDeleteMapping(mapping.id)}
                        disabled={isPending}
                        className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {selectedServiceId && mappings.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[#e8ccb3] p-3 text-xs text-[#6b6b6b]">
                No add-ons attached to this service yet.
              </li>
            ) : null}
          </ul>

          {mappingsError ? (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Unable to load mappings: {mappingsError}. Verify add-on migration and admin APIs are available in this environment.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
