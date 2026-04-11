import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the module under test.
// ---------------------------------------------------------------------------

// Mock Razorpay SDK (required by razorpay.ts which is imported transitively)
vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({ orders: { create: vi.fn() } })),
}));

// Mock the signature verifier so tests control validity without real HMAC math.
vi.mock('@/lib/payments/razorpay', () => ({
  verifyWebhookSignature: vi.fn(),
}));

// Mock the subscription activation helper.
vi.mock('@/lib/subscriptions/subscriptionService', () => ({
  createOrActivateSubscriptionFromPayment: vi.fn(),
}));

// Mock the invoice creator (non-fatal path inside webhook handler).
vi.mock('@/lib/payments/invoiceService', () => ({
  createSubscriptionInvoice: vi.fn(),
}));

// Set required env vars before any module that reads them loads.
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

import { processRazorpayWebhook } from './webhookHandler';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { createOrActivateSubscriptionFromPayment } from '@/lib/subscriptions/subscriptionService';
import { createSubscriptionInvoice } from '@/lib/payments/invoiceService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid Razorpay event body string. */
function buildEventBody(overrides: Record<string, unknown> = {}): string {
  const base = {
    event: 'payment.captured',
    created_at: Math.floor(Date.now() / 1000), // fresh timestamp
    payload: {
      payment: {
        entity: {
          id: 'pay_test123',
          order_id: 'order_test456',
          status: 'captured',
          amount: 99900,
          currency: 'INR',
        },
      },
    },
  };
  return JSON.stringify({ ...base, ...overrides });
}

/**
 * Builds a layered Supabase mock where every `.from(table)` returns a fluent
 * builder whose terminal methods resolve with the provided table-level responses.
 *
 * `tableResponses` is a map of table name → { data, error } for the most
 * important terminal call. Specific tests that need to override per-call
 * behaviour can replace individual `vi.fn()` returns.
 */
type MockResponse = { data: unknown; error: unknown };

