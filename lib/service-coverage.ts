export const BENGALURU_CITY_COVERAGE_PINCODE = '560000';
export const BENGALURU_CITY_COVERAGE_LABEL = 'Bengaluru city';
export const BENGALURU_CITY_COVERAGE_PINCODE_CSV = BENGALURU_CITY_COVERAGE_PINCODE;

const BENGALURU_CITY_PINCODE_PREFIX = /^560\d{3}$/;

export function isBengaluruCityCoveragePincode(pincode: string | null | undefined) {
  return pincode?.trim() === BENGALURU_CITY_COVERAGE_PINCODE;
}

export function serviceCoveragePincodeMatches(
  configuredPincode: string | null | undefined,
  requestedPincode: string | null | undefined,
) {
  const configured = configuredPincode?.trim() ?? '';
  const requested = requestedPincode?.trim() ?? '';

  if (!/^[1-9]\d{5}$/.test(configured) || !/^[1-9]\d{5}$/.test(requested)) {
    return false;
  }

  if (configured === requested) {
    return true;
  }

  return isBengaluruCityCoveragePincode(configured) && BENGALURU_CITY_PINCODE_PREFIX.test(requested);
}

export function hasServiceCoverageForPincode(
  configuredPincodes: Iterable<string | null | undefined>,
  requestedPincode: string | null | undefined,
) {
  for (const configuredPincode of configuredPincodes) {
    if (serviceCoveragePincodeMatches(configuredPincode, requestedPincode)) {
      return true;
    }
  }

  return false;
}

export function formatServiceCoveragePincode(pincode: string) {
  return isBengaluruCityCoveragePincode(pincode) ? BENGALURU_CITY_COVERAGE_LABEL : pincode;
}

export function formatServiceCoveragePincodes(pincodes: string[]) {
  const formatted = Array.from(new Set(pincodes.map(formatServiceCoveragePincode)));
  return formatted.join(', ');
}