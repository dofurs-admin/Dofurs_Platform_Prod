import type { BookingStatus } from './types';

export function bookingTimelineLabel(status: BookingStatus) {
  if (status === 'pending') {
    return 'Created → Pending confirmation';
  }

  if (status === 'confirmed') {
    return 'Created → Confirmed';
  }

  if (status === 'completed') {
    return 'Created → Confirmed → Completed';
  }

  if (status === 'no_show') {
    return 'Created → Confirmed → No-show';
  }

  return 'Created → Cancelled';
}

export function bookingStatusTone(status: BookingStatus) {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  if (status === 'cancelled' || status === 'no_show') {
    return 'critical';
  }

  return 'info';
}