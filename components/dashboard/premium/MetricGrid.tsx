'use client';

interface MetricGridProps {
  items: Array<{
    id: string;
    label: string;
    value: number | string;
  }>;
  columns?: number;
}

export default function MetricGrid({ items, columns = 3 }: MetricGridProps) {
  const colClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'lg:grid-cols-6',
  }[columns] || 'sm:grid-cols-3';

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-sm transition-all duration-150 ease-out hover:shadow-md hover:-translate-y-0.5"
        >
          <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">{item.label}</p>
          <p className="mt-3 text-2xl font-bold text-neutral-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
