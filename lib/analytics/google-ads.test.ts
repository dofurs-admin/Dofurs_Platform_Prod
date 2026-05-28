import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'GOOGLE_ADS_ID',
  'NEXT_PUBLIC_GOOGLE_ADS_ID',
  'GOOGLE_ADS_BOOKING_CONVERSION_LABEL',
  'NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL',
  'BOOKING_CONVERSION_TRACKING_ENABLED',
  'NEXT_PUBLIC_BOOKING_CONVERSION_TRACKING_ENABLED',
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

async function importGoogleAdsModule(values: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  vi.resetModules();

  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, values);
  return import('./google-ads');
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const originalValue = originalEnv[key];
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }

  vi.resetModules();
});

describe('google ads analytics config', () => {
  it('keeps the Google Ads booking conversion disabled until the flag is enabled', async () => {
    const googleAds = await importGoogleAdsModule();

    expect(googleAds.GOOGLE_ADS_ID).toBe('AW-17976541101');
    expect(googleAds.GOOGLE_ADS_BOOKING_CONVERSION_LABEL).toBe('6bf3CKWwibQcEK3_8PtC');
    expect(googleAds.buildGoogleAdsBookingSendTo()).toBe('AW-17976541101/6bf3CKWwibQcEK3_8PtC');
    expect(googleAds.isBookingConversionTrackingConfigured()).toBe(false);
  });

  it('enables the booking conversion with the default Google-provided label', async () => {
    const googleAds = await importGoogleAdsModule({
      BOOKING_CONVERSION_TRACKING_ENABLED: 'true',
    });

    expect(googleAds.isBookingConversionTrackingConfigured()).toBe(true);
    expect(googleAds.buildGoogleAdsBookingSendTo()).toBe('AW-17976541101/6bf3CKWwibQcEK3_8PtC');
  });

  it('allows server-side production overrides for the account id and label', async () => {
    const googleAds = await importGoogleAdsModule({
      GOOGLE_ADS_ID: 'AW-11111111111',
      NEXT_PUBLIC_GOOGLE_ADS_ID: 'AW-22222222222',
      GOOGLE_ADS_BOOKING_CONVERSION_LABEL: 'serverLabel',
      NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL: 'publicLabel',
      NEXT_PUBLIC_BOOKING_CONVERSION_TRACKING_ENABLED: 'true',
    });

    expect(googleAds.GOOGLE_ADS_ID).toBe('AW-11111111111');
    expect(googleAds.GOOGLE_ADS_BOOKING_CONVERSION_LABEL).toBe('serverLabel');
    expect(googleAds.isBookingConversionTrackingConfigured()).toBe(true);
    expect(googleAds.buildGoogleAdsBookingSendTo()).toBe('AW-11111111111/serverLabel');
  });
});