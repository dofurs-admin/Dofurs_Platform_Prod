import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { DELETE } from '@/app/api/admin/subscriptions/plans/[id]/route';

const PLAN_ID = 'dfb56b7d-cadd-4cd9-a111-028c2dfa39d0';

function makeAuthContext() {
  return {
    response: null,
    context: {
      user: { id: 'admin-user-id' },
      role: 'admin',
      supabase: {},
    },
  };
}

function makePlanLookupBuilder(plan: { id: string; name: string; code: string; deleted_at: string | null } | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
  };
}

function makeReferenceCountBuilder(count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ count, error: null }),
  };
}

describe('DELETE /api/admin/subscriptions/plans/[id]', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('hard-deletes an unused subscription plan', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const lookupBuilder = makePlanLookupBuilder({
      id: PLAN_ID,
      name: 'Test Plan',
      code: 'TEST',
      deleted_at: null,
    });
    const subscriptionCountBuilder = makeReferenceCountBuilder(0);
    const paymentOrderCountBuilder = makeReferenceCountBuilder(0);
    const deleteFilterBuilder = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const deleteBuilder = {
      delete: vi.fn().mockReturnValue(deleteFilterBuilder),
    };

    const from = vi.fn((table: string) => {
      if (table === 'user_subscriptions') return subscriptionCountBuilder;
      if (table === 'subscription_payment_orders') return paymentOrderCountBuilder;
      if (from.mock.calls.filter(([calledTable]) => calledTable === 'subscription_plans').length === 1) {
        return lookupBuilder;
      }
      return deleteBuilder;
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const response = await DELETE(new Request('http://localhost/api/admin/subscriptions/plans/test'), {
      params: Promise.resolve({ id: PLAN_ID }),
    });

    expect(response.status).toBe(200);
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteFilterBuilder.eq).toHaveBeenCalledWith('id', PLAN_ID);
    await expect(response.json()).resolves.toEqual({ success: true, deleted: true });
  });

  it('soft-deletes a plan that has linked subscription or payment history', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const lookupBuilder = makePlanLookupBuilder({
      id: PLAN_ID,
      name: 'Essential 6M',
      code: 'ESSENTIAL6M',
      deleted_at: null,
    });
    const subscriptionCountBuilder = makeReferenceCountBuilder(0);
    const paymentOrderCountBuilder = makeReferenceCountBuilder(2);
    const archiveFilterBuilder = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ error: null }),
    };
    const archiveBuilder = {
      update: vi.fn().mockReturnValue(archiveFilterBuilder),
    };

    const from = vi.fn((table: string) => {
      if (table === 'user_subscriptions') return subscriptionCountBuilder;
      if (table === 'subscription_payment_orders') return paymentOrderCountBuilder;
      if (from.mock.calls.filter(([calledTable]) => calledTable === 'subscription_plans').length === 1) {
        return lookupBuilder;
      }
      return archiveBuilder;
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const response = await DELETE(new Request('http://localhost/api/admin/subscriptions/plans/test'), {
      params: Promise.resolve({ id: PLAN_ID }),
    });

    expect(response.status).toBe(200);
    expect(archiveBuilder.update).toHaveBeenCalledWith({
      is_active: false,
      deleted_at: expect.any(String),
    });
    expect(archiveFilterBuilder.eq).toHaveBeenCalledWith('id', PLAN_ID);
    expect(archiveFilterBuilder.is).toHaveBeenCalledWith('deleted_at', null);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.archived).toBe(true);
    expect(json.linkedPaymentOrders).toBe(2);
  });

  it('returns 404 when the plan does not exist', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const lookupBuilder = makePlanLookupBuilder(null);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(lookupBuilder),
    } as never);

    const response = await DELETE(new Request('http://localhost/api/admin/subscriptions/plans/test'), {
      params: Promise.resolve({ id: PLAN_ID }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Plan not found.' });
  });
});