'use client';

import { useRouter } from 'next/navigation';
import StatusBadge from './StatusBadge';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/design-system';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

interface BookingCardProps {
  id: number;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  bookingStart: string;
  serviceName?: string;
  petName?: string;
  providerName?: string;
  bookingMode?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  onCancel?: (bookingId: number) => void;
  onViewDetails?: (bookingId: number) => void;
  detailsHref?: string;
  isCancelling?: boolean;
  isHighlighted?: boolean;
  className?: string;
  /** When 'user', pending is displayed as "Confirmed". */
  viewerRole?: 'user' | 'provider' | 'admin';
}

export default function BookingCard({
  id,
  bookingDate,
  startTime,
  endTime,
  bookingStart,
  serviceName,
  petName,
  providerName,
  bookingMode,
  status,
  onCancel,
  onViewDetails,
  detailsHref,
  isCancelling = false,
  isHighlighted = false,
  className,
  viewerRole,
}: BookingCardProps) {
  const router = useRouter();

  function formatDateLabel(value: string) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return DATE_FORMATTER.format(parsed);
    }

    return value;
  }

  function formatTimeLabel(value: string) {
    const normalized = value.trim();
    const parsed = new Date(`1970-01-01T${normalized}`);
    if (!Number.isNaN(parsed.getTime())) {
      return TIME_FORMATTER.format(parsed);
    }

    return normalized;
  }

  function formatModeLabel(value: string) {
    if (value === 'home_visit') {
      return 'Home visit';
    }
    if (value === 'clinic_visit') {
      return 'Clinic visit';
    }
    if (value === 'teleconsult') {
      return 'Teleconsult';
    }

    return value.replace(/_/g, ' ');
  }

  // Format datetime
  const formatDateTime = () => {
    const dateLabel = bookingDate ? formatDateLabel(bookingDate) : formatDateLabel(bookingStart);

    if (startTime) {
      const startLabel = formatTimeLabel(startTime);
      const endLabel = endTime ? formatTimeLabel(endTime) : null;
      const endTimeStr = endLabel ? ` - ${endLabel}` : '';
      return `${dateLabel} • ${startLabel}${endTimeStr}`;
    }

    const fallback = new Date(bookingStart);
    if (!Number.isNaN(fallback.getTime())) {
      return `${DATE_FORMATTER.format(fallback)} • ${TIME_FORMATTER.format(fallback)}`;
    }

    return bookingStart;
  };

  const isActive = status === 'pending' || status === 'confirmed';
  const resolvedDetailsHref = detailsHref ?? `/dashboard/user?view=operations&booking=${id}`;

  function handleViewDetails() {
    if (onViewDetails) {
      onViewDetails(id);
      return;
    }

    router.push(resolvedDetailsHref);
  }

  return (
    <div
      data-booking-id={id}
      className={cn(
        'card card-interactive group relative overflow-hidden border border-[#e7ceb9] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_68%,#fff7ef_100%)] p-4 shadow-[0_10px_22px_rgba(151,101,60,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(151,101,60,0.18)] sm:p-6 sm:shadow-[0_16px_34px_rgba(151,101,60,0.14)] sm:hover:shadow-[0_22px_42px_rgba(151,101,60,0.2)]',
        isHighlighted && 'ring-2 ring-brand-400/70 ring-offset-2 ring-offset-white',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f0c59f] to-transparent" aria-hidden="true" />

      {/* Header: Booking ID and Status */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1 space-y-2">
          {/* Booking Number */}
          <p className="inline-flex items-center rounded-full border border-[#ecd4bf] bg-[#fff8f2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
            Booking #{id}
          </p>

          {/* Main Details */}
          <div className="space-y-1.5">
            {/* Service / Pet / Provider */}
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {serviceName && (
                <span className="font-semibold text-neutral-950">{serviceName}</span>
              )}
              {petName && (
                <span className="rounded-full border border-[#e6cfba] bg-[#fff6ee] px-2 py-0.5 text-[11px] font-medium text-neutral-700">{petName}</span>
              )}
              {providerName && (
                <span className="text-neutral-600">by {providerName}</span>
              )}
            </div>

            {/* DateTime */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 sm:text-sm">
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{formatDateTime()}</span>
            </div>

            {/* Mode */}
            {bookingMode && (
              <p className="text-xs font-medium text-neutral-500 capitalize">
                {formatModeLabel(bookingMode)}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div>
          <StatusBadge status={status} viewerRole={viewerRole} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 sm:mt-6">
        <div className={cn('grid gap-2', isActive && onCancel ? 'grid-cols-1 sm:grid-cols-2' : '')}>
          {isActive && onCancel && (
            <Button
              variant="danger"
              size="md"
              type="button"
              fullWidth
              isLoading={isCancelling}
              disabled={isCancelling}
              className="min-h-[44px] truncate border-red-200/90 bg-red-50/90 hover:bg-red-100"
              onClick={() => onCancel(id)}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="premium"
            size="md"
            type="button"
            fullWidth
            className="min-h-[44px] truncate"
            onClick={handleViewDetails}
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}
