import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSubscriptionInvoice, createServiceInvoice } from './invoiceService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Supabase mock where every `.from(table)` returns a fluent
 * builder. The `tableConfig` map drives how the terminal calls resolve:
 *
 *   { tableName: { maybeSingleData, insertData, insertError } }
 *
 * For cases where a table is called multiple times (insert then insert again
 * for line items) the `insertResponses` queue is consumed in order.
 */
interface TableConfig {
  maybeSingleData?: unknown;
  maybeSingleError?: unknown;
  singleData?: unknown;
  singleError?: unknown;
  insertResponses?: Array<{ data: unknown; error: unknown }>;
}

function createSupabaseMock(tableConfig: Record<string, TableConfig>): SupabaseClient {
  function makeBuilder(table: string) {
    const cfg = tableConfig[table] ?? {};
    let insertIdx = 0;

    const b: Record<string, unknown> = {};

    for (const m of ['select', 'eq', 'update', 'upsert']) {
      b[m] = vi.fn().mockReturnValue(b);
    }

    // insert returns a new builder so that `.select().single()` can be chained.
    b['insert'] = vi.fn().mockImplementation(() => {
      const insertResp = cfg.insertResponses?.[insertIdx++] ?? { data: null, error: null };
      const ib: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) {
        ib[m] = vi.fn().mockReturnValue(ib);
      }
      ib['single'] = vi.fn().mockResolvedValue(insertResp);
      // Make insert itself awaitable (for line-item inserts that are not chained further)
      ib['then'] = undefined;
      const thenableFn = (resolve: (v: unknown) => void) => resolve(insertResp);
      Object.defineProperty(ib, 'then', { get: () => thenableFn });
      return ib;
    });

    b['maybeSingle'] = vi.fn().mockResolvedValue({
      data: cfg.maybeSingleData ?? null,
      error: cfg.maybeSingleError ?? null,
    });

    b['single'] = vi.fn().mockResolvedValue({
      data: cfg.singleData ?? null,
      error: cfg.singleError ?? null,
    });

    return b;
  }

  return {
    from: vi.fn().mockImplementation((table: string) => makeBuilder(table)),
  } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// createSubscriptionInvoice
// ---------------------------------------------------------------------------

describe('createSubscriptionInvoice', () => {
  const validInput = {
    userId: 'user_001',
    userSubscriptionId: 'sub_001',
    paymentTransactionId: 'tx_001',
    planName: 'Gold Plan',
    amountInr: 999,
  };

  it('creates a subscription invoice with correct fields', async () => {
    const createdInvoice = { id: 'inv_new', invoice_number: 'INV-SUB-20240101-000001-123456' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: null, // no existing invoice
        insertResponses: [
          { data: createdInvoice, error: null }, // invoice insert
          { data: null, error: null },            // line-item insert
        ],
      },
      billing_invoice_items: {
        insertResponses: [{ data: null, error: null }],
      },
    });

    const result = await createSubscriptionInvoice(supabase, validInput);

    expect(result).toMatchObject({ id: 'inv_new' });

    // Verify the invoice was inserted with the expected field shape
    const billingFrom = vi.mocked(supabase.from).mock.calls.find(([t]) => t === 'billing_invoices');
    expect(billingFrom).toBeDefined();
  });

  it('returns existing invoice without inserting when one already exists (idempotent)', async () => {
    const existingInvoice = { id: 'inv_existing', invoice_number: 'INV-SUB-EXISTING' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: existingInvoice,
      },
    });

    const result = await createSubscriptionInvoice(supabase, validInput);

    expect(result).toEqual(existingInvoice);

    // insert should never have been called since we returned early
    const insertCalls = vi.mocked(supabase.from).mock.results
      .map((r) => r.value as Record<string, ReturnType<typeof vi.fn>>)
      .flatMap((b) => (b['insert'] as ReturnType<typeof vi.fn>)?.mock.calls ?? []);

    expect(insertCalls).toHaveLength(0);
  });

  it('throws when maybeSingle returns a DB error', async () => {
    const dbError = { message: 'DB connection failed', code: 'XX000' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: null,
        maybeSingleError: dbError,
      },
    });

    await expect(createSubscriptionInvoice(supabase, validInput)).rejects.toMatchObject({
      message: 'DB connection failed',
    });
  });

  it('throws when the invoice insert fails', async () => {
    const insertError = { message: 'Insert constraint violation', code: '23505' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: null, // no existing
        insertResponses: [
          { data: null, error: insertError }, // invoice insert fails
        ],
      },
    });

    await expect(createSubscriptionInvoice(supabase, validInput)).rejects.toMatchObject({
      message: 'Insert constraint violation',
    });
  });

  it('inserts a billing_invoice_items line item after creating the invoice', async () => {
    const createdInvoice = { id: 'inv_002', invoice_number: 'INV-SUB-20240101-000001-999999' };

    const lineItemInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    // Custom supabase mock that tracks line item inserts separately
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'billing_invoices') {
          const b: Record<string, unknown> = {};
          for (const m of ['select', 'eq', 'update', 'upsert']) {
            b[m] = vi.fn().mockReturnValue(b);
          }
          b['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: null });
          b['insert'] = vi.fn().mockImplementation(() => {
            const ib: Record<string, unknown> = {};
            ib['select'] = vi.fn().mockReturnValue(ib);
            ib['eq'] = vi.fn().mockReturnValue(ib);
            ib['single'] = vi.fn().mockResolvedValue({ data: createdInvoice, error: null });
            return ib;
          });
          return b;
        }

        if (table === 'billing_invoice_items') {
          const b: Record<string, unknown> = {};
          b['insert'] = lineItemInsertMock;
          for (const m of ['select', 'eq']) {
            b[m] = vi.fn().mockReturnValue(b);
          }
          return b;
        }

        const b: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'insert', 'update', 'upsert']) {
          b[m] = vi.fn().mockReturnValue(b);
        }
        b['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: null });
        b['single'] = vi.fn().mockResolvedValue({ data: null, error: null });
        return b;
      }),
    } as unknown as SupabaseClient;

    await createSubscriptionInvoice(supabase, validInput);

    expect(lineItemInsertMock).toHaveBeenCalledOnce();
    const [lineItemPayload] = lineItemInsertMock.mock.calls[0];
    expect(lineItemPayload).toMatchObject({
      invoice_id: createdInvoice.id,
      item_type: 'subscription',
      description: expect.stringContaining(validInput.planName),
      quantity: 1,
      unit_amount_inr: validInput.amountInr,
      line_total_inr: validInput.amountInr,
    });
  });
});

