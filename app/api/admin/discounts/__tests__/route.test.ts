import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  getApiAuthContext: vi.fn(),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/provider-management/service', () => ({
  listPlatformDiscounts: vi.fn(),
  getPlatformDiscountAnalytics: vi.fn(),
  upsertPlatformDiscount: vi.fn(),
}));

vi.mock('@/lib/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { getApiAuthContext } from '@/lib/auth/api-auth';
import { listPlatformDiscounts, getPlatformDiscountAnalytics, upsertPlatformDiscount } from '@/lib/provider-management/service';
import { GET, POST } from '@/app/api/admin/discounts/route';

function makeAdminContext(supabase: object = {}) {
  return {
    user: { id: 'admin-user-id' },
    role: 'admin' as const,
    supabase,
  };
}

describe('GET /api/admin/discounts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns discounts and analytics', async () => {
    const mockDiscounts = [{ id: 1, code: 'SAVE10', discount_type: 'percentage', discount_value: 10, is_active: true }];
    const mockAnalytics = { total: 1, active: 1, inactive: 0 };

    vi.mocked(getApiAuthContext).mockResolvedValue(makeAdminContext() as never);
    vi.mocked(listPlatformDiscounts).mockResolvedValue(mockDiscounts as never);
    vi.mocked(getPlatformDiscountAnalytics).mockResolvedValue(mockAnalytics as never);

    const response = await GET();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.discounts)).toBe(true);
    expect(json.discounts[0].code).toBe('SAVE10');
    expect(json.analytics).toEqual(mockAnalytics);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: null,
      role: null,
      supabase: {} as never,
    } as never);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns 403 when caller is not admin or staff', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'user-id' },
      role: 'user',
      supabase: {} as never,
    } as never);

    const response = await GET();

    expect(response.status).toBe(403);
  });
});

describe('POST /api/admin/discounts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for an invalid payload', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue(makeAdminContext() as never);

    const request = new Request('http://localhost/api/admin/discounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Missing required fields: code, discount_type, discount_value
      body: JSON.stringify({ is_active: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('succeeds for a valid discount payload', async () => {
    const createdDiscount = {
      id: 5,
      code: 'FLAT50',
      discount_type: 'flat',
      discount_value: 50,
      is_active: true,
    };

    vi.mocked(getApiAuthContext).mockResolvedValue(makeAdminContext() as never);
    vi.mocked(upsertPlatformDiscount).mockResolvedValue(createdDiscount as never);

    const request = new Request('http://localhost/api/admin/discounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'FLAT50',
        title: 'Flat 50 off',
        discount_type: 'flat',
        discount_value: 50,
        valid_from: '2026-04-01T00:00:00.000Z',
        is_active: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.discount.code).toBe('FLAT50');
    expect(upsertPlatformDiscount).toHaveBeenCalledWith(expect.anything(), 'admin-user-id', expect.objectContaining({ code: 'FLAT50' }));
  });
});