function createSupabaseMock(tableResponses: Record<string, MockResponse | MockResponse[]>) {
  const callCounters: Record<string, number> = {};

  const makeBuilder = (table: string) => {
    const responses = tableResponses[table];

    function getNextResponse(): MockResponse {
      if (Array.isArray(responses)) {
        const idx = callCounters[table] ?? 0;
        callCounters[table] = idx + 1;
        return responses[Math.min(idx, responses.length - 1)];
      }
      return (responses as MockResponse) ?? { data: null, error: null };
    }

    const builder: Record<string, unknown> = {};

    // Chain methods return `builder` so calls can be chained arbitrarily.
    const chainMethods = ['select', 'eq', 'neq', 'in', 'filter', 'order', 'update', 'insert', 'upsert'];
    for (const m of chainMethods) {
      builder[m] = vi.fn().mockReturnValue(builder);
    }

    // Terminal methods resolve with the configured response.
    builder['single'] = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
    builder['maybeSingle'] = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));

    // `.upsert(...).select(...).single()` — upsert returns builder so the
    // chain continues; terminal `.single()` resolves from the table response.

    return builder;
  };

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => makeBuilder(table)),
  };

  return supabase as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processRazorpayWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: signature is valid
    vi.mocked(verifyWebhookSignature).mockResolvedValue(true);
    // Default: subscription activation succeeds
    vi.mocked(createOrActivateSubscriptionFromPayment).mockResolvedValue({ id: 'sub_001' } as never);
    // Default: invoice creation succeeds
    vi.mocked(createSubscriptionInvoice).mockResolvedValue({ id: 'inv_001', invoice_number: 'INV-SUB-001' } as never);
  });

  // -------------------------------------------------------------------------
  // Signature / replay guard
  // -------------------------------------------------------------------------

  it('returns accepted: false when signature is null (missing)', async () => {
    const supabase = createSupabaseMock({});
    const result = await processRazorpayWebhook(supabase, buildEventBody(), null);
    expect(result).toMatchObject({ accepted: false, message: expect.stringContaining('Missing') });
  });

  it('returns accepted: false when signature is invalid', async () => {
    vi.mocked(verifyWebhookSignature).mockResolvedValue(false);
    const supabase = createSupabaseMock({});
    const result = await processRazorpayWebhook(supabase, buildEventBody(), 'bad_sig');
    expect(result).toMatchObject({ accepted: false, message: expect.stringContaining('Invalid') });
  });

  it('returns accepted: false with replay message for an event older than 30 minutes', async () => {
    const oldTimestamp = Math.floor((Date.now() - 31 * 60 * 1000) / 1000); // 31 min ago
    const body = buildEventBody({ created_at: oldTimestamp });
    const supabase = createSupabaseMock({});

    const result = await processRazorpayWebhook(supabase, body, 'valid_sig');
    expect(result).toMatchObject({ accepted: false, message: expect.stringContaining('too old') });
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('returns duplicate message when event was already processed', async () => {
    const supabase = createSupabaseMock({
      payment_webhook_events: { data: { id: 'evt_1', processed: true, processed_at: new Date().toISOString() }, error: null },
    });

    const result = await processRazorpayWebhook(supabase, buildEventBody(), 'valid_sig');
    expect(result).toMatchObject({ accepted: true, message: expect.stringContaining('already processed') });
  });

  // -------------------------------------------------------------------------
  // payment.captured — happy path
  // -------------------------------------------------------------------------

  it('activates subscription and returns accepted: true on payment.captured', async () => {
    // Table responses in call order:
    //   1. payment_webhook_events maybeSingle  → not yet processed
    //   2. payment_webhook_events upsert       → ok (no error)
    //   3. subscription_payment_orders single  → order row
    //   4. payment_transactions upsert/single  → tx row
    //   5. payment_events insert               → ok
    //   6. subscription_payment_orders update  → ok
    //   7. subscription_plans maybeSingle      → plan row
    //   8. payment_webhook_events update       → ok

    const order = { id: 'ord_1', user_id: 'user_1', plan_id: 'plan_1', amount_inr: '999', status: 'created' };
    const tx = { id: 'tx_1', user_id: 'user_1', status: 'captured' };
    const plan = { name: 'Basic Plan' };

    // We use a smarter mock that queues responses per table.
    function makeQueuedBuilder(responses: MockResponse[]) {
      let idx = 0;
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'filter', 'order', 'update', 'insert', 'upsert']) {
        b[m] = vi.fn().mockReturnValue(b);
      }
      b['maybeSingle'] = vi.fn().mockImplementation(() => Promise.resolve(responses[Math.min(idx++, responses.length - 1)]));
      b['single'] = vi.fn().mockImplementation(() => Promise.resolve(responses[Math.min(idx++, responses.length - 1)]));
      return b;
    }

    const successNoData = { data: null, error: null };

    const tableQueues: Record<string, MockResponse[]> = {
      payment_webhook_events: [
        { data: null, error: null },            // maybeSingle — not yet processed
        successNoData,                           // upsert — logged
        successNoData,                           // update — mark processed
      ],
      subscription_payment_orders: [
        { data: order, error: null },            // single — fetch order
        successNoData,                           // update — mark paid
      ],
      payment_transactions: [{ data: tx, error: null }],
      payment_events: [successNoData],
      subscription_plans: [{ data: plan, error: null }],
    };

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const queue = tableQueues[table] ?? [successNoData];
        return makeQueuedBuilder(queue);
      }),
    } as unknown as SupabaseClient;

    const result = await processRazorpayWebhook(supabase, buildEventBody(), 'valid_sig');

    expect(result).toMatchObject({ accepted: true, message: expect.stringContaining('subscription activated') });
    expect(createOrActivateSubscriptionFromPayment).toHaveBeenCalledWith(
      supabase,
      order.user_id,
      order.plan_id,
      tx.id,
    );
  });

  // -------------------------------------------------------------------------
  // Refund event — happy path
  // -------------------------------------------------------------------------

  it('cancels subscription and zeros credits on refund event', async () => {
    const refundEventBody = JSON.stringify({
      event: 'payment.refunded',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: { entity: { id: 'pay_refund_test', order_id: 'order_ref', status: 'refunded', amount: 99900, currency: 'INR' } },
        refund: { entity: { id: 'rfnd_1', payment_id: 'pay_refund_test', amount: 99900, status: 'processed' } },
      },
    });

    const tx = { id: 'tx_ref', user_id: 'user_ref' };
    const sub = { id: 'sub_ref' };
    const credits = [{ id: 'credit_1', available_credits: 3, consumed_credits: 0 }];

    const successNoData = { data: null, error: null };

    const tableQueues: Record<string, MockResponse[]> = {
      payment_webhook_events: [
        { data: null, error: null },   // maybeSingle — not yet processed
        successNoData,                  // upsert
        successNoData,                  // update mark processed
      ],
      payment_transactions: [{ data: tx, error: null }],
      user_subscriptions: [
        { data: sub, error: null },     // maybeSingle fetch sub
        successNoData,                  // update cancel
        successNoData,                  // compensating restore (not called in happy path)
      ],
      user_service_credits: [{ data: credits, error: null }],
    };

    // credits query returns an array — we need a custom builder that handles it
    function makeRefundBuilder(table: string) {
      let callIdx = 0;
      const queue = tableQueues[table] ?? [successNoData];
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'filter', 'order', 'update', 'insert', 'upsert']) {
        b[m] = vi.fn().mockReturnValue(b);
      }
      // maybeSingle / single advance call index
      b['maybeSingle'] = vi.fn().mockImplementation(() => Promise.resolve(queue[Math.min(callIdx++, queue.length - 1)]));
      b['single'] = vi.fn().mockImplementation(() => Promise.resolve(queue[Math.min(callIdx++, queue.length - 1)]));
      // For the credits table, the handler does `.select().eq().eq()` and awaits the builder
      // directly (no terminal call) — so make the builder itself thenable.
      if (table === 'user_service_credits') {
        (b as { then?: unknown }).then = undefined; // reset if inherited
        Object.defineProperty(b, 'then', {
          get() { return undefined; }, // not a Promise
        });
        // The code does: const { data: credits } = await supabase.from('user_service_credits').select(...).eq(...)...
        // Since there's no maybeSingle/single the awaited value IS the builder.
        // Override eq to return a thenable on the last call.
        let eqCount = 0;
        (b['eq'] as ReturnType<typeof vi.fn>).mockImplementation(() => {
          eqCount++;
          if (eqCount >= 2) {
            // Return a promise-like object
            return Promise.resolve({ data: credits, error: null });
          }
          return b;
        });
      }
      return b;
    }

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => makeRefundBuilder(table)),
    } as unknown as SupabaseClient;

    const result = await processRazorpayWebhook(supabase, refundEventBody, 'valid_sig');

    expect(result).toMatchObject({ accepted: true, message: expect.stringContaining('Refund event') });
  });

  // -------------------------------------------------------------------------
  // Refund event — compensating transaction when credit zeroing fails
  // -------------------------------------------------------------------------

  it('restores subscription to active when credit zeroing fails after cancel', async () => {
    const refundEventBody = JSON.stringify({
      event: 'refund.created',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: { entity: { id: 'pay_comp_test', order_id: 'order_comp', status: 'refunded', amount: 99900, currency: 'INR' } },
        refund: { entity: { id: 'rfnd_2', payment_id: 'pay_comp_test', amount: 99900, status: 'processed' } },
      },
    });

    const tx = { id: 'tx_comp', user_id: 'user_comp' };
    const sub = { id: 'sub_comp' };
    const credits = [{ id: 'credit_comp', available_credits: 2, consumed_credits: 0 }];
    const creditError = { message: 'DB update failed', code: 'XX000' };
    const successNoData = { data: null, error: null };

    // Track update calls to verify compensation occurred.
    const userSubUpdates: Array<{ status: string }> = [];

    // user_service_credits is accessed twice in processRefundEvent:
    //   1. SELECT to fetch credits array     — .select().eq().eq() awaited directly
    //   2. UPDATE to zero available_credits  — .update().eq() awaited directly
    // We track how many times .from('user_service_credits') is called and return
    // a distinct builder each time.
    let creditsCallCount = 0;

    function makeCompBuilder(table: string) {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'neq', 'in', 'filter', 'order', 'insert', 'upsert']) {
        b[m] = vi.fn().mockReturnValue(b);
      }
      b['eq'] = vi.fn().mockReturnValue(b);
      b['maybeSingle'] = vi.fn().mockResolvedValue(successNoData);
      b['single'] = vi.fn().mockResolvedValue(successNoData);
      b['update'] = vi.fn().mockReturnValue(b);

      if (table === 'payment_webhook_events') {
        (b['maybeSingle'] as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
        b['upsert'] = vi.fn().mockReturnValue(b);
        // make builder thenable for upsert awaiting (no terminal method)
        const thenFn = (resolve: (v: unknown) => void) => resolve(successNoData);
        Object.defineProperty(b, 'then', { get: () => thenFn });
      }

      if (table === 'payment_transactions') {
        (b['maybeSingle'] as ReturnType<typeof vi.fn>).mockResolvedValue({ data: tx, error: null });
      }

      if (table === 'user_subscriptions') {
        (b['maybeSingle'] as ReturnType<typeof vi.fn>).mockResolvedValue({ data: sub, error: null });
        b['update'] = vi.fn().mockImplementation((values: { status: string }) => {
          userSubUpdates.push(values);
          // update().eq() is awaited directly — return a thenable.
          const eqResult = Promise.resolve(successNoData);
          return { eq: vi.fn().mockReturnValue(eqResult) };
        });
      }

      if (table === 'user_service_credits') {
        creditsCallCount++;
        if (creditsCallCount === 1) {
          // First call: SELECT credits.
          // Code: .from('user_service_credits').select(...).eq('user_subscription_id', sub.id)
          // The chain is awaited directly — .eq() must return a thenable.
          b['eq'] = vi.fn().mockReturnValue(Promise.resolve({ data: credits, error: null }));
        } else {
          // Second call: UPDATE available_credits.  .update().eq() is awaited directly.
          b['update'] = vi.fn().mockImplementation(() => {
            return { eq: vi.fn().mockResolvedValue({ data: null, error: creditError }) };
          });
        }
      }

      return b;
    }

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => makeCompBuilder(table)),
    } as unknown as SupabaseClient;

    // The function should throw because creditError propagates after the compensating restore.
    await expect(processRazorpayWebhook(supabase, refundEventBody, 'valid_sig')).rejects.toMatchObject({
      message: 'DB update failed',
    });

    // Verify that compensation (restore to active) was attempted on user_subscriptions.
    const restoreCall = userSubUpdates.find((u) => u.status === 'active');
    expect(restoreCall).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // processing_error is set when processing throws
  // -------------------------------------------------------------------------

  it('records processing_error on the webhook event row when processing throws', async () => {
    // Order lookup will throw — simulates a DB error mid-processing.
    const successNoData = { data: null, error: null };
    const dbError = new Error('Order not found');

    const updateCalls: Array<{ table: string; payload: unknown }> = [];

    function makeErrorBuilder(table: string) {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'filter', 'order', 'update', 'insert', 'upsert']) {
        b[m] = vi.fn().mockReturnValue(b);
      }
      b['maybeSingle'] = vi.fn().mockResolvedValue(successNoData);
      b['single'] = vi.fn().mockResolvedValue(successNoData);

      if (table === 'payment_webhook_events') {
        // First maybeSingle: not yet processed; upsert: ok; update: captures setProcessingError call
        b['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: null });
        b['update'] = vi.fn().mockImplementation((payload: unknown) => {
          updateCalls.push({ table: 'payment_webhook_events', payload });
          return b;
        });
        b['upsert'] = vi.fn().mockReturnValue(b);
      }

      if (table === 'subscription_payment_orders') {
        // maybeSingle rejects to simulate a DB error during subscription order lookup
        b['maybeSingle'] = vi.fn().mockRejectedValue(dbError);
      }

      return b;
    }

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => makeErrorBuilder(table)),
    } as unknown as SupabaseClient;

    await expect(processRazorpayWebhook(supabase, buildEventBody(), 'valid_sig')).rejects.toThrow('Order not found');

    // Verify that an update with processing_error was issued on payment_webhook_events
    const errorUpdate = updateCalls.find((c) => {
      const p = c.payload as Record<string, unknown>;
      return typeof p['processing_error'] === 'string' && p['processing_error'].length > 0;
    });
    expect(errorUpdate).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Non-payment.captured events are acknowledged but not processed
  // -------------------------------------------------------------------------

  it('acknowledges and ignores unrecognised event types', async () => {
    // Use an event type that is neither captured/failed/refund — truly unrecognised.
    const ignoredBody = JSON.stringify({
      event: 'order.paid',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: { entity: { id: 'pay_ign1', order_id: 'order_ign1', status: 'created', amount: 500, currency: 'INR' } },
      },
    });

    const successNoData = { data: null, error: null };

    function makeIgnoreBuilder() {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'filter', 'order', 'update', 'insert', 'upsert']) {
        b[m] = vi.fn().mockReturnValue(b);
      }
      b['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: null });
      b['single'] = vi.fn().mockResolvedValue(successNoData);
      return b;
    }

    const supabase = {
      from: vi.fn().mockImplementation(() => makeIgnoreBuilder()),
    } as unknown as SupabaseClient;

    const result = await processRazorpayWebhook(supabase, ignoredBody, 'valid_sig');
    expect(result).toMatchObject({ accepted: true, message: expect.stringContaining('Ignored event type') });
    expect(createOrActivateSubscriptionFromPayment).not.toHaveBeenCalled();
  });
});
