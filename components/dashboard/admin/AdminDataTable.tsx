import type { ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type AdminDataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  className?: string;
  render: (row: Row) => ReactNode;
};

type AdminDataTableProps<Row> = {
  rows: Row[];
  columns: AdminDataTableColumn<Row>[];
  getRowId: (row: Row) => string | number;
  selectedRowIds?: Array<string | number>;
  onToggleRow?: (row: Row) => void;
  emptyState?: ReactNode;
  className?: string;
  rowClassName?: (row: Row) => string | undefined;
};

export default function AdminDataTable<Row>({
  rows,
  columns,
  getRowId,
  selectedRowIds = [],
  onToggleRow,
  emptyState,
  className,
  rowClassName,
}: AdminDataTableProps<Row>) {
  const hasSelection = Boolean(onToggleRow);

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-xl border border-dashed border-neutral-200 bg-white p-6 text-center', className)}>
        {emptyState ?? <p className="text-sm text-neutral-500">No records found.</p>}
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm', className)}>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full divide-y divide-neutral-200 text-left">
          <thead className="bg-neutral-50">
            <tr>
              {hasSelection ? <th scope="col" className="w-9 px-3 py-2" /> : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn('px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {rows.map((row) => {
              const rowId = getRowId(row);
              const selected = selectedRowIds.includes(rowId);

              return (
                <tr key={rowId} className={cn('transition hover:bg-neutral-50/80', selected && 'bg-brand-50/50', rowClassName?.(row))}>
                  {hasSelection ? (
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleRow?.(row)}
                        className="h-3.5 w-3.5 rounded border-neutral-300 text-coral focus:ring-coral/20"
                        aria-label={`Select row ${rowId}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-3 py-2 align-top text-xs text-neutral-700', column.className)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-neutral-100 lg:hidden">
        {rows.map((row) => {
          const rowId = getRowId(row);
          const selected = selectedRowIds.includes(rowId);

          return (
            <div key={rowId} className={cn('space-y-2.5 p-3', selected && 'bg-brand-50/50')}>
              <div className="flex items-start gap-2.5">
                {hasSelection ? (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleRow?.(row)}
                    className="mt-1 h-3.5 w-3.5 rounded border-neutral-300 text-coral focus:ring-coral/20"
                    aria-label={`Select row ${rowId}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-2.5">
                  {columns.map((column) => (
                    <div key={column.key}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{column.header}</p>
                      <div className="mt-1 text-xs text-neutral-700">{column.render(row)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
