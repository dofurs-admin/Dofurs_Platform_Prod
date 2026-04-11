import { describe, expect, it } from 'vitest';
import { getInactivityTimeoutMs, isInactivityExpired } from './inactivity';

describe('inactivity session timeout', () => {
  it('enforces a 20-minute timeout window', () => {
    expect(getInactivityTimeoutMs()).toBe(20 * 60 * 1000);
  });

  it('does not expire when there has not been 20 minutes of inactivity', () => {
    const now = 1_000_000;
    const nineteenMinutesAgo = now - (19 * 60 * 1000);

    expect(isInactivityExpired(nineteenMinutesAgo, now)).toBe(false);
  });

  it('expires when inactivity exceeds 20 minutes', () => {
    const now = 2_000_000;
    const twentyOneMinutesAgo = now - (21 * 60 * 1000);

    expect(isInactivityExpired(twentyOneMinutesAgo, now)).toBe(true);
  });
});
