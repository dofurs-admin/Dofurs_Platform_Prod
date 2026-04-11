import crypto from 'crypto';
import { describe, it, expect, vi } from 'vitest';

// Mock the Razorpay constructor and module before importing the module under test.
// razorpay.ts instantiates `new Razorpay(...)` at module load time.
// The default export must be a class (constructor function), not an arrow function.
vi.mock('razorpay', () => {
  return {
    default: class MockRazorpay {
      orders = { create: vi.fn() };
      constructor() {}
    },
  };
});

// Set env vars before the module loads.
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

// Dynamic import so env vars are set first.
const { verifyPaymentSignature, verifyWebhookSignature } = await import('./razorpay');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePaymentSignature(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function makeWebhookSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ---------------------------------------------------------------------------
// verifyPaymentSignature
// ---------------------------------------------------------------------------

describe('verifyPaymentSignature', () => {
  const secret = 'test_key_secret';
  const orderId = 'order_abc123';
  const paymentId = 'pay_xyz456';

  it('returns true for a valid payment signature', () => {
    const signature = makePaymentSignature(orderId, paymentId, secret);
    expect(verifyPaymentSignature({ providerOrderId: orderId, providerPaymentId: paymentId, providerSignature: signature })).toBe(true);
  });

  it('returns false for an invalid payment signature', () => {
    const badSignature = 'a'.repeat(64); // wrong value, same length
    expect(verifyPaymentSignature({ providerOrderId: orderId, providerPaymentId: paymentId, providerSignature: badSignature })).toBe(false);
  });

  it('returns false for a signature with mismatched length (timing-safe path)', () => {
    // A hex HMAC-SHA256 is always 64 chars; a shorter/longer string hits the
    // length-check branch and returns false before timingSafeEqual is called.
    const shortSignature = 'abc123';
    expect(verifyPaymentSignature({ providerOrderId: orderId, providerPaymentId: paymentId, providerSignature: shortSignature })).toBe(false);
  });

  it('returns false when signature is an empty string', () => {
    expect(verifyPaymentSignature({ providerOrderId: orderId, providerPaymentId: paymentId, providerSignature: '' })).toBe(false);
  });

  it('returns false when order id is tampered', () => {
    const signature = makePaymentSignature(orderId, paymentId, secret);
    expect(verifyPaymentSignature({ providerOrderId: 'order_TAMPERED', providerPaymentId: paymentId, providerSignature: signature })).toBe(false);
  });

  it('returns false when payment id is tampered', () => {
    const signature = makePaymentSignature(orderId, paymentId, secret);
    expect(verifyPaymentSignature({ providerOrderId: orderId, providerPaymentId: 'pay_TAMPERED', providerSignature: signature })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature', () => {
  const secret = 'test_webhook_secret';
  const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });

  it('returns true for a valid webhook signature', async () => {
    const signature = makeWebhookSignature(rawBody, secret);
    expect(await verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('returns false for an invalid webhook signature', async () => {
    const badSignature = 'b'.repeat(64);
    expect(await verifyWebhookSignature(rawBody, badSignature)).toBe(false);
  });

  it('returns false for a webhook signature with mismatched length', async () => {
    // Shorter than a valid hex HMAC-SHA256 — hits the length-check branch.
    expect(await verifyWebhookSignature(rawBody, 'short')).toBe(false);
  });

  it('returns false when raw body is tampered after signing', async () => {
    const signature = makeWebhookSignature(rawBody, secret);
    const tamperedBody = rawBody + ' '; // one extra space
    expect(await verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });
});
