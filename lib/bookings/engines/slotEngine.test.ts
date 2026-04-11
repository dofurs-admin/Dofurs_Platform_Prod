import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAvailableSlots, resolveDayAvailability, resolveAvailableSlotsMultiDay } from './slotEngine';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookableSlot } from '../types';

/**
 * SlotEngine Test Suite
 * 
 * Note: SlotEngine primarily uses Supabase RPC (get_available_slots) which
 * requires database access. These tests focus on integration patterns and
 * mocking strategies. For full coverage, use E2E tests with test database.
 */

// Helper to create mock Supabase client
function createMockSupabaseForSlots(
  rpcSlots: BookableSlot[],
  blocks: Array<{ block_start: string; block_end: string }> = [],
  blockedDates: Array<{ id: string; reason: string }> = [],
) {
  return {
    rpc: async (name: string, params: unknown) => {
      void params;
      if (name === 'get_available_slots') {
        return { data: rpcSlots, error: null };
      }
      return { data: null, error: new Error('Unknown RPC') };
    },
    from: (table: string) => ({
      select: (columns: string) => {
        void columns;
        return {
          eq: (column: string, value: unknown) => {
            void column;
            void value;
          const chain = {
            eq: (col2: string, val2: unknown) => {
              void col2;
              void val2;
              return chain;
            },
            or: (condition: string) => {
              void condition;
              return chain;
            },
            single: async () => {
              if (table === 'provider_blocked_dates' && blockedDates.length > 0) {
                return { data: blockedDates[0], error: null };
              }
              return { data: null, error: null };
            },
          };

          if (table === 'provider_blocks') {
            return {
              ...chain,
              // Return blocks data immediately for provider_blocks
              then: async (resolve: (value: unknown) => void) => {
                resolve({ data: blocks, error: null });
              },
              or: (condition: string) => {
                void condition;
                return {
                  then: async (resolve: (value: unknown) => void) => {
                    resolve({ data: blocks, error: null });
                  },
                };
              },
            };
          }

          return chain;
          },
        };
      },
    }),
  } as unknown as SupabaseClient;
}

