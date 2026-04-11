import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  logSecurityEvent: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { GET } from '@/app/api/admin/bookings/route';

function makeMockSupabase(rpcResult: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
}

describe('GET /api/admin/bookings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns bookings when RPC succeeds', async () => {
    const mockBookings = [
      {
        id: 1,
        user_id: 'user-1',
        provider_id: 2,
        booking_start: '2026-04-10T10:00:00Z',
        booking_date: '2026-04-10',
        start_time: '10:00',
        end_time: '11:00',
        status: 'confirmed',
        booking_status: 'confirmed',
        booking_mode: 'home_visit',
        service_type: 'grooming',
        customer_name: 'Alice',
        customer_email: 'alice@example.com',
        customer_phone: '+919876543210',
        provider_name: 'Bob Groomer',
        completion_task_status: null,
        completion_due_at: null,
        completion_completed_at: null,
      },
    ];

    const mockSupabase = makeMockSupabase({ data: mockBookings, error: null });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: mockSupabase,
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings?filter=all');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.bookings)).toBe(true);
    expect(json.bookings[0].id).toBe(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_search_bookings', expect.objectContaining({ p_filter: 'all' }));
  });

  it('returns 400 for invalid filter value', async () => {
    const mockSupabase = makeMockSupabase({ data: null, error: null });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: mockSupabase,
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings?filter=invalid-filter-value');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 for limit out of range', async () => {
    const mockSupabase = makeMockSupabase({ data: null, error: null });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: mockSupabase,
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings?limit=9999');
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it('returns auth response when requireApiRole denies access', async () => {
    const deniedResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: deniedResponse,
      context: null,
    } as never);

    const request = new Request('http://localhost/api/admin/bookings');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
