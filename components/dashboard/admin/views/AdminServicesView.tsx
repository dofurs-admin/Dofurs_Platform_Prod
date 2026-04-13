'use client';

import ServiceCategoriesManager from '@/components/dashboard/admin/ServiceCategoriesManager';
import ServiceBuilder from '@/components/dashboard/admin/ServiceBuilder';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import type { ServiceCategory, Service } from '@/lib/service-catalog/types';

type ServiceCatalogPanel = 'types' | 'services';

type AdminServicesViewProps = {
  serviceCatalogPanel: ServiceCatalogPanel;
  onPanelChange: (panel: ServiceCatalogPanel) => void;
  initialServiceCategories: ServiceCategory[];
  initialCatalogServices: Service[];
};

export default function AdminServicesView({
  serviceCatalogPanel,
  onPanelChange,
  initialServiceCategories,
  initialCatalogServices,
}: AdminServicesViewProps) {
  return (
    <section className="space-y-4">
      <AdminSectionGuide
        title="How to Use Service Catalog"
        subtitle="Build canonical service templates, then roll them out in the Providers view"
        steps={[
          { title: 'Switch Panels', description: 'Use "Service Types" for categories and "Services" for catalog templates.' },
          { title: 'Service Types', description: 'Create and edit top-level categories such as Grooming, Vet Visit, and Training.' },
          { title: 'Catalog Services', description: 'Create service templates with default price, duration, media, and requirements.' },
          { title: 'Provider Rollout', description: 'Assign templates and serviceable pincodes from the Providers tab only.' },
        ]}
      />

      <div className="rounded-2xl border border-neutral-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">Catalog Builders</h2>
            <p className="text-xs text-neutral-600">Select one section to edit at a time.</p>
          </div>
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
          </div>
        </div>
      </div>

      {serviceCatalogPanel === 'types' ? (
        <ServiceCategoriesManager initialCategories={initialServiceCategories} />
      ) : null}

      {serviceCatalogPanel === 'services' ? (
        <ServiceBuilder
          initialServices={initialCatalogServices}
          categories={initialServiceCategories}
        />
      ) : null}
    </section>
  );
}