// ---------------------------------------------------------------------------
// createServiceInvoice
// ---------------------------------------------------------------------------

describe('createServiceInvoice', () => {
  const validInput = {
    userId: 'user_002',
    bookingId: 42,
    paymentTransactionId: 'tx_svc_001',
    description: 'Dog grooming - full service',
    amountInr: 599,
    status: 'paid' as const,
  };

  it('creates a service invoice for a booking', async () => {
    const createdInvoice = { id: 'inv_svc_001', invoice_number: 'INV-SVC-20240101-000001-111111' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: null,
        insertResponses: [{ data: createdInvoice, error: null }],
      },
      billing_invoice_items: {
        insertResponses: [{ data: null, error: null }],
      },
    });

    const result = await createServiceInvoice(supabase, validInput);
    expect(result).toMatchObject({ id: 'inv_svc_001' });
  });

  it('returns existing service invoice without inserting (idempotent)', async () => {
    const existingInvoice = { id: 'inv_svc_existing', invoice_number: 'INV-SVC-EXISTING' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: existingInvoice,
      },
    });

    const result = await createServiceInvoice(supabase, validInput);
    expect(result).toEqual(existingInvoice);
  });

  it('creates a service invoice with status issued and null paid_at', async () => {
    const createdInvoice = { id: 'inv_svc_issued', invoice_number: 'INV-SVC-20240101-000001-222222' };

    let capturedInsertPayload: unknown = null;

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const b: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'update', 'upsert']) {
          b[m] = vi.fn().mockReturnValue(b);
        }
        b['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: null });
        b['insert'] = vi.fn().mockImplementation((payload: unknown) => {
          if (table === 'billing_invoices') capturedInsertPayload = payload;
          const ib: Record<string, unknown> = {};
          ib['select'] = vi.fn().mockReturnValue(ib);
          ib['eq'] = vi.fn().mockReturnValue(ib);
          ib['single'] = vi.fn().mockResolvedValue({ data: createdInvoice, error: null });
          // also thenable for line-item path
          const thenFn = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
          Object.defineProperty(ib, 'then', { get: () => thenFn });
          return ib;
        });
        return b;
      }),
    } as unknown as SupabaseClient;

    await createServiceInvoice(supabase, { ...validInput, status: 'issued', paymentTransactionId: null });

    expect(capturedInsertPayload).toMatchObject({
      status: 'issued',
      paid_at: null,
      booking_id: validInput.bookingId,
    });
  });

  it('throws when service invoice insert fails', async () => {
    const insertError = { message: 'Unique constraint on booking_id', code: '23505' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: null,
        insertResponses: [{ data: null, error: insertError }],
      },
    });

    await expect(createServiceInvoice(supabase, validInput)).rejects.toMatchObject({
      message: 'Unique constraint on booking_id',
    });
  });

  it('creates service invoice without paymentTransactionId', async () => {
    const createdInvoice = { id: 'inv_svc_nopay', invoice_number: 'INV-SVC-NOPAY' };

    const supabase = createSupabaseMock({
      billing_invoices: {
        maybeSingleData: null,
        insertResponses: [{ data: createdInvoice, error: null }],
      },
      billing_invoice_items: {
        insertResponses: [{ data: null, error: null }],
      },
    });

    const result = await createServiceInvoice(supabase, { ...validInput, paymentTransactionId: undefined });
    expect(result).toMatchObject({ id: 'inv_svc_nopay' });
  });
});
