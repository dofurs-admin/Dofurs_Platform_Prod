import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { PATCH } from '@/app/api/admin/subscriptions/[id]/status/route';

function makeSupabaseMock(currentStatus: string, updatedSubscription: object) {
  // Tracks call count to differentiate fetch vs update on the same table
  let fromCallCount = 0;

  const fetchBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'sub-1', status: currentStatus, user_id: 'user-1' }, error: null }),
  };

  const updateBuilder = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: updatedSubscription, error: null }),
  };

  const creditsBuilder = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'user_service_credits') return creditsBuilder;
        fromCallCount += 1;
        return fromCallCount === 1 ? fetchBuilder : updateBuilder;
      }),
    },
    updateBuilder,
  };
}

function makeAuthContext() {
  return {
    response: null,
    context: {
      user: { id: 'admin-user-id' },
      role: 'admin',
    },
  };
}

describe('PATCH /api/admin/subscriptions/[id]/status', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for an invalid status value', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'deleted' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-1' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/invalid status/i);
  });

  it('returns 400 when status is missing', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-1' }) });

    expect(response.status).toBe(400);
  });

  it('succeeds transitioning from paused to active', async () => {
    const updatedSubscription = {
      id: 'sub-1',
      status: 'active',
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: null,
      updated_at: '2026-04-04T00:00:00Z',
    };

    const { supabase } = makeSupabaseMock('paused', updatedSubscription);
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-1' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.subscription.status).toBe('active');
  });

  it('succeeds transitioning from active to cancelled and sets ends_at', async () => {
    const updatedSubscription = {
      id: 'sub-2',
      status: 'cancelled',
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-04-04T00:00:00Z',
      updated_at: '2026-04-04T00:00:00Z',
    };

    const { supabase, updateBuilder } = makeSupabaseMock('active', updatedSubscription);
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-2/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-2' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', ends_at: expect.any(String) }),
    );
  });

  it('returns 422 for invalid transition (active -> active)', async () => {
    const { supabase } = makeSupabaseMock('active', {});
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-1' }) });

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error).toMatch(/cannot transition/i);
  });

  it('returns 422 for invalid transition (cancelled -> active)', async () => {
    const { supabase } = makeSupabaseMock('cancelled', {});
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-1' }) });

    expect(response.status).toBe(422);
  });

  it('returns auth response when requireApiRole denies access', async () => {
    const deniedResponse = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

    vi.mocked(requireApiRole).mockResolvedValue({
      response: deniedResponse,
      context: null,
    } as never);

    const request = new Request('http://localhost/api/admin/subscriptions/sub-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'sub-1' }) });

    expect(response.status).toBe(403);
  });
});
