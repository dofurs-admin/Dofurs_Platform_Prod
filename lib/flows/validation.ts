import { z } from 'zod';
import { getISTDateString } from '@/lib/utils/date';

const noHtmlChars = (val: string) => !/<|>|&lt;|&gt;|javascript:/i.test(val);

function normalizePhoneForE164(rawPhone: string) {
  const trimmed = rawPhone.trim();

  if (!trimmed) {
    return '';
  }

  // Accept mobile autofill separators while preserving strict E.164 semantics.
  const compact = trimmed.replace(/[\s()-]+/g, '');

  if (compact.startsWith('00')) {
    return `+${compact.slice(2)}`;
  }

  return compact;
}

export const ownerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),
  email: z.string().trim().email('Invalid email address').max(200),
  phone: z.preprocess(
    (value) => (typeof value === 'string' ? normalizePhoneForE164(value) : value),
    z.string().regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number'),
  ),
  address: z.string().trim().min(5).max(300),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other']),
});

export const authSignupSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),
  email: z.string().trim().email('Invalid email address').max(200),
  phone: z.preprocess(
    (value) => (typeof value === 'string' ? normalizePhoneForE164(value) : value),
    z.string().regex(/^\+91\d{10}$/, 'Invalid phone number'),
  ),
  referralCode: z
    .string()
    .trim()
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'Invalid referral code format')
    .optional()
    .nullable(),
});

const bookingBaseSchema = z.object({
  petId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (val) => val >= getISTDateString(),
    { message: 'Booking date cannot be in the past' },
  ),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  bookingMode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']),
  locationAddress: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Location address must not contain HTML or script characters' })
    .nullable()
    .optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  providerNotes: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Notes must not contain HTML or script characters' })
    .nullable()
    .optional(),
  bookingUserId: z.string().uuid().optional(),
  discountCode: z.string().trim().max(40).optional(),
  addOns: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().positive().max(20),
      }),
    )
    .optional(),
  useSubscriptionCredit: z.boolean().optional(),
  walletCreditsAppliedInr: z.number().int().min(0).max(100_000).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Invalid 6-digit Indian pincode').optional(),
  boardingEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const serviceBookingCreateSchema = bookingBaseSchema
  .extend({
    bookingType: z.literal('service').optional(),
    providerServiceId: z.string().uuid(),
  })
  .superRefine((data, ctx) => {
    if (data.bookingMode === 'home_visit') {
      if (!data.locationAddress?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locationAddress'], message: 'Location address is required for home visits.' });
      }
      if (data.latitude == null || !Number.isFinite(data.latitude)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Latitude is required for home visits.' });
      }
      if (data.longitude == null || !Number.isFinite(data.longitude)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['longitude'], message: 'Longitude is required for home visits.' });
      }
    }
  });

export const bookingCreateSchema = serviceBookingCreateSchema;

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  providerNotes: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Notes must not contain HTML or script characters' })
    .optional(),
  cancellationReason: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Cancellation reason must not contain HTML or script characters' })
    .optional(),
});
