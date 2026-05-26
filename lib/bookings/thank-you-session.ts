export const BOOKING_THANK_YOU_PATH = '/forms/customer-booking/thank-you';
export const BOOKING_THANK_YOU_SESSION_KEY = 'dofurs.booking.thankYou.bookingId';
export const BOOKING_THANK_YOU_SESSION_TTL_MS = 10 * 60 * 1000;

export type BookingThankYouSession = {
  bookingId: number;
  createdAt: number;
  confirmationPath: string;
};

export function buildBookingConfirmationPath(bookingId: number) {
  return `/forms/customer-booking/confirmation/${bookingId}`;
}

function isPositiveBookingId(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export function createBookingThankYouSession(bookingId: number, now = Date.now()): BookingThankYouSession | null {
  if (!isPositiveBookingId(bookingId) || !Number.isFinite(now) || now <= 0) {
    return null;
  }

  return {
    bookingId,
    createdAt: now,
    confirmationPath: buildBookingConfirmationPath(bookingId),
  };
}

export function serializeBookingThankYouSession(bookingId: number, now = Date.now()) {
  const session = createBookingThankYouSession(bookingId, now);
  return session ? JSON.stringify(session) : null;
}

export function parseBookingThankYouSession(rawValue: string | null, now = Date.now()): BookingThankYouSession | null {
  if (!rawValue) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const bookingId = record.bookingId;
  const createdAt = record.createdAt;

  if (!isPositiveBookingId(bookingId) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return null;
  }

  if (createdAt <= 0 || createdAt > now + 60_000 || now - createdAt > BOOKING_THANK_YOU_SESSION_TTL_MS) {
    return null;
  }

  return {
    bookingId,
    createdAt,
    confirmationPath: buildBookingConfirmationPath(bookingId),
  };
}