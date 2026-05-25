'use client';

import { cn } from '@/lib/design-system';

type DailyPoint = { date: string; bookings: number; revenue: number };
type StatusPoint = { status: string; count: number };

type Props = {
  dailySeries: DailyPoint[];
  statusDistribution: StatusPoint[];
  days: number;
};

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, notation: 'compact' });

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function statusCount(data: StatusPoint[], status: string) {
  return data.find((item) => item.status === status)?.count ?? 0;
}

export default function OperationsHealthCard({ dailySeries, statusDistribution, days }: Props) {
  const totalBookings = statusDistribution.reduce((sum, item) => sum + item.count, 0)
    || dailySeries.reduce((sum, item) => sum + item.bookings, 0);
  const totalRevenue = dailySeries.reduce((sum, item) => sum + item.revenue, 0);
  const completed = statusCount(statusDistribution, 'completed');
  const pending = statusCount(statusDistribution, 'pending');
  const confirmed = statusCount(statusDistribution, 'confirmed');
  const exceptions = statusCount(statusDistribution, 'cancelled') + statusCount(statusDistribution, 'no_show');
  const completionRate = percent(completed, totalBookings);
  const exceptionRate = percent(exceptions, totalBookings);
  const openQueue = pending + confirmed;
  const avgDailyBookings = days > 0 ? totalBookings / days : 0;
  const revenuePerBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;
  const healthLabel = exceptionRate >= 15 ? 'Needs review' : openQueue >= Math.max(4, Math.ceil(totalBookings * 0.25)) ? 'Watch queue' : 'Healthy';
  const healthClassName = healthLabel === 'Healthy'
    ? 'bg-emerald-50 text-emerald-700'
    : healthLabel === 'Watch queue'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-900">Operations Health</p>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', healthClassName)}>{healthLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-neutral-200 bg-white/75 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Completion</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{completionRate}%</p>
          <p className="text-[11px] text-neutral-500">{completed} completed</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white/75 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Exceptions</p>
          <p className="mt-1 text-lg font-semibold text-red-700">{exceptionRate}%</p>
          <p className="text-[11px] text-neutral-500">{exceptions} cancelled/no-show</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white/75 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Avg/day</p>
          <p className="mt-1 text-lg font-semibold text-neutral-950">{avgDailyBookings.toFixed(1)}</p>
          <p className="text-[11px] text-neutral-500">{totalBookings} bookings</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white/75 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Rev/booking</p>
          <p className="mt-1 text-lg font-semibold text-[#9f5529]">INR {INR.format(revenuePerBooking)}</p>
          <p className="text-[11px] text-neutral-500">{openQueue} still open</p>
        </div>
      </div>
    </div>
  );
}