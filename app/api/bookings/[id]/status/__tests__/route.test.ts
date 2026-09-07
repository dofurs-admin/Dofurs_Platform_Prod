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

vi.mock('@/lib/payments/bookingPayable', () => ({
  getBookingOutstandingSummary: vi.fn(),
}));

vi.mock('@/lib/referrals/service', () => ({
  processReferrerRewardOnFirstBooking: vi.fn().mockResolvedValue(undefined),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';
import { updateBookingStatus } from '@/lib/bookings/service';
import { PATCH } from '@/app/api/bookings/[id]/status/route';

function makeAdminSupabase(options?: { hasCashCollection?: boolean; unfulfilledSops?: boolean }) {
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

  // Admin completion now runs the SOP bypass check: it reads the booking-level
  // waiver flag and the booking's SOP submissions. Default mocks model a
  // booking with no SOP requirements assigned.
  const bookingSopWaiverMaybeSingle = vi.fn().mockResolvedValue({
    data: { sop_completion_waived: false },
    error: null,
  });

  const bookingWaiverUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });

  const bookingsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: bookingLookupSingle,
    maybeSingle: bookingSopWaiverMaybeSingle,
    update: vi.fn().mockReturnValue({ eq: bookingWaiverUpdateEq }),
  };

  const collectionsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: collectionMaybeSingle,
  };

  const sopSubmissionsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue(
      options?.unfulfilledSops
        ? {
            data: [
              {
                id: 'sop-1',
                title_snapshot: 'Service After Pictures',
                mandatory_snapshot: true,
                status: 'pending',
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    ),
  };

  const auditLogQuery = {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'bookings') return bookingsQuery;
      if (table === 'booking_payment_collections') return collectionsQuery;
      if (table === 'booking_sop_submissions') return sopSubmissionsQuery;
      if (table === 'admin_audit_log') return auditLogQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    bookingsQuery,
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
    vi.mocked(getBookingOutstandingSummary).mockResolvedValue({
      booking: {
        id: 44,
        user_id: 'user-44',
        provider_id: 404,
        payment_mode: 'direct_to_provider',
        booking_status: 'confirmed',
        final_price: 1000,
        wallet_credits_applied_inr: 0,
      },
      payableBeforeCapturedInr: 1000,
      capturedOnlineInr: 0,
      settledManualInr: 0,
      settledTotalInr: 0,
      outstandingInr: 1000,
    });

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
    expect(payload.error).toContain('Pending payable amount');
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('allows admin completion when direct-to-provider collection is marked paid', async () => {
    const adminSupabase = makeAdminSupabase({ hasCashCollection: true });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);
    vi.mocked(getBookingOutstandingSummary).mockResolvedValue({
      booking: {
        id: 44,
        user_id: 'user-44',
        provider_id: 404,
        payment_mode: 'direct_to_provider',
        booking_status: 'confirmed',
        final_price: 1000,
        wallet_credits_applied_inr: 0,
      },
      payableBeforeCapturedInr: 1000,
      capturedOnlineInr: 0,
      settledManualInr: 1000,
      settledTotalInr: 1000,
      outstandingInr: 0,
    });
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

  it('requires an SOP bypass reason when mandatory SOPs are unfulfilled, then records the waiver', async () => {
    const adminSupabase = makeAdminSupabase({ hasCashCollection: true, unfulfilledSops: true });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminSupabase as never);
    vi.mocked(getBookingOutstandingSummary).mockResolvedValue({
      booking: {
        id: 44,
        user_id: 'user-44',
        provider_id: 404,
        payment_mode: 'direct_to_provider',
        booking_status: 'confirmed',
        final_price: 1000,
        wallet_credits_applied_inr: 0,
      },
      payableBeforeCapturedInr: 1000,
      capturedOnlineInr: 0,
      settledManualInr: 1000,
      settledTotalInr: 1000,
      outstandingInr: 0,
    });
    vi.mocked(updateBookingStatus).mockResolvedValue({ id: 44, booking_status: 'completed' } as never);

    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        role: 'admin',
        user: { id: 'admin-user-id' },
        supabase: {},
      },
    } as never);

    // Without a bypass reason → 400 with the missing SOP list
    const noReasonRequest = new Request('http://localhost/api/bookings/44/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    const noReasonResponse = await PATCH(noReasonRequest, { params: Promise.resolve({ id: '44' }) });
    expect(noReasonResponse.status).toBe(400);
    const noReasonPayload = await noReasonResponse.json();
    expect(noReasonPayload.error).toContain('bypass reason');
    expect(noReasonPayload.missingSops).toEqual([
      { id: 'sop-1', title: 'Service After Pictures' },
    ]);
    expect(updateBookingStatus).not.toHaveBeenCalled();

    // With a bypass reason → completes and stamps the booking-level waiver
    const bypassRequest = new Request('http://localhost/api/bookings/44/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed', sopBypassReason: 'customer declined photos' }),
    });

    const bypassResponse = await PATCH(bypassRequest, { params: Promise.resolve({ id: '44' }) });
    expect(bypassResponse.status).toBe(200);
    expect(updateBookingStatus).toHaveBeenCalledTimes(1);
    expect(adminSupabase.bookingsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sop_completion_waived: true,
        sop_waiver_reason: 'customer declined photos',
        sop_waived_by: 'admin-user-id',
      }),
    );
  });
});
