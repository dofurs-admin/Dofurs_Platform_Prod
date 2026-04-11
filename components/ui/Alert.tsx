/**
 * Alert Component
 * 
 * Inline alert messages for feedback and notifications.
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function Alert({
  variant = 'info',
  title,
  children,
  icon,
  onClose,
  className,
}: AlertProps) {
  const variants = {
    info: {
      container: 'bg-blue-50 border-blue-200',
      title: 'text-blue-900',
      text: 'text-blue-700',
      icon: 'ℹ️',
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200',
      title: 'text-emerald-900',
      text: 'text-emerald-700',
      icon: '✓',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200',
      title: 'text-amber-900',
      text: 'text-amber-700',
      icon: '⚠',
    },
    error: {
      container: 'bg-red-50 border-red-200',
      title: 'text-red-900',
      text: 'text-red-700',
      icon: '✕',
    },
  };

  const config = variants[variant];

  return (
    <div
      className={cn(
        'relative rounded-xl border p-4 transition-all duration-150 ease-out',
        config.container,
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-lg">
          {icon || config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1">
          {title && (
            <h4 className={cn('text-sm font-semibold', config.title)}>
              {title}
            </h4>
          )}
          <div className={cn('text-sm', config.text)}>
            {children}
          </div>
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              'flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5',
              config.text
            )}
            aria-label="Close alert"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
