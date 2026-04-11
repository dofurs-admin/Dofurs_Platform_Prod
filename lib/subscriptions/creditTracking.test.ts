import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeOrRestoreCreditForBookingTransition, reserveCreditForBooking } from './creditTracking';

function makeReserveSupabase(options?: {
  activeSubscriptions?: Array<{
    id: string;
    starts_at?: string | null;
    ends_at: string;
    user_service_credits: Array<{
      id: string;
      service_type: string;
      available_credits: number;
      consumed_credits?: number;
    }>;
  }>;
  linkInsertError?: { message: string } | null;
}) {
  const activeSubscriptions = options?.activeSubscriptions ?? [];
  const linkInsertError = options?.linkInsertError ?? null;

  const debitUpdates: Array<Record<string, unknown>> = [];
  const linkUpserts: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'user_subscriptions') {
        const b: Record<string, unknown> = {};
        b.select = vi.fn().mockReturnValue(b);
        b.eq = vi.fn().mockReturnValue(b);
        b.order = vi.fn().mockResolvedValue({ data: activeSubscriptions, error: null });
        return b;
      }

      if (table === 'user_service_credits') {
        let currentCredit = activeSubscriptions[0]?.user_service_credits?.[0] ?? {
          id: 'credit_1',
          service_type: 'grooming',
          available_credits: 2,
          consumed_credits: 0,
        };

        const b: Record<string, unknown> = {};
        b.select = vi.fn().mockReturnValue(b);
        b.eq = vi.fn().mockReturnValue(b);
        b.single = vi.fn().mockResolvedValue({
          data: {
            id: currentCredit.id,
            available_credits: currentCredit.available_credits,
            consumed_credits: Number(currentCredit.consumed_credits ?? 0),
          },
          error: null,
        });
        b.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: currentCredit.id },
          error: null,
        });
        b.update = vi.fn((payload: Record<string, unknown>) => {
          debitUpdates.push(payload);
          if (typeof payload.available_credits === 'number') {
            currentCredit = {
              ...currentCredit,
              available_credits: payload.available_credits,
              consumed_credits: Number(payload.consumed_credits ?? currentCredit.consumed_credits ?? 0),
            };
          }
          const ub: Record<string, unknown> = {};
          ub.eq = vi.fn().mockReturnValue(ub);
          return ub;
        });
        return b;
      }

      if (table === 'booking_subscription_credit_links') {
        const b: Record<string, unknown> = {};
        b.select = vi.fn().mockReturnValue(b);
        b.eq = vi.fn().mockReturnValue(b);
        // First call is the idempotency check — return no existing link
        b.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        b.upsert = vi.fn((payload: Record<string, unknown>) => {
          linkUpserts.push(payload);
          return b;
        });
        b.single = vi.fn().mockResolvedValue(
          linkInsertError
            ? { data: null, error: linkInsertError }
            : {
                data: {
                  id: 'link_1',
                  booking_id: Number(linkUpserts[0]?.booking_id ?? 1),
                  user_subscription_id: String(linkUpserts[0]?.user_subscription_id ?? 'sub_1'),
                  service_type: String(linkUpserts[0]?.service_type ?? 'grooming'),
                  status: 'reserved',
                },
                error: null,
              },
        );
        b.delete = vi.fn().mockReturnValue(b);
        return b;
      }

      if (table === 'credit_usage_events') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            events.push(payload);
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }

      return {};
    }),
  } as unknown as SupabaseClient;

  return { supabase, debitUpdates, linkUpserts, events };
}

