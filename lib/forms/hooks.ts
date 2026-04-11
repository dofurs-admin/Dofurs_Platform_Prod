/**
 * Custom hooks for form handling with React Hook Form
 */

import { useCallback, useState } from 'react';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { scrollToFirstError } from '@/lib/hooks/useAutoFocusInteractive';

/**
 * Hook for handling async form submission with error handling
 * 
 * Manages loading state, error handling, and API communication.
 * Automatically catches errors and displays them to users.
 * 
 * @example
 * ```tsx
 * const form = useForm<FormData>({ resolver: zodResolver(schema) });
 * const { isSubmitting, error, handleSubmit } = useAsyncForm(form.setError);
 * 
 * const onSubmit = handleSubmit(async (data) => {
 *   const response = await api.submitForm(data);
 *   return response;
 * });
 * ```
 */
export function useAsyncForm<T extends FieldValues>(
  setError: UseFormSetError<T>,
  onSuccess?: (data: unknown) => Promise<void> | void,
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setFormError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (onSubmit: (data: T) => Promise<unknown>) => {
      return async (data: T) => {
        setIsSubmitting(true);
        setFormError(null);

        try {
          const result = await onSubmit(data);
          
          if (onSuccess) {
            await onSuccess(result);
          }
          
          return result;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'An error occurred while submitting the form';
          
          // Set general form error
          setFormError(errorMessage);
          
          // If error has field-specific details, set them
          if (typeof err === 'object' && err !== null && 'fieldErrors' in err) {
            const fieldErrors = (err as { fieldErrors?: Record<string, unknown> }).fieldErrors;
            if (fieldErrors && typeof fieldErrors === 'object') {
              Object.entries(fieldErrors).forEach(([field, message]) => {
                setError(field as Parameters<UseFormSetError<T>>[0], {
                  type: 'manual',
                  message: String(message),
                });
              });

              // Scroll to the first error field after React re-renders
              requestAnimationFrame(() => {
                setTimeout(() => scrollToFirstError(), 50);
              });
            }
          }
          
          throw err;
        } finally {
          setIsSubmitting(false);
        }
      };
    },
    [setError, onSuccess],
  );

  return {
    isSubmitting,
    error,
    handleSubmit,
    clearError: () => setFormError(null),
  };
}

/**
 * Hook for managing dependent form fields
 * 
 * When one field changes, update related fields based on custom logic.
 * Useful for cascading selects, price calculations, etc.
 * 
 * @example
 * ```tsx
 * const form = useForm<BookingData>();
 * 
 * const handleProviderChange = useDependentField(
 *   form.watch('providerId'),
 *   async (providerId) => {
 *     const services = await fetchServices(providerId);
 *     form.setValue('serviceId', '');
 *     return { availableServices: services };
 *   }
 * );
 * ```
 */
export function useDependentField<T>(
  watchValue: T,
  computeDependent: (value: T) => Promise<void> | void,
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(async () => {
    if (!watchValue) {
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await computeDependent(watchValue);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dependent data');
    } finally {
      setIsLoading(false);
    }
  }, [watchValue, computeDependent]);

  return {
    isLoading,
    error,
    handleChange,
  };
}

/**
 * Hook for form field validation with real-time feedback
 * 
 * Provides debounced validation for async validators (API checks).
 * 
 * @example
 * ```tsx
 * const checkEmailExists = useAsyncFieldValidator(
 *   async (email: string) => {
 *     const exists = await api.checkEmail(email);
 *     if (exists) throw new Error('Email already registered');
 *   },
 *   500
 * );
 * ```
 */
export function useAsyncFieldValidator(
  validator: (value: string) => Promise<void>,
  debounceMs: number = 500,
) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const validate = useCallback(
    (value: string) => {
      setIsValidating(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          await validator(value);
          setError(null);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Validation failed');
        } finally {
          setIsValidating(false);
        }
      }, debounceMs);
    },
    [validator, debounceMs],
  );

  return {
    isValidating,
    error,
    validate,
  };
}

// Add React import for useCallback and other hooks
import React from 'react';
