import { describe, expect, it, vi } from 'vitest';
import { deleteProviderServiceRolloutEntry, getProviderServicesWithPincodes } from './service';

describe('getProviderServicesWithPincodes', () => {
  it('loads pincodes only for the provider service ids and filters disabled/duplicates', async () => {
    const providerServicesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'svc-1',
            provider_id: 55,
            service_type: 'grooming',
            base_price: 499,
            surge_price: null,
            commission_percentage: null,
            service_duration_minutes: 45,
            is_active: true,
            created_at: '2026-04-10T10:00:00.000Z',
          },
          {
            id: 'svc-2',
            provider_id: 55,
            service_type: 'veterinary',
            base_price: 799,
            surge_price: null,
            commission_percentage: null,
            service_duration_minutes: 60,
            is_active: true,
            created_at: '2026-04-10T10:00:00.000Z',
          },
        ],
        error: null,
      }),
    };

    const pincodeQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { provider_service_id: 'svc-1', pincode: '560001', is_enabled: true },
          { provider_service_id: 'svc-1', pincode: '560001', is_enabled: true },
          { provider_service_id: 'svc-1', pincode: '560002', is_enabled: false },
          { provider_service_id: 'svc-2', pincode: '560003', is_enabled: true },
          { provider_service_id: 'svc-other', pincode: '560999', is_enabled: true },
        ],
        error: null,
      }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'provider_services') {
          return providerServicesQuery;
        }
        if (table === 'provider_service_pincodes') {
          return pincodeQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getProviderServicesWithPincodes(supabase as never, 55);

    expect(providerServicesQuery.eq).toHaveBeenCalledWith('provider_id', 55);
    expect(pincodeQuery.in).toHaveBeenCalledWith('provider_service_id', ['svc-1', 'svc-2']);

    expect(result).toEqual([
      expect.objectContaining({ id: 'svc-1', service_pincodes: ['560001'] }),
      expect.objectContaining({ id: 'svc-2', service_pincodes: ['560003'] }),
    ]);
  });

  it('returns empty list and skips pincode query when provider has no services', async () => {
    const providerServicesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const pincodeQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'provider_services') {
          return providerServicesQuery;
        }
        if (table === 'provider_service_pincodes') {
          return pincodeQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getProviderServicesWithPincodes(supabase as never, 99);

    expect(result).toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('provider_services');
    expect(supabase.from).not.toHaveBeenCalledWith('provider_service_pincodes');
  });
});

describe('deleteProviderServiceRolloutEntry', () => {
  it('cleans dependent rollout rows and unlinks historical bookings before deleting the provider service row', async () => {
    const serviceLookupQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'svc-1' }, error: null }),
    };

    const serviceDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'svc-1' }, error: null }),
    };
    serviceDeleteQuery.eq.mockReturnValue(serviceDeleteQuery);

    const refreshedServicesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const addonMappingsLookupQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ id: 'mapping-1' }], error: null }),
    };

    const bookingAddonsUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    const addonMappingsDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const serviceAddonsDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const packageServicesDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const pincodeDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const bookingsUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const providerServiceQueries = [serviceLookupQuery, serviceDeleteQuery, refreshedServicesQuery];
    const addonMappingQueries = [addonMappingsLookupQuery, addonMappingsDeleteQuery];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'provider_services') {
          const nextQuery = providerServiceQueries.shift();
          if (!nextQuery) {
            throw new Error('Unexpected provider_services query');
          }
          return nextQuery;
        }
        if (table === 'provider_service_addon_mappings') {
          const nextQuery = addonMappingQueries.shift();
          if (!nextQuery) {
            throw new Error('Unexpected provider_service_addon_mappings query');
          }
          return nextQuery;
        }
        if (table === 'booking_addon_items') {
          return bookingAddonsUpdateQuery;
        }
        if (table === 'service_addons') {
          return serviceAddonsDeleteQuery;
        }
        if (table === 'package_services') {
          return packageServicesDeleteQuery;
        }
        if (table === 'provider_service_pincodes') {
          return pincodeDeleteQuery;
        }
        if (table === 'bookings') {
          return bookingsUpdateQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await expect(deleteProviderServiceRolloutEntry(supabase as never, 55, 'svc-1')).resolves.toEqual([]);

    expect(bookingAddonsUpdateQuery.update).toHaveBeenCalledWith({ provider_service_addon_mapping_id: null });
    expect(bookingAddonsUpdateQuery.in).toHaveBeenCalledWith('provider_service_addon_mapping_id', ['mapping-1']);
    expect(addonMappingsDeleteQuery.eq).toHaveBeenCalledWith('provider_service_id', 'svc-1');
    expect(serviceAddonsDeleteQuery.eq).toHaveBeenCalledWith('provider_service_id', 'svc-1');
    expect(packageServicesDeleteQuery.eq).toHaveBeenCalledWith('provider_service_id', 'svc-1');
    expect(pincodeDeleteQuery.eq).toHaveBeenCalledWith('provider_service_id', 'svc-1');
    expect(bookingsUpdateQuery.update).toHaveBeenCalledWith({ provider_service_id: null });
    expect(bookingsUpdateQuery.eq).toHaveBeenCalledWith('provider_service_id', 'svc-1');
    expect(serviceDeleteQuery.delete).toHaveBeenCalled();
    expect(serviceDeleteQuery.select).toHaveBeenCalledWith('id');
    expect(serviceDeleteQuery.maybeSingle).toHaveBeenCalled();
  });
});
