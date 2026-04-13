import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getISTTimestamp } from '@/lib/utils/date';

function invoiceNumber(prefix: 'INV-SVC' | 'INV-SUB') {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const t = String(now.getUTCHours()).padStart(2, '0') + String(now.getUTCMinutes()).padStart(2, '0') + String(now.getUTCSeconds()).padStart(2, '0');
  const rand = crypto.randomInt(100000, 999999);
  return `${prefix}-${y}${m}${d}-${t}-${rand}`;
}

export async function createSubscriptionInvoice(
  supabase: SupabaseClient,
  input: {
    userId: string;
    userSubscriptionId: string;
    paymentTransactionId: string;
    planName: string;
    amountInr: number;
  },
) {
  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number')
    .eq('invoice_type', 'subscription')
    .eq('payment_transaction_id', input.paymentTransactionId)
    .maybeSingle();

  if (existingInvoiceError) {
    throw existingInvoiceError;
  }

  if (existingInvoice) {
    return existingInvoice;
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .insert({
      user_id: input.userId,
      invoice_number: invoiceNumber('INV-SUB'),
      invoice_type: 'subscription',
      status: 'paid',
      user_subscription_id: input.userSubscriptionId,
      payment_transaction_id: input.paymentTransactionId,
      subtotal_inr: input.amountInr,
      discount_inr: 0,
      tax_inr: 0,
      total_inr: input.amountInr,
      issued_at: getISTTimestamp(),
      paid_at: getISTTimestamp(),
      metadata: { source: 'subscription_payment' },
    })
    .select('id, invoice_number')
    .single();

  if (invoiceError || !invoice) throw invoiceError ?? new Error('Unable to create subscription invoice.');

  await supabase.from('billing_invoice_items').insert({
    invoice_id: invoice.id,
    item_type: 'subscription',
    description: `Subscription purchase: ${input.planName}`,
    quantity: 1,
    unit_amount_inr: input.amountInr,
    line_total_inr: input.amountInr,
  });

  return invoice;
}

export async function createServiceInvoice(
  supabase: SupabaseClient,
  input: {
    userId: string;
    bookingId: number;
    paymentTransactionId?: string | null;
    description: string;
    amountInr: number;
    walletCreditsAppliedInr?: number;
    status: 'issued' | 'paid';
  },
) {
  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number')
    .eq('invoice_type', 'service')
    .eq('booking_id', input.bookingId)
    .maybeSingle();

  if (existingInvoiceError) {
    throw existingInvoiceError;
  }

  if (existingInvoice) {
    return existingInvoice;
  }

  const creditsApplied = Math.max(0, input.walletCreditsAppliedInr ?? 0);
  // total_inr = what the customer actually owed in cash/online payment
  const totalInr = Math.max(0, input.amountInr - creditsApplied);
  const now = getISTTimestamp();

  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .insert({
      user_id: input.userId,
      invoice_number: invoiceNumber('INV-SVC'),
      invoice_type: 'service',
      status: input.status,
      booking_id: input.bookingId,
      payment_transaction_id: input.paymentTransactionId ?? null,
      subtotal_inr: input.amountInr,
      discount_inr: 0,
      tax_inr: 0,
      wallet_credits_applied_inr: creditsApplied,
      total_inr: totalInr,
      issued_at: now,
      paid_at: input.status === 'paid' ? now : null,
      metadata: { source: 'service_booking' },
    })
    .select('id, invoice_number')
    .single();

  if (invoiceError || !invoice) throw invoiceError ?? new Error('Unable to create service invoice.');

  // Service charge line item
  await supabase.from('billing_invoice_items').insert({
    invoice_id: invoice.id,
    item_type: 'service',
    description: input.description,
    quantity: 1,
    unit_amount_inr: input.amountInr,
    line_total_inr: input.amountInr,
  });

  // Wallet credits deduction line item — shows as negative entry in the breakdown
  if (creditsApplied > 0) {
    await supabase.from('billing_invoice_items').insert({
      invoice_id: invoice.id,
      item_type: 'credit_applied',
      description: 'Dofurs Credits Applied',
      quantity: 1,
      unit_amount_inr: -creditsApplied,
      line_total_inr: -creditsApplied,
    });
  }

  return invoice;
}
