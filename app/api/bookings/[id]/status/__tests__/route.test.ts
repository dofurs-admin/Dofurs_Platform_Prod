import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitKey: vi.fn().mockReturnValue('rate-key'),
  isRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock('@/lib/bookings/service', () => ({
  cancelBooking: vi.fn(),
  cancelBookingAsProvider: vi.fn(),
  confirmBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  updateBookingStatus: vi.fn(),
}));

vi.mock('@/lib/notifications/service', () => ({
  notifyBookingStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { updateBookingStatus } from '@/lib/bookings/service';
import { PATCH } from '@/app/api/bookings/[id]/status/route';

function makeAdminSupabase(options?: { hasCashCollection?: boolean }) {
  const bookingLookupSingle = vi.fn().mockResolvedValue({
    data: {
      id: 44,
      user_id: 'user-44',
      provider_id: 404,
      booking_status: 'confirmed',
      payment_mode: 'direct_to_provider',
    },
    error: null,
  });

  const collectionMaybeSingle = vi.fn().mockResolvedValue({
    data: options?.hasCashCollection ? { id: 'cash-1' } : null,
    error: null,
  });

  const bookingsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: bookingLookupSingle,
  };

  const collectionsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: collectionMaybeSingle,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'bookings') return bookingsQuery;
      if (table === 'booking_payment_collections') return collectionsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('PATCH /api/bookings/[id]/status', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('blocks admin completion when direct-to-provider booking is not marked paid', async () => {
    const adminSupabase = makeAdminSupabase({ hasCashCollection: false });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        role: 'admin',
        user: { id: 'admin-user-id' },
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/bookings/44/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '44' }) });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain('Cash payment');
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('allows admin completion when direct-to-provider collection is marked paid', async () => {
    const adminSupabase = makeAdminSupabase({ hasCashCollection: true });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);
    vi.mocked(updateBookingStatus).mockResolvedValue({ id: 44, booking_status: 'completed' } as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        role: 'admin',
        user: { id: 'admin-user-id' },
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/bookings/44/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '44' }) });
    expect(response.status).toBe(200);
    expect(updateBookingStatus).toHaveBeenCalledTimes(1);
  });
});
