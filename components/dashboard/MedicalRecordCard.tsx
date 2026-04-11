'use client';

import { ReactNode } from 'react';

interface MedicalRecordCardProps {
  conditionName: string;
  ongoing: boolean;
  diagnosisDate?: string;
  medications?: string;
  vetName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown date';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MedicalRecordCard({
  conditionName,
  ongoing,
  diagnosisDate,
  medications,
  vetName,
  onEdit,
  onDelete,
  children,
  isExpanded = false,
  onToggleExpand,
}: MedicalRecordCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-4 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex-1 cursor-pointer"
          onClick={onToggleExpand}
          role="button"
          tabIndex={0}
        >
          {/* Title and status */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-neutral-950">{conditionName}</h4>
            </div>

            {/* Ongoing badge */}
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium border whitespace-nowrap ${
                ongoing
                  ? 'bg-amber-50 border-amber-200/30 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200/30 text-emerald-700'
              }`}
            >
              {ongoing ? 'Ongoing' : 'Resolved'}
            </div>
          </div>

          {/* Additional info */}
          <div className="mt-3 space-y-1 text-xs text-neutral-600">
            {diagnosisDate && <div>Diagnosed: {formatDate(diagnosisDate)}</div>}
            {vetName && <div>Veterinarian: {vetName}</div>}
            {medications && <div>Medications: {medications}</div>}
          </div>
        </div>

        {/* Expand icon */}
        {children && (
          <button
            onClick={onToggleExpand}
            className="text-neutral-400 transition-all duration-150 ease-out hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`h-5 w-5 transition-transform duration-150 ease-out ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && children && (
        <div className="mt-4 border-t border-neutral-100 pt-4 space-y-3">{children}</div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2 pt-3 border-t border-neutral-100">
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg px-3 py-2 text-left text-xs font-medium text-brand-600 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
