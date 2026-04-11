'use client';

import { ReactNode } from 'react';

interface VaccinationCardProps {
  vaccineName: string;
  brandName?: string;
  administeredDate: string;
  nextDueDate?: string;
  status: 'up-to-date' | 'due-soon' | 'overdue';
  onEdit?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function getStatusColor(status: 'up-to-date' | 'due-soon' | 'overdue') {
  switch (status) {
    case 'up-to-date':
      return 'bg-emerald-50 border-emerald-200/30 text-emerald-700';
    case 'due-soon':
      return 'bg-amber-50 border-amber-200/30 text-amber-700';
    case 'overdue':
      return 'bg-red-50 border-red-200/30 text-red-700';
  }
}

function getStatusLabel(status: 'up-to-date' | 'due-soon' | 'overdue') {
  switch (status) {
    case 'up-to-date':
      return 'Up to date';
    case 'due-soon':
      return 'Due soon';
    case 'overdue':
      return 'Overdue';
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function VaccinationCard({
  vaccineName,
  brandName,
  administeredDate,
  nextDueDate,
  status,
  onEdit,
  onDelete,
  children,
  isExpanded = false,
  onToggleExpand,
}: VaccinationCardProps) {
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
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-neutral-950">{vaccineName}</h4>
              {brandName && (
                <p className="mt-1 text-xs text-neutral-500">{brandName}</p>
              )}
            </div>

            {/* Status badge */}
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium border ${getStatusColor(
                status
              )}`}
            >
              {getStatusLabel(status)}
            </div>
          </div>

          {/* Date info */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            <span>Administered: {formatDate(administeredDate)}</span>
            {nextDueDate && <span>Next due: {formatDate(nextDueDate)}</span>}
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
        <div className="mt-4 border-t border-neutral-100 pt-4">{children}</div>
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
