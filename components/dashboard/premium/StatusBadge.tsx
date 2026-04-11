'use client';

import { cn } from '@/lib/design-system';

interface StatusBadgeProps {
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  className?: string;
  showDot?: boolean;
  /** When 'user', pending is displayed as "Confirmed" (green). */
  viewerRole?: 'user' | 'provider' | 'admin';
}

export default function StatusBadge({ status, className = '', showDot = true, viewerRole }: StatusBadgeProps) {
  const displayStatus = viewerRole === 'user' && status === 'pending' ? 'confirmed' : status;

  const statusConfig = {
    pending: {
      label: 'Pending',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    confirmed: {
      label: 'Confirmed',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    completed: {
      label: 'Completed',
      bg: 'bg-neutral-100',
      border: 'border-neutral-200',
      text: 'text-neutral-700',
      dot: 'bg-neutral-500',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      dot: 'bg-red-500',
    },
    no_show: {
      label: 'No Show',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      dot: 'bg-orange-500',
    },
  };

  const config = statusConfig[displayStatus];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ease-out',
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />}
      {config.label}
    </span>
  );
}
