import { describe, it, expect } from 'vitest';
import { calculateBookingPriceWithSupabase } from './pricingEngine';
import type { SupabaseClient } from '@supabase/supabase-js';

type PricingMockConfig = {
  serviceRow?: { base_price: number | null; service_type: string } | null;
  serviceRowError?: Error | null;
  serviceTypes?: Array<{ id: string; service_type: string | null }>;
  serviceTypesError?: Error | null;
  mappingRows?: Array<{
    id: string;
    provider_service_id: string;
    addon_template_id: string;
    price_override: number | null;
    is_active: boolean;
    moderation_status: string;
    addon_templates:
      | { id: string; name: string; default_price: number | null; is_active: boolean; moderation_status: string }
      | Array<{ id: string; name: string; default_price: number | null; is_active: boolean; moderation_status: string }>;
  }>;
  mappingRowsError?: Error | null;
  legacyRows?: Array<{ id: string; provider_service_id: string; name: string; price: number | null; is_active: boolean }>;
  legacyRowsError?: Error | null;
};

function createPricingMockSupabase(config: PricingMockConfig) {
  return {
    from: (table: string) => {
      if (table === 'provider_services') {
        const eqChain = {
          eq: () => eqChain,
          single: async () => ({ data: config.serviceRow ?? null, error: config.serviceRowError ?? null }),
        };

        return {
          select: () => ({
            eq: () => eqChain,
            in: () => ({
              returns: async () => ({ data: config.serviceTypes ?? [], error: config.serviceTypesError ?? null }),
            }),
          }),
        };
      }

      if (table === 'provider_service_addon_mappings') {
        return {
          select: () => ({
            in: () => ({
              returns: async () => ({ data: config.mappingRows ?? [], error: config.mappingRowsError ?? null }),
            }),
          }),
        };
      }

      if (table === 'service_addons') {
        return {
          select: () => ({
            in: () => ({
              returns: async () => ({ data: config.legacyRows ?? [], error: config.legacyRowsError ?? null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('pricingEngine', () => {
  describe('calculateBookingPriceWithSupabase - Service Booking', () => {
    it('should calculate price for basic service without add-ons', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: {
          base_price: 500,
          service_type: 'grooming_session',
        },
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-selected',
        addOns: [],
      });

      expect(result.base_total).toBe(500);
      expect(result.addon_total).toBe(0);
      expect(result.discount_amount).toBe(0);
      expect(result.final_total).toBe(500);
      expect(result.breakdown).toContain('grooming_session: ₹500');
    });

    it('should calculate price with normalized mapping add-on id', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: { base_price: 500, service_type: 'grooming_session' },
        serviceTypes: [
          { id: 'service-selected', service_type: 'grooming_session' },
          { id: 'service-catalog-grooming', service_type: 'grooming_session' },
        ],
        mappingRows: [
          {
            id: 'mapping-1',
            provider_service_id: 'service-catalog-grooming',
            addon_template_id: 'template-1',
            price_override: 60,
            is_active: true,
            moderation_status: 'approved',
            addon_templates: {
              id: 'template-1',
              name: 'Nail Trimming',
              default_price: 50,
              is_active: true,
              moderation_status: 'approved',
            },
          },
        ],
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-selected',
        addOns: [{ id: 'mapping-1', quantity: 2 }],
      });

      expect(result.base_total).toBe(500);
      expect(result.addon_total).toBe(120);
      expect(result.final_total).toBe(620);
      expect(result.breakdown).toContain('Nail Trimming (x2): ₹120');
    });

    it('should fall back to legacy service_addons ids', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: { base_price: 600, service_type: 'vet_consultation' },
        serviceTypes: [{ id: 'service-vet', service_type: 'vet_consultation' }],
        mappingRows: [],
        legacyRows: [
          {
            id: 'legacy-addon-1',
            provider_service_id: 'service-vet',
            name: 'Vaccination',
            price: 200,
            is_active: true,
          },
          {
            id: 'legacy-addon-2',
            provider_service_id: 'service-vet',
            name: 'Health Certificate',
            price: 100,
            is_active: true,
          },
        ],
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-vet',
        addOns: [
          { id: 'legacy-addon-1', quantity: 2 },
          { id: 'legacy-addon-2', quantity: 1 },
        ],
      });

      expect(result.base_total).toBe(600);
      expect(result.addon_total).toBe(500); // (200 * 2) + (100 * 1)
      expect(result.final_total).toBe(1100);
    });

    it('should throw error if service not found', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: null,
        serviceRowError: new Error('Service not found'),
      });

      await expect(
        calculateBookingPriceWithSupabase(supabase, {
          bookingType: 'service',
          providerId: 123,
          serviceId: 'invalid-service',
          addOns: [],
        }),
      ).rejects.toThrow('Service not found');
    });

    it('should throw on incompatible mapping service type', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: { base_price: 500, service_type: 'grooming_session' },
        serviceTypes: [
          { id: 'service-selected', service_type: 'grooming_session' },
          { id: 'service-vet-catalog', service_type: 'vet_consultation' },
        ],
        mappingRows: [
          {
            id: 'mapping-vet-1',
            provider_service_id: 'service-vet-catalog',
            addon_template_id: 'template-vet-1',
            price_override: null,
            is_active: true,
            moderation_status: 'approved',
            addon_templates: {
              id: 'template-vet-1',
              name: 'ECG Add-on',
              default_price: 300,
              is_active: true,
              moderation_status: 'approved',
            },
          },
        ],
      });

      await expect(
        calculateBookingPriceWithSupabase(supabase, {
          bookingType: 'service',
          providerId: 123,
          serviceId: 'service-selected',
          addOns: [{ id: 'mapping-vet-1', quantity: 1 }],
        }),
      ).rejects.toThrow('Add-on not found');
    });

    it('should handle null/missing base_price gracefully', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: {
          base_price: null,
          service_type: 'grooming_session',
        },
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [],
      });

      expect(result.base_total).toBe(0);
      expect(result.final_total).toBe(0);
    });

    it('should handle zero-quantity add-ons', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: { base_price: 500, service_type: 'grooming_session' },
        serviceTypes: [
          { id: 'service-selected', service_type: 'grooming_session' },
          { id: 'service-catalog-grooming', service_type: 'grooming_session' },
        ],
        mappingRows: [
          {
            id: 'mapping-1',
            provider_service_id: 'service-catalog-grooming',
            addon_template_id: 'template-1',
            price_override: null,
            is_active: true,
            moderation_status: 'approved',
            addon_templates: {
              id: 'template-1',
              name: 'Extra Product',
              default_price: 50,
              is_active: true,
              moderation_status: 'approved',
            },
          },
        ],
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-selected',
        addOns: [{ id: 'mapping-1', quantity: 0 }],
      });

      // Quantity 0 should be treated as 1 (Math.max(1, qty))
      expect(result.addon_total).toBe(50);
      expect(result.final_total).toBe(550);
    });
  });

  describe('Edge Cases & Security', () => {
    it('should floor final price at 0 (no negative prices)', async () => {
      const supabase = createPricingMockSupabase({
        serviceRow: {
          base_price: 0,
          service_type: 'test_service',
        },
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-overd',
        addOns: [],
      });

      expect(result.final_total).toBe(0);
    });
  });
});
