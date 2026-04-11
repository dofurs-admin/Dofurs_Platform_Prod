import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { loadInvoiceDetailForUser } from '@/lib/payments/invoiceDetails';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { id: invoiceId } = await context.params;
  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice id is required.' }, { status: 400 });
  }

  try {
    const detail = await loadInvoiceDetailForUser(auth.context.supabase, auth.context.user.id, invoiceId);

    if (!detail) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load invoice details.' },
      { status: 500 },
    );
  }
}
