'use client';

import { UseFormRegisterReturn } from 'react-hook-form';
import React from 'react';
import FormError from './FormError';

/**
 * Option for select dropdown
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Props for FormSelect component
 */
export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Label text displayed above select */
  label: string;
  /** React Hook Form registration object */
  registration: UseFormRegisterReturn;
  /** Error message to display */
  error?: string;
  /** Helper text displayed below select */
  helperText?: string;
  /** Array of options or option groups */
  options: SelectOption[];
  /** Placeholder option text */
  placeholder?: string;
}

/**
 * Reusable select dropdown component for forms using React Hook Form
 * 
 * Provides consistent styling, error handling, and accessibility for dropdowns.
 * 
 * @example
 * ```tsx
 * const { register, formState: { errors } } = useForm();
 * 
 * <FormSelect
 *   label="Service Type"
 *   registration={register('serviceType')}
 *   error={errors.serviceType?.message}
 *   options={[
 *     { value: 'grooming', label: 'Grooming' },
 *     { value: 'training', label: 'Training' },
 *     { value: 'boarding', label: 'Boarding' },
 *   ]}
 *   placeholder="Select a service"
 * />
 * ```
 */
export default function FormSelect({
  label,
  registration,
  error,
  helperText,
  options,
  placeholder,
  className,
  ...props
}: FormSelectProps) {
  return (
    <label className="grid gap-2">
      <div>
        <span className="text-xs font-semibold text-ink">{label}</span>
        {helperText && <p className="text-[11px] text-[#6b6b6b] mt-0.5">{helperText}</p>}
      </div>
      <select
        {...registration}
        {...props}
        className={`rounded-xl border border-[#f2dfcf] bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-[#e8a87c] focus:ring-1 focus:ring-[#e8a87c]/20 ${
          error ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''
        } ${className || ''}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <FormError message={error} />}
    </label>
  );
}
