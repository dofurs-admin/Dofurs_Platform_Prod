'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type DataPoint = { date: string; revenue: number };

type Props = {
  data: DataPoint[];
};

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const CURRENCY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function RevenueChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-neutral-900">Revenue (Paid Invoices)</p>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top: 4, right: 2, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e39a5d" stopOpacity={0.34} />
              <stop offset="95%" stopColor="#e39a5d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5ece4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 9, fill: '#8a8178' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: '#8a8178' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
          <Tooltip
            labelFormatter={(v) => String(v)}
            formatter={(v) => [CURRENCY.format(Number(v ?? 0)), 'Revenue']}
            cursor={{ stroke: '#e39a5d', strokeWidth: 1 }}
            contentStyle={{ border: '1px solid #ead7c8', borderRadius: 10, boxShadow: '0 10px 24px rgba(31,31,31,0.08)', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#cf8347" strokeWidth={1.8} fill="url(#revenueGrad)" activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
