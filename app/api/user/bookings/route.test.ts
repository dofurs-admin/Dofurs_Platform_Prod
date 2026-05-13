import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/bookings/service', () => ({
  getMyBookings: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  logSecurityEvent: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getMyBookings } from '@/lib/bookings/service';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { GET } from '@/app/api/user/bookings/route';

function makeAdminClientMock(options: {
  collections?: Array<{ booking_id: number; amount_inr: number | null; status: string }>;
  captured?: Array<{ booking_id: number | null; amount_inr: number | null; status: string | null }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'booking_payment_collections') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          returns: vi.fn().mockResolvedValue({ data: options.collections ?? [], error: null }),
        };
      }

      if (table === 'payment_transactions') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          returns: vi.fn().mockResolvedValue({ data: options.captured ?? [], error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('GET /api/user/bookings', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('uses explicit non-paid collection amount even when payment_mode is stale', async () => {
    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'user-1' },
        role: 'user',
        supabase: {},
      },
    } as never);

    vi.mocked(getMyBookings).mockResolvedValue([
      {
        id: 212,
        payment_mode: 'platform',
        amount: 2298,
        final_price: 2298,
        price_at_booking: 2298,
      },
    ] as never);

    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeAdminClientMock({
        collections: [{ booking_id: 212, amount_inr: 2298, status: 'pending' }],
        captured: [],
      }) as never,
    );

    const response = await GET(new Request('http://localhost/api/user/bookings'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.bookings[0].pending_payable_inr).toBe(2298);
  });

  it('falls back to computed pending when collection row has zero but booking is cash', async () => {
    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'user-1' },
        role: 'user',
        supabase: {},
      },
    } as never);

    vi.mocked(getMyBookings).mockResolvedValue([
      {
        id: 213,
        payment_mode: 'direct_to_provider',
        amount: 2298,
        final_price: 2298,
        price_at_booking: 2298,
      },
    ] as never);

    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeAdminClientMock({
        collections: [{ booking_id: 213, amount_inr: 0, status: 'pending' }],
        captured: [{ booking_id: 213, amount_inr: 300, status: 'captured' }],
      }) as never,
    );

    const response = await GET(new Request('http://localhost/api/user/bookings'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.bookings[0].pending_payable_inr).toBe(1998);
  });
});
