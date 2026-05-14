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

export type ServiceInvoiceLineItemInput = {
  description: string;
  quantity?: number;
  unitAmountInr?: number;
  lineTotalInr?: number;
};

function normalizeServiceInvoiceLineItems(
  lineItems: ServiceInvoiceLineItemInput[] | null | undefined,
) {
  if (!Array.isArray(lineItems)) {
    return [] as Array<{
      description: string;
      quantity: number;
      unit_amount_inr: number;
      line_total_inr: number;
    }>;
  }

  return lineItems
    .map((item) => {
      const description = item.description.trim();
      const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)));
      const explicitLineTotal = Number(item.lineTotalInr ?? NaN);
      const unitAmount = Number.isFinite(Number(item.unitAmountInr))
        ? Number(item.unitAmountInr)
        : Number.isFinite(explicitLineTotal)
          ? explicitLineTotal / quantity
          : NaN;
      const lineTotal = Number.isFinite(explicitLineTotal)
        ? explicitLineTotal
        : Number.isFinite(unitAmount)
          ? unitAmount * quantity
          : NaN;

      if (!description || !Number.isFinite(unitAmount) || !Number.isFinite(lineTotal) || lineTotal <= 0) {
        return null;
      }

      return {
        description,
        quantity,
        unit_amount_inr: Math.round(unitAmount),
        line_total_inr: Math.round(lineTotal),
      };
    })
    .filter((item): item is {
      description: string;
      quantity: number;
      unit_amount_inr: number;
      line_total_inr: number;
    } => Boolean(item));
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
    discountInr?: number;
    walletCreditsAppliedInr?: number;
    serviceLineItems?: ServiceInvoiceLineItemInput[];
    status: 'issued' | 'paid';
    metadata?: Record<string, unknown>;
  },
) {
  if (input.paymentTransactionId) {
    const { data: existingByTransaction, error: existingByTransactionError } = await supabase
      .from('billing_invoices')
      .select('id, invoice_number')
      .eq('invoice_type', 'service')
      .eq('payment_transaction_id', input.paymentTransactionId)
      .maybeSingle();

    if (existingByTransactionError) {
      throw existingByTransactionError;
    }

    if (existingByTransaction) {
      return existingByTransaction;
    }
  } else {
    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from('billing_invoices')
      .select('id, invoice_number')
      .eq('invoice_type', 'service')
      .eq('booking_id', input.bookingId)
      .is('payment_transaction_id', null)
      .maybeSingle();

    if (existingInvoiceError) {
      throw existingInvoiceError;
    }

    if (existingInvoice) {
      return existingInvoice;
    }
  }

  const subtotalInr = Math.max(0, input.amountInr);
  const discountInr = Math.max(0, input.discountInr ?? 0);
  const creditsApplied = Math.max(0, input.walletCreditsAppliedInr ?? 0);
  // total_inr = subtotal - discount - wallet credits
  const totalInr = Math.max(0, subtotalInr - discountInr - creditsApplied);
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
      subtotal_inr: subtotalInr,
      discount_inr: discountInr,
      tax_inr: 0,
      wallet_credits_applied_inr: creditsApplied,
      total_inr: totalInr,
      issued_at: now,
      paid_at: input.status === 'paid' ? now : null,
      metadata: {
        source: input.paymentTransactionId ? 'service_payment_collection' : 'service_booking',
        ...(input.metadata ?? {}),
      },
    })
    .select('id, invoice_number')
    .single();

  if (invoiceError || !invoice) throw invoiceError ?? new Error('Unable to create service invoice.');

  const normalizedServiceLineItems = normalizeServiceInvoiceLineItems(input.serviceLineItems);
  const serviceLineItems = normalizedServiceLineItems.length > 0
    ? normalizedServiceLineItems
    : [{
        description: input.description,
        quantity: 1,
        unit_amount_inr: subtotalInr,
        line_total_inr: subtotalInr,
      }];

  await supabase.from('billing_invoice_items').insert(
    serviceLineItems.map((item) => ({
      invoice_id: invoice.id,
      item_type: 'service',
      ...item,
    })),
  );

  if (discountInr > 0) {
    await supabase.from('billing_invoice_items').insert({
      invoice_id: invoice.id,
      item_type: 'discount',
      description: 'Promotional discount applied',
      quantity: 1,
      unit_amount_inr: -discountInr,
      line_total_inr: -discountInr,
    });
  }

  // Wallet credits deduction line item — shows as negative entry in the breakdown
  if (creditsApplied > 0) {
    await supabase.from('billing_invoice_items').insert({
      invoice_id: invoice.id,
      item_type: 'adjustment',
      description: 'Dofurs Credits Applied',
      quantity: 1,
      unit_amount_inr: -creditsApplied,
      line_total_inr: -creditsApplied,
    });
  }

  return invoice;
}
