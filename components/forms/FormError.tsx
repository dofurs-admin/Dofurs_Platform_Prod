'use client';

import React from 'react';

/**
 * Props for FormError component
 */
export interface FormErrorProps {
  /** Error message to display */
  message: string;
}

/**
 * Reusable error message display component
 * 
 * Displays validation error messages with consistent styling and accessibility.
 * Used internally by form fields and can be used standalone for custom errors.
 * 
 * @example
 * ```tsx
 * <FormError message="Email address is required" />
 * ```
 */
export default function FormError({ message }: FormErrorProps) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700 flex items-center gap-2"
      role="alert"
    >
      <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
