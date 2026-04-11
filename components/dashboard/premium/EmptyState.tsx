'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/design-system';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export default function EmptyState({
  icon = '🐾',
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 text-center',
        isCompact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {/* Icon */}
      <div className={cn('animate-fade-in', isCompact ? 'text-3xl' : 'text-5xl')}>
        {icon}
      </div>

      {/* Title */}
      <h3 className={cn('mt-4 font-semibold text-neutral-900', isCompact ? 'text-base' : 'text-lg')}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className={cn('mt-2 max-w-sm text-neutral-600', isCompact ? 'text-sm' : 'text-base')}>
          {description}
        </p>
      )}

      {/* CTA Button */}
      {(ctaLabel && ctaHref) || ctaOnClick ? (
        <div className="mt-6">
          {ctaHref ? (
            <Link href={ctaHref}>
              <Button>{ctaLabel}</Button>
            </Link>
          ) : (
            <Button onClick={ctaOnClick}>
              {ctaLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
