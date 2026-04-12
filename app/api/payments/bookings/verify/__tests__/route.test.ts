import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitKey: vi.fn().mockReturnValue('rate-key'),
  isRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock('@/lib/payments/razorpay', () => ({
  verifyPaymentSignature: vi.fn().mockReturnValue(true),
  fetchRazorpayPayment: vi.fn().mockResolvedValue({
    id: 'pay_123',
    order_id: 'order_123',
    status: 'captured',
    amount: 89900,
    currency: 'INR',
  }),
}));

vi.mock('@/lib/bookings/service', () => ({
  createBooking: vi.fn(),
}));

vi.mock('@/lib/payments/invoiceService', () => ({
  createServiceInvoice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/bookings/discounts', () => ({
  createDiscountRedemption: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { fetchRazorpayPayment } from '@/lib/payments/razorpay';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createBooking } from '@/lib/bookings/service';
import { POST } from '@/app/api/payments/bookings/verify/route';

const FUTURE_BOOKING_DATE = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function makeAdminSupabase(txStatus: 'initiated' | 'authorized' | 'failed' = 'initiated') {
  const maybeSingleQueue = [
    // existingPayment
    { data: null, error: null },
    // txCandidates
    {
      data: {
        id: 'tx-1',
        user_id: 'user-1',
        amount_inr: 899,
        currency: 'INR',
        status: txStatus,
        booking_id: null,
        metadata: {
          checkout_context: 'booking_prepaid',
          provider_order_id: 'order_123',
          booking_payload: {
            petId: 5,
            providerId: 44,
            providerServiceId: '550e8400-e29b-41d4-a716-446655440000',
            bookingDate: FUTURE_BOOKING_DATE,
            startTime: '10:00',
            bookingMode: 'home_visit',
            locationAddress: 'Indiranagar',
            latitude: 12.97,
            longitude: 77.64,
            providerNotes: null,
            addOns: [],
          },
          price_breakdown: {
            finalAmount: 899,
            discountAmount: 0,
          },
        },
      },
      error: null,
    },
    // pets ownership
    { data: { id: 5 }, error: null },
  ];

  const singleQueue = [
    // update payment transaction returns updated tx
    { data: { id: 'tx-1' }, error: null },
  ];

  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleQueue.shift() ?? { data: null, error: null })),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn(() => Promise.resolve(singleQueue.shift() ?? { data: null, error: null })),
  };

  return {
    from: vi.fn(() => query),
  };
}

describe('POST /api/payments/bookings/verify', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('creates prepaid booking with platform payment mode', async () => {
    const adminSupabase = makeAdminSupabase();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(createBooking).mockResolvedValue({ id: 777 } as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'user-1' },
        role: 'user',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/payments/bookings/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerOrderId: 'order_123',
        providerPaymentId: 'pay_123',
        providerSignature: 'sig_123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(createBooking).toHaveBeenCalledTimes(1);
    const createBookingInput = vi.mocked(createBooking).mock.calls[0][2];
    expect(createBookingInput.paymentMode).toBe('platform');
    expect(fetchRazorpayPayment).toHaveBeenCalledWith('pay_123');
  });

  it('rejects verification when local transaction is already failed', async () => {
    const adminSupabase = makeAdminSupabase('failed');
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'user-1' },
        role: 'user',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/payments/bookings/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerOrderId: 'order_123',
        providerPaymentId: 'pay_123',
        providerSignature: 'sig_123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Payment failed in Razorpay. Please try another payment method.',
    });

    expect(createBooking).not.toHaveBeenCalled();
    expect(fetchRazorpayPayment).not.toHaveBeenCalled();
  });

  it('rejects verification when Razorpay payment is failed', async () => {
    const adminSupabase = makeAdminSupabase('initiated');
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'user-1' },
        role: 'user',
        supabase: {},
      },
    } as never);

    vi.mocked(fetchRazorpayPayment).mockResolvedValueOnce({
      id: 'pay_123',
      order_id: 'order_123',
      status: 'failed',
      amount: 89900,
      currency: 'INR',
    });

    const request = new Request('http://localhost/api/payments/bookings/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerOrderId: 'order_123',
        providerPaymentId: 'pay_123',
        providerSignature: 'sig_123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Payment failed in Razorpay. Please try another payment method.',
    });

    expect(createBooking).not.toHaveBeenCalled();
  });
});
