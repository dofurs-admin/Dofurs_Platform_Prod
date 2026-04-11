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
import { GET, PATCH, POST } from '@/app/api/admin/billing/invoices/route';

function makeAuthContext(supabase: object = {}) {
  return {
    response: null,
    context: {
      user: { id: 'admin-user-id' },
      role: 'admin',
      supabase,
    },
  };
}

// ---------- GET ----------

describe('GET /api/admin/billing/invoices', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns paginated invoices', async () => {
    const mockInvoices = [
      { id: 'inv-1', user_id: 'user-1', invoice_number: 'INV-MAN-20260404-120000-1234', status: 'issued', total_inr: 500 },
    ];

    // Make countBuilder thenable (Promise-like via resolvedValue)
    const countPromise = Promise.resolve({ count: 1, data: null, error: null });
    const dataPromise = Promise.resolve({ data: mockInvoices, error: null });

    const selectMock = vi.fn();
    // first call is count query, second is data query — we differentiate by args
    selectMock.mockImplementation((cols: string, opts?: { count?: string; head?: boolean }) => {
      const builder = {
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      };
      if (opts?.head) {
        // count query
        return Object.assign(builder, { then: countPromise.then.bind(countPromise) });
      }
      return Object.assign(builder, { then: dataPromise.then.bind(dataPromise) });
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    };

    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext(mockSupabase) as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);

    const request = new Request('http://localhost/api/admin/billing/invoices?limit=10&offset=0');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.invoices)).toBe(true);
    expect(json.invoices[0].id).toBe('inv-1');
    expect(json.total).toBe(1);
    expect(json.pageSize).toBe(10);
  });
});

// ---------- POST ----------

describe('POST /api/admin/billing/invoices', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when userId is missing', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const request = new Request('http://localhost/api/admin/billing/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Grooming session', subtotalInr: 500 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/userId/i);
  });

  it('returns 400 when description is missing', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const request = new Request('http://localhost/api/admin/billing/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', subtotalInr: 500 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/description/i);
  });

  it('succeeds for a valid invoice creation payload', async () => {
    const createdInvoice = {
      id: 'inv-new',
      user_id: 'user-1',
      invoice_number: 'INV-MAN-20260404-120000-9999',
      invoice_type: 'service',
      status: 'issued',
      total_inr: 500,
      issued_at: '2026-04-04T00:00:00Z',
      paid_at: null,
      created_at: '2026-04-04T00:00:00Z',
    };

    const insertBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdInvoice, error: null }),
    };

    const itemInsertBuilder = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    let fromCallCount = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        fromCallCount++;
        if (fromCallCount === 1) return insertBuilder; // billing_invoices
        return itemInsertBuilder; // billing_invoice_items
      }),
    };

    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext(mockSupabase) as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);

    const request = new Request('http://localhost/api/admin/billing/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        description: 'Grooming session',
        subtotalInr: 500,
        discountInr: 0,
        taxInr: 0,
        invoiceType: 'service',
        status: 'issued',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.invoice.id).toBe('inv-new');
  });
});

// ---------- PATCH ----------

describe('PATCH /api/admin/billing/invoices', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when invoiceIds is empty', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const request = new Request('http://localhost/api/admin/billing/invoices', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceIds: [], status: 'paid' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 when status is not a valid invoice status', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext() as never);

    const request = new Request('http://localhost/api/admin/billing/invoices', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceIds: ['inv-1'], status: 'refunded' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/status/i);
  });

  it('succeeds when valid invoiceIds and status are provided', async () => {
    const fetchedInvoices = [
      { id: 'inv-1', status: 'issued', issued_at: null, paid_at: null, metadata: null },
    ];

    const updatedInvoices = [
      { id: 'inv-1', user_id: 'user-1', invoice_number: 'INV-MAN-1', invoice_type: 'service', status: 'paid', total_inr: 400, issued_at: null, paid_at: null, created_at: null },
    ];

    const fetchBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: fetchedInvoices, error: null }),
    };

    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const finalFetchBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: updatedInvoices, error: null }),
    };

    let fromCallCount = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        fromCallCount++;
        if (fromCallCount === 1) return fetchBuilder;
        if (fromCallCount === 2) return updateBuilder;
        return finalFetchBuilder;
      }),
    };

    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext(mockSupabase) as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never);

    const request = new Request('http://localhost/api/admin/billing/invoices', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceIds: ['inv-1'], status: 'paid' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.updated).toBe(1);
  });
});