describe('reserveCreditForBooking', () => {
  it('debits available credits by the service amount and logs reserved link', async () => {
    const bookingId = 111;
    const userId = 'user_111';
    const serviceType = 'dog_grooming';
    const serviceAmount = 500;

    const { supabase, debitUpdates, linkUpserts, events } = makeReserveSupabase({
      activeSubscriptions: [
        {
          id: 'sub_1',
          ends_at: new Date(Date.now() + 86_400_000).toISOString(),
          user_service_credits: [
            { id: 'credit_1', service_type: 'grooming', available_credits: 2000, consumed_credits: 0 },
          ],
        },
      ],
    });

    const result = await reserveCreditForBooking(supabase, bookingId, userId, serviceType, serviceAmount);

    expect(result.status).toBe('reserved');
    expect(debitUpdates).toContainEqual({ available_credits: 1500, consumed_credits: 500 });
    expect(linkUpserts[0]?.service_type).toBe('grooming');
    expect(events[0]?.event_type).toBe('reserved');
    expect((events[0]?.notes as string)).toContain('amount: 500');
  });

  it('throws when user has no active subscription', async () => {
    const { supabase } = makeReserveSupabase({ activeSubscriptions: [] });

    await expect(reserveCreditForBooking(supabase, 1, 'user_a', 'grooming', 500)).rejects.toThrow(
      'No active subscription found.',
    );
  });

  it('throws when available credits are less than service amount', async () => {
    const { supabase } = makeReserveSupabase({
      activeSubscriptions: [
        {
          id: 'sub_2',
          ends_at: new Date(Date.now() + 86_400_000).toISOString(),
          user_service_credits: [
            { id: 'credit_x', service_type: 'vet_consultation', available_credits: 200, consumed_credits: 800 },
          ],
        },
      ],
    });

    await expect(reserveCreditForBooking(supabase, 2, 'user_b', 'vet_consultation', 500)).rejects.toThrow(
      'Insufficient subscription credits for this service.',
    );
  });

  it('throws when service amount is zero', async () => {
    const { supabase } = makeReserveSupabase({
      activeSubscriptions: [
        {
          id: 'sub_3',
          ends_at: new Date(Date.now() + 86_400_000).toISOString(),
          user_service_credits: [
            { id: 'credit_y', service_type: 'grooming', available_credits: 1000, consumed_credits: 0 },
          ],
        },
      ],
    });

    await expect(reserveCreditForBooking(supabase, 3, 'user_c', 'grooming', 0)).rejects.toThrow(
      'Service amount must be a positive number',
    );
  });

  it('throws when service amount is negative', async () => {
    const { supabase } = makeReserveSupabase({
      activeSubscriptions: [
        {
          id: 'sub_4',
          ends_at: new Date(Date.now() + 86_400_000).toISOString(),
          user_service_credits: [
            { id: 'credit_z', service_type: 'grooming', available_credits: 1000, consumed_credits: 0 },
          ],
        },
      ],
    });

    await expect(reserveCreditForBooking(supabase, 4, 'user_d', 'grooming', -100)).rejects.toThrow(
      'Service amount must be a positive number',
    );
  });
});

function makeTransitionSupabase(options: {
  link: {
    id: string;
    user_id: string;
    user_subscription_id: string;
    service_type: string;
    status: 'reserved' | 'consumed' | 'released' | 'restored';
  } | null;
  credit: {
    id: string;
    total_credits: number;
    available_credits: number;
    consumed_credits: number;
  };
  priceAtBooking: number;
}) {
  const linkUpdates: Array<Record<string, unknown>> = [];
  const creditUpdates: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'booking_subscription_credit_links') {
        const b: Record<string, unknown> = {};
        b.select = vi.fn().mockReturnValue(b);
        b.eq = vi.fn().mockReturnValue(b);
        b.maybeSingle = vi.fn().mockResolvedValue({ data: options.link, error: null });
        b.update = vi.fn((payload: Record<string, unknown>) => {
          linkUpdates.push(payload);
          const ub: Record<string, unknown> = {};
          ub.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return ub;
        });
        return b;
      }

      if (table === 'bookings') {
        const b: Record<string, unknown> = {};
        b.select = vi.fn().mockReturnValue(b);
        b.eq = vi.fn().mockReturnValue(b);
        b.single = vi.fn().mockResolvedValue({
          data: { price_at_booking: options.priceAtBooking },
          error: null,
        });
        return b;
      }

      if (table === 'user_service_credits') {
        const b: Record<string, unknown> = {};
        b.select = vi.fn().mockReturnValue(b);
        b.eq = vi.fn().mockReturnValue(b);
        b.single = vi.fn().mockResolvedValue({ data: options.credit, error: null });
        b.update = vi.fn((payload: Record<string, unknown>) => {
          creditUpdates.push(payload);
          const ub: Record<string, unknown> = {};
          ub.eq = vi.fn().mockResolvedValue({ data: null, error: null });
          return ub;
        });
        return b;
      }

      if (table === 'credit_usage_events') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            events.push(payload);
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }

      return {};
    }),
  } as unknown as SupabaseClient;

  return { supabase, linkUpdates, creditUpdates, events };
}

