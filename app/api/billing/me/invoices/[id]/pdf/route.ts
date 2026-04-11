import { requireApiRole } from '@/lib/auth/api-auth';
import { buildInvoicePdfBuffer } from '@/lib/payments/invoiceDocument';
import { loadInvoiceDetailForUser } from '@/lib/payments/invoiceDetails';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { id: invoiceId } = await context.params;
  if (!invoiceId) {
    return new Response('Invoice id is required.', { status: 400 });
  }

  try {
    const detail = await loadInvoiceDetailForUser(auth.context.supabase, auth.context.user.id, invoiceId);

    if (!detail) {
      return new Response('Invoice not found.', { status: 404 });
    }

    const pdfBuffer = buildInvoicePdfBuffer({
      invoice: detail.invoice,
      items: detail.items,
      payment: detail.payment,
      issuer: detail.company,
    });

    const filename = (detail.invoice.invoice_number ?? 'invoice').replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get('inline') === '1' ? 'inline' : 'attachment';

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${disposition}; filename="${filename}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unable to generate invoice PDF.', { status: 500 });
  }
}
