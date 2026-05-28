const DEFAULT_GOOGLE_ADS_ID = 'AW-17976541101';
const DEFAULT_GOOGLE_ADS_BOOKING_CONVERSION_LABEL = '6bf3CKWwibQcEK3_8PtC';

function firstConfiguredValue(...values: Array<string | undefined>) {
  for (const candidate of values) {
    const normalized = candidate?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export const GOOGLE_ADS_ID = firstConfiguredValue(
  process.env.GOOGLE_ADS_ID,
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  DEFAULT_GOOGLE_ADS_ID,
);
export const GOOGLE_ADS_BOOKING_CONVERSION_LABEL =
  firstConfiguredValue(
    process.env.GOOGLE_ADS_BOOKING_CONVERSION_LABEL,
    process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL,
    DEFAULT_GOOGLE_ADS_BOOKING_CONVERSION_LABEL,
  );

export const BOOKING_CONVERSION_TRACKING_ENABLED =
  process.env.BOOKING_CONVERSION_TRACKING_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_BOOKING_CONVERSION_TRACKING_ENABLED === 'true';

export function isBookingConversionTrackingConfigured() {
  return BOOKING_CONVERSION_TRACKING_ENABLED && GOOGLE_ADS_BOOKING_CONVERSION_LABEL.trim().length > 0;
}

export function buildGoogleAdsBookingSendTo() {
  const label = GOOGLE_ADS_BOOKING_CONVERSION_LABEL.trim();
  return label ? `${GOOGLE_ADS_ID}/${label}` : null;
}