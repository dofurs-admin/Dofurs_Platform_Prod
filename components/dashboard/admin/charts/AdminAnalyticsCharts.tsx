'use client';

import { useState, useEffect, useTransition } from 'react';
import BookingTrendChart from './BookingTrendChart';
import RevenueChart from './RevenueChart';
import BookingStatusDistribution from './BookingStatusDistribution';
import OperationsHealthCard from './OperationsHealthCard';

type DailyPoint = { date: string; bookings: number; revenue: number };
type StatusPoint = { status: string; count: number };

type AnalyticsData = {
  dailySeries: DailyPoint[];
  statusDistribution: StatusPoint[];
  days: number;
};

export default function AdminAnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, startLoad] = useTransition();

  useEffect(() => {
    startLoad(async () => {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      if (res.ok) {
        setData(await res.json());
      }
    });
  }, [days]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Analytics</h3>
        <select
          className="input-field !min-h-8 !w-auto !rounded-lg !px-2 !py-1 text-xs"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-xs text-neutral-400">Loading charts…</p>
      ) : !data ? null : (
        <div className="grid gap-3 lg:grid-cols-2">
          <BookingTrendChart data={data.dailySeries} />
          <RevenueChart data={data.dailySeries} />
          <BookingStatusDistribution data={data.statusDistribution} />
          <OperationsHealthCard dailySeries={data.dailySeries} statusDistribution={data.statusDistribution} days={data.days} />
        </div>
      )}
    </div>
  );
}
