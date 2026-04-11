/**
 * Form system centralized exports
 * 
 * This index file provides clean imports for the entire form system:
 * 
 * @example
 * // Import hooks
 * import { useAsyncForm, useDependentField } from '@/lib/forms';
 * 
 * // Import validators and schemas
 * import { validators, schemas, optional, nullable } from '@/lib/forms';
 */

// Re-export hooks
export { useAsyncForm, useDependentField, useAsyncFieldValidator } from './hooks';

// Re-export validators and schemas
export {
  validators,
  schemas,
  optional,
  nullable,
  conditional,
  contactFormSchema,
  registrationFormSchema,
  addressFormSchema,
  type ContactFormData,
  type RegistrationFormData,
  type AddressFormData,
} from './validation';
