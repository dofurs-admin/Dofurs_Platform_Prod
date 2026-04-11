import { z } from 'zod';
import { PROVIDER_TYPES } from './types';

const providerTypeSchema = z.union([
  z.enum(PROVIDER_TYPES),
  z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'Custom provider type must use lowercase letters, numbers, and underscores'),
]);

export const providerProfileUpdateSchema = z.object({
  bio: z.string().trim().max(5000).nullable().optional(),
  profile_photo_url: z.string().trim().max(2000).nullable().optional(),
  years_of_experience: z.number().int().min(0).nullable().optional(),
  phone_number: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number').nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  service_radius_km: z.number().int().min(0).nullable().optional(),
});

export const providerSelfProfileUpdateSchema = providerProfileUpdateSchema.pick({
  bio: true,
});

export const createProviderSchema = z.object({
  provider_type: providerTypeSchema,
  is_individual: z.boolean(),
  business_name: z.string().trim().max(255).nullable().optional(),
  profile_photo_url: z.string().trim().max(2000).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  years_of_experience: z.number().int().min(0).nullable().optional(),
  phone_number: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number').nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  service_radius_km: z.number().int().min(0).nullable().optional(),
  professional_details: z
    .object({
      license_number: z.string().trim().max(120).nullable().optional(),
      specialization: z.string().trim().max(255).nullable().optional(),
      teleconsult_enabled: z.boolean().optional(),
      emergency_service_enabled: z.boolean().optional(),
      equipment_details: z.string().trim().max(5000).nullable().optional(),
      insurance_document_url: z.string().trim().max(500).nullable().optional(),
      license_verified: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  clinic_details: z
    .object({
      registration_number: z.string().trim().max(120).nullable().optional(),
      gst_number: z.string().trim().max(120).nullable().optional(),
      address: z.string().trim().max(1000).nullable().optional(),
      city: z.string().trim().max(120).nullable().optional(),
      state: z.string().trim().max(120).nullable().optional(),
      pincode: z.string().trim().max(30).nullable().optional(),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
      operating_hours: z.record(z.string(), z.unknown()).nullable().optional(),
      number_of_doctors: z.number().int().min(0).nullable().optional(),
      hospitalization_available: z.boolean().optional(),
      emergency_services_available: z.boolean().optional(),
      registration_verified: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

export const providerAvailabilityItemSchema = z.object({
  id: z.string().uuid().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  end_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  is_available: z.boolean().optional(),
  slot_duration_minutes: z.number().int().positive().optional(),
  buffer_time_minutes: z.number().int().min(0).optional(),
});

export const providerAvailabilitySchema = z
  .array(providerAvailabilityItemSchema)
  .min(1)
  .superRefine((rows, context) => {
    const seen = new Set<string>();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const key = `${row.day_of_week}|${row.start_time.slice(0, 5)}|${row.end_time.slice(0, 5)}`;

      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate availability window for the same day and time.',
          path: [index],
        });
      }

      seen.add(key);
    }
  });

export const providerReviewResponseSchema = z.object({
  responseText: z.string().trim().min(1).max(3000),
});

export const providerDocumentCreateSchema = z.object({
  document_type: z.string().trim().min(1).max(120),
  document_url: z.string().trim().url().max(500),
});

export const providerDocumentPatchSchema = z
  .object({
    document_type: z.string().trim().min(1).max(120).optional(),
    document_url: z.string().trim().url().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const providerDetailsUpdateSchema = z
  .object({
    professionalDetails: z
      .object({
        license_number: z.string().trim().max(120).nullable().optional(),
        specialization: z.string().trim().max(255).nullable().optional(),
        teleconsult_enabled: z.boolean().optional(),
        emergency_service_enabled: z.boolean().optional(),
        equipment_details: z.string().trim().max(5000).nullable().optional(),
        insurance_document_url: z.string().trim().url().max(500).nullable().optional(),
      })
      .optional(),
    clinicDetails: z
      .object({
        registration_number: z.string().trim().max(120).nullable().optional(),
        gst_number: z.string().trim().max(120).nullable().optional(),
        address: z.string().trim().max(1000).nullable().optional(),
        city: z.string().trim().max(120).nullable().optional(),
        state: z.string().trim().max(120).nullable().optional(),
        pincode: z.string().trim().max(30).nullable().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        operating_hours: z.record(z.string(), z.unknown()).nullable().optional(),
        number_of_doctors: z.number().int().min(0).nullable().optional(),
        hospitalization_available: z.boolean().optional(),
        emergency_services_available: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one details section is required.',
  });

export const providerReviewsQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export const providerPricingItemSchema = z.object({
  id: z.string().uuid().optional(),
  service_type: z.string().trim().min(1).max(120),
  base_price: z.number().min(0),
  surge_price: z.number().min(0).nullable().optional(),
  commission_percentage: z.number().min(0).max(100).nullable().optional(),
  service_duration_minutes: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const providerPricingSchema = z.array(providerPricingItemSchema).min(1);

const indianPincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/);

export const adminProviderServiceRolloutItemSchema = providerPricingItemSchema
  .omit({
    base_price: true,
    surge_price: true,
    commission_percentage: true,
    service_duration_minutes: true,
  })
  .extend({
    base_price: z.number().min(0).optional(),
    surge_price: z.number().min(0).nullable().optional(),
    commission_percentage: z.number().min(0).max(100).nullable().optional(),
    service_duration_minutes: z.number().int().positive().nullable().optional(),
  service_pincodes: z.array(indianPincodeSchema).max(200).optional(),
});

export const adminProviderServiceRolloutSchema = z.array(adminProviderServiceRolloutItemSchema).min(1);

export const adminServiceGlobalToggleSchema = z.object({
  service_type: z.string().trim().min(1).max(120),
  is_active: z.boolean(),
});

export const adminServiceGlobalRolloutSchema = z.object({
  service_type: z.string().trim().min(1).max(120),
  base_price: z.number().min(0),
  surge_price: z.number().min(0).nullable().optional(),
  commission_percentage: z.number().min(0).max(100).nullable().optional(),
  service_duration_minutes: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
  service_pincodes: z.array(indianPincodeSchema).max(200).optional(),
  provider_types: z.array(providerTypeSchema).max(PROVIDER_TYPES.length).optional(),
  provider_ids: z.array(z.number().int().positive()).max(2000).optional(),
  overwrite_existing: z.boolean().optional(),
});

export const adminProviderLocationUpdateSchema = z
  .object({
    address: z.string().trim().max(500).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    state: z.string().trim().max(120).nullable().optional(),
    pincode: indianPincodeSchema.nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    service_radius_km: z.number().min(0).max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  })
  .superRefine((value, context) => {
    const hasLatitude = Object.prototype.hasOwnProperty.call(value, 'latitude');
    const hasLongitude = Object.prototype.hasOwnProperty.call(value, 'longitude');

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'latitude and longitude must be provided together.',
        path: hasLatitude ? ['longitude'] : ['latitude'],
      });
    }

    const coordinatesProvided = value.latitude !== null && value.latitude !== undefined;

    if (coordinatesProvided) {
      const hasAddress = typeof value.address === 'string' && value.address.trim().length > 0;
      const hasCity = typeof value.city === 'string' && value.city.trim().length > 0;
      const hasState = typeof value.state === 'string' && value.state.trim().length > 0;
      const hasPincode = typeof value.pincode === 'string' && value.pincode.trim().length > 0;

      if (!hasAddress || !hasCity || !hasState || !hasPincode) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'address, city, state, and pincode are required when coordinates are provided.',
          path: ['address'],
        });
      }
    }
  });

// Admin-only schema: intentionally permissive so admins can edit existing
// provider records regardless of the format they were originally stored in.
export const adminProviderProfileUpdateSchema = z
  .object({
    // No character-class regex — provider/business names vary widely.
    name: z.string().trim().min(2).max(255).optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    // Accept any non-empty string — admin may need to correct non-standard types.
    provider_type: z.string().trim().min(1).max(120).optional(),
    business_name: z.string().trim().max(255).nullable().optional(),
    profile_photo_url: z.string().trim().max(2000).nullable().optional(),
    service_radius_km: z.number().min(0).max(500).nullable().optional(),
    professional_details: z
      .object({
        license_number: z.string().trim().max(120).nullable().optional(),
        specialization: z.string().trim().max(255).nullable().optional(),
        teleconsult_enabled: z.boolean().optional(),
        emergency_service_enabled: z.boolean().optional(),
        equipment_details: z.string().trim().max(5000).nullable().optional(),
        // No .url() — stored values may be storage paths, not full URLs.
        insurance_document_url: z.string().trim().max(500).nullable().optional(),
      })
      .optional(),
    clinic_details: z
      .object({
        registration_number: z.string().trim().max(120).nullable().optional(),
        gst_number: z.string().trim().max(120).nullable().optional(),
        number_of_doctors: z.number().int().min(0).nullable().optional(),
        hospitalization_available: z.boolean().optional(),
        emergency_services_available: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const discountTypeSchema = z.enum(['percentage', 'flat']);

const adminDiscountBaseSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  discount_type: discountTypeSchema,
  discount_value: z.number().positive(),
  max_discount_amount: z.number().positive().nullable().optional(),
  min_booking_amount: z.number().min(0).nullable().optional(),
  applies_to_service_type: z.string().trim().min(1).max(120).nullable().optional(),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime().nullable().optional(),
  usage_limit_total: z.number().int().positive().nullable().optional(),
  usage_limit_per_user: z.number().int().positive().nullable().optional(),
  first_booking_only: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const adminDiscountUpsertSchema = adminDiscountBaseSchema
  .superRefine((value, context) => {
    if (value.discount_type === 'percentage' && value.discount_value > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage discount cannot exceed 100.',
        path: ['discount_value'],
      });
    }

    if (value.valid_until && new Date(value.valid_until).getTime() <= new Date(value.valid_from).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'valid_until must be later than valid_from.',
        path: ['valid_until'],
      });
    }
  });

export const adminDiscountPatchSchema = adminDiscountBaseSchema
  .partial()
  .omit({ code: true })
  .superRefine((value, context) => {
    if (
      value.discount_type === 'percentage' &&
      value.discount_value !== undefined &&
      value.discount_value > 100
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage discount cannot exceed 100.',
        path: ['discount_value'],
      });
    }

    if (value.valid_from && value.valid_until) {
      if (new Date(value.valid_until).getTime() <= new Date(value.valid_from).getTime()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'valid_until must be later than valid_from.',
          path: ['valid_until'],
        });
      }
    }
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const verifyDocumentSchema = z.object({
  verificationStatus: z.enum(['pending', 'approved', 'rejected']),
});
