'use client';

// ── Booking-flow session telemetry (client side, Phase 3) ─────────────────────
//
// The public booking flow reports its progress so unfinished flows become
// "abandoned booking" hot leads in the CRM after the sweep runs. Reporting is
// best-effort: failures are swallowed and never affect the booking itself.

const SESSION_KEY_STORAGE = 'dofurs.booking.sessionKey';

export type BookingProgressStage = 'pet-service' | 'datetime' | 'review' | 'booked';

export function getBookingSessionKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    let key = window.sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!key || !/^[0-9a-f-]{16,64}$/i.test(key)) {
      key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.sessionStorage.setItem(SESSION_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return '';
  }
}

export function reportBookingProgress(payload: {
  stage: BookingProgressStage;
  service?: string | null;
  petCount?: number | null;
  preferredDate?: string | null;
  area?: string | null;
  bookingId?: number | null;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const sessionKey = getBookingSessionKey();
  if (!sessionKey) {
    return;
  }

  try {
    void fetch('/api/crm/booking-progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ sessionKey, ...payload }),
    }).catch(() => {
      // Best-effort telemetry — never surface to the customer.
    });
  } catch {
    // Ignore storage/network failures.
  }
}
