'use client';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export default function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>}
      </div>
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-900 transition-all duration-150 ease-out hover:bg-neutral-50"
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-900 transition-all duration-150 ease-out hover:bg-neutral-50"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
