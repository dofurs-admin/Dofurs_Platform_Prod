'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type DataPoint = { date: string; bookings: number };

type Props = {
  data: DataPoint[];
};

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function BookingTrendChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-neutral-900">Booking Trend</p>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 4, right: 2, left: -26, bottom: 0 }}>
          <defs>
            <linearGradient id="bookingTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e39a5d" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#cf8347" stopOpacity={0.72} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5ece4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 9, fill: '#8a8178' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: '#8a8178' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            labelFormatter={(v) => String(v)}
            formatter={(v) => [Number(v ?? 0), 'Bookings']}
            cursor={{ fill: '#fff3e8' }}
            contentStyle={{ border: '1px solid #ead7c8', borderRadius: 10, boxShadow: '0 10px 24px rgba(31,31,31,0.08)', fontSize: 12 }}
          />
          <Bar dataKey="bookings" fill="url(#bookingTrendGrad)" maxBarSize={26} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
