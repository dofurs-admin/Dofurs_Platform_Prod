'use client';

import { useState, useEffect, useTransition } from 'react';
import BookingTrendChart from './BookingTrendChart';
import RevenueChart from './RevenueChart';
import BookingStatusDistribution from './BookingStatusDistribution';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Analytics</h3>
        <select
          className="input-field text-xs py-1 px-2 w-auto"
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
        <p className="text-sm text-neutral-400 py-4 text-center">Loading charts…</p>
      ) : !data ? null : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <BookingTrendChart data={data.dailySeries} />
          <RevenueChart data={data.dailySeries} />
          <BookingStatusDistribution data={data.statusDistribution} />
        </div>
      )}
    </div>
  );
}
