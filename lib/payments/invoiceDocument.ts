type InvoiceCompanyProfile = {
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

type InvoiceDocumentModel = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  user_id: string;
  booking_id: number | null;
  user_subscription_id: string | null;
  payment_transaction_id: string | null;
  subtotal_inr: number;
  discount_inr: number;
  tax_inr: number;
  wallet_credits_applied_inr?: number | null;
  cgst_inr?: number | null;
  sgst_inr?: number | null;
  igst_inr?: number | null;
  gst_invoice_number?: string | null;
  gstin?: string | null;
  hsn_sac_code?: string | null;
  total_inr: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type InvoiceDocumentLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_amount_inr: number;
  line_total_inr: number;
  item_type: string;
};

type InvoicePaymentSummary = {
  provider: string;
  status: string;
  display_method: string;
  payment_reference: string | null;
  provider_payment_id: string | null;
  collected_at: string | null;
  notes: string | null;
};

type BuildInvoiceDocumentInput = {
  invoice: InvoiceDocumentModel;
  items: InvoiceDocumentLineItem[];
  payment: InvoicePaymentSummary | null;
  issuer: InvoiceCompanyProfile;
  titleSuffix?: string;
  autoPrint?: boolean;
};

function normalizeUrl(value: string) {
  if (!value) {
    return 'https://dofurs.in';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function trimTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getInvoiceCompanyProfile(): InvoiceCompanyProfile {
  const websiteBase = trimTrailingSlash(normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://dofurs.in'));

  return {
    brandName: process.env.COMPANY_BRAND_NAME ?? 'Dofurs',
    legalEntityName: process.env.COMPANY_LEGAL_NAME ?? 'Dofurs Platform',
    registrationNumber: process.env.COMPANY_REGISTRATION_NUMBER ?? 'Registration number available on request',
    gstin: process.env.COMPANY_GSTIN ?? 'GSTIN available on request',
    supportEmail: process.env.COMPANY_SUPPORT_EMAIL ?? 'petcare@dofurs.in',
    supportPhone: process.env.COMPANY_SUPPORT_PHONE ?? '+91 70083 65175',
    websiteUrl: websiteBase,
    addressLine: process.env.COMPANY_ADDRESS_LINE ?? 'Bangalore, Karnataka 560100, India',
    termsUrl: `${websiteBase}/terms-conditions`,
    logoUrl: `${websiteBase}/logo/brand-logo.png`,
  };
}

export function formatInr(value: number | null | undefined) {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolvePaymentMethodLabel(
  invoice: InvoiceDocumentModel,
  payment: InvoicePaymentSummary,
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizePdfText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function splitDescription(text: string, width = 44) {
  if (text.length <= width) {
    return [text];
  }

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function chunkLines(lines: string[], pageSize: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    chunks.push(lines.slice(index, index + pageSize));
  }
  return chunks;
}

function buildPageStream(lines: string[], pageNumber: number, pageCount: number) {
  const escaped = lines.map((line) => sanitizePdfText(line));
  const footer = sanitizePdfText(`Page ${pageNumber} of ${pageCount}`);

  return [
    'BT',
    '/F1 10 Tf',
    '50 795 Td',
    '13 TL',
    ...escaped.map((line, index) => (index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)),
    'ET',
    'BT',
    '/F1 9 Tf',
    '260 20 Td',
    `(${footer}) Tj`,
    'ET',
  ].join('\n');
}

function buildSimplePdf(lines: string[]) {
  const lineChunks = chunkLines(lines, 50);
  const pageCount = Math.max(1, lineChunks.length);

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];
  let nextObjectNumber = 3;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    pageObjectNumbers.push(nextObjectNumber);
    nextObjectNumber += 1;
    contentObjectNumbers.push(nextObjectNumber);
    nextObjectNumber += 1;
  }

  const kids = pageObjectNumbers.map((num) => `${num} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageObjectNumber = pageObjectNumbers[pageIndex];
    const contentObjectNumber = contentObjectNumbers[pageIndex];
    const stream = buildPageStream(lineChunks[pageIndex] ?? [], pageIndex + 1, pageCount);

    objects.push(
      `${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${nextObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentObjectNumber} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  }

  objects.push(`${nextObjectNumber} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function buildPriceRows(invoice: InvoiceDocumentModel) {
  const rows = [
    { label: 'Subtotal', value: formatInr(invoice.subtotal_inr) },
    { label: 'Discount', value: formatInr(invoice.discount_inr) },
    { label: 'Tax', value: formatInr(invoice.tax_inr) },
  ];

  if ((invoice.cgst_inr ?? 0) > 0) {
    rows.push({ label: 'CGST', value: formatInr(invoice.cgst_inr) });
  }

  if ((invoice.sgst_inr ?? 0) > 0) {
    rows.push({ label: 'SGST', value: formatInr(invoice.sgst_inr) });
  }

  if ((invoice.igst_inr ?? 0) > 0) {
    rows.push({ label: 'IGST', value: formatInr(invoice.igst_inr) });
  }

  if ((invoice.wallet_credits_applied_inr ?? 0) > 0) {
    rows.push({
      label: 'Dofurs Credits Applied',
      value: `-${formatInr(invoice.wallet_credits_applied_inr)}`,
    });
  }

  rows.push({ label: 'Total', value: formatInr(invoice.total_inr) });
  return rows;
}

export function buildInvoicePrintHtml(input: BuildInvoiceDocumentInput) {
  const { invoice, items, payment, issuer } = input;
  const priceRows = buildPriceRows(invoice);
  const paymentMethodLabel = payment ? resolvePaymentMethodLabel(invoice, payment) : null;

  const itemRows = (items ?? [])
    .map((item, index) => {
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.description || 'Invoice line item')}</td>
        <td>${Number(item.quantity || 0)}</td>
        <td>${escapeHtml(formatInr(item.unit_amount_inr || 0))}</td>
        <td>${escapeHtml(formatInr(item.line_total_inr || 0))}</td>
      </tr>`;
    })
    .join('');

  const totalsRows = priceRows
    .map((row) => {
      const rowClass = row.label === 'Total' ? 'totals-row total' : 'totals-row';
      return `<div class="${rowClass}"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`;
    })
    .join('');

  const paymentLines = payment
    ? [
        `<p><strong>Payment method:</strong> ${escapeHtml(paymentMethodLabel ?? payment.display_method)}</p>`,
        `<p><strong>Payment status:</strong> ${escapeHtml(payment.status)}</p>`,
        payment.payment_reference ? `<p><strong>Payment reference:</strong> ${escapeHtml(payment.payment_reference)}</p>` : '',
        payment.provider_payment_id ? `<p><strong>Provider payment ID:</strong> ${escapeHtml(payment.provider_payment_id)}</p>` : '',
        payment.collected_at ? `<p><strong>Collected at:</strong> ${escapeHtml(formatDateTime(payment.collected_at))}</p>` : '',
      ]
        .filter(Boolean)
        .join('')
    : '<p><strong>Payment method:</strong> Not available</p>';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(invoice.invoice_number)}${input.titleSuffix ? ` | ${escapeHtml(input.titleSuffix)}` : ''}</title>
    <style>
      body {
        margin: 0;
        background: #f7f4f1;
        color: #1f1f1f;
        font-family: 'Plus Jakarta Sans', 'Avenir Next', 'Segoe UI', sans-serif;
      }
      .sheet {
        max-width: 980px;
        margin: 24px auto;
        background: #fff;
        border: 1px solid #e7c4a7;
        border-radius: 16px;
        padding: 28px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .logo {
        width: 72px;
        height: 72px;
        border-radius: 16px;
        border: 1px solid #efd7c2;
        object-fit: contain;
        background: #fff8f0;
      }
      .brand-title {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      .muted {
        color: #6b6b6b;
        font-size: 13px;
      }
      .summary {
        margin-top: 22px;
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .card {
        border: 1px solid #ecd8c5;
        border-radius: 12px;
        padding: 12px;
        background: #fffdfa;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      th,
      td {
        text-align: left;
        padding: 10px;
        border-bottom: 1px solid #efe2d4;
        font-size: 13px;
      }
      th {
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #6b6b6b;
      }
      .totals {
        margin-top: 18px;
        margin-left: auto;
        width: min(360px, 100%);
      }
      .totals-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 14px;
      }
      .totals-row.total {
        font-size: 17px;
        font-weight: 800;
        color: #b56e2a;
        border-top: 1px solid #e7c4a7;
        padding-top: 10px;
        margin-top: 6px;
      }
      .footer {
        margin-top: 22px;
        border-top: 1px solid #ecd8c5;
        padding-top: 12px;
        font-size: 12px;
        color: #5a5a5a;
      }
      .footer a {
        color: #b56e2a;
        text-decoration: none;
      }
      @media print {
        body {
          background: #fff;
        }
        .sheet {
          margin: 0;
          border: 0;
          border-radius: 0;
          max-width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="header">
        <div class="header-left">
          <img class="logo" src="${escapeHtml(issuer.logoUrl)}" alt="${escapeHtml(issuer.brandName)} logo" />
          <div>
            <div class="brand-title">${escapeHtml(issuer.brandName)}</div>
            <div class="muted">Premium Pet Care Billing</div>
          </div>
        </div>
        <div>
          <div><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number || 'N/A')}</div>
          <div><strong>Status:</strong> ${escapeHtml(invoice.status || 'N/A')}</div>
          <div><strong>Type:</strong> ${escapeHtml((invoice.invoice_type || 'service').replaceAll('_', ' '))}</div>
        </div>
      </div>

      <section class="summary">
        <article class="card">
          <div class="muted">Bill To (User ID)</div>
          <div><strong>${escapeHtml(invoice.user_id || 'N/A')}</strong></div>
          <div class="muted" style="margin-top:8px;">Reference</div>
          <div>Booking: ${escapeHtml(String(invoice.booking_id ?? 'N/A'))}</div>
          <div>Subscription: ${escapeHtml(invoice.user_subscription_id ?? 'N/A')}</div>
        </article>
        <article class="card">
          <div class="muted">Payment Details</div>
          ${paymentLines}
        </article>
        <article class="card">
          <div class="muted">Timeline</div>
          <div><strong>Created:</strong> ${escapeHtml(formatDateTime(invoice.created_at))}</div>
          <div><strong>Issued:</strong> ${escapeHtml(formatDateTime(invoice.issued_at))}</div>
          <div><strong>Paid:</strong> ${escapeHtml(formatDateTime(invoice.paid_at))}</div>
        </article>
        <article class="card">
          <div class="muted">Compliance</div>
          <div><strong>Entity:</strong> ${escapeHtml(issuer.legalEntityName)}</div>
          <div><strong>Registration:</strong> ${escapeHtml(issuer.registrationNumber)}</div>
          <div><strong>GSTIN:</strong> ${escapeHtml(invoice.gstin || issuer.gstin)}</div>
          ${invoice.hsn_sac_code ? `<div><strong>HSN/SAC:</strong> ${escapeHtml(invoice.hsn_sac_code)}</div>` : ''}
          ${invoice.gst_invoice_number ? `<div><strong>GST Invoice #:</strong> ${escapeHtml(invoice.gst_invoice_number)}</div>` : ''}
        </article>
      </section>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows || '<tr><td colspan="5">No items</td></tr>'}
        </tbody>
      </table>

      <section class="totals">${totalsRows}</section>

      <footer class="footer">
        <p><strong>${escapeHtml(issuer.legalEntityName)}</strong> | ${escapeHtml(issuer.addressLine)}</p>
        <p>Registration: ${escapeHtml(issuer.registrationNumber)} | GSTIN: ${escapeHtml(invoice.gstin || issuer.gstin)}</p>
        <p>Support: ${escapeHtml(issuer.supportEmail)} | ${escapeHtml(issuer.supportPhone)} | ${escapeHtml(issuer.websiteUrl)}</p>
        <p>Terms and conditions: <a href="${escapeHtml(issuer.termsUrl)}">${escapeHtml(issuer.termsUrl)}</a></p>
      </footer>
    </main>
    ${input.autoPrint ? `<script>window.addEventListener('load', () => setTimeout(() => window.print(), 120));</script>` : ''}
  </body>
</html>`;

  return html;
}

export function buildInvoicePdfBuffer(input: BuildInvoiceDocumentInput) {
  const { invoice, items, issuer, payment } = input;
  const paymentMethodLabel = payment ? resolvePaymentMethodLabel(invoice, payment) : null;
  const lines: string[] = [
    `${issuer.brandName.toUpperCase()} - PREMIUM PET CARE`,
    issuer.legalEntityName,
    `Address: ${issuer.addressLine}`,
    `Registration: ${issuer.registrationNumber}`,
    `GSTIN: ${invoice.gstin || issuer.gstin}`,
    `Support: ${issuer.supportEmail} | ${issuer.supportPhone}`,
    `Website: ${issuer.websiteUrl}`,
    `Terms: ${issuer.termsUrl}`,
    '====================================================',
    `INVOICE NO: ${invoice.invoice_number || 'N/A'}`,
    `STATUS: ${(invoice.status || 'N/A').toUpperCase()}    TYPE: ${(invoice.invoice_type || 'service').toUpperCase()}`,
    `CUSTOMER (USER ID): ${invoice.user_id || 'N/A'}`,
    `BOOKING: ${invoice.booking_id ?? 'N/A'}    SUBSCRIPTION: ${invoice.user_subscription_id ?? 'N/A'}`,
    `CREATED: ${formatDateTime(invoice.created_at)}`,
    `ISSUED: ${formatDateTime(invoice.issued_at)}`,
    `PAID: ${formatDateTime(invoice.paid_at)}`,
  ];

  if (payment) {
    lines.push(`PAYMENT METHOD: ${paymentMethodLabel ?? payment.display_method}`);
    lines.push(`PAYMENT STATUS: ${payment.status}`);
    if (payment.payment_reference) {
      lines.push(`PAYMENT REF: ${payment.payment_reference}`);
    }
    if (payment.provider_payment_id) {
      lines.push(`PROVIDER PAYMENT ID: ${payment.provider_payment_id}`);
    }
  }

  lines.push('----------------------------------------------------');
  lines.push('ITEMS');
  lines.push('DESCRIPTION                                  QTY      UNIT       TOTAL');
  lines.push('----------------------------------------------------');

  for (const item of items ?? []) {
    const qty = Number(item.quantity ?? 0);
    const unit = Number(item.unit_amount_inr ?? 0);
    const lineTotal = Number(item.line_total_inr ?? 0);
    const splitLines = splitDescription(item.description || 'Invoice item', 42);

    for (let lineIndex = 0; lineIndex < splitLines.length; lineIndex += 1) {
      const desc = splitLines[lineIndex].padEnd(42, ' ');
      if (lineIndex === 0) {
        const row = `${desc}${String(qty).padStart(4, ' ')}  ${formatInr(unit).padStart(10, ' ')}  ${formatInr(lineTotal).padStart(10, ' ')}`;
        lines.push(row);
      } else {
        lines.push(desc);
      }
    }
  }

  lines.push('----------------------------------------------------');
  lines.push(`Subtotal: ${formatInr(invoice.subtotal_inr)}`);
  lines.push(`Discount: ${formatInr(invoice.discount_inr)}`);
  lines.push(`Tax: ${formatInr(invoice.tax_inr)}`);
  if ((invoice.cgst_inr ?? 0) > 0) {
    lines.push(`CGST: ${formatInr(invoice.cgst_inr)}`);
  }
  if ((invoice.sgst_inr ?? 0) > 0) {
    lines.push(`SGST: ${formatInr(invoice.sgst_inr)}`);
  }
  if ((invoice.igst_inr ?? 0) > 0) {
    lines.push(`IGST: ${formatInr(invoice.igst_inr)}`);
  }
  lines.push(`TOTAL: ${formatInr(invoice.total_inr)}`);
  lines.push('====================================================');
  lines.push(`Generated by ${issuer.brandName} finance system.`);

  return buildSimplePdf(lines);
}

export type {
  InvoiceCompanyProfile,
  InvoiceDocumentModel,
  InvoiceDocumentLineItem,
  InvoicePaymentSummary,
  BuildInvoiceDocumentInput,
};
