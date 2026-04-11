import { describe, it, expect } from 'vitest';
import { calculateBookingPriceWithSupabase } from './pricingEngine';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
function createMockSupabase<T>(mockData: T, error: Error | null = null) {
  const eqChain = {
    eq: () => eqChain,
    single: async () => ({ data: mockData, error }),
    returns: async () => ({ data: mockData, error }),
    in: () => ({
      returns: async () => ({ data: mockData, error }),
    }),
  };

  return {
    from: () => ({
      select: () => ({
        eq: () => eqChain,
        in: () => ({
          returns: async () => ({ data: mockData, error }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('pricingEngine', () => {
  describe('calculateBookingPriceWithSupabase - Service Booking', () => {
    it('should calculate price for basic service without add-ons', async () => {
      const supabase = createMockSupabase({
        base_price: 500,
        service_type: 'grooming_session',
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [],
      });

      expect(result.base_total).toBe(500);
      expect(result.addon_total).toBe(0);
      expect(result.discount_amount).toBe(0);
      expect(result.final_total).toBe(500);
      expect(result.breakdown).toContain('grooming_session: ₹500');
    });

    it('should calculate price with single add-on', async () => {
      const serviceData = { base_price: 500, service_type: 'grooming_session' };
      const addonRows = [{ id: 'addon-1', name: 'Nail Trimming', price: 50 }];

      const supabase = {
        from: (table: string) => {
          if (table === 'service_addons') {
            return {
              select: () => ({
                in: async () => ({ data: addonRows, error: null }),
              }),
            };
          }
          const eqChain = {
            eq: () => eqChain,
            single: async () => ({ data: serviceData, error: null }),
          };
          return { select: () => ({ eq: () => eqChain }) };
        },
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [{ id: 'addon-1', quantity: 1 }],
      });

      expect(result.base_total).toBe(500);
      expect(result.addon_total).toBe(50);
      expect(result.final_total).toBe(550);
      expect(result.breakdown).toContain('Nail Trimming (x1): ₹50');
    });

    it('should calculate price with multiple add-ons and quantities', async () => {
      const serviceData = { base_price: 600, service_type: 'vet_consultation' };
      const addonRows = [
        { id: 'addon-1', name: 'Vaccination', price: 200 },
        { id: 'addon-2', name: 'Health Certificate', price: 100 },
      ];

      const supabase = {
        from: (table: string) => {
          if (table === 'service_addons') {
            return {
              select: () => ({
                in: async () => ({ data: addonRows, error: null }),
              }),
            };
          }
          const eqChain = {
            eq: () => eqChain,
            single: async () => ({ data: serviceData, error: null }),
          };
          return { select: () => ({ eq: () => eqChain }) };
        },
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-vet',
        addOns: [
          { id: 'addon-1', quantity: 2 },
          { id: 'addon-2', quantity: 1 },
        ],
      });

      expect(result.base_total).toBe(600);
      expect(result.addon_total).toBe(500); // (200 * 2) + (100 * 1)
      expect(result.final_total).toBe(1100);
    });

    it('should throw error if service not found', async () => {
      const supabase = createMockSupabase(null, new Error('Service not found'));

      await expect(
        calculateBookingPriceWithSupabase(supabase, {
          bookingType: 'service',
          providerId: 123,
          serviceId: 'invalid-service',
          addOns: [],
        }),
      ).rejects.toThrow('Service not found');
    });

    it('should handle null/missing base_price gracefully', async () => {
      const supabase = createMockSupabase({
        base_price: null,
        service_type: 'grooming_session',
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
      const serviceData = { base_price: 500, service_type: 'grooming_session' };
      const addonRows = [{ id: 'addon-1', name: 'Extra Product', price: 50 }];

      const supabase = {
        from: (table: string) => {
          if (table === 'service_addons') {
            return {
              select: () => ({
                in: async () => ({ data: addonRows, error: null }),
              }),
            };
          }
          const eqChain = {
            eq: () => eqChain,
            single: async () => ({ data: serviceData, error: null }),
          };
          return { select: () => ({ eq: () => eqChain }) };
        },
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [{ id: 'addon-1', quantity: 0 }],
      });

      // Quantity 0 should be treated as 1 (Math.max(1, qty))
      expect(result.addon_total).toBe(50);
      expect(result.final_total).toBe(550);
    });
  });

  describe('Edge Cases & Security', () => {
    it('should floor final price at 0 (no negative prices)', async () => {
      const supabase = createMockSupabase({
        base_price: 0,
        service_type: 'test_service',
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
