'use client';

import { UseFormRegisterReturn } from 'react-hook-form';
import React from 'react';
import FormError from '@/components/forms/FormError';

/**
 * Props for FormInput component
 */
export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed above input */
  label: string;
  /** React Hook Form registration object */
  registration: UseFormRegisterReturn;
  /** Error message to display */
  error?: string;
  /** Helper text displayed below input */
  helperText?: string;
}

/**
 * Reusable text input component for forms using React Hook Form
 * 
 * Provides consistent styling, error handling, and accessibility.
 * Supports all standard HTML input types (text, email, password, number, tel, etc.)
 * 
 * @example
 * ```tsx
 * const { register, formState: { errors } } = useForm();
 * 
 * <FormInput
 *   label="Email Address"
 *   type="email"
 *   placeholder="user@example.com"
 *   registration={register('email')}
 *   error={errors.email?.message}
 * />
 * ```
 */
export default function FormInput({
  label,
  registration,
  error,
  helperText,
  type = 'text',
  className,
  ...props
}: FormInputProps) {
  return (
    <label className="grid gap-2">
      <div>
        <span className="text-xs font-semibold text-ink">{label}</span>
        {helperText && <p className="text-[11px] text-[#6b6b6b] mt-0.5">{helperText}</p>}
      </div>
      <input
        type={type}
        {...registration}
        {...props}
        className={`rounded-xl border border-[#f2dfcf] bg-white px-4 py-2.5 text-sm text-ink placeholder-[#c9b5a3] outline-none transition focus:border-[#e8a87c] focus:ring-1 focus:ring-[#e8a87c]/20 ${
          error ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''
        } ${className || ''}`}
      />
      {error && <FormError message={error} />}
    </label>
  );
}
