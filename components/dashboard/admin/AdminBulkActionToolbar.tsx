import type { ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type AdminBulkActionToolbarProps = {
  selectedCount: number;
  children: ReactNode;
  className?: string;
};

export default function AdminBulkActionToolbar({ selectedCount, children, className }: AdminBulkActionToolbarProps) {
  return (
    <div className={cn('sticky top-[4rem] z-10 flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white/95 p-2.5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <p className="text-xs font-semibold text-neutral-950">{selectedCount} selected</p>
        <p className="text-xs text-neutral-500">Bulk actions apply only to selected rows.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
