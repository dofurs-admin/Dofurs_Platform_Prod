'use client';

import React from 'react';

/**
 * Props for the SummaryCard component
 */
export interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'highlight';
  onClick?: () => void;
}

/**
 * Reusable metric/statistic card for dashboard summary sections
 * 
 * Displays a single metric with value, trend indicator, and optional description.
 * Used for quick insights like "Active Bookings: 5", "Revenue: $2,340", etc.
 * 
 * @example
 * ```tsx
 * <SummaryCard
 *   title="Active Bookings"
 *   value={5}
 *   trend="up"
 *   description="Last 7 days"
 * />
 * ```
 */
export default function SummaryCard({
  title,
  value,
  description,
  trend,
  variant = 'default',
  onClick,
}: SummaryCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${
        variant === 'highlight'
          ? 'border-[#f4a261] bg-[#fff4e6] shadow-premium'
          : 'border-[#e8ccb3] bg-[#fff9f3]'
      }`}
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-wide">
          {title}
        </h3>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend === 'up'
                ? 'text-emerald-600'
                : trend === 'down'
                  ? 'text-red-600'
                  : 'text-[#6b6b6b]'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'}
          </span>
        )}
      </div>

      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>

      {description && (
        <p className="mt-2 text-xs text-[#6b6b6b]">{description}</p>
      )}
    </div>
  );
}
