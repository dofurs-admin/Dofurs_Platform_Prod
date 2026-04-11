import type { Booking } from './types';

export function resolveBookingStatus(booking: Booking): Booking['status'] {
  return booking.booking_status ?? booking.status;
}

/**
 * Maps internal booking status to user-facing display status.
 * Users should see "confirmed" instead of "pending" — the pending state
 * (awaiting provider acceptance) is an operational detail only relevant
 * to providers and admins.
 */
export function userDisplayStatus(status: Booking['status']): Booking['status'] {
  return status === 'pending' ? 'confirmed' : status;
}

export function normalizeBookingRecord(booking: Booking): Booking {
  const effectiveStatus = booking.booking_status ?? booking.status ?? 'pending';
  const walletCreditsAppliedInr = Number(booking.wallet_credits_applied_inr ?? 0);
  const rawAmount = Number(booking.amount ?? 0);
  const fallbackAmount = Number((booking as Booking & { price_at_booking?: number | null }).price_at_booking ?? 0);
  const effectiveAmountSource =
    Number.isFinite(rawAmount) && rawAmount >= 0
      ? rawAmount
      : Number.isFinite(fallbackAmount) && fallbackAmount >= 0
        ? fallbackAmount
        : NaN;
  const normalizedAmount =
    Number.isFinite(effectiveAmountSource)
      ? Math.max(0, effectiveAmountSource - (Number.isFinite(walletCreditsAppliedInr) ? walletCreditsAppliedInr : 0))
      : booking.amount;

  return {
    ...booking,
    amount: normalizedAmount,
    status: effectiveStatus,
    booking_status: booking.booking_status ?? effectiveStatus,
  };
}

export function resolveProviderName(providers: Booking['providers']): string | undefined {
  if (!providers) return undefined;
  if (Array.isArray(providers)) return providers[0]?.name;
  return providers.name;
}

export function bookingStatusMeta(status: Booking['status']) {
  if (status === 'confirmed') {
    return {
      label: 'Confirmed',
      toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dotClass: 'bg-emerald-500',
    };
  }

  if (status === 'pending') {
    return {
      label: 'Pending Confirmation',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
      dotClass: 'bg-amber-500',
    };
  }

  if (status === 'completed') {
    return {
      label: 'Completed',
      toneClass: 'border-blue-200 bg-blue-50 text-blue-700',
      dotClass: 'bg-blue-500',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
      dotClass: 'bg-rose-500',
    };
  }

  return {
    label: 'No Show',
    toneClass: 'border-neutral-200 bg-neutral-50 text-neutral-700',
    dotClass: 'bg-neutral-500',
  };
}

const BOOKING_DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const BOOKING_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatBookingDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return BOOKING_DATE_FORMATTER.format(parsed);
}

export function formatBookingTime(value: string) {
  const normalized = value.trim();
  const parsed = new Date(`1970-01-01T${normalized}`);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return BOOKING_TIME_FORMATTER.format(parsed);
}

export function formatBookingTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  bookingStart: string,
) {
  if (startTime) {
    const startLabel = formatBookingTime(startTime);
    const endLabel = endTime ? formatBookingTime(endTime) : null;
    return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
  }

  const fallback = new Date(bookingStart);
  if (Number.isNaN(fallback.getTime())) {
    return bookingStart;
  }

  return BOOKING_TIME_FORMATTER.format(fallback);
}

export function formatBookingMode(value: string | null | undefined) {
  if (!value) {
    return 'Not specified';
  }

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

export function formatPaymentMode(
  value: string | null | undefined,
  options?: { walletCreditsAppliedInr?: number | null },
) {
  const walletCreditsAppliedInr = options?.walletCreditsAppliedInr ?? 0;

  if (!value) {
    return 'Not specified';
  }

  if (value === 'direct_to_provider') {
    return 'Cash will be collected';
  }
  if (value === 'subscription_credit') {
    return 'Paid by Subscription Credits';
  }
  if (value === 'platform') {
    return walletCreditsAppliedInr > 0 ? 'Paid partly by Dofurs Credits and Razorpay' : 'Paid with Razorpay';
  }
  if (value === 'mixed') {
    return walletCreditsAppliedInr > 0
      ? 'Paid partly by Dofurs Credits and Razorpay'
      : 'Split payment';
  }

  return value.replace(/_/g, ' ');
}

export function formatBookingAmount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not available';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}
