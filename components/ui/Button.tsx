/**
 * Button Component
 * 
 * Unified button system with consistent variants and states.
 */

'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'premium';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-coral text-white hover:bg-[#cf8448] hover:shadow-md focus:ring-coral/20',
      premium:
        'border border-[#ca7d44] bg-[linear-gradient(135deg,#e49a57_0%,#cf8347_55%,#bf733c_100%)] text-white shadow-[0_10px_24px_rgba(182,102,40,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_16px_30px_rgba(182,102,40,0.4)] focus:ring-[#d89157]/50',
      secondary:
        'border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:shadow-sm focus:ring-neutral-900/10',
      ghost:
        'text-neutral-700 hover:bg-neutral-100 focus:ring-neutral-900/10',
      danger:
        'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-sm focus:ring-red-500/20',
      success:
        'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:shadow-sm focus:ring-emerald-500/20',
    };

    const sizes = {
      sm: 'min-h-[44px] px-3 py-2 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          widthClass,
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
