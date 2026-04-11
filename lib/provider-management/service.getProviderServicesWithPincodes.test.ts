import { describe, expect, it, vi } from 'vitest';
import { getProviderServicesWithPincodes } from './service';

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
