'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

type DataPoint = { status: string; count: number };

type Props = {
  data: DataPoint[];
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
  no_show: '#6b7280',
};

const STATUS_DOT_CLASSES: Record<string, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  no_show: 'bg-neutral-500',
};

function labelify(s: string) { return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function BookingStatusDistribution({ data }: Props) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-900">Booking Status Distribution</p>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-coral">{total} total</span>
      </div>
      <ResponsiveContainer width="100%" height={138}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={2} label={false}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#d4b896'} />
            ))}
          </Pie>
          <Tooltip formatter={(v, name) => [Number(v ?? 0), labelify(String(name))]} contentStyle={{ border: '1px solid #ead7c8', borderRadius: 10, boxShadow: '0 10px 24px rgba(31,31,31,0.08)', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-neutral-600">
        {data.map((entry) => (
          <div key={entry.status} className="flex min-w-0 items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[entry.status] ?? 'bg-[#d4b896]'}`} />
            <span className="truncate">{labelify(entry.status)}</span>
            <span className="ml-auto font-semibold text-neutral-800">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
