import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 30), 7), 90);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  // Bookings per day
  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('booking_start, status, booking_status')
    .gte('booking_start', sinceIso)
    .order('booking_start', { ascending: true });

  // Revenue from paid invoices per day
  const { data: invoiceRows } = await supabase
    .from('billing_invoices')
    .select('paid_at, total_inr')
    .eq('status', 'paid')
    .gte('paid_at', sinceIso)
    .order('paid_at', { ascending: true });

  // Booking status distribution (all time counts)
  const { data: statusCounts } = await supabase
    .from('bookings')
    .select('status, booking_status');

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
