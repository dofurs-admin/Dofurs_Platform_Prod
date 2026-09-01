import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  // Admin analytics aggregates rows across ALL customers, so it must use the
  // service-role client. RLS on billing_invoices only permits owner reads for
  // authenticated sessions — querying with the user's session client silently
  // returns zero invoice rows and leaves the revenue chart empty.
  const adminSupabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 30), 7), 90);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  // Bookings per day
  const { data: bookingRows, error: bookingRowsError } = await adminSupabase
    .from('bookings')
    .select('booking_start, status, booking_status')
    .gte('booking_start', sinceIso)
    .order('booking_start', { ascending: true });

  if (bookingRowsError) {
    console.warn('Unable to load booking rows for admin analytics', bookingRowsError);
  }

  // Revenue from paid invoices per day
  const { data: invoiceRows, error: invoiceRowsError } = await adminSupabase
    .from('billing_invoices')
    .select('paid_at, total_inr')
    .eq('status', 'paid')
    .gte('paid_at', sinceIso)
    .order('paid_at', { ascending: true });

  if (invoiceRowsError) {
    console.warn('Unable to load paid invoices for admin analytics', invoiceRowsError);
  }

  // Booking status distribution (all time counts)
  const { data: statusCounts, error: statusCountsError } = await adminSupabase
    .from('bookings')
    .select('status, booking_status');

  if (statusCountsError) {
    console.warn('Unable to load booking status counts for admin analytics', statusCountsError);
  }

  // Aggregate bookings by day
  const bookingsByDay: Record<string, number> = {};
  for (const row of bookingRows ?? []) {
    const day = (row.booking_start as string).slice(0, 10);
    bookingsByDay[day] = (bookingsByDay[day] ?? 0) + 1;
  }

  // Aggregate revenue by day
  const revenueByDay: Record<string, number> = {};
  for (const row of invoiceRows ?? []) {
    if (!row.paid_at) continue;
    const day = (row.paid_at as string).slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + (row.total_inr ?? 0);
  }

  // Status distribution
  const statusMap: Record<string, number> = {};
  for (const row of statusCounts ?? []) {
    const s = (row.booking_status ?? row.status) as string;
    statusMap[s] = (statusMap[s] ?? 0) + 1;
  }

  // Build daily series filling gaps
  const dailySeries: Array<{ date: string; bookings: number; revenue: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const day = d.toISOString().slice(0, 10);
    dailySeries.push({ date: day, bookings: bookingsByDay[day] ?? 0, revenue: revenueByDay[day] ?? 0 });
  }

  const statusDistribution = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

  return NextResponse.json({ dailySeries, statusDistribution, days });
}
