'use client';

type AdminPaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export default function AdminPaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  className = '',
}: AdminPaginationControlsProps) {
  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (total === 0) return null;

  const rangePages: number[] = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    rangePages.push(i);
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 ${className}`}>
      <span>
        Showing {from}–{to} of {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        {rangePages[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              1
            </button>
            {rangePages[0] > 2 && <span className="px-1">…</span>}
          </>
        )}

        {rangePages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              p === page
                ? 'border-coral bg-coral text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {p}
          </button>
        ))}

        {rangePages[rangePages.length - 1] < totalPages && (
          <>
            {rangePages[rangePages.length - 1] < totalPages - 1 && <span className="px-1">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
