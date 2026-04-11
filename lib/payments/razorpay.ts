import crypto from 'crypto';
import Razorpay from 'razorpay';
import type { RazorpayOrderRequest, RazorpayOrderResponse } from './types';

function getRazorpayKeyId() {
  const key = process.env.RAZORPAY_KEY_ID;
  if (!key) throw new Error('Missing RAZORPAY_KEY_ID');
  return key;
}

function getRazorpaySecret() {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('Missing RAZORPAY_KEY_SECRET');
  return secret;
}

function getRazorpayWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing RAZORPAY_WEBHOOK_SECRET');
  return secret;
}

let _razorpayInstance: Razorpay | null = null;

/** Lazily initializes and returns the Razorpay instance. Prevents module-level crash when env vars are missing. */
export function getRazorpayInstance(): Razorpay {
  if (!_razorpayInstance) {
    _razorpayInstance = new Razorpay({
      key_id: getRazorpayKeyId(),
      key_secret: getRazorpaySecret(),
    });
  }
  return _razorpayInstance;
}

/** @deprecated Use getRazorpayInstance() instead */
export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    return (getRazorpayInstance() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function getRazorpayPublicConfig() {
  return {
    keyId: getRazorpayKeyId(),
  };
}

export async function createRazorpayOrder(input: RazorpayOrderRequest): Promise<RazorpayOrderResponse> {
  const rz = getRazorpayInstance();
  const order = await rz.orders.create({
    amount: input.amountInPaise,
    currency: input.currency ?? 'INR',
    receipt: input.receipt,
    notes: input.notes,
  });

  return order as RazorpayOrderResponse;
}

export function verifyPaymentSignature(input: {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}) {
  const payload = `${input.providerOrderId}|${input.providerPaymentId}`;
  const expected = crypto.createHmac('sha256', getRazorpaySecret()).update(payload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(input.providerSignature, 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function verifyWebhookSignature(rawBody: string, signature: string) {
  const expectedSignature = crypto.createHmac('sha256', getRazorpayWebhookSecret()).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
