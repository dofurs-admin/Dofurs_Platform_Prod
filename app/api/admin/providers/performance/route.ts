import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

type ProviderMetrics = {
  provider_id: number;
  total_bookings: number;
  completed: number;
  cancelled: number;
  no_show: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
  avg_rating: number | null;
  total_revenue_inr: number;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const { searchParams } = new URL(request.url);
  const providerIdParam = searchParams.get('providerId');

  // Fetch bookings grouped by provider
  let bookingsQuery = supabase
    .from('bookings')
    .select('provider_id, status, booking_status, final_price');

  if (providerIdParam) {
    const pid = Number(providerIdParam);
    if (!Number.isFinite(pid)) {
      return NextResponse.json({ error: 'Invalid providerId' }, { status: 400 });
    }
    bookingsQuery = bookingsQuery.eq('provider_id', pid);
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Fetch provider reviews for avg rating
  const { data: reviews } = await supabase
    .from('provider_reviews')
    .select('provider_id, rating');

  // Aggregate per provider
  const metricsMap = new Map<number, {
    total: number; completed: number; cancelled: number; no_show: number; revenue: number;
  }>();

  for (const b of bookings ?? []) {
    const pid = b.provider_id as number;
    const s = ((b.booking_status ?? b.status) as string);
    if (!metricsMap.has(pid)) {
      metricsMap.set(pid, { total: 0, completed: 0, cancelled: 0, no_show: 0, revenue: 0 });
    }
    const m = metricsMap.get(pid)!;
    m.total += 1;
    if (s === 'completed') { m.completed += 1; m.revenue += Number(b.final_price ?? 0); }
    if (s === 'cancelled') m.cancelled += 1;
    if (s === 'no_show') m.no_show += 1;
  }

  // Aggregate ratings per provider
  const ratingMap = new Map<number, { sum: number; count: number }>();
  for (const r of reviews ?? []) {
    const pid = r.provider_id as number;
    if (!ratingMap.has(pid)) ratingMap.set(pid, { sum: 0, count: 0 });
    const entry = ratingMap.get(pid)!;
    entry.sum += Number(r.rating ?? 0);
    entry.count += 1;
  }

  const metrics: ProviderMetrics[] = [];
  for (const [provider_id, m] of metricsMap.entries()) {
    const ratingEntry = ratingMap.get(provider_id);
    const avg_rating = ratingEntry && ratingEntry.count > 0
      ? Math.round((ratingEntry.sum / ratingEntry.count) * 10) / 10
      : null;
    const pct = (n: number) => m.total > 0 ? Math.round((n / m.total) * 1000) / 10 : 0;
    metrics.push({
      provider_id,
      total_bookings: m.total,
      completed: m.completed,
      cancelled: m.cancelled,
      no_show: m.no_show,
      completion_rate: pct(m.completed),
      cancellation_rate: pct(m.cancelled),
      no_show_rate: pct(m.no_show),
      avg_rating,
      total_revenue_inr: m.revenue,
    });
  }

  metrics.sort((a, b) => b.total_bookings - a.total_bookings);

  return NextResponse.json({ metrics });
}
