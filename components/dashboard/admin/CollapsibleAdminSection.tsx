'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/design-system';

type CollapsibleAdminSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
  bodyClassName?: string;
  headingLevel?: 'h2' | 'h3';
};

type AdminSectionCollapseToolbarProps = {
  title: string;
  description: string;
  expandAllLabel?: string;
  minimizeAllLabel?: string;
  areAllExpanded: boolean;
  areAllMinimized: boolean;
  onExpandAll: () => void;
  onMinimizeAll: () => void;
  className?: string;
};

export function AdminSectionCollapseToolbar({
  title,
  description,
  expandAllLabel = 'Expand all',
  minimizeAllLabel = 'Minimize all',
  areAllExpanded,
  areAllMinimized,
  onExpandAll,
  onMinimizeAll,
  className,
}: AdminSectionCollapseToolbarProps) {
  return (
    <div className={cn('rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 text-xs text-neutral-600">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExpandAll}
            disabled={areAllExpanded}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            {expandAllLabel}
          </button>
          <button
            type="button"
            onClick={onMinimizeAll}
            disabled={areAllMinimized}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
            {minimizeAllLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CollapsibleAdminSection({
  id,
  title,
  description,
  children,
  summary,
  actions,
  isExpanded,
  defaultExpanded = true,
  onToggle,
  className,
  bodyClassName,
  headingLevel = 'h2',
}: CollapsibleAdminSectionProps) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const expanded = isExpanded ?? localExpanded;
  const contentId = `${id}-content`;
  const titleId = `${id}-title`;
  const HeadingTag = headingLevel;

  function toggleSection() {
    if (onToggle) {
      onToggle();
      return;
    }

    setLocalExpanded((current) => !current);
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn('rounded-xl border border-neutral-200/60 bg-white p-4 shadow-sm', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={toggleSection}
            aria-label={`${expanded ? 'Minimize' : 'Expand'} ${title}`}
            aria-expanded={expanded}
            aria-controls={contentId}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f2dfcf] bg-[#fff7f0] text-coral transition-colors hover:bg-[#ffefe0] focus:outline-none focus:ring-2 focus:ring-coral/20 focus:ring-offset-2"
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', expanded ? 'rotate-180' : '')}
              aria-hidden="true"
            />
          </button>
          <div className="min-w-0">
            <HeadingTag id={titleId} className="text-base font-semibold text-ink">
              {title}
            </HeadingTag>
            {description ? (
              <p className="mt-1 text-xs text-[#6b6b6b]">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {summary ? (
            <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-semibold text-ink">
              {summary}
            </span>
          ) : null}
          {actions}
          <button
            type="button"
            onClick={toggleSection}
            aria-expanded={expanded}
            aria-controls={contentId}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-brand-50/60 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:ring-offset-2"
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {expanded ? 'Minimize' : 'Expand'}
          </button>
        </div>
      </div>

      <div id={contentId} hidden={!expanded} className={bodyClassName}>
        {children}
      </div>
    </section>
  );
}