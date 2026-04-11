/**
 * Badge Component
 * 
 * Small status indicators and labels.
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  dot = false,
  className 
}: BadgeProps) {
  const variants = {
    default: 'bg-neutral-100 border-neutral-200 text-neutral-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    neutral: 'bg-neutral-100 border-neutral-200 text-neutral-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
  };

  const dotColors = {
    default: 'bg-neutral-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-neutral-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-150 ease-out',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
