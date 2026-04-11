'use client';

import React, { ReactNode } from 'react';
import { FormProvider, UseFormReturn, SubmitHandler, FieldValues } from 'react-hook-form';
import FormError from './FormError';

/**
 * Props for Form component
 */
export interface FormProps<T extends FieldValues> {
  /** React Hook Form instance from useForm() */
  form: UseFormReturn<T>;
  /** Form submission handler */
  onSubmit: SubmitHandler<T>;
  /** Form content (input fields) */
  children: ReactNode;
  /** CSS class name for form element */
  className?: string;
  /** Submit button text */
  submitButtonText?: string;
  /** Whether submit button is disabled (e.g., during submission) */
  isSubmitting?: boolean;
  /** General form error message */
  error?: string;
  /** Optional footer content before submit button */
  footer?: ReactNode;
}

/**
 * Reusable form wrapper component for React Hook Form
 * 
 * Provides FormProvider context, error handling, and consistent styling.
 * Automatically manages form submission and loading states.
 * 
 * @example
 * ```tsx
 * const form = useForm<MyFormData>({ resolver: zodResolver(mySchema) });
 * 
 * <Form
 *   form={form}
 *   onSubmit={async (data) => {
 *     await submit(data);
 *   }}
 *   submitButtonText="Create"
 * >
 *   <FormInput
 *     label="Name"
 *     registration={form.register('name')}
 *     error={form.formState.errors.name?.message}
 *   />
 *   <FormInput
 *     label="Email"
 *     type="email"
 *     registration={form.register('email')}
 *     error={form.formState.errors.email?.message}
 *   />
 * </Form>
 * ```
 */
export default function Form<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  submitButtonText = 'Submit',
  isSubmitting = false,
  error,
  footer,
}: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={`grid gap-4 ${className || ''}`}>
        {/* General form error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <FormError message={error} />
          </div>
        )}

        {/* Form fields */}
        {children}

        {/* Footer content (optional) */}
        {footer && <div>{footer}</div>}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || form.formState.isSubmitting}
          className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-6 py-3 text-sm font-semibold text-ink transition hover:bg-[#ffe8d6] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting || form.formState.isSubmitting ? 'Submitting...' : submitButtonText}
        </button>
      </form>
    </FormProvider>
  );
}
