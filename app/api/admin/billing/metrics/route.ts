import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

type BillingMetricInvoice = {
  status: string;
  total_inr: number;
  issued_at: string | null;
  paid_at: string | null;
};

function daysBetween(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function daysSince(startIso: string) {
  return daysBetween(startIso, getISTTimestamp());
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 600), 100), 1500);

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('status, total_inr, issued_at, paid_at')
    .in('status', ['issued', 'paid'])
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<BillingMetricInvoice[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invoices = data ?? [];

  let issuedAmount = 0;
  let collectedAmount = 0;
  let paidInvoiceCount = 0;
  let dsoDaysTotal = 0;

  const aging = {
    days_0_7: { count: 0, amount_inr: 0 },
    days_8_14: { count: 0, amount_inr: 0 },
    days_15_30: { count: 0, amount_inr: 0 },
    days_30_plus: { count: 0, amount_inr: 0 },
  };

  for (const invoice of invoices) {
    const amount = Number(invoice.total_inr ?? 0);
    issuedAmount += amount;

    if (invoice.status === 'paid') {
      collectedAmount += amount;
      paidInvoiceCount += 1;

      if (invoice.issued_at && invoice.paid_at) {
        dsoDaysTotal += daysBetween(invoice.issued_at, invoice.paid_at);
      }
      continue;
    }

    const reference = invoice.issued_at;
    if (!reference) {
      aging.days_30_plus.count += 1;
      aging.days_30_plus.amount_inr += amount;
      continue;
    }

    const ageDays = daysSince(reference);

    if (ageDays <= 7) {
      aging.days_0_7.count += 1;
      aging.days_0_7.amount_inr += amount;
    } else if (ageDays <= 14) {
      aging.days_8_14.count += 1;
      aging.days_8_14.amount_inr += amount;
    } else if (ageDays <= 30) {
      aging.days_15_30.count += 1;
      aging.days_15_30.amount_inr += amount;
    } else {
      aging.days_30_plus.count += 1;
      aging.days_30_plus.amount_inr += amount;
    }
  }

  const outstandingAmount = Math.max(0, issuedAmount - collectedAmount);
  const collectionRatePct = issuedAmount > 0 ? (collectedAmount / issuedAmount) * 100 : 0;
  const dsoDays = paidInvoiceCount > 0 ? dsoDaysTotal / paidInvoiceCount : 0;

  return NextResponse.json({
    generated_at: getISTTimestamp(),
    totals: {
      invoices_considered: invoices.length,
      issued_amount_inr: issuedAmount,
      collected_amount_inr: collectedAmount,
      outstanding_amount_inr: outstandingAmount,
      collection_rate_pct: Number(collectionRatePct.toFixed(2)),
      dso_days: Number(dsoDays.toFixed(2)),
    },
    aging,
  });
}
