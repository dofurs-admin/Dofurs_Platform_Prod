'use client';

export type BookingTimelineStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

type TimelineStep = {
  status: BookingTimelineStatus;
  label: string;
  description: string;
  icon: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  { status: 'pending', label: 'Booked', description: 'Your request has been submitted', icon: '📋' },
  { status: 'confirmed', label: 'Confirmed', description: 'Provider has accepted the booking', icon: '✅' },
  { status: 'completed', label: 'Completed', description: 'Service has been delivered', icon: '🌟' },
];

const STATUS_ORDER: Record<BookingTimelineStatus, number> = {
  pending: 0,
  confirmed: 1,
  completed: 2,
  cancelled: -1,
  no_show: -1,
};

type BookingStatusTimelineProps = {
  status: BookingTimelineStatus;
  bookingDate?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
};

export default function BookingStatusTimeline({
  status,
  bookingDate,
  confirmedAt,
  completedAt,
  cancelledAt,
}: BookingStatusTimelineProps) {
  const currentOrder = STATUS_ORDER[status];
  const isCancelled = status === 'cancelled' || status === 'no_show';

  const timestamps: Record<string, string | undefined> = {
    pending: bookingDate,
    confirmed: confirmedAt,
    completed: completedAt,
  };

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <span className="text-xl">❌</span>
        <div>
          <p className="text-sm font-semibold text-rose-700">
            {status === 'cancelled' ? 'Booking Cancelled' : 'No Show'}
          </p>
          {cancelledAt && (
            <p className="mt-0.5 text-xs text-rose-500">{cancelledAt}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {TIMELINE_STEPS.map((step, idx) => {
        const stepOrder = STATUS_ORDER[step.status];
        const isDone = currentOrder > stepOrder;
        const isActive = currentOrder === stepOrder;
        const isPending = currentOrder < stepOrder;

        return (
          <div key={step.status} className="flex gap-4">
            {/* Connector + icon column */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-all ${
                  isDone
                    ? 'border-emerald-400 bg-emerald-400 text-white'
                    : isActive
                      ? 'border-coral bg-coral text-white shadow-[0_0_0_4px_rgba(228,154,87,0.2)]'
                      : 'border-neutral-300 bg-white text-neutral-400'
                }`}
              >
                {isDone ? '✓' : step.icon}
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div
                  className={`mt-1 h-8 w-0.5 ${
                    isDone ? 'bg-emerald-300' : 'bg-neutral-200'
                  }`}
                />
              )}
            </div>

            {/* Text column */}
            <div className={`pb-6 pt-1 ${isPending ? 'opacity-40' : ''}`}>
              <p className={`text-sm font-semibold ${isActive ? 'text-coral' : isDone ? 'text-neutral-900' : 'text-neutral-500'}`}>
                {step.label}
              </p>
              <p className="text-xs text-neutral-500">{step.description}</p>
              {timestamps[step.status] && (
                <p className="mt-0.5 text-[11px] text-neutral-400">{timestamps[step.status]}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
