import { describe, expect, it } from 'vitest';
import {
  adminProviderProfileUpdateSchema,
  adminServiceGlobalRolloutSchema,
  providerDetailsUpdateSchema,
  providerDocumentCreateSchema,
  providerDocumentPatchSchema,
  providerSelfProfileUpdateSchema,
  providerReviewsQuerySchema,
} from './validation';

describe('provider management validation', () => {
  it('validates details update payload', () => {
    const parsed = providerDetailsUpdateSchema.safeParse({
      professionalDetails: {
        license_number: 'LIC-123',
        teleconsult_enabled: true,
      },
      clinicDetails: {
        city: 'Bengaluru',
        number_of_doctors: 4,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty details payload', () => {
    const parsed = providerDetailsUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('validates document create and patch payloads', () => {
    expect(
      providerDocumentCreateSchema.safeParse({
        document_type: 'license',
        document_url: 'https://example.com/file.pdf',
      }).success,
    ).toBe(true);

    expect(
      providerDocumentPatchSchema.safeParse({
        document_url: 'https://example.com/new-file.pdf',
      }).success,
    ).toBe(true);
  });

  it('validates review query params', () => {
    const parsed = providerReviewsQuerySchema.safeParse({
      page: 2,
      pageSize: 10,
      rating: 4,
    });

    expect(parsed.success).toBe(true);
  });

  it('allows provider self-service profile updates for bio only', () => {
    const allowed = providerSelfProfileUpdateSchema.safeParse({ bio: 'Experienced small-animal clinician' });
    expect(allowed.success).toBe(true);

    const disallowed = providerSelfProfileUpdateSchema.safeParse({ profile_photo_url: 'https://example.com/photo.jpg' });
    expect(disallowed.success).toBe(true);

    if (disallowed.success) {
      expect(Object.keys(disallowed.data)).toHaveLength(0);
    }
  });

  it('validates global rollout payload with provider_types', () => {
    const parsed = adminServiceGlobalRolloutSchema.safeParse({
      service_type: 'grooming_session',
      base_price: 599,
      is_active: true,
      provider_types: ['groomer', 'clinic'],
      overwrite_existing: false,
    });

    expect(parsed.success).toBe(true);
  });

  it('validates admin provider profile payload with professional and clinic details', () => {
    const parsed = adminProviderProfileUpdateSchema.safeParse({
      name: 'Dr. Rani',
      profile_photo_url: 'https://example.com/photo.jpg',
      professional_details: {
        license_number: 'LIC-7788',
        teleconsult_enabled: true,
      },
      clinic_details: {
        registration_number: 'CLINIC-001',
        number_of_doctors: 3,
        hospitalization_available: true,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('remains backward-compatible when provider_ids is included', () => {
    const parsed = adminServiceGlobalRolloutSchema.safeParse({
      service_type: 'grooming_session',
      base_price: 599,
      is_active: true,
      provider_types: ['groomer'],
      provider_ids: [101, 202],
      overwrite_existing: true,
    });

    expect(parsed.success).toBe(true);
  });
});
