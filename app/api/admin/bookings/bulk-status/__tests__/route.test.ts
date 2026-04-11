import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/bookings/service', () => ({
  updateBookingStatus: vi.fn(),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock('@/lib/notifications/service', () => ({
  notifyBookingStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { requireApiRole } from '@/lib/auth/api-auth';
import { updateBookingStatus } from '@/lib/bookings/service';
import { notifyBookingStatusChanged } from '@/lib/notifications/service';
import { PATCH } from '@/app/api/admin/bookings/bulk-status/route';

function makeMockSupabaseForBookings(bookingRows: Array<{
  id: number;
  user_id: string;
  provider_id: number;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_mode?: string | null;
}>) {
  const single = vi.fn();

  for (const row of bookingRows) {
    single.mockResolvedValueOnce({ data: row, error: null });
  }

  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'col-1' }, error: null }),
    single,
  };

  return {
    from: vi.fn(() => query),
    __query: query,
  };
}

describe('PATCH /api/admin/bookings/bulk-status', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('succeeds with valid bookingIds and status', async () => {
    const mockSupabase = makeMockSupabaseForBookings([
      { id: 1, user_id: 'user-1', provider_id: 10, booking_status: 'pending', status: 'pending', payment_mode: 'direct_to_provider' },
      { id: 2, user_id: 'user-2', provider_id: 11, booking_status: 'pending', status: 'pending', payment_mode: 'direct_to_provider' },
      { id: 3, user_id: 'user-3', provider_id: 12, booking_status: 'pending', status: 'pending', payment_mode: 'direct_to_provider' },
    ]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);
    vi.mocked(updateBookingStatus).mockResolvedValue(undefined as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/bulk-status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingIds: [1, 2, 3], status: 'confirmed' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('confirmed');
    expect(json.updated).toBe(3);
    expect(json.failed).toBe(0);
    expect(updateBookingStatus).toHaveBeenCalledTimes(3);
    expect(notifyBookingStatusChanged).toHaveBeenCalledTimes(3);
  });

  it('blocks completion for direct_to_provider booking without paid cash collection', async () => {
    const mockSupabase = makeMockSupabaseForBookings([
      { id: 9, user_id: 'user-9', provider_id: 19, booking_status: 'confirmed', status: 'confirmed', payment_mode: 'direct_to_provider' },
    ]);
    mockSupabase.__query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);
    vi.mocked(updateBookingStatus).mockResolvedValue(undefined as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/bulk-status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingIds: [9], status: 'completed' }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(0);
    expect(json.failed).toBe(1);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when bookingIds is missing', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeMockSupabaseForBookings([]) as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/bulk-status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 when status is invalid', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeMockSupabaseForBookings([]) as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/bulk-status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingIds: [1], status: 'not-a-valid-status' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 when bookingIds is an empty array', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeMockSupabaseForBookings([]) as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/bulk-status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingIds: [], status: 'confirmed' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
  });

  it('marks booking as failed when lookup fails', async () => {
    const mockSupabase = makeMockSupabaseForBookings([]);
    mockSupabase.__query.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'missing booking row' },
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);
    vi.mocked(updateBookingStatus).mockResolvedValue(undefined as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/bulk-status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingIds: [101], status: 'confirmed' }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(0);
    expect(json.failed).toBe(1);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });
});
