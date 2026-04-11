import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitKey: vi.fn().mockReturnValue('rate-key'),
  isRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock('@/lib/bookings/state-transition-guard', () => ({
  assertRoleCanCreateBookingForUser: vi.fn(),
}));

vi.mock('@/lib/payments/razorpay', () => ({
  createRazorpayOrder: vi.fn().mockResolvedValue({
    id: 'order_123',
    amount: 89900,
    currency: 'INR',
  }),
  getRazorpayPublicConfig: vi.fn().mockReturnValue({ keyId: 'rzp_test_123' }),
}));

vi.mock('@/lib/service-catalog', () => ({
  calculateBookingPrice: vi.fn().mockResolvedValue({
    final_total: 899,
  }),
}));

vi.mock('@/lib/bookings/discounts', () => ({
  evaluateDiscountForBooking: vi.fn().mockResolvedValue({ preview: null, reason: null }),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { POST } from '@/app/api/payments/bookings/order/route';

const FUTURE_BOOKING_DATE = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function makeAdminSupabase() {
  const petsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const petSharesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'share_1',
        role: 'manager',
        status: 'accepted',
        accepted_at: '2026-04-09T10:00:00.000Z',
        revoked_at: null,
      },
      error: null,
    }),
  };

  const providerServicesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        provider_id: 44,
        service_type: 'dog_grooming',
        is_active: true,
      },
      error: null,
    }),
  };

  const paymentTransactionsQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'tx_1',
        amount_inr: 899,
        currency: 'INR',
        status: 'initiated',
      },
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'pets') return petsQuery;
      if (table === 'pet_shares') return petSharesQuery;
      if (table === 'provider_services') return providerServicesQuery;
      if (table === 'payment_transactions') return paymentTransactionsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('POST /api/payments/bookings/order', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('allows prepaid order creation when pet share status is accepted', async () => {
    const adminSupabase = makeAdminSupabase();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'user-1', email: 'shared.user@example.com' },
        role: 'user',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/payments/bookings/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        petId: 5,
        providerId: 44,
        providerServiceId: '550e8400-e29b-41d4-a716-446655440000',
        bookingDate: FUTURE_BOOKING_DATE,
        startTime: '10:00',
        bookingMode: 'home_visit',
        locationAddress: 'Indiranagar',
        latitude: 12.97,
        longitude: 77.64,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.transaction.id).toBe('tx_1');
    expect(payload.razorpay.orderId).toBe('order_123');
    expect(adminSupabase.from).toHaveBeenCalledWith('pet_shares');
  });
});
