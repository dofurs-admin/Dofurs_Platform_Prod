import { describe, expect, it } from 'vitest';
import { formatAddressParts, formatSavedAddress, sanitizeAddressText } from './address';

describe('address formatting', () => {
  it('dedupes overlapping segments when saved address line already contains city/state/pincode', () => {
    const formatted = formatSavedAddress({
      address_line_1: 'Smondo 3, E City, Bengaluru, Karnataka, 560100, India',
      address_line_2: 'E City',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560100',
      country: 'India',
    });

    expect(formatted).toBe('Smondo 3, E City, Bengaluru, Karnataka, 560100, India');
  });

  it('sanitizes prebuilt address strings that repeat suffix chunks', () => {
    const sanitized = sanitizeAddressText(
      'Smondo 3, E City, Bengaluru, Karnataka, 560100, India, E City, Bengaluru, Karnataka, 560100, India',
    );

    expect(sanitized).toBe('Smondo 3, E City, Bengaluru, Karnataka, 560100, India');
  });

  it('normalizes whitespace and ignores empty segments', () => {
    const formatted = formatAddressParts(['  Block A  ', '', null, 'Sector 7,  Bengaluru  ', 'sector 7']);

    expect(formatted).toBe('Block A, Sector 7, Bengaluru');
  });
});
