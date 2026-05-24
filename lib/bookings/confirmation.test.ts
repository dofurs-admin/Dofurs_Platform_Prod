import { describe, expect, it } from 'vitest';
import { getBookingConfirmationStatusLabel, toCustomerDisplayStatus } from './confirmation';

describe('toCustomerDisplayStatus', () => {
  it('shows newly created pending bookings as confirmed to customers', () => {
    expect(toCustomerDisplayStatus('pending')).toBe('confirmed');
  });

  it('preserves terminal statuses', () => {
    expect(toCustomerDisplayStatus('completed')).toBe('completed');
    expect(toCustomerDisplayStatus('cancelled')).toBe('cancelled');
    expect(toCustomerDisplayStatus('no_show')).toBe('no_show');
  });
});

describe('getBookingConfirmationStatusLabel', () => {
  it('formats customer-facing labels for confirmation headers', () => {
    expect(getBookingConfirmationStatusLabel('confirmed')).toBe('Confirmed');
    expect(getBookingConfirmationStatusLabel('in_progress')).toBe('In progress');
  });
});