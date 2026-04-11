import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { loadInvoiceDetailForAdmin } from '@/lib/payments/invoiceDetails';
import { buildInvoicePrintHtml } from '@/lib/payments/invoiceDocument';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { id: invoiceId } = await context.params;

  if (!invoiceId) {
    return new Response('Invoice id is required.', { status: 400 });
  }

  try {
    const detail = await loadInvoiceDetailForAdmin(supabase, invoiceId);
    if (!detail) {
      return new Response('Invoice not found.', { status: 404 });
    }

    const html = buildInvoicePrintHtml({
      invoice: detail.invoice,
      items: detail.items,
      payment: detail.payment,
      issuer: detail.company,
      titleSuffix: `${detail.company.brandName} Invoice`,
      autoPrint: true,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unable to render invoice.', { status: 500 });
  }
}
