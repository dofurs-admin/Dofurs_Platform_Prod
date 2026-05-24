'use client';

import { useState } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import ServiceCategoriesManager from '@/components/dashboard/admin/ServiceCategoriesManager';
import ServiceBuilder from '@/components/dashboard/admin/ServiceBuilder';
import ServiceAddonsManager from '@/components/dashboard/admin/ServiceAddonsManager';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import { cn } from '@/lib/design-system';
import type { ServiceCategory, Service } from '@/lib/service-catalog/types';

type ServiceCatalogPanel = 'types' | 'services' | 'addons';

type AdminServicesViewProps = {
  serviceCatalogPanel: ServiceCatalogPanel;
  onPanelChange: (panel: ServiceCatalogPanel) => void;
  initialServiceCategories: ServiceCategory[];
  initialCatalogServices: Service[];
  catalogBuilderExpanded?: boolean;
  defaultCatalogBuilderExpanded?: boolean;
  onCatalogBuilderToggle?: () => void;
};

const serviceCatalogPanelLabels: Record<ServiceCatalogPanel, string> = {
  types: 'Service Types',
  services: 'Services',
  addons: 'Add-ons',
};

export default function AdminServicesView({
  serviceCatalogPanel,
  onPanelChange,
  initialServiceCategories,
  initialCatalogServices,
  catalogBuilderExpanded,
  defaultCatalogBuilderExpanded = true,
  onCatalogBuilderToggle,
}: AdminServicesViewProps) {
  const [localCatalogBuilderExpanded, setLocalCatalogBuilderExpanded] = useState(defaultCatalogBuilderExpanded);
  const isCatalogBuilderExpanded = catalogBuilderExpanded ?? localCatalogBuilderExpanded;
  const catalogBuilderContentId = 'admin-services-catalog-builders-content';
  const catalogBuilderSwitcherId = 'admin-services-catalog-builders-switcher';

  function toggleCatalogBuilder() {
    if (onCatalogBuilderToggle) {
      onCatalogBuilderToggle();
      return;
    }

    setLocalCatalogBuilderExpanded((current) => !current);
  }

  return (
    <section className="space-y-4">
      <AdminSectionGuide
        title="How to Use Service Catalog"
        subtitle="Build canonical service templates, then roll them out in the Providers view"
        steps={[
          { title: 'Switch Panels', description: 'Use "Service Types" for categories, "Services" for catalog templates, and "Add-ons" for reusable extras.' },
          { title: 'Service Types', description: 'Create and edit grooming categories, packages, and package families.' },
          { title: 'Catalog Services', description: 'Create service templates with default price, duration, media, and requirements.' },
          { title: 'Add-ons', description: 'Create add-on templates, then attach them to services from the Add-ons panel.' },
          { title: 'Provider Rollout', description: 'Assign templates and serviceable pincodes from the Providers tab only.' },
        ]}
      />

      <div className="rounded-2xl border border-neutral-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={toggleCatalogBuilder}
            aria-expanded={isCatalogBuilderExpanded}
            aria-controls={`${catalogBuilderSwitcherId} ${catalogBuilderContentId}`}
            className="group flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#f2dfcf] bg-[#fff7f0] text-coral transition-colors group-hover:bg-[#ffefe0]">
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-200', isCatalogBuilderExpanded ? 'rotate-180' : '')}
                aria-hidden="true"
              />
            </span>
            <span>
              <span className="block text-base font-semibold text-neutral-950">Catalog Builders</span>
              <span className="mt-1 block text-xs text-neutral-600">Select one section to edit at a time.</span>
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-semibold text-ink">
              Open: {serviceCatalogPanelLabels[serviceCatalogPanel]}
            </span>
            <button
              type="button"
              onClick={toggleCatalogBuilder}
              aria-expanded={isCatalogBuilderExpanded}
              aria-controls={`${catalogBuilderSwitcherId} ${catalogBuilderContentId}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:ring-offset-2"
            >
              {isCatalogBuilderExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isCatalogBuilderExpanded ? 'Minimize' : 'Expand'}
            </button>
          </div>
        </div>

        <div
          id={catalogBuilderSwitcherId}
          hidden={!isCatalogBuilderExpanded}
          className="mt-4"
        >
          <div className="inline-flex rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-1">
            <button
              type="button"
              onClick={() => onPanelChange('types')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                serviceCatalogPanel === 'types'
                  ? 'bg-white text-coral shadow-sm'
                  : 'text-ink/80 hover:text-coral'
              }`}
            >
              Service Types
            </button>
            <button
              type="button"
              onClick={() => onPanelChange('services')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                serviceCatalogPanel === 'services'
                  ? 'bg-white text-coral shadow-sm'
                  : 'text-ink/80 hover:text-coral'
              }`}
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => onPanelChange('addons')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                serviceCatalogPanel === 'addons'
                  ? 'bg-white text-coral shadow-sm'
                  : 'text-ink/80 hover:text-coral'
              }`}
            >
              Add-ons
            </button>
          </div>
        </div>
      </div>

      <div id={catalogBuilderContentId} hidden={!isCatalogBuilderExpanded}>
        {serviceCatalogPanel === 'types' ? (
          <ServiceCategoriesManager initialCategories={initialServiceCategories} />
        ) : null}

        {serviceCatalogPanel === 'services' ? (
          <ServiceBuilder
            initialServices={initialCatalogServices}
            categories={initialServiceCategories}
          />
        ) : null}

        {serviceCatalogPanel === 'addons' ? (
          <ServiceAddonsManager services={initialCatalogServices} />
        ) : null}
      </div>
    </section>
  );
}
