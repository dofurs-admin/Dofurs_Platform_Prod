import { describe, expect, it } from 'vitest';
import { getRateLimitKey, isRateLimited } from './rate-limit';

describe('rate limiter', () => {
  it('limits after max requests in same window', () => {
    const key = getRateLimitKey('test-scope', `user-${Date.now()}`);

    const first = isRateLimited(key, { windowMs: 10_000, maxRequests: 2 });
    const second = isRateLimited(key, { windowMs: 10_000, maxRequests: 2 });
    const third = isRateLimited(key, { windowMs: 10_000, maxRequests: 2 });

    expect(first.limited).toBe(false);
    expect(second.limited).toBe(false);
    expect(third.limited).toBe(true);
  });
});
