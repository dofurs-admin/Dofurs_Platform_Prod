'use client';

import { UseFormRegisterReturn } from 'react-hook-form';
import React from 'react';
import FormError from './FormError';

/**
 * Props for FormTextarea component
 */
export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text displayed above textarea */
  label: string;
  /** React Hook Form registration object */
  registration: UseFormRegisterReturn;
  /** Error message to display */
  error?: string;
  /** Helper text displayed below textarea */
  helperText?: string;
  /** Show character count */
  showCharCount?: boolean;
  /** Maximum character length (for validation) */
  maxLength?: number;
}

/**
 * Reusable textarea component for forms using React Hook Form
 * 
 * Provides consistent styling, error handling, character counting, and accessibility.
 * 
 * @example
 * ```tsx
 * const { register, formState: { errors }, watch } = useForm();
 * 
 * <FormTextarea
 *   label="Comments"
 *   registration={register('comments')}
 *   error={errors.comments?.message}
 *   placeholder="Enter your comments here..."
 *   rows={4}
 *   maxLength={500}
 *   showCharCount
 * />
 * ```
 */
export default function FormTextarea({
  label,
  registration,
  error,
  helperText,
  showCharCount,
  maxLength,
  className,
  ...props
}: FormTextareaProps) {
  const [charCount, setCharCount] = React.useState(0);

  return (
    <label className="grid gap-2">
      <div>
        <span className="text-xs font-semibold text-ink">{label}</span>
        {helperText && <p className="text-[11px] text-[#6b6b6b] mt-0.5">{helperText}</p>}
      </div>
      <textarea
        {...registration}
        {...props}
        maxLength={maxLength}
        onChange={(e) => {
          setCharCount(e.target.value.length);
          props.onChange?.(e);
        }}
        className={`rounded-xl border border-[#f2dfcf] bg-white px-4 py-2.5 text-sm text-ink placeholder-[#c9b5a3] outline-none transition focus:border-[#e8a87c] focus:ring-1 focus:ring-[#e8a87c]/20 resize-none ${
          error ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''
        } ${className || ''}`}
      />
      <div className="flex items-center justify-between gap-2">
        {error && <FormError message={error} />}
        {showCharCount && maxLength && (
          <p className={`text-[11px] ${charCount > maxLength * 0.9 ? 'text-amber-600' : 'text-[#6b6b6b]'}`}>
            {charCount} / {maxLength}
          </p>
        )}
      </div>
    </label>
  );
}
