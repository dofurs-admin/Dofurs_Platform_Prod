import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getInvoiceCompanyProfile,
  type InvoiceDocumentLineItem,
  type InvoiceDocumentModel,
  type InvoicePaymentSummary,
} from '@/lib/payments/invoiceDocument';

type InvoiceDetailResult = {
  invoice: InvoiceDocumentModel;
  items: InvoiceDocumentLineItem[];
  payment: InvoicePaymentSummary | null;
  company: ReturnType<typeof getInvoiceCompanyProfile>;
};

type PaymentTransactionRow = {
  id: string;
  provider: string;
  status: string;
  provider_payment_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type PaymentEventRow = {
  payload: Record<string, unknown> | null;
};

type BookingPaymentCollectionRow = {
  collection_mode: string | null;
  status: string | null;
  marked_paid_at: string | null;
  notes: string | null;
};

function toText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sentenceCase(input: string) {
  const normalized = input.replaceAll('_', ' ').trim();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseRazorpayMethod(payload: Record<string, unknown> | null) {
  const payment = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  if (!payment) {
    return {
      displayMethod: null,
      paymentReference: null,
      providerPaymentId: null,
    };
  }

  const method = toText(payment.method);
  const vpa = toText(payment.vpa);
  const cardLast4 = toText(payment.card_id) ?? toText((payment.card as Record<string, unknown> | undefined)?.last4);
  const bank = toText(payment.bank);

  let displayMethod: string | null = null;
  if (method) {
    if (method === 'upi' && vpa) {
      displayMethod = `UPI (${vpa})`;
    } else if (method === 'card' && cardLast4) {
      displayMethod = `Card ending ${cardLast4}`;
    } else if (method === 'netbanking' && bank) {
      displayMethod = `Netbanking (${bank})`;
    } else {
      displayMethod = sentenceCase(method);
    }
  }

  const paymentReference = toText(payment.acquirer_data && typeof payment.acquirer_data === 'object'
    ? (payment.acquirer_data as Record<string, unknown>).rrn
    : null)
    ?? toText(payment.id)
    ?? null;

  return {
    displayMethod,
    paymentReference,
    providerPaymentId: toText(payment.id),
  };
}

function buildPaymentSummary(
  invoice: InvoiceDocumentModel,
  transaction: PaymentTransactionRow | null,
  event: PaymentEventRow | null,
  collection: BookingPaymentCollectionRow | null,
): InvoicePaymentSummary | null {
  const txMetadata = transaction?.metadata ?? null;
  const metadataMethod = toText(txMetadata && typeof txMetadata === 'object' ? (txMetadata as Record<string, unknown>).collection_mode : null)
    ?? toText(txMetadata && typeof txMetadata === 'object' ? (txMetadata as Record<string, unknown>).payment_method : null);

  if (transaction) {
    const eventDetails = parseRazorpayMethod(event?.payload ?? null);
    const displayMethod = eventDetails.displayMethod
      ?? (metadataMethod ? sentenceCase(metadataMethod) : null)
      ?? sentenceCase(transaction.provider);

    const paymentReference = eventDetails.paymentReference
      ?? toText(txMetadata && typeof txMetadata === 'object' ? (txMetadata as Record<string, unknown>).provider_order_id : null)
      ?? transaction.provider_payment_id;

    return {
      provider: transaction.provider,
      status: transaction.status,
      display_method: displayMethod,
      payment_reference: paymentReference,
      provider_payment_id: eventDetails.providerPaymentId ?? transaction.provider_payment_id,
      collected_at: invoice.paid_at ?? transaction.created_at,
      notes: null,
    };
  }

  if (collection) {
    return {
      provider: 'manual',
      status: collection.status ?? invoice.status,
      display_method: sentenceCase(collection.collection_mode ?? 'manual'),
      payment_reference: null,
      provider_payment_id: null,
      collected_at: collection.marked_paid_at ?? invoice.paid_at,
      notes: collection.notes,
    };
  }

  if (invoice.status !== 'paid') {
    return null;
  }

  return {
    provider: 'unknown',
    status: invoice.status,
    display_method: 'Paid (method not available)',
    payment_reference: null,
    provider_payment_id: null,
    collected_at: invoice.paid_at,
    notes: null,
  };
}

export async function loadInvoiceDetailForUser(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
): Promise<InvoiceDetailResult | null> {
  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .select(
      'id, user_id, invoice_number, invoice_type, status, booking_id, user_subscription_id, payment_transaction_id, subtotal_inr, discount_inr, tax_inr, wallet_credits_applied_inr, cgst_inr, sgst_inr, igst_inr, gst_invoice_number, gstin, hsn_sac_code, total_inr, issued_at, paid_at, created_at',
    )
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .maybeSingle<InvoiceDocumentModel>();

  if (invoiceError) {
    throw invoiceError;
  }

  if (!invoice) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('billing_invoice_items')
    .select('id, item_type, description, quantity, unit_amount_inr, line_total_inr')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
    .returns<InvoiceDocumentLineItem[]>();

  if (itemsError) {
    throw itemsError;
  }

  let transaction: PaymentTransactionRow | null = null;
  if (invoice.payment_transaction_id) {
    const { data: tx, error: txError } = await supabase
      .from('payment_transactions')
      .select('id, provider, status, provider_payment_id, created_at, metadata')
      .eq('id', invoice.payment_transaction_id)
      .eq('user_id', userId)
      .maybeSingle<PaymentTransactionRow>();

    if (txError) {
      throw txError;
    }

    transaction = tx;
  }

  let event: PaymentEventRow | null = null;
  if (transaction?.id) {
    const { data: paymentEvent, error: eventError } = await supabase
      .from('payment_events')
      .select('payload')
      .eq('transaction_id', transaction.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PaymentEventRow>();

    if (!eventError) {
      event = paymentEvent;
    }
  }

  let collection: BookingPaymentCollectionRow | null = null;
  if (invoice.booking_id) {
    const { data: manualCollection } = await supabase
      .from('booking_payment_collections')
      .select('collection_mode, status, marked_paid_at, notes')
      .eq('booking_id', invoice.booking_id)
      .eq('user_id', userId)
      .maybeSingle<BookingPaymentCollectionRow>();

    collection = manualCollection;
  }

  return {
    invoice,
    items: items ?? [],
    payment: buildPaymentSummary(invoice, transaction, event, collection),
    company: getInvoiceCompanyProfile(),
  };
}

export async function loadInvoiceDetailForAdmin(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<InvoiceDetailResult | null> {
  const { data: invoice, error: invoiceError } = await supabase
    .from('billing_invoices')
    .select(
      'id, user_id, invoice_number, invoice_type, status, booking_id, user_subscription_id, payment_transaction_id, subtotal_inr, discount_inr, tax_inr, wallet_credits_applied_inr, cgst_inr, sgst_inr, igst_inr, gst_invoice_number, gstin, hsn_sac_code, total_inr, issued_at, paid_at, created_at',
    )
    .eq('id', invoiceId)
    .maybeSingle<InvoiceDocumentModel>();

  if (invoiceError) {
    throw invoiceError;
  }

  if (!invoice) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('billing_invoice_items')
    .select('id, item_type, description, quantity, unit_amount_inr, line_total_inr')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
    .returns<InvoiceDocumentLineItem[]>();

  if (itemsError) {
    throw itemsError;
  }

  let transaction: PaymentTransactionRow | null = null;
  if (invoice.payment_transaction_id) {
    const { data: tx, error: txError } = await supabase
      .from('payment_transactions')
      .select('id, provider, status, provider_payment_id, created_at, metadata')
      .eq('id', invoice.payment_transaction_id)
      .maybeSingle<PaymentTransactionRow>();

    if (txError) {
      throw txError;
    }

    transaction = tx;
  }

  let event: PaymentEventRow | null = null;
  if (transaction?.id) {
    const { data: paymentEvent, error: eventError } = await supabase
      .from('payment_events')
      .select('payload')
      .eq('transaction_id', transaction.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PaymentEventRow>();

    if (!eventError) {
      event = paymentEvent;
    }
  }

  let collection: BookingPaymentCollectionRow | null = null;
  if (invoice.booking_id) {
    const { data: manualCollection } = await supabase
      .from('booking_payment_collections')
      .select('collection_mode, status, marked_paid_at, notes')
      .eq('booking_id', invoice.booking_id)
      .maybeSingle<BookingPaymentCollectionRow>();

    collection = manualCollection;
  }

  return {
    invoice,
    items: items ?? [],
    payment: buildPaymentSummary(invoice, transaction, event, collection),
    company: getInvoiceCompanyProfile(),
  };
}