describe('consumeOrRestoreCreditForBookingTransition', () => {
  it('marks reserved link as consumed on completion without extra debit', async () => {
    const { supabase, linkUpdates, creditUpdates, events } = makeTransitionSupabase({
      link: {
        id: 'link_1',
        user_id: 'user_1',
        user_subscription_id: 'sub_1',
        service_type: 'grooming',
        status: 'reserved',
      },
      credit: {
        id: 'credit_1',
        total_credits: 5000,
        available_credits: 4500,
        consumed_credits: 500,
      },
      priceAtBooking: 500,
    });

    await consumeOrRestoreCreditForBookingTransition(supabase, 11, 'completed');

    expect(linkUpdates).toContainEqual({ status: 'consumed' });
    expect(creditUpdates.length).toBe(0);
    expect(events[0]?.event_type).toBe('consumed');
  });

  it('restores full service amount when reserved booking is cancelled', async () => {
    const { supabase, linkUpdates, creditUpdates, events } = makeTransitionSupabase({
      link: {
        id: 'link_2',
        user_id: 'user_2',
        user_subscription_id: 'sub_2',
        service_type: 'grooming',
        status: 'reserved',
      },
      credit: {
        id: 'credit_2',
        total_credits: 5000,
        available_credits: 4500,
        consumed_credits: 500,
      },
      priceAtBooking: 500,
    });

    await consumeOrRestoreCreditForBookingTransition(supabase, 22, 'cancelled');

    expect(creditUpdates).toContainEqual({ available_credits: 5000, consumed_credits: 0 });
    expect(linkUpdates).toContainEqual({ status: 'released' });
    expect(events[0]?.event_type).toBe('released');
    expect((events[0]?.notes as string)).toContain('amount: 500');
  });

  it('restores full service amount when consumed booking is cancelled', async () => {
    const { supabase, linkUpdates, creditUpdates, events } = makeTransitionSupabase({
      link: {
        id: 'link_3',
        user_id: 'user_3',
        user_subscription_id: 'sub_3',
        service_type: 'grooming',
        status: 'consumed',
      },
      credit: {
        id: 'credit_3',
        total_credits: 5000,
        available_credits: 4200,
        consumed_credits: 800,
      },
      priceAtBooking: 500,
    });

    await consumeOrRestoreCreditForBookingTransition(supabase, 33, 'cancelled');

    expect(creditUpdates).toContainEqual({ available_credits: 4700, consumed_credits: 300 });
    expect(linkUpdates).toContainEqual({ status: 'restored' });
    expect(events[0]?.event_type).toBe('restored');
    expect((events[0]?.notes as string)).toContain('amount: 500');
  });

  it('caps restored credits at total_credits', async () => {
    const { supabase, creditUpdates } = makeTransitionSupabase({
      link: {
        id: 'link_4',
        user_id: 'user_4',
        user_subscription_id: 'sub_4',
        service_type: 'grooming',
        status: 'reserved',
      },
      credit: {
        id: 'credit_4',
        total_credits: 5000,
        available_credits: 4800,
        consumed_credits: 200,
      },
      priceAtBooking: 500,
    });

    await consumeOrRestoreCreditForBookingTransition(supabase, 44, 'cancelled');

    // 4800 + 500 = 5300 > 5000, so capped at 5000
    expect(creditUpdates).toContainEqual({ available_credits: 5000, consumed_credits: 0 });
  });
});
