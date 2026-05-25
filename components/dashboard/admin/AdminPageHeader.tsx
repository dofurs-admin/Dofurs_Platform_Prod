import type { ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function AdminPageHeader({
  eyebrow = 'Operations console',
  title,
  description,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{eyebrow}</p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-normal text-neutral-950 sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-xs leading-5 text-neutral-600">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
