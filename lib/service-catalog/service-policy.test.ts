import { describe, expect, it } from 'vitest';
import {
  PUBLIC_BOOKABLE_SERVICE_ERROR,
  assertPublicBookableService,
  filterActiveCatalogProviderServices,
  filterPublicBookableCategories,
  filterPublicBookableServices,
  isGenericGroomingServiceQuery,
  isPublicBookableService,
  normalizeServiceFamily,
} from './service-policy';

describe('service-policy grooming gate', () => {
  it('normalizes grooming aliases into the grooming family', () => {
    expect(normalizeServiceFamily('grooming')).toBe('grooming');
    expect(normalizeServiceFamily('Dog Grooming')).toBe('grooming');
    expect(normalizeServiceFamily('cat-grooming')).toBe('grooming');
    expect(normalizeServiceFamily('pet grooming')).toBe('grooming');
    expect(normalizeServiceFamily('pet-grooming')).toBe('grooming');
    expect(normalizeServiceFamily('Full Spa Grooming')).toBe('grooming');
  });

  it('identifies generic public grooming aliases without swallowing package names', () => {
    expect(isGenericGroomingServiceQuery('grooming')).toBe(true);
    expect(isGenericGroomingServiceQuery('pet grooming')).toBe(true);
    expect(isGenericGroomingServiceQuery('pet-grooming')).toBe(true);
    expect(isGenericGroomingServiceQuery('Dog Grooming Bangalore')).toBe(true);
    expect(isGenericGroomingServiceQuery('Essential Grooming')).toBe(false);
    expect(isGenericGroomingServiceQuery('Fur Bath Care')).toBe(false);
  });

  it('does not normalize retired service families as public bookable services', () => {
    expect(normalizeServiceFamily('vet_consultation')).toBe('vet_consultation');
    expect(normalizeServiceFamily('Pet Boarding')).toBe('boarding');
    expect(normalizeServiceFamily('Training')).toBe('training');
    expect(isPublicBookableService({ service_type: 'vet_consultation', category: 'Vet Visits' })).toBe(false);
    expect(isPublicBookableService({ service_type: 'pet_sitting', category: 'Pet Sitting' })).toBe(false);
  });

  it('allows grooming services by service type or category', () => {
    expect(isPublicBookableService({ service_type: 'Complete Grooming', category: null })).toBe(true);
    expect(isPublicBookableService({ service_type: 'Bath Care', category: 'Pet Grooming' })).toBe(true);
  });

  it('filters public services and categories to grooming only', () => {
    const services = [
      { id: 1, provider_id: 'provider-uuid', service_type: 'Complete Grooming', category: 'Grooming' },
      { id: 2, service_type: 'Vet Visit', category: 'Veterinary' },
      { id: 3, service_type: 'Pet Sitting', category: 'Pet Sitting' },
    ];
    const categories = [
      { id: 1, name: 'Grooming' },
      { id: 2, name: 'Vet Visits' },
      { id: 3, name: 'Training' },
    ];

    expect(filterPublicBookableServices(services)).toEqual([services[0]]);
    expect(filterPublicBookableCategories(categories)).toEqual([categories[0]]);
  });

  it('filters customer catalog services to active catalog templates', () => {
    const providerServices = [
      { id: 'legacy-basic', provider_id: 10, service_type: 'Doorstep Pet Grooming (Basic Package)' },
      { id: 'legacy-offer', provider_id: 10, service_type: 'Summer Bonanza (Offer Package)' },
      { id: 'active-fur-bath', provider_id: 10, service_type: 'Fur Bath Care' },
      { id: 'inactive-complete', provider_id: 10, service_type: 'Complete Care' },
      { id: 'template-row', provider_id: null, service_type: 'Fur Bath Care' },
    ];
    const catalogTemplates = [
      { provider_id: null, service_type: 'Fur Bath Care', is_active: true },
      { provider_id: null, service_type: 'Complete Care', is_active: false },
    ];

    expect(filterActiveCatalogProviderServices(providerServices, catalogTemplates).map((service) => service.id)).toEqual([
      'active-fur-bath',
    ]);
  });

  it('throws the public booking error for non-grooming services', () => {
    expect(() => assertPublicBookableService({ service_type: 'Vet Visit', category: 'Veterinary' })).toThrow(
      PUBLIC_BOOKABLE_SERVICE_ERROR,
    );
  });
});
