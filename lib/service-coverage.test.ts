import { describe, expect, it } from 'vitest';
import {
  BENGALURU_CITY_COVERAGE_PINCODE,
  hasServiceCoverageForPincode,
  serviceCoveragePincodeMatches,
} from './service-coverage';

describe('service coverage presets', () => {
  it('matches exact configured pincodes', () => {
    expect(serviceCoveragePincodeMatches('560034', '560034')).toBe(true);
    expect(serviceCoveragePincodeMatches('560034', '560035')).toBe(false);
  });

  it('matches Bengaluru city coverage marker against 560-series pincodes', () => {
    expect(serviceCoveragePincodeMatches(BENGALURU_CITY_COVERAGE_PINCODE, '560034')).toBe(true);
    expect(serviceCoveragePincodeMatches(BENGALURU_CITY_COVERAGE_PINCODE, '562125')).toBe(false);
  });

  it('checks marker and exact rows in coverage lists', () => {
    expect(hasServiceCoverageForPincode(['560034', BENGALURU_CITY_COVERAGE_PINCODE], '560102')).toBe(true);
    expect(hasServiceCoverageForPincode(['560034'], '560102')).toBe(false);
  });
});