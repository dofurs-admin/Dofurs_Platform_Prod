// Date/time/currency formatting utilities for the provider dashboard

import type { ProviderBooking } from './providerTypes';

const PROVIDER_DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const PROVIDER_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const PROVIDER_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const PROVIDER_CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatProviderDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return PROVIDER_DATE_FORMATTER.format(parsed);
}

export function formatProviderTime(value: string) {
  const parsed = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return PROVIDER_TIME_FORMATTER.format(parsed);
}

export function formatProviderDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return PROVIDER_DATE_TIME_FORMATTER.format(parsed);
}

export function formatProviderBookingDateTime(booking: ProviderBooking) {
  const dateLabel = formatProviderDate(booking.booking_date);
  const compactDateLabel = formatProviderDate(booking.booking_date).replace(/^[A-Za-z]{3},\s*/, '');
  const startLabel = formatProviderTime(booking.start_time);
  const endLabel = formatProviderTime(booking.end_time);
  return {
    full: `${dateLabel} • ${startLabel} - ${endLabel}`,
    compact: `${compactDateLabel} • ${startLabel}-${endLabel}`,
  };
}

export function formatProviderMode(value: ProviderBooking['booking_mode']) {
  if (value === 'home_visit') {
    return 'Home visit';
  }
  if (value === 'clinic_visit') {
    return 'Clinic visit';
  }
  return 'Teleconsult';
}

export function formatProviderAmount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not available';
  }
  return PROVIDER_CURRENCY_FORMATTER.format(value);
}
