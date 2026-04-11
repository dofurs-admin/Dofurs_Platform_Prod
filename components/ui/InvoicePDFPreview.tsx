'use client';

import Image from 'next/image';

export type InvoicePreviewDetail = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  user_id: string;
  subtotal_inr: number;
  discount_inr: number;
  tax_inr: number;
  wallet_credits_applied_inr?: number | null;
  cgst_inr?: number | null;
  sgst_inr?: number | null;
  igst_inr?: number | null;
  gstin?: string | null;
  hsn_sac_code?: string | null;
  gst_invoice_number?: string | null;
  total_inr: number;
  booking_id: number | null;
  user_subscription_id: string | null;
  payment_transaction_id: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type InvoicePreviewItem = {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_amount_inr: number;
  line_total_inr: number;
};

export type InvoicePreviewCompany = {
  brandName: string;
  legalEntityName: string;
  registrationNumber: string;
  gstin: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
  addressLine: string;
  termsUrl: string;
  logoUrl: string;
};

export type InvoicePreviewPayment = {
  provider: string;
  status: string;
  display_method: string;
  payment_reference: string | null;
  provider_payment_id: string | null;
  collected_at: string | null;
  notes: string | null;
};

interface InvoicePDFPreviewProps {
  invoice: InvoicePreviewDetail;
  items: InvoicePreviewItem[];
  company?: InvoicePreviewCompany | null;
  payment?: InvoicePreviewPayment | null;
  onDownload?: () => void;
  onPrint?: () => void;
  onCopyLink?: () => void;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolvePaymentMethodLabel(
  invoice: InvoicePreviewDetail,
  payment: InvoicePreviewPayment,
) {
  const normalizedMethod = payment.display_method.trim().toLowerCase();
  const hasExplicitMethod =
    normalizedMethod.length > 0 &&
    normalizedMethod !== 'paid (method not available)';

  if (invoice.user_subscription_id && (!hasExplicitMethod || payment.provider === 'unknown')) {
    return 'Paid by Subscription Credits';
  }

  if (
    payment.provider === 'razorpay' &&
    (!hasExplicitMethod || normalizedMethod === 'razorpay')
  ) {
    return 'Paid with Razorpay';
  }

  return payment.display_method;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  issued: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoicePDFPreview({
  invoice,
  items,
  company,
  payment,
  onDownload,
  onPrint,
  onCopyLink,
}: InvoicePDFPreviewProps) {
  const statusClass = STATUS_STYLES[invoice.status] ?? 'bg-neutral-100 text-neutral-600';
  const paymentMethodLabel = payment ? resolvePaymentMethodLabel(invoice, payment) : null;

  return (
    <div className="space-y-4">
      {company ? (
        <div className="rounded-xl border border-[#ecd8c5] bg-[#fffaf4] px-4 py-3">
          <div className="flex items-start gap-3">
            <Image
              src={company.logoUrl}
              alt={`${company.brandName} logo`}
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg border border-[#ead3bf] bg-white p-1"
              unoptimized
            />
            <div>
              <p className="text-sm font-semibold text-neutral-900">{company.brandName}</p>
              <p className="text-xs text-neutral-600">{company.legalEntityName}</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Registration: {company.registrationNumber}
              </p>
              <p className="text-[11px] text-neutral-500">
                GSTIN: {invoice.gstin ?? company.gstin}
              </p>
              <p className="text-[11px] text-neutral-500">
                Contact: {company.supportEmail} | {company.supportPhone}
              </p>
              <a href={company.termsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-semibold text-coral underline">
                Terms and conditions
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* Invoice header */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Invoice</p>
          <p className="mt-1 font-semibold text-neutral-900">{invoice.invoice_number}</p>
          <p className="text-xs capitalize text-neutral-500">{invoice.invoice_type.replace(/_/g, ' ')}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Status</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusClass}`}>
              {invoice.status}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-neutral-400">User: {invoice.user_id}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="font-semibold text-neutral-700">Timeline</p>
        <div className="mt-2 space-y-1.5">
          {[
            { label: 'Created', value: formatDate(invoice.created_at) },
            { label: 'Issued', value: formatDate(invoice.issued_at) },
            { label: 'Paid', value: formatDate(invoice.paid_at) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-neutral-500">{label}</span>
              <span className={value === '—' ? 'text-neutral-400' : 'font-medium text-neutral-800'}>{value}</span>
            </div>
          ))}
        </div>
        {(invoice.booking_id || invoice.user_subscription_id || invoice.payment_transaction_id) && (
          <div className="mt-2 space-y-0.5 border-t border-neutral-200 pt-2 text-[11px] text-neutral-400">
            {invoice.booking_id != null && <p>Booking #{invoice.booking_id}</p>}
            {invoice.user_subscription_id && <p>Subscription: {invoice.user_subscription_id}</p>}
            {invoice.payment_transaction_id && <p>Payment Ref: {invoice.payment_transaction_id}</p>}
          </div>
        )}
      </div>

      {payment ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
          <p className="font-semibold text-neutral-700">Payment Details</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <p className="text-neutral-600">
              Method: <span className="font-semibold text-neutral-900">{paymentMethodLabel}</span>
            </p>
            <p className="text-neutral-600">
              Status: <span className="font-semibold text-neutral-900 capitalize">{payment.status}</span>
            </p>
            <p className="text-neutral-600">
              Provider: <span className="font-semibold text-neutral-900 capitalize">{payment.provider}</span>
            </p>
            <p className="text-neutral-600">
              Paid At: <span className="font-semibold text-neutral-900">{formatDate(payment.collected_at)}</span>
            </p>
            {payment.payment_reference ? (
              <p className="text-neutral-600 sm:col-span-2">
                Payment Ref: <span className="font-semibold text-neutral-900">{payment.payment_reference}</span>
              </p>
            ) : null}
            {payment.provider_payment_id ? (
              <p className="text-neutral-600 sm:col-span-2">
                Provider Payment ID: <span className="font-semibold text-neutral-900">{payment.provider_payment_id}</span>
              </p>
            ) : null}
            {payment.notes ? (
              <p className="text-neutral-600 sm:col-span-2">
                Note: <span className="font-semibold text-neutral-900">{payment.notes}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Line items */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Line Items
        </div>
        <div className="max-h-56 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-4 text-xs text-neutral-400">No line items found.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">{item.description}</p>
                    <p className="shrink-0 text-sm font-semibold text-neutral-900">
                      {formatCurrency(item.line_total_inr)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {item.item_type.replace(/_/g, ' ')} · Qty {item.quantity} × {formatCurrency(item.unit_amount_inr)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Price breakdown */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
        <div className="space-y-1.5">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal_inr)}</span>
          </div>
          {invoice.discount_inr > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount</span>
              <span>−{formatCurrency(invoice.discount_inr)}</span>
            </div>
          )}
          {invoice.tax_inr > 0 && (invoice.cgst_inr == null || invoice.cgst_inr === 0) && (invoice.sgst_inr == null || invoice.sgst_inr === 0) && (invoice.igst_inr == null || invoice.igst_inr === 0) && (
            <div className="flex justify-between text-neutral-600">
              <span>Tax</span>
              <span>{formatCurrency(invoice.tax_inr)}</span>
            </div>
          )}
          {(invoice.cgst_inr ?? 0) > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>CGST</span>
              <span>{formatCurrency(invoice.cgst_inr!)}</span>
            </div>
          )}
          {(invoice.sgst_inr ?? 0) > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>SGST</span>
              <span>{formatCurrency(invoice.sgst_inr!)}</span>
            </div>
          )}
          {(invoice.igst_inr ?? 0) > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>IGST</span>
              <span>{formatCurrency(invoice.igst_inr!)}</span>
            </div>
          )}
          {(invoice.wallet_credits_applied_inr ?? 0) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Dofurs Credits Applied</span>
              <span>−{formatCurrency(invoice.wallet_credits_applied_inr!)}</span>
            </div>
          )}
          {(invoice.hsn_sac_code || invoice.gstin || invoice.gst_invoice_number) && (
            <div className="border-t border-neutral-100 pt-2 space-y-0.5 text-[11px] text-neutral-400">
              {invoice.gst_invoice_number && <p>GST Invoice #: {invoice.gst_invoice_number}</p>}
              {invoice.gstin && <p>GSTIN: {invoice.gstin}</p>}
              {invoice.hsn_sac_code && <p>HSN/SAC: {invoice.hsn_sac_code}</p>}
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-2 font-bold text-neutral-900">
            <span>Total</span>
            <span className="text-base text-coral">{formatCurrency(invoice.total_inr)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {(onDownload || onPrint || onCopyLink) && (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="rounded-full border border-coral/40 px-4 py-2 text-xs font-semibold text-coral transition hover:border-coral"
            >
              Download PDF
            </button>
          )}
          {onCopyLink && (
            <button
              type="button"
              onClick={onCopyLink}
              className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0]"
            >
              Copy Link
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95"
            >
              Open Printable
            </button>
          )}
        </div>
      )}
    </div>
  );
}
