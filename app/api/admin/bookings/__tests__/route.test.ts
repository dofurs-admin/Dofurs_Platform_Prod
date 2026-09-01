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
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
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
    const adminSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          const queryState = {
            selectClause: '',
          };

          return {
            select: vi.fn((clause: string) => {
              queryState.selectClause = clause;
              return {
                in: vi.fn(() => {
                  if (queryState.selectClause.includes('payment_mode')) {
                    return Promise.resolve({
                      data: [{ id: 1, payment_mode: 'direct_to_provider' }],
                      error: null,
                    });
                  }

                  if (queryState.selectClause.includes('location_address')) {
                    return {
                      returns: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: 1,
                            user_id: 'user-1',
                            pet_id: 11,
                            location_address: '12 Koramangala 5th Block, Bengaluru',
                            latitude: 12.9352,
                            longitude: 77.6245,
                            discount_code: 'WELCOME10',
                            discount_amount: 129.9,
                            wallet_credits_applied_inr: 50,
                            amount: 1299,
                            final_price: 1119.1,
                            created_at: '2026-04-01T10:00:00.000Z',
                            cancellation_reason: null,
                            provider_notes: null,
                            internal_notes: null,
                          },
                        ],
                        error: null,
                      }),
                    };
                  }

                  return {
                    returns: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 1,
                          service_type: 'grooming',
                          provider_service_id: null,
                          included_services: ['grooming'],
                          provider_notes: null,
                          internal_notes: null,
                          admin_price_reference: null,
                          price_at_booking: 1299,
                        },
                      ],
                      error: null,
                    }),
                  };
                }),
              };
            }),
          };
        }

        if (table === 'booking_payment_collections') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ booking_id: 1, amount_inr: 1299 }],
              error: null,
            }),
          };
        }

        if (table === 'pets') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                returns: vi.fn().mockResolvedValue({
                  data: [{ id: 11, name: 'Simba', breed: 'Labrador' }],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === 'user_addresses') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                returns: vi.fn().mockResolvedValue({
                  data: [
                    { user_id: 'user-1', city: 'Bengaluru', pincode: '560095', is_default: true },
                    { user_id: 'user-1', city: 'Mumbai', pincode: '400001', is_default: false },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

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
    expect(json.bookings[0].payment_mode).toBe('direct_to_provider');
    expect(json.bookings[0].cash_collected).toBe(true);
    expect(json.bookings[0].collected_amount_inr).toBe(1299);
    expect(json.bookings[0].included_services).toEqual(['grooming']);
    expect(json.bookings[0].location_address).toBe('12 Koramangala 5th Block, Bengaluru');
    expect(json.bookings[0].latitude).toBe(12.9352);
    expect(json.bookings[0].longitude).toBe(77.6245);
    expect(json.bookings[0].city).toBe('Bengaluru');
    expect(json.bookings[0].pincode).toBe('560095');
    expect(json.bookings[0].pet_names).toBe('Simba');
    expect(json.bookings[0].pet_breed).toBe('Labrador');
    expect(json.bookings[0].discount_code).toBe('WELCOME10');
    expect(json.bookings[0].discount_amount).toBe(129.9);
    expect(json.bookings[0].wallet_credits_applied_inr).toBe(50);
    expect(json.bookings[0].final_price).toBe(1119.1);
    expect(json.bookings[0].created_at).toBe('2026-04-01T10:00:00.000Z');
    expect(json.bookings[0].cancellation_reason).toBeNull();
    expect(adminSupabase.rpc).toHaveBeenCalledWith('admin_search_bookings', expect.objectContaining({ p_filter: 'all' }));
  });

  it('filters RPC results by booking status filter', async () => {
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
      {
        id: 2,
        user_id: 'user-2',
        provider_id: 3,
        booking_start: '2026-04-11T10:00:00Z',
        booking_date: '2026-04-11',
        start_time: '10:00',
        end_time: '11:00',
        status: 'completed',
        booking_status: 'completed',
        booking_mode: 'home_visit',
        service_type: 'grooming',
        customer_name: 'Ravi',
        customer_email: 'ravi@example.com',
        customer_phone: '+919876543211',
        provider_name: 'Cara Groomer',
        completion_task_status: null,
        completion_due_at: null,
        completion_completed_at: null,
      },
    ];

    const mockSupabase = makeMockSupabase({ data: mockBookings, error: null });
    const adminSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          const queryState = {
            selectClause: '',
          };

          return {
            select: vi.fn((clause: string) => {
              queryState.selectClause = clause;
              return {
                in: vi.fn(() => {
                  if (queryState.selectClause.includes('payment_mode')) {
                    return Promise.resolve({ data: [{ id: 1, payment_mode: 'platform' }], error: null });
                  }

                  if (queryState.selectClause.includes('location_address')) {
                    return {
                      returns: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: 1,
                            user_id: 'user-1',
                            pet_id: 11,
                            location_address: '12 Koramangala 5th Block, Bengaluru',
                            latitude: 12.9352,
                            longitude: 77.6245,
                            discount_code: null,
                            discount_amount: null,
                            wallet_credits_applied_inr: null,
                            amount: 1299,
                            final_price: null,
                            created_at: '2026-04-01T10:00:00.000Z',
                            cancellation_reason: null,
                            provider_notes: null,
                            internal_notes: null,
                          },
                        ],
                        error: null,
                      }),
                    };
                  }

                  return {
                    returns: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 1,
                          service_type: 'grooming',
                          provider_service_id: null,
                          provider_notes: null,
                          internal_notes: null,
                          admin_price_reference: null,
                          price_at_booking: 1299,
                        },
                      ],
                      error: null,
                    }),
                  };
                }),
              };
            }),
          };
        }

        if (table === 'booking_payment_collections') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }

        if (table === 'pets') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                returns: vi.fn().mockResolvedValue({
                  data: [{ id: 11, name: 'Simba', breed: 'Labrador' }],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === 'user_addresses') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                returns: vi.fn().mockResolvedValue({
                  data: [{ user_id: 'user-1', city: 'Bengaluru', pincode: '560095', is_default: true }],
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: mockSupabase,
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings?filter=confirmed');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.bookings).toHaveLength(1);
    expect(json.bookings[0].id).toBe(1);
    expect(json.bookings[0].pet_names).toBe('Simba');
    expect(json.bookings[0].pincode).toBe('560095');
    expect(adminSupabase.rpc).toHaveBeenCalledWith('admin_search_bookings', expect.objectContaining({ p_filter: 'confirmed' }));
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
