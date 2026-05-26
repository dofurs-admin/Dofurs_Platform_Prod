import { describe, expect, it } from 'vitest';
import {
  buildBookingConfirmationPath,
  createBookingThankYouSession,
  parseBookingThankYouSession,
  serializeBookingThankYouSession,
} from './thank-you-session';

describe('booking thank-you session', () => {
  it('serializes a positive booking id with a stable confirmation path', () => {
    const serialized = serializeBookingThankYouSession(249, 1_000);

    expect(serialized).toBe(JSON.stringify({
      bookingId: 249,
      createdAt: 1_000,
      confirmationPath: '/forms/customer-booking/confirmation/249',
    }));
    expect(parseBookingThankYouSession(serialized, 1_000)).toEqual({
      bookingId: 249,
      createdAt: 1_000,
      confirmationPath: '/forms/customer-booking/confirmation/249',
    });
  });

  it('rejects invalid booking ids', () => {
    expect(createBookingThankYouSession(0, 1_000)).toBeNull();
    expect(createBookingThankYouSession(-12, 1_000)).toBeNull();
    expect(parseBookingThankYouSession(JSON.stringify({ bookingId: '249', createdAt: 1_000 }), 1_000)).toBeNull();
  });

  it('rejects malformed and stale session values', () => {
    expect(parseBookingThankYouSession('not-json', 1_000)).toBeNull();
    expect(parseBookingThankYouSession(JSON.stringify({ bookingId: 249, createdAt: 1_000 }), 1_000 + 600_001)).toBeNull();
    expect(parseBookingThankYouSession(JSON.stringify({ bookingId: 249, createdAt: 1_000 + 60_001 }), 1_000)).toBeNull();
  });

  it('does not trust a stored confirmation path', () => {
    const parsed = parseBookingThankYouSession(
      JSON.stringify({ bookingId: 7, createdAt: 1_000, confirmationPath: 'https://example.com' }),
      1_000,
    );

    expect(parsed?.confirmationPath).toBe(buildBookingConfirmationPath(7));
  });
});