describe('slotEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00+05:30'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Same-day slot guardrails', () => {
    it('should hide past slots for same-day booking', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:30:00+05:30'));

      const mockSlots: BookableSlot[] = [
        { start_time: '10:00', end_time: '10:30', is_available: true },
        { start_time: '12:30', end_time: '13:00', is_available: true },
        { start_time: '13:00', end_time: '13:30', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(1);
      expect(result[0].start_time).toBe('13:00');

      vi.useRealTimers();
    });

    it('should block same-day booking after 6 PM', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T18:15:00+05:30'));

      const mockSlots: BookableSlot[] = [
        { start_time: '18:30', end_time: '19:00', is_available: true },
        { start_time: '19:00', end_time: '19:30', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toEqual([]);

      vi.useRealTimers();
    });
  });

  describe('resolveAvailableSlots', () => {
    it('should return available slots from RPC', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '09:30', is_available: true },
        { start_time: '10:00', end_time: '10:30', is_available: true },
        { start_time: '11:00', end_time: '11:30', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(3);
      expect(result[0].start_time).toBe('09:00');
      expect(result[0].end_time).toBe('09:30');
      expect(result[0].is_available).toBe(true);
    });

    it('should normalize time values to HH:MM format', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00:00', end_time: '09:30:00', is_available: true },
        { start_time: '14:15:30', end_time: '15:00:45', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result[0].start_time).toBe('09:00');
      expect(result[0].end_time).toBe('09:30');
      expect(result[1].start_time).toBe('14:15');
      expect(result[1].end_time).toBe('15:00');
    });

    it('should filter out slots blocked by provider_blocks', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '09:30', is_available: true },
        { start_time: '10:00', end_time: '10:30', is_available: true }, // Will be blocked
        { start_time: '11:00', end_time: '11:30', is_available: true },
      ];

      const blocks = [
        {
          block_start: '2026-03-10T10:00:00',
          block_end: '2026-03-10T10:30:00',
        },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots, blocks);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.start_time === '10:00')).toBeUndefined();
    });

    it('should handle empty RPC response', async () => {
      const supabase = createMockSupabaseForSlots([]);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toEqual([]);
    });

    it('should use default service duration (30 minutes) when not specified', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '09:30', is_available: true },
      ];

      let capturedParams: Record<string, unknown> | undefined;
      const supabase = {
        rpc: async (name: string, params: Record<string, unknown>) => {
          capturedParams = params;
          return { data: mockSlots, error: null };
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              or: () => ({
                then: async (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
      });

      expect(capturedParams?.p_service_duration_minutes).toBe(30);
    });

    it('should pass selected service duration to RPC when provided', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '10:00', is_available: true },
      ];

      let capturedParams: Record<string, unknown> | undefined;
      const supabase = {
        rpc: async (_name: string, params: Record<string, unknown>) => {
          capturedParams = params;
          return { data: mockSlots, error: null };
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              or: () => ({
                then: async (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 60,
      });

      expect(capturedParams?.p_service_duration_minutes).toBe(60);
    });
  });

  describe('resolveDayAvailability', () => {
    it('should return day with slots when not blocked', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '09:30', is_available: true },
        { start_time: '10:00', end_time: '10:30', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveDayAvailability(supabase, 123, '2026-03-10', 30);

      expect(result.date).toBe('2026-03-10');
      expect(result.is_blocked).toBe(false);
      expect(result.slots).toHaveLength(2);
      expect(result.dayOfWeek).toBe(2); // Tuesday
      expect(result.dayName).toBe('Tuesday');
    });

    it('should return blocked day with empty slots', async () => {
      const blockedDates = [
        { id: 'block-1', reason: 'Holiday' },
      ];

      const supabase = createMockSupabaseForSlots([], [], blockedDates);

      const result = await resolveDayAvailability(supabase, 123, '2026-03-15', 30);

      expect(result.is_blocked).toBe(true);
      expect(result.block_reason).toBe('Holiday');
      expect(result.slots).toEqual([]);
    });

    it('should correctly identify day of week and name', async () => {
      const supabase = createMockSupabaseForSlots([]);

      // Test multiple days
      const monday = await resolveDayAvailability(supabase, 123, '2026-03-09', 30);
      expect(monday.dayOfWeek).toBe(1); // Monday
      expect(monday.dayName).toBe('Monday');

      const tuesday = await resolveDayAvailability(supabase, 123, '2026-03-10', 30);
      expect(tuesday.dayOfWeek).toBe(2); // Tuesday
      expect(tuesday.dayName).toBe('Tuesday');

      const saturday = await resolveDayAvailability(supabase, 123, '2026-03-14', 30);
      expect(saturday.dayOfWeek).toBe(6); // Saturday
      expect(saturday.dayName).toBe('Saturday');
    });
  });

  describe('resolveAvailableSlotsMultiDay', () => {
    it('should return availability for date range', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '09:30', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlotsMultiDay(supabase, {
        providerId: 123,
        fromDate: '2026-03-10',
        toDate: '2026-03-12',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(3); // 3 days inclusive
      expect(result[0].date).toBe('2026-03-10');
      expect(result[1].date).toBe('2026-03-11');
      expect(result[2].date).toBe('2026-03-12');
    });

    it('should handle single day range', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '09:30', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlotsMultiDay(supabase, {
        providerId: 123,
        fromDate: '2026-03-10',
        toDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-03-10');
    });

    it('should include both from and to dates (inclusive)', async () => {
      const supabase = createMockSupabaseForSlots([]);

      const result = await resolveAvailableSlotsMultiDay(supabase, {
        providerId: 123,
        fromDate: '2026-03-01',
        toDate: '2026-03-07',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(7);
      expect(result[0].date).toBe('2026-03-01');
      expect(result[6].date).toBe('2026-03-07');
    });

    it('should respect blocked dates in multi-day range', async () => {
      const blockedDates = [{ id: 'block-1', reason: 'Holiday' }];
      
      // Create a mock that returns blocked date only for specific date
      const supabase = {
        rpc: async () => ({ data: [], error: null }),
        from: (table: string) => {
          void table;
          return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              void column;
              void value;
              return {
                eq: (col2: string, val2: unknown) => {
                  void col2;
                  return {
                single: async () => {
                  // Return blocked only for middle date (2026-03-11)
                  if (val2 === '2026-03-11') {
                    return { data: blockedDates[0], error: null };
                  }
                  return { data: null, error: null };
                },
                  };
                },
                or: () => ({
                  then: async (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
                }),
              };
            },
          }),
        };
      },
      } as unknown as SupabaseClient;

      const result = await resolveAvailableSlotsMultiDay(supabase, {
        providerId: 123,
        fromDate: '2026-03-10',
        toDate: '2026-03-12',
        serviceDurationMinutes: 30,
      });

      expect(result).toHaveLength(3);
      expect(result[0].is_blocked).toBe(false);
      expect(result[1].is_blocked).toBe(true);
      expect(result[1].block_reason).toBe('Holiday');
      expect(result[2].is_blocked).toBe(false);
    });
  });

  describe('Integration: Slot Overlap Prevention', () => {
    it('should not return overlapping slots', async () => {
      const mockSlots: BookableSlot[] = [
        { start_time: '09:00', end_time: '10:00', is_available: true },
        { start_time: '10:00', end_time: '11:00', is_available: true },
        { start_time: '11:00', end_time: '12:00', is_available: true },
      ];

      const supabase = createMockSupabaseForSlots(mockSlots);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 60,
      });

      // Verify slots are contiguous, not overlapping
      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i];
        const next = result[i + 1];
        expect(current.end_time).toBe(next.start_time);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle provider with no availability', async () => {
      const supabase = createMockSupabaseForSlots([]);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 999,
        bookingDate: '2026-03-10',
        serviceDurationMinutes: 30,
      });

      expect(result).toEqual([]);
    });

    it('should handle past dates gracefully', async () => {
      const supabase = createMockSupabaseForSlots([]);

      const result = await resolveAvailableSlots(supabase, {
        providerId: 123,
        bookingDate: '2020-01-01',
        serviceDurationMinutes: 30,
      });

      // Should not throw, just return empty
      expect(result).toEqual([]);
    });
  });
});
