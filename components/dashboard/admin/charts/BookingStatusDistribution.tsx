'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

function labelify(s: string) { return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function BookingStatusDistribution({ data }: Props) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-neutral-900 mb-4">Booking Status Distribution</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={false}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#d4b896'} />
            ))}
          </Pie>
          <Tooltip formatter={(v, name) => [Number(v ?? 0), labelify(String(name))]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend formatter={labelify} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
