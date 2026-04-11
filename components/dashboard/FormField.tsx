'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  type?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      fullWidth = true,
      icon,
      className,
      type = 'text',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClass =
      'w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-0 placeholder:text-neutral-400';

    const stateClass = error
      ? 'border-red-500 ring-2 ring-red-500/20 focus:ring-red-500'
      : 'border-neutral-200/60 focus:ring-brand-500 focus:border-brand-500';

    const disabledClass = disabled ? 'bg-neutral-50 text-neutral-500 cursor-not-allowed' : 'hover:border-neutral-300';

    return (
      <div className={fullWidth ? 'w-full' : 'w-auto'}>
        {label && (
          <label className="mb-2 block text-sm font-semibold text-neutral-900">
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">{icon}</div>}

          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={`${baseClass} ${stateClass} ${disabledClass} ${icon ? 'pl-10' : ''} ${className || ''}`}
            {...props}
          />
        </div>

        {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-neutral-500">{helperText}</p>}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export default FormField;
