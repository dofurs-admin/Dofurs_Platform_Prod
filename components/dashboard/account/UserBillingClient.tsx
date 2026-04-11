'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api/client';
import Modal from '@/components/ui/Modal';
import InvoicePDFPreview from '@/components/ui/InvoicePDFPreview';

type BillingInvoice = {
  id: string;
  invoice_number: string;
  invoice_type: 'service' | 'subscription';
  status: 'draft' | 'issued' | 'paid' | 'void';
  subtotal_inr: number;
  discount_inr: number;
  tax_inr: number;
  wallet_credits_applied_inr?: number;
  total_inr: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  booking_id: number | null;
  user_subscription_id: string | null;
  payment_transaction_id: string | null;
  payment_summary: {
    method: string;
    provider: string;
    reference: string | null;
    status: string;
    paid_at: string | null;
  } | null;
};

type BillingInvoiceDetail = {
  invoice: {
    id: string;
    invoice_number: string;
    invoice_type: string;
    status: string;
    user_id: string;
    subtotal_inr: number;
    discount_inr: number;
    tax_inr: number;
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
  items: Array<{
    id: string;
    item_type: string;
    description: string;
    quantity: number;
    unit_amount_inr: number;
    line_total_inr: number;
  }>;
  payment: {
    provider: string;
    status: string;
    display_method: string;
    payment_reference: string | null;
    provider_payment_id: string | null;
    collected_at: string | null;
    notes: string | null;
  } | null;
  company: {
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
};

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusChipClass(status: BillingInvoice['status']) {
  switch (status) {
    case 'paid':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'issued':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'draft':
      return 'border-neutral-200 bg-neutral-100 text-neutral-700';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

export default function UserBillingClient() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoiceDetail | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInvoices() {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await apiRequest<{ invoices: BillingInvoice[] }>('/api/billing/me?limit=50');

        if (!active) {
          return;
        }

        setInvoices(payload.invoices ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load billing history.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadInvoices();

    return () => {
      active = false;
    };
  }, []);

  async function openInvoiceDetails(invoiceId: string) {
    setIsModalOpen(true);
    setIsDetailLoading(true);
    setDetailError(null);
    setSelectedInvoice(null);

    try {
      const detail = await apiRequest<BillingInvoiceDetail>(`/api/billing/me/invoices/${invoiceId}`);
      setSelectedInvoice(detail);
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load invoice details.');
    } finally {
      setIsDetailLoading(false);
    }
  }

  function openInvoicePdf(invoiceId: string, inline: boolean) {
    const mode = inline ? '1' : '0';
    window.open(`/api/billing/me/invoices/${invoiceId}/pdf?inline=${mode}`, '_blank', 'noopener,noreferrer');
  }

  function openInvoicePrint(invoiceId: string) {
    window.open(`/api/billing/me/invoices/${invoiceId}/print`, '_blank', 'noopener,noreferrer');
  }

  async function copyInvoiceLink(invoiceId: string) {
    try {
      const url = `${window.location.origin}/api/billing/me/invoices/${invoiceId}/print`;
      await navigator.clipboard.writeText(url);
    } catch (copyError) {
      console.error('Unable to copy invoice link', copyError);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">Billing and Invoices</h1>
            <p className="mt-1 text-sm text-[#6b6b6b]">Track subscription and service invoices from your account.</p>
          </div>
          <Link
            href="/dashboard/user/subscriptions"
            className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-4 py-2 text-xs font-semibold text-ink"
          >
            View Subscriptions
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        {isLoading ? <p className="text-sm text-[#6b6b6b]">Loading invoices...</p> : null}
        {!isLoading && error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          invoices.length === 0 ? (
            <p className="text-sm text-[#6b6b6b]">No invoices yet. Invoices will appear here after paid bookings or subscriptions.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => void openInvoiceDetails(invoice.id)}
                  className="block w-full rounded-2xl border border-[#ecd8c5] p-4 text-left transition hover:border-coral/60 hover:bg-[#fffaf4]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{invoice.invoice_number}</p>
                      <p className="text-xs text-[#6b6b6b]">
                        {invoice.invoice_type === 'subscription' ? 'Subscription' : 'Service'} invoice
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusChipClass(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[#5f5f5f] sm:grid-cols-2 lg:grid-cols-4">
                    <p>
                      Subtotal: <span className="font-semibold text-ink">{formatInr(invoice.subtotal_inr)}</span>
                    </p>
                    <p>
                      Tax: <span className="font-semibold text-ink">{formatInr(invoice.tax_inr)}</span>
                    </p>
                    <p>
                      Discount: <span className="font-semibold text-ink">{formatInr(invoice.discount_inr)}</span>
                    </p>
                    <p>
                      Credits Applied: <span className="font-semibold text-ink">{formatInr(invoice.wallet_credits_applied_inr ?? 0)}</span>
                    </p>
                    <p>
                      Total: <span className="font-semibold text-ink">{formatInr(invoice.total_inr)}</span>
                    </p>
                    <p>
                      Issued: <span className="font-semibold text-ink">{formatDate(invoice.issued_at ?? invoice.created_at)}</span>
                    </p>
                    <p>
                      Paid: <span className="font-semibold text-ink">{formatDate(invoice.paid_at)}</span>
                    </p>
                    <p>
                      Payment Mode: <span className="font-semibold text-ink">{invoice.payment_summary?.method ?? '-'}</span>
                    </p>
                    <p>
                      Payment Ref: <span className="font-semibold text-ink">{invoice.payment_summary?.reference ?? '-'}</span>
                    </p>
                    <p>
                      Booking: <span className="font-semibold text-ink">{invoice.booking_id ? `#${invoice.booking_id}` : '-'}</span>
                    </p>
                    <p>
                      Subscription: <span className="font-semibold text-ink">{invoice.user_subscription_id ?? '-'}</span>
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-coral">Open full invoice</p>
                </button>
              ))}
            </div>
          )
        ) : null}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (isDetailLoading) return;
          setIsModalOpen(false);
        }}
        size="xl"
        title="Invoice details"
        description="Review complete billing details and access your printable/downloadable invoice."
      >
        {isDetailLoading ? <p className="text-sm text-neutral-500">Loading invoice details...</p> : null}
        {!isDetailLoading && detailError ? <p className="text-sm font-semibold text-red-700">{detailError}</p> : null}
        {!isDetailLoading && !detailError && selectedInvoice ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#ecd8c5] bg-[#fffaf4] p-4 text-xs text-[#5f5f5f]">
              <p className="text-sm font-semibold text-ink">Issuer details</p>
              <p className="mt-2 font-medium text-ink">{selectedInvoice.company.brandName}</p>
              <p>{selectedInvoice.company.legalEntityName}</p>
              <p>Registration: {selectedInvoice.company.registrationNumber}</p>
              <p>GSTIN: {selectedInvoice.invoice.gstin ?? selectedInvoice.company.gstin}</p>
              <p>
                Contact: {selectedInvoice.company.supportEmail} | {selectedInvoice.company.supportPhone}
              </p>
              <a
                href={selectedInvoice.company.termsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-semibold text-coral underline"
              >
                Terms and Conditions
              </a>
            </div>

            <InvoicePDFPreview
              invoice={selectedInvoice.invoice}
              items={selectedInvoice.items}
              company={selectedInvoice.company}
              payment={selectedInvoice.payment}
              onDownload={() => openInvoicePdf(selectedInvoice.invoice.id, false)}
              onPrint={() => openInvoicePrint(selectedInvoice.invoice.id)}
              onCopyLink={() => void copyInvoiceLink(selectedInvoice.invoice.id)}
            />

            <section className="overflow-hidden rounded-2xl border border-[#ecd8c5] bg-white">
              <div className="flex items-center justify-between border-b border-[#f0e0d0] px-4 py-3">
                <h3 className="text-sm font-semibold text-ink">PDF preview</h3>
                <button
                  type="button"
                  onClick={() => openInvoicePdf(selectedInvoice.invoice.id, true)}
                  className="rounded-full border border-coral/40 px-3 py-1.5 text-xs font-semibold text-coral hover:border-coral"
                >
                  Open in new tab
                </button>
              </div>
              <iframe
                title={`Invoice PDF ${selectedInvoice.invoice.invoice_number}`}
                src={`/api/billing/me/invoices/${selectedInvoice.invoice.id}/pdf?inline=1`}
                className="h-[420px] w-full"
              />
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
