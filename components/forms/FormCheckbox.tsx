'use client';

import { UseFormRegisterReturn } from 'react-hook-form';
import React from 'react';
import FormError from './FormError';

/**
 * Props for FormCheckbox component
 */
export interface FormCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed next to checkbox */
  label: string;
  /** React Hook Form registration object */
  registration: UseFormRegisterReturn;
  /** Error message to display */
  error?: string;
  /** Helper text displayed below checkbox */
  helperText?: string;
  /** Whether to display the checkbox on the left or right of label */
  labelPosition?: 'right' | 'left';
}

/**
 * Reusable checkbox component for forms using React Hook Form
 * 
 * Provides consistent styling, error handling, and accessibility for checkboxes.
 * 
 * @example
 * ```tsx
 * const { register, formState: { errors } } = useForm();
 * 
 * <FormCheckbox
 *   label="I agree to the terms and conditions"
 *   registration={register('termsAccepted')}
 *   error={errors.termsAccepted?.message}
 * />
 * ```
 */
export default function FormCheckbox({
  label,
  registration,
  error,
  helperText,
  labelPosition = 'right',
  className,
  ...props
}: FormCheckboxProps) {
  return (
    <div className="grid gap-2">
      <label className={`flex items-center gap-3 cursor-pointer ${labelPosition === 'left' ? 'flex-row-reverse' : ''}`}>
        <input
          type="checkbox"
          {...registration}
          {...props}
          className={`h-4 w-4 rounded border-[#f2dfcf] text-[#e8a87c] focus:ring-[#e8a87c]/20 cursor-pointer ${
            error ? 'border-red-300' : ''
          } ${className || ''}`}
        />
        <div>
          <span className="text-sm font-semibold text-ink">{label}</span>
          {helperText && <p className="text-[11px] text-[#6b6b6b] mt-0.5">{helperText}</p>}
        </div>
      </label>
      {error && <FormError message={error} />}
    </div>
  );
}
