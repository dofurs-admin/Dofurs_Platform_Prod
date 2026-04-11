/**
 * Skeleton Component
 * 
 * Loading placeholders for async content.
 */

'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/design-system';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'shimmer';
  width?: string;
  height?: string;
  circle?: boolean;
}

export default function Skeleton({
  variant = 'default',
  width,
  height,
  circle = false,
  className,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg',
        variant === 'default' ? 'animate-pulse bg-neutral-200/50' : '',
        variant === 'shimmer'
          ? 'animate-shimmer bg-gradient-to-r from-neutral-200/50 via-neutral-100 to-neutral-200/50 bg-[length:1000px_100%]'
          : '',
        circle && 'rounded-full',
        className
      )}
      style={{
        width: width || '100%',
        height: height || '1rem',
        ...style,
      }}
      {...props}
    />
  );
}

// Skeleton presets for common UI elements
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card card-padding space-y-4', className)}>
      <div className="flex items-start gap-4">
        <Skeleton circle width="48px" height="48px" />
        <div className="flex-1 space-y-2">
          <Skeleton height="1rem" width="40%" />
          <Skeleton height="0.75rem" width="80%" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="1.5rem" width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height="1rem" width={`${100 / columns}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('card card-padding space-y-3', className)}>
      <Skeleton height="0.875rem" width="40%" />
      <Skeleton height="2rem" width="60%" />
      <Skeleton height="0.75rem" width="80%" />
    </div>
  );
}
