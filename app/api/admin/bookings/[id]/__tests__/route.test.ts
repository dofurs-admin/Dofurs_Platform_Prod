import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/payments/bookingPayable', () => ({
  getBookingOutstandingSummary: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { GET } from '@/app/api/admin/bookings/[id]/route';

type BookingRow = {
  id: number;
  user_id: string;
  pet_id: number;
  provider_id: number;
  booking_start: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  booking_status: string | null;
  booking_mode: string | null;
  service_type: string | null;
  address: string | null;
  pincode: string | null;
  notes: string | null;
  subtotal_inr: number | null;
  discount_inr: number | null;
  total_inr: number | null;
  final_price: number | null;
  discount_code: string | null;
  created_at: string;
  users: { name: string | null; email: string | null; phone: string | null; address: string | null } | null;
  providers: { name: string | null; email: string | null; phone_number: string | null } | null;
  pets: null;
};

function makeSupabaseMock(options?: {
  transitionError?: { code?: string; message: string } | null;
}) {
  const booking: BookingRow = {
    id: 32,
    user_id: 'user-1',
    pet_id: 1,
    provider_id: 99,
    booking_start: '2026-04-08T10:00:00.000Z',
    booking_date: '2026-04-08',
    start_time: '10:00:00',
    end_time: '11:00:00',
    status: 'confirmed',
    booking_status: 'confirmed',
    booking_mode: 'home_visit',
    service_type: 'grooming',
    address: 'Indiranagar',
    pincode: '560038',
    notes: null,
    subtotal_inr: 1200,
    discount_inr: 0,
    total_inr: 1200,
    final_price: 1200,
    discount_code: null,
    created_at: '2026-04-01T10:00:00.000Z',
    users: { name: 'Alice', email: 'alice@example.com', phone: '+919999999999', address: 'Bengaluru' },
    providers: { name: 'Bob', email: 'bob@example.com', phone_number: '+918888888888' },
    pets: null,
  };

  const bookingsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: booking, error: null }),
  };

  const transitionQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(
      options?.transitionError
        ? { data: null, error: options.transitionError }
        : {
            data: [
              {
                from_status: 'pending',
                to_status: 'confirmed',
                actor_id: 'admin-user-id',
                created_at: '2026-04-08T09:30:00.000Z',
                source: 'api/bookings/[id]/status',
                metadata: { event: 'status_change' },
              },
            ],
            error: null,
          },
    ),
  };

  const invoicesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          status: 'paid',
          total_inr: 1200,
          issued_at: '2026-04-08T10:00:00.000Z',
          paid_at: '2026-04-08T10:02:00.000Z',
        },
      ],
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'bookings') return bookingsQuery;
      if (table === 'booking_status_transition_events') return transitionQuery;
      if (table === 'billing_invoices') return invoicesQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeAdminSupabaseMock() {
  const invoicesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          status: 'paid',
          total_inr: 1200,
          issued_at: '2026-04-08T10:00:00.000Z',
          paid_at: '2026-04-08T10:02:00.000Z',
        },
      ],
      error: null,
    }),
  };

  const addonItemsQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'addon-1',
          booking_id: 32,
          name_snapshot: 'Nail Trim',
          quantity: 1,
          total_price_inr: 199,
          total_price_snapshot: 199,
          status: 'active',
          created_at: '2026-04-08T09:00:00.000Z',
        },
      ],
      error: null,
    }),
  };

  const paymentTransactionsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({
      data: [
        {
          metadata: {
            booking_bundle_payload: [{ petId: 2 }],
          },
        },
      ],
      error: null,
    }),
  };

  const petsQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Milo', breed: 'Labrador', age: 4, gender: 'male', size_category: 'large' },
        { id: 2, name: 'Luna', breed: 'Pug', age: 2, gender: 'female', size_category: 'small' },
      ],
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'booking_addon_items') return addonItemsQuery;
      if (table === 'billing_invoices') return invoicesQuery;
      if (table === 'payment_transactions') return paymentTransactionsQuery;
      if (table === 'pets') return petsQuery;

      if (table === 'provider_services') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          returns: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected admin table: ${table}`);
    }),
  };
}

describe('GET /api/admin/bookings/[id]', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns booking details with mapped transition events', async () => {
    const supabase = makeSupabaseMock();
    const adminSupabase = makeAdminSupabaseMock();

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        supabase,
      },
    } as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);
    vi.mocked(getBookingOutstandingSummary).mockResolvedValue({
      booking: {
        id: 32,
        user_id: 'user-1',
        provider_id: 99,
        payment_mode: 'direct_to_provider',
        booking_status: 'confirmed',
        final_price: 1200,
        wallet_credits_applied_inr: 0,
      },
      payableBeforeCapturedInr: 1200,
      capturedOnlineInr: 0,
      settledManualInr: 0,
      settledTotalInr: 0,
      outstandingInr: 1200,
    });

    const response = await GET(new Request('http://localhost/api/admin/bookings/32'), {
      params: Promise.resolve({ id: '32' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.booking.id).toBe(32);
    expect(payload.booking.booking_status_transition_events).toHaveLength(1);
    expect(payload.booking.booking_status_transition_events[0]).toMatchObject({
      old_status: 'pending',
      new_status: 'confirmed',
      changed_by: 'admin-user-id',
    });
    expect(payload.booking.pets).toEqual([
      expect.objectContaining({ id: 1, name: 'Milo' }),
      expect.objectContaining({ id: 2, name: 'Luna' }),
    ]);
    expect(payload.invoices).toHaveLength(1);
    expect(payload.addonItems).toHaveLength(1);
  });

  it('returns booking details even when transition table is unavailable', async () => {
    const supabase = makeSupabaseMock({
      transitionError: {
        code: '42P01',
        message: 'relation does not exist',
      },
    });
    const adminSupabase = makeAdminSupabaseMock();

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        supabase,
      },
    } as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);
    vi.mocked(getBookingOutstandingSummary).mockResolvedValue({
      booking: {
        id: 32,
        user_id: 'user-1',
        provider_id: 99,
        payment_mode: 'direct_to_provider',
        booking_status: 'confirmed',
        final_price: 1200,
        wallet_credits_applied_inr: 0,
      },
      payableBeforeCapturedInr: 1200,
      capturedOnlineInr: 0,
      settledManualInr: 0,
      settledTotalInr: 0,
      outstandingInr: 1200,
    });

    const response = await GET(new Request('http://localhost/api/admin/bookings/32'), {
      params: Promise.resolve({ id: '32' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.booking.id).toBe(32);
    expect(payload.booking.booking_status_transition_events).toEqual([]);
  });
});
