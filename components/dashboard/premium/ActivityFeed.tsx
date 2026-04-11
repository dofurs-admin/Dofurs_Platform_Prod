'use client';

interface ActivityItem {
  id: string;
  icon: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success';
}

interface ActivityFeedProps {
  items: ActivityItem[];
  emptyMessage?: string;
}

export default function ActivityFeed({
  items,
  emptyMessage = 'No recent activity',
}: ActivityFeedProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 py-8 px-4 text-center">
        <p className="text-sm text-neutral-600">{emptyMessage}</p>
      </div>
    );
  }

  const typeConfig = {
    info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {items.map((item, index) => {
        const config = typeConfig[item.type];

        return (
          <div
            key={item.id}
            className={`flex items-start gap-2.5 rounded-xl border ${config.border} ${config.bg} p-3 transition-all duration-150 ease-out sm:gap-3 sm:rounded-2xl sm:p-4`}
          >
            {/* Timeline line */}
            {index < items.length - 1 && (
              <div className="absolute left-1/2 top-full ml-0.5 h-2 w-0.5 bg-neutral-200" />
            )}

            {/* Icon */}
            <span className="mt-0.5 flex-shrink-0 text-base sm:text-xl">{item.icon}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-medium leading-snug ${config.text} sm:text-sm`}>{item.message}</p>
              <p className="mt-1 text-xs text-neutral-500">{item.timestamp}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
