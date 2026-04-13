import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitKey: vi.fn().mockReturnValue('rate-key'),
  isRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock('@/lib/provider-management/api', () => ({
  getProviderIdByUserId: vi.fn(),
}));

vi.mock('@/lib/bookings/state-transition-guard', () => ({
  assertRoleCanCreateBookingForUser: vi.fn(),
}));

vi.mock('@/lib/bookings/service', () => ({
  createBooking: vi.fn(),
}));

vi.mock('@/lib/notifications/service', () => ({
  notifyBookingCreated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  isSlotConflictMessage: vi.fn().mockReturnValue(false),
  logSecurityEvent: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/credits/wallet', () => ({
  deductCredits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/utils/geo-distance', () => ({
  haversineDistanceKm: vi.fn().mockReturnValue(0),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createBooking } from '@/lib/bookings/service';
import { POST } from '@/app/api/bookings/create/route';

const FUTURE_BOOKING_DATE = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function makeAdminSupabase(options?: {
  petOwnership?: { data: { id: number } | null; error: null | { message?: string } };
  sharedAccess?: { data: { id: string; role: string; status: string; accepted_at: string | null; revoked_at: string | null } | null; error: null | { message?: string } };
}) {
  const petsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(options?.petOwnership ?? { data: { id: 5 }, error: null }),
  };

  const petSharesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(options?.sharedAccess ?? { data: null, error: null }),
  };

  const pincodeQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  const providersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const providerServicesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { service_type: 'grooming' }, error: null }),
  };

  const creditLinksQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'link_1', user_subscription_id: 'sub_1', service_type: 'grooming', status: 'reserved' }, error: null }),
  };

  const userServiceCreditsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { available_credits: 2, consumed_credits: 1, total_credits: 3 },
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'pets') return petsQuery;
      if (table === 'pet_shares') return petSharesQuery;
      if (table === 'provider_service_pincodes') return pincodeQuery;
      if (table === 'providers') return providersQuery;
      if (table === 'provider_services') return providerServicesQuery;
      if (table === 'booking_subscription_credit_links') return creditLinksQuery;
      if (table === 'user_service_credits') return userServiceCreditsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('POST /api/bookings/create', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('creates booking for valid authenticated user payload', async () => {
    const adminSupabase = makeAdminSupabase();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: '550e8400-e29b-41d4-a716-446655440001' },
        role: 'user',
        supabase: {},
      },
    } as never);

    vi.mocked(createBooking).mockResolvedValue({ id: 901 } as never);

    const request = new Request('http://localhost/api/bookings/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        petId: 5,
        providerId: 12,
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
    expect(payload.success).toBe(true);
    expect(createBooking).toHaveBeenCalledTimes(1);
  });

  it('allows booking for an accepted shared pet', async () => {
    const adminSupabase = makeAdminSupabase({
      petOwnership: { data: null, error: null },
      sharedAccess: {
        data: {
          id: 'share_1',
          role: 'manager',
          status: 'accepted',
          accepted_at: '2026-04-09T10:00:00.000Z',
          revoked_at: null,
        },
        error: null,
      },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: '550e8400-e29b-41d4-a716-446655440001', email: 'shared.user@example.com' },
        role: 'user',
        supabase: {},
      },
    } as never);

    vi.mocked(createBooking).mockResolvedValue({ id: 902 } as never);

    const request = new Request('http://localhost/api/bookings/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        petId: 5,
        providerId: 12,
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
    expect(payload.success).toBe(true);
    expect(createBooking).toHaveBeenCalledTimes(1);
  });

  it('preserves subscription-credit intent in booking payload', async () => {
    const adminSupabase = makeAdminSupabase();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: '550e8400-e29b-41d4-a716-446655440001' },
        role: 'user',
        supabase: {},
      },
    } as never);

    vi.mocked(createBooking).mockResolvedValue({ id: 903, service_type: 'grooming' } as never);

    const request = new Request('http://localhost/api/bookings/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        petId: 5,
        providerId: 12,
        providerServiceId: '550e8400-e29b-41d4-a716-446655440000',
        bookingDate: FUTURE_BOOKING_DATE,
        startTime: '10:00',
        bookingMode: 'home_visit',
        locationAddress: 'Indiranagar',
        latitude: 12.97,
        longitude: 77.64,
        useSubscriptionCredit: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(createBooking).toHaveBeenCalledWith(
      expect.any(Object),
      '550e8400-e29b-41d4-a716-446655440001',
      expect.objectContaining({ useSubscriptionCredit: true }),
      expect.any(Object),
    );

    const payload = await response.json();
    expect(payload.creditReservation?.reserved).toBe(true);
  });
});
