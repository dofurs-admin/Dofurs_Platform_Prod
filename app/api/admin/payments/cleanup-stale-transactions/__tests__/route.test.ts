import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/utils/date', () => ({
  getISTTimestamp: vi.fn(() => '2026-06-24T10:00:00.000Z'),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { POST } from '@/app/api/admin/payments/cleanup-stale-transactions/route';

function createFetchBuilder(staleRows: Array<Record<string, unknown>>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: staleRows, error: null }),
  };
}

function createUpdateBuilder() {
  return {
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe('POST /api/admin/payments/cleanup-stale-transactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BILLING_AUTOMATION_SECRET;
  });

  it('accepts scheduler bearer token without requiring admin session', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';

    const fetchBuilder = createFetchBuilder([
      {
        id: 'tx_1',
        user_id: 'user_1',
        transaction_type: 'booking_payment',
        amount_inr: 499,
        created_at: '2026-06-22T10:00:00.000Z',
      },
    ]);
    const updateBuilder = createUpdateBuilder();

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder),
    } as never);

    const response = await POST(
      new Request('http://localhost/api/admin/payments/cleanup-stale-transactions', {
        method: 'POST',
        headers: {
          authorization: 'Bearer scheduler-secret',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(requireApiRole).not.toHaveBeenCalled();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.cleaned).toBe(1);
  });

  it('accepts x-billing-automation-token header without requiring admin session', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';

    const fetchBuilder = createFetchBuilder([]);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(fetchBuilder),
    } as never);

    const response = await POST(
      new Request('http://localhost/api/admin/payments/cleanup-stale-transactions', {
        method: 'POST',
        headers: {
          'x-billing-automation-token': 'scheduler-secret',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(requireApiRole).not.toHaveBeenCalled();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.cleaned).toBe(0);
  });

  it('falls back to role auth when token does not match', async () => {
    process.env.BILLING_AUTOMATION_SECRET = 'scheduler-secret';

    vi.mocked(requireApiRole).mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      context: null,
    } as never);

    const response = await POST(
      new Request('http://localhost/api/admin/payments/cleanup-stale-transactions', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(requireApiRole).toHaveBeenCalledWith(['admin', 'staff']);
  });

  it('uses admin role auth path when automation secret is not configured', async () => {
    vi.mocked(requireApiRole).mockResolvedValue({
      response: null,
      context: {
        user: { id: 'admin_1' },
        role: 'admin',
        supabase: {},
      },
    } as never);

    const fetchBuilder = createFetchBuilder([]);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(fetchBuilder),
    } as never);

    const response = await POST(
      new Request('http://localhost/api/admin/payments/cleanup-stale-transactions', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(requireApiRole).toHaveBeenCalledWith(['admin', 'staff']);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.cleaned).toBe(0);
  });
});
