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
        subtitle="Build and manage the services offered on the platform"
        steps={[
          { title: 'Switch Panels', description: 'Use the "Service Types" and "Services" tabs to switch between managing categories and individual services.' },
          { title: 'Service Types', description: 'Create and edit service categories (e.g., Grooming, Vet Visit). These are the top-level groups customers see.' },
          { title: 'Add a Service', description: 'Under the Services panel, create specific service offerings with pricing, duration, and provider assignments.' },
          { title: 'Edit Details', description: 'Click on any service type or service to update its name, description, pricing, or availability.' },
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
