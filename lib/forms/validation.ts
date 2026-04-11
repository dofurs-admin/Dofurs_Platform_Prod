/**
 * Reusable Zod validation schemas for common form fields
 * 
 * Use these schemas as building blocks for your form validation.
 * Import and extend them to create your own schemas without duplication.
 */

import { z } from 'zod';

/**
 * Common field validators - use these for consistency across all forms
 */

export const validators = {
  // Text fields
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),

  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(200, 'Email must be at most 200 characters'),

  phone: z
    .string()
    .trim()
    .regex(/^[\+]?[\d\s\-\(\)]{10,}$/, 'Invalid phone number'),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  url: z
    .string()
    .trim()
    .url('Please enter a valid URL'),

  // Address fields
  address: z
    .string()
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(300, 'Address must be at most 300 characters'),

  zipCode: z
    .string()
    .trim()
    .regex(/^[0-9]{5,10}$/, 'Please enter a valid zip code'),

  // Location fields
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),

  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),

  // Numeric fields
  age: z
    .number()
    .int('Age must be a whole number')
    .min(13, 'Age must be at least 13')
    .max(120, 'Age must be less than 120'),

  price: z
    .number()
    .min(0, 'Price must be 0 or greater')
    .max(999999, 'Price is invalid'),

  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(9999, 'Quantity is too large'),

  // Date/Time fields
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)'),

  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter a valid time (HH:MM)'),

  dateTime: z
    .string()
    .datetime('Please enter a valid date and time'),

  // Other fields
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters'),

  notes: z
    .string()
    .trim()
    .max(5000, 'Notes must be at most 5000 characters'),

  termsAccepted: z
    .boolean()
    .refine((val) => val === true, 'You must accept the terms and conditions'),

  uuid: z
    .string()
    .uuid('Please provide a valid ID'),
};

/**
 * Reusable schema fragments - combine these for common form patterns
 */

export const schemas = {
  /**
   * Contact information schema - use for user profiles, inquiries, etc.
   */
  contact: z.object({
    name: validators.name,
    email: validators.email,
    phone: validators.phone,
  }),

  /**
   * Address information schema - use for delivery, location forms
   */
  address: z.object({
    address: validators.address,
    city: z
      .string()
      .trim()
      .min(2, 'City must be at least 2 characters')
      .max(50, 'City must be at most 50 characters'),
    state: z
      .string()
      .trim()
      .min(2, 'State must be at least 2 characters')
      .max(50, 'State must be at most 50 characters'),
    zipCode: validators.zipCode,
  }),

  /**
   * Location information schema - use for GPS coordinates
   */
  location: z.object({
    latitude: validators.latitude,
    longitude: validators.longitude,
  }),

  /**
   * Booking details schema - use for appointment/booking forms
   */
  booking: z.object({
    bookingDate: validators.date,
    startTime: validators.time,
    bookingMode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']),
  }),
};

/**
 * Helper function to create optional versions of validators
 * 
 * @example
 * const schema = z.object({
 *   email: validators.email,
 *   phone: optional(validators.phone),
 * });
 */
export function optional<T extends z.ZodType>(validator: T): z.ZodOptional<T> {
  return validator.optional();
}

/**
 * Helper function to create nullable versions of validators
 */
export function nullable<T extends z.ZodType>(validator: T): z.ZodNullable<T> {
  return validator.nullable();
}

/**
 * Helper function for conditional validation
 * 
 * @example
 * const schema = z.object({
 *   needsAddress: z.boolean(),
 *   address: conditional(z.boolean(), (val) => val === true, validators.address),
 * });
 */
export function conditional(
  checkValue: z.ZodType,
  condition: (val: unknown) => boolean,
  schema: z.ZodType,
): z.ZodType {
  void schema;
  return checkValue.refine(
    condition,
    {
      message: 'This field is required when condition is met',
    },
  );
}

/**
 * Example: Combining schemas into complex forms
 */

// Example 1: Simple contact form
export const contactFormSchema = z.object({
  ...schemas.contact.shape,
  message: validators.description,
  termsAccepted: validators.termsAccepted,
});

// Example 2: User registration form
export const registrationFormSchema = z.object({
  name: validators.name,
  email: validators.email,
  password: validators.password,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  phone: validators.phone,
  termsAccepted: validators.termsAccepted,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Example 3: Address form
export const addressFormSchema = z.object({
  ...schemas.address.shape,
  ...schemas.contact.shape,
  ...schemas.location.shape,
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
export type RegistrationFormData = z.infer<typeof registrationFormSchema>;
export type AddressFormData = z.infer<typeof addressFormSchema>;
