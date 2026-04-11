import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isValidIndianPincode, lookupPincode } from './india-pincode';

describe('isValidIndianPincode', () => {
  it('returns true for a valid 6-digit pincode', () => {
    expect(isValidIndianPincode('560034')).toBe(true);
    expect(isValidIndianPincode('110001')).toBe(true);
  });

  it('returns false for fewer than 6 digits', () => {
    expect(isValidIndianPincode('56003')).toBe(false);
  });

  it('returns false for more than 6 digits', () => {
    expect(isValidIndianPincode('5600345')).toBe(false);
  });

  it('returns false for non-numeric strings', () => {
    expect(isValidIndianPincode('abcdef')).toBe(false);
    expect(isValidIndianPincode('5600ab')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidIndianPincode('')).toBe(false);
  });
});

describe('lookupPincode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for invalid pincode without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await lookupPincode('123');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns city, state, country on successful API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ city: 'Bangalore', state: 'Karnataka', country: 'India' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await lookupPincode('560034');
    expect(result).toEqual({ city: 'Bangalore', state: 'Karnataka', country: 'India' });
  });

  it('returns null when API returns non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad Request', { status: 400 }),
    );

    const result = await lookupPincode('999999');
    expect(result).toBeNull();
  });

  it('returns null when API returns null city/state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ city: null, state: null, country: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await lookupPincode('000000');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    // Use a pincode not cached by previous tests
    const result = await lookupPincode('400001');
    expect(result).toBeNull();
  });
});
