'use client';

import { ReactNode } from 'react';
import Button from '@/components/ui/Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  action?: ReactNode;
}

export default function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200/60 bg-neutral-50/50 py-12 px-6 text-center">
      {/* Icon */}
      <div className="text-5xl mb-4">{icon}</div>

      {/* Title */}
      <h3 className="text-lg font-bold text-neutral-950">{title}</h3>

      {/* Description */}
      <p className="mt-2 text-sm text-neutral-600 max-w-sm">{description}</p>

      {/* Action */}
      {action ? (
        <div className="mt-6">{action}</div>
      ) : ctaLabel && onCtaClick ? (
        <Button onClick={onCtaClick} className="mt-6">
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
