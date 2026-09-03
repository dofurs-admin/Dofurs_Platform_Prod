import { describe, expect, it } from 'vitest';
import { getISTDateString, getISTDayBoundaryISO } from './date';

// ── IST window semantics (gaze "Today" + CRM lead windows) ─────────────────────
//
// Pins the exact bug fixed 2026-09-03: before this, date keys and window
// boundaries were computed in UTC, so between 00:00 and 05:30 IST every day
// the "Today" window silently resolved to the previous IST day.

describe('getISTDateString', () => {
  it('maps UTC instants onto the IST calendar day', () => {
    // 00:30 IST on Sep 3 is 19:00 UTC on Sep 2 → IST date key is Sep 3.
    expect(getISTDateString(new Date('2026-09-02T19:00:00.000Z'))).toBe('2026-09-03');
    // 05:29 IST on Sep 3 is 23:59 UTC on Sep 2 → still Sep 3.
    expect(getISTDateString(new Date('2026-09-02T23:59:59.000Z'))).toBe('2026-09-03');
    // 05:31 IST on Sep 3 is 00:01 UTC on Sep 3 → still Sep 3.
    expect(getISTDateString(new Date('2026-09-03T00:01:00.000Z'))).toBe('2026-09-03');
    // 00:15 IST on Sep 4 is 18:45 UTC on Sep 3 → Sep 4.
    expect(getISTDateString(new Date('2026-09-03T18:45:00.000Z'))).toBe('2026-09-04');
  });
});

describe('getISTDayBoundaryISO', () => {
  it('returns the UTC instant of IST midnight', () => {
    expect(getISTDayBoundaryISO('2026-09-03')).toBe('2026-09-02T18:30:00.000Z');
    expect(getISTDayBoundaryISO('2026-01-01')).toBe('2025-12-31T18:30:00.000Z');
  });

  it('day boundaries are exactly 24h apart (exclusive-end friendly)', () => {
    const day = Date.parse(getISTDayBoundaryISO('2026-09-03'));
    const next = Date.parse(getISTDayBoundaryISO('2026-09-04'));
    expect(next - day).toBe(24 * 60 * 60 * 1000);
  });

  it('includes a lead created just after IST midnight and excludes one just before', () => {
    const windowStart = Date.parse(getISTDayBoundaryISO('2026-09-03'));
    const windowEnd = Date.parse(getISTDayBoundaryISO('2026-09-04'));

    // Lead at 00:05 IST Sep 3 (18:35 UTC Sep 2) — inside the IST day.
    expect(Date.parse('2026-09-02T18:35:00.000Z')).toBeGreaterThanOrEqual(windowStart);
    expect(Date.parse('2026-09-02T18:35:00.000Z')).toBeLessThan(windowEnd);

    // Lead at 23:58 IST Sep 2 (18:28 UTC Sep 2) — before the IST day starts.
    expect(Date.parse('2026-09-02T18:28:00.000Z')).toBeLessThan(windowStart);
  });

  it('throws on malformed date keys', () => {
    expect(() => getISTDayBoundaryISO('not-a-date')).toThrow();
    expect(() => getISTDayBoundaryISO('')).toThrow();
  });
});
