import { describe, expect, it } from 'vitest';
import { getVisibleServiceCartCount, parseServiceCartCount } from './service-cart';

describe('parseServiceCartCount', () => {
  it('returns 0 for empty cart payload', () => {
    expect(parseServiceCartCount(null)).toBe(0);
  });

  it('falls back to serviceId when serviceCount is missing', () => {
    expect(parseServiceCartCount(JSON.stringify({ serviceId: 'svc-1' }))).toBe(1);
  });

  it('adds add-on quantities to service count', () => {
    expect(
      parseServiceCartCount(
        JSON.stringify({
          serviceCount: 1,
          addOns: [{ quantity: 2 }, { quantity: 1 }],
        }),
      ),
    ).toBe(4);
  });
});

describe('getVisibleServiceCartCount', () => {
  it('shows 0 for unauthenticated users even when cart data exists', () => {
    const cartRaw = JSON.stringify({ serviceId: 'svc-1' });

    expect(getVisibleServiceCartCount(false, cartRaw)).toBe(0);
  });

  it('shows persisted count for authenticated users', () => {
    const cartRaw = JSON.stringify({ serviceId: 'svc-1', addOns: [{ quantity: 2 }] });

    expect(getVisibleServiceCartCount(true, cartRaw)).toBe(3);
  });
});
