'use client';

import { useState } from 'react';

interface AvailabilityCalendarProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  minDate?: string; // 'YYYY-MM-DD', defaults to today
  maxDate?: string; // 'YYYY-MM-DD'
  availableDates?: string[];
  disableUnavailableDates?: boolean;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function padTwo(n: number) {
  return String(n).padStart(2, '0');
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${padTwo(month + 1)}-${padTwo(day)}`;
}

export default function AvailabilityCalendar({
  value,
  onChange,
  minDate,
  maxDate,
  availableDates = [],
  disableUnavailableDates = false,
}: AvailabilityCalendarProps) {
  const today = new Date().toISOString().split('T')[0];
  const effectiveMin = minDate ?? today;
  const effectiveMax = maxDate ?? null;
  const availableDateSet = new Set(availableDates);

  const initialDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  // Build grid: null cells for padding, then date strings
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(viewYear, viewMonth, d));

  // Can navigate back? Only if the prev month is not entirely before effectiveMin
  const prevMonthLastDay = toDateStr(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1, new Date(viewYear, viewMonth, 0).getDate());
  const canGoPrev = prevMonthLastDay >= effectiveMin;
  const nextMonthFirstDay = viewMonth === 11
    ? toDateStr(viewYear + 1, 0, 1)
    : toDateStr(viewYear, viewMonth + 1, 1);
  const canGoNext = !effectiveMax || nextMonthFirstDay <= effectiveMax;

  return (
    <div className="select-none rounded-2xl border-2 border-neutral-200 bg-white p-2.5 shadow-sm sm:p-4">
      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between sm:mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-neutral-500 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg"
        >
          ‹
        </button>
        <p className="text-[13px] font-semibold text-neutral-900 sm:text-sm">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-neutral-500 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg"
        >
          ›
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[9px] font-semibold uppercase tracking-wider text-neutral-400 sm:text-[10px]"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`pad-${i}`} />;

          const isPast = dateStr < effectiveMin;
          const isBeyondMax = Boolean(effectiveMax && dateStr > effectiveMax);
          const isAvailable = availableDateSet.size > 0 && availableDateSet.has(dateStr);
          const isUnavailable = availableDateSet.size > 0 && !isAvailable;
          const isDisabledByAvailability = disableUnavailableDates && isUnavailable;
          const isSelected = dateStr === value;
          const isToday = dateStr === today;
          const isDisabled = isPast || isBeyondMax || isDisabledByAvailability;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              className={[
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors sm:h-9 sm:w-9 sm:text-sm',
                isDisabled
                  ? 'cursor-not-allowed text-neutral-300'
                  : isSelected
                    ? 'bg-coral font-semibold text-white shadow-sm'
                    : isAvailable
                      ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                    : isToday
                      ? 'border-2 border-coral font-bold text-coral hover:bg-coral/10'
                      : 'font-medium text-neutral-700 hover:bg-coral/10',
              ].join(' ')}
            >
              {new Date(`${dateStr}T00:00:00`).getDate()}
            </button>
          );
        })}
      </div>

      {/* Selected date label */}
      {value && (
        <p className="mt-3 text-center text-xs text-neutral-500">
          {new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}
