import { z } from 'zod';

const noHtmlChars = (val: string) => !/<|>|&lt;|&gt;|javascript:/i.test(val);

export const basicProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods').optional(),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number')
    .optional(),
  profile_photo_url: z.string().trim().max(500).nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
  gender: z.string().trim().max(40).nullable().optional(),
});

export const householdProfileUpdateSchema = z.object({
  total_pets: z.number().int().min(0).optional(),
  first_pet_owner: z.boolean().optional(),
  years_of_pet_experience: z.number().int().min(0).nullable().optional(),
  lives_in: z.string().trim().max(120).nullable().optional(),
  has_other_pets: z.boolean().optional(),
  number_of_people_in_house: z.number().int().min(1).nullable().optional(),
  has_children: z.boolean().optional(),
});

export const userAddressSchema = z.object({
  label: z.enum(['Home', 'Office', 'Other']).nullable().optional(),
  address_line_1: z
    .string()
    .trim()
    .min(3)
    .max(250)
    .refine(noHtmlChars, { message: 'Address must not contain HTML or script characters' }),
  address_line_2: z
    .string()
    .trim()
    .max(250)
    .refine((v) => !v || noHtmlChars(v), { message: 'Address must not contain HTML or script characters' })
    .nullable()
    .optional(),
  city: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine(noHtmlChars, { message: 'City must not contain HTML or script characters' }),
  state: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine(noHtmlChars, { message: 'State must not contain HTML or script characters' }),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Pincode must be a valid 6-digit Indian pincode'),
  country: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine(noHtmlChars, { message: 'Country must not contain HTML or script characters' }),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().trim().regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format').nullable().optional(),
  is_default: z.boolean().optional(),
});

export const userAddressPatchSchema = userAddressSchema.partial();

export const userEmergencyContactSchema = z.object({
  contact_name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),
  relationship: z.string().trim().max(80).nullable().optional(),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number'),
  is_primary: z.boolean().optional(),
});

export const userEmergencyContactPatchSchema = userEmergencyContactSchema.partial();

export const userPreferencesSchema = z.object({
  preferred_service_time: z.string().trim().max(80).nullable().optional(),
  preferred_groomer_gender: z.string().trim().max(40).nullable().optional(),
  communication_preference: z.enum(['call', 'whatsapp', 'app']).nullable().optional(),
  special_instructions: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Instructions must not contain HTML or script characters' })
    .nullable()
    .optional(),
  preferred_payment_method: z.enum(['razorpay', 'upi', 'card', 'netbanking', 'wallet', 'cash']).nullable().optional(),
  preferred_upi_vpa: z.string().trim().max(120).nullable().optional(),
  billing_email: z.string().trim().email().max(320).nullable().optional(),
});

export const adminVerificationUpdateSchema = z.object({
  is_phone_verified: z.boolean().optional(),
  is_email_verified: z.boolean().optional(),
  kyc_status: z.enum(['not_submitted', 'pending', 'verified', 'rejected']).optional(),
  government_id_type: z.string().trim().max(80).nullable().optional(),
  id_document_url: z.string().trim().max(500).nullable().optional(),
});

export const adminReputationUpdateSchema = z.object({
  cancellation_rate: z.number().min(0).optional(),
  late_cancellation_count: z.number().int().min(0).optional(),
  no_show_count: z.number().int().min(0).optional(),
  average_rating: z.number().min(0).optional(),
  total_bookings: z.number().int().min(0).optional(),
  flagged_count: z.number().int().min(0).optional(),
  is_suspended: z.boolean().optional(),
  account_status: z.enum(['active', 'flagged', 'banned']).optional(),
  risk_score: z.number().min(0).optional(),
});
