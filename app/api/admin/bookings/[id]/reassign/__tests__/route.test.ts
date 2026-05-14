import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  ADMIN_ROLES: ['admin', 'staff'],
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/monitoring/security-log', () => ({
  isSlotConflictMessage: vi.fn().mockReturnValue(false),
  logSecurityEvent: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { PATCH } from '@/app/api/admin/bookings/[id]/reassign/route';

describe('PATCH /api/admin/bookings/[id]/reassign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reassigns provider without forcing booking status back to pending', async () => {
    const providerSingle = vi.fn().mockResolvedValue({ data: { id: 222 }, error: null });

    const bookingLookupMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 32,
        service_type: 'grooming',
        provider_service_id: 'service-111',
        included_services: null,
        provider_notes: null,
        internal_notes: null,
        admin_price_reference: null,
        price_at_booking: null,
      },
      error: null,
    });

    const providerServiceMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'service-222',
        service_type: 'grooming',
      },
      error: null,
    });

    const bookingSingle = vi.fn().mockResolvedValue({
      data: {
        id: 32,
        provider_id: 222,
        provider_service_id: 'service-222',
        booking_status: 'confirmed',
        status: 'confirmed',
      },
      error: null,
    });

    const bookingsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: bookingLookupMaybeSingle,
    };

    const bookingDetailsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { booking_date: '2026-04-10', start_time: '10:00', end_time: '10:30' },
        error: null,
      }),
    };

    const conflictCheckQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const bookingsUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: bookingSingle,
    };

    const providersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: providerSingle,
    };

    const providerServicesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: providerServiceMaybeSingle,
    };

    let bookingsFromCallCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'providers') return providersQuery;
        if (table === 'provider_services') return providerServicesQuery;
        if (table === 'bookings') {
          bookingsFromCallCount++;
          if (bookingsFromCallCount === 1) return bookingsQuery;
          if (bookingsFromCallCount === 2) return bookingDetailsQuery;
          if (bookingsFromCallCount === 3) return conflictCheckQuery;
          return bookingsUpdateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/32/reassign', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: 222 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '32' }) });

    expect(response.status).toBe(200);
    expect(bookingsUpdateQuery.update).toHaveBeenCalledWith({
      provider_id: 222,
      provider_service_id: 'service-222',
      service_type: 'grooming',
    });

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.booking.booking_status).toBe('confirmed');
    expect(payload.booking.status).toBe('confirmed');
  });

  it('validates and remaps every bundled provider service when reassigned', async () => {
    const oldGroomingServiceId = '11111111-1111-4111-8111-111111111111';
    const oldVetServiceId = '22222222-2222-4222-8222-222222222222';
    const providerNotes = [
      'Bundled services (2)',
      `1. Pet 81 | Service ${oldGroomingServiceId} | Start 10:00`,
      `2. Pet 82 | Service ${oldVetServiceId} | Start 10:00`,
    ].join('\n');

    const providerSingle = vi.fn().mockResolvedValue({ data: { id: 333 }, error: null });

    const bookingLookupMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 64,
        service_type: 'Grooming',
        provider_service_id: oldGroomingServiceId,
        included_services: null,
        provider_notes: providerNotes,
        internal_notes: providerNotes,
        admin_price_reference: 2200,
        price_at_booking: 2200,
      },
      error: null,
    });

    const oldProviderServicesQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: oldGroomingServiceId, service_type: 'Grooming' },
          { id: oldVetServiceId, service_type: 'Vet Consultation' },
        ],
        error: null,
      }),
    };

    const groomingTargetMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'new-grooming-service', service_type: 'Grooming' },
      error: null,
    });

    const vetTargetMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'new-vet-service', service_type: 'Vet Consultation' },
      error: null,
    });

    const makeTargetProviderServiceQuery = (maybeSingle: ReturnType<typeof vi.fn>) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle,
    });

    const bookingDetailsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { booking_date: '2026-04-10', start_time: '10:00', end_time: '11:30' },
        error: null,
      }),
    };

    const conflictCheckQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const bookingSingle = vi.fn().mockResolvedValue({
      data: {
        id: 64,
        provider_id: 333,
        provider_service_id: 'new-grooming-service',
        service_type: 'Grooming',
      },
      error: null,
    });

    const bookingsUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: bookingSingle,
    };

    const providersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: providerSingle,
    };

    const bookingsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: bookingLookupMaybeSingle,
    };

    let bookingsFromCallCount = 0;
    let providerServicesFromCallCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'providers') return providersQuery;
        if (table === 'provider_services') {
          providerServicesFromCallCount++;
          if (providerServicesFromCallCount === 1) return oldProviderServicesQuery;
          if (providerServicesFromCallCount === 2) return makeTargetProviderServiceQuery(groomingTargetMaybeSingle);
          return makeTargetProviderServiceQuery(vetTargetMaybeSingle);
        }
        if (table === 'bookings') {
          bookingsFromCallCount++;
          if (bookingsFromCallCount === 1) return bookingsQuery;
          if (bookingsFromCallCount === 2) return bookingDetailsQuery;
          if (bookingsFromCallCount === 3) return conflictCheckQuery;
          return bookingsUpdateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin-user-id' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const request = new Request('http://localhost/api/admin/bookings/64/reassign', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: 333 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '64' }) });

    expect(response.status).toBe(200);
    expect(groomingTargetMaybeSingle).toHaveBeenCalledTimes(1);
    expect(vetTargetMaybeSingle).toHaveBeenCalledTimes(1);
    expect(bookingsUpdateQuery.update).toHaveBeenCalledWith({
      provider_id: 333,
      provider_service_id: 'new-grooming-service',
      service_type: 'Grooming',
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Service new-grooming-service | Start 10:00',
        '2. Pet 82 | Service new-vet-service | Start 10:00',
      ].join('\n'),
      internal_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Service new-grooming-service | Start 10:00',
        '2. Pet 82 | Service new-vet-service | Start 10:00',
      ].join('\n'),
    });
  });
});
