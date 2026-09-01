'use client';

import { useEffect, useState } from 'react';
import { Button, Alert, Badge } from '@/components/ui';
import AdminBookingFlow from '@/components/forms/AdminBookingFlow';
import AdminBulkActionToolbar from '@/components/dashboard/admin/AdminBulkActionToolbar';
import AdminDataTable from '@/components/dashboard/admin/AdminDataTable';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import BookingDetailModal from '@/components/dashboard/admin/BookingDetailModal';
import SendMessageModal from '@/components/dashboard/SendMessageModal';
import { exportToCsv } from '@/lib/utils/export';
import {
  BOOKING_EXPORT_COLUMN_GROUPS,
  BOOKING_EXPORT_PRESETS,
  DEFAULT_BOOKING_EXPORT_COLUMN_KEYS,
  buildBookingExportRows,
  getBookingExportPresetColumnKeys,
  loadPersistedBookingExportColumnKeys,
  persistBookingExportColumnKeys,
  resolveBookingExportColumns,
  resolveBookingServiceLabel,
  toggleBookingExportColumn,
  toggleBookingExportGroup,
} from '@/components/dashboard/admin/bookingsExport';
import type { BookingExportColumnKey } from '@/components/dashboard/admin/bookingsExport';
import type { BookingStatus } from '@/lib/bookings/types';

type AdminBookingStatus = BookingStatus;
type BookingFilter = 'all' | 'sla' | 'high-risk' | AdminBookingStatus;
type BulkBookingStatus = AdminBookingStatus;
type BookingDatePreset = 'today' | 'last_7_days' | 'this_month';

type AdminBooking = {
  id: number;
  user_id?: string;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: AdminBookingStatus;
  booking_status?: AdminBookingStatus | null;
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
  admin_price_reference?: number | null;
  price_at_booking?: number | null;
  included_services?: string[] | null;
  payment_mode?: string | null;
  cash_collected?: boolean;
  collected_amount_inr?: number | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
  city?: string | null;
  pet_names?: string | null;
  pet_breed?: string | null;
  discount_code?: string | null;
  discount_amount?: number | null;
  wallet_credits_applied_inr?: number | null;
  amount?: number | null;
  final_price?: number | null;
  created_at?: string | null;
  cancellation_reason?: string | null;
  completion_task_status?: 'pending' | 'completed' | null;
  completion_due_at?: string | null;
  completion_completed_at?: string | null;
};

type Provider = {
  id: number;
  name: string;
};

type BookingRiskSummary = {
  pending: number;
  inProgress: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

const BOOKING_FILTER_OPTIONS: ReadonlyArray<{ value: BookingFilter; label: string }> = [
  { value: 'all', label: 'All Bookings' },
  { value: 'sla', label: 'SLA Queue' },
  { value: 'pending', label: 'Pending Bookings' },
  { value: 'confirmed', label: 'Confirmed Bookings' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed Bookings' },
  { value: 'cancelled', label: 'Cancelled Bookings' },
  { value: 'no_show', label: 'No-Show Bookings' },
  { value: 'high-risk', label: 'High Risk' },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const INR_AMOUNT_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(`1970-01-01T${value}`);
  return Number.isNaN(parsed.getTime()) ? value : TIME_FORMATTER.format(parsed);
}

function formatBookingDateTime(booking: AdminBooking) {
  if (booking.booking_date && booking.start_time) {
    const dateLabel = formatDate(booking.booking_date);
    const startLabel = formatTime(booking.start_time);
    const endLabel = formatTime(booking.end_time);
    return endLabel ? `${dateLabel} • ${startLabel} - ${endLabel}` : `${dateLabel} • ${startLabel}`;
  }
  return formatDateTime(booking.booking_start);
}

function formatBookingMode(value: AdminBooking['booking_mode']) {
  if (value === 'home_visit') return 'Home visit';
  if (value === 'clinic_visit') return 'Clinic visit';
  return 'Teleconsult';
}

function formatAmountForDisplay(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return INR_AMOUNT_FORMATTER.format(Number(value));
}

function formatPaymentModeForDisplay(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolvePaymentStatusLabel(booking: Pick<AdminBooking, 'payment_mode' | 'cash_collected'>): string {
  const mode = booking.payment_mode ?? null;
  const isCashCollectionMode = mode === 'direct_to_provider' || mode === 'mixed' || mode === 'cash';

  if (isCashCollectionMode) {
    if (booking.cash_collected) {
      return mode === 'mixed' ? 'Payable settled' : 'Cash collected';
    }

    return mode === 'mixed' ? 'Pending payable' : 'Awaiting cash';
  }

  if (!mode) {
    return 'Unknown';
  }

  return mode === 'platform' ? 'Platform paid' : 'Non-cash';
}

function getStatusBadgeVariant(status: AdminBookingStatus) {
  if (status === 'completed') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'cancelled' || status === 'no_show') return 'error';
  return 'info';
}

function isStatusLockedForAdminOps(status: AdminBookingStatus) {
  return status === 'completed' || status === 'cancelled' || status === 'no_show';
}

type AdminBookingsViewProps = {
  bookingRiskSummary: BookingRiskSummary;
  bookingSearchQuery: string;
  onSearchChange: (query: string) => void;
  bookingFilter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
  bookingDateFrom: string;
  bookingDateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyDatePreset: (preset: BookingDatePreset) => void;
  onClearDateRange: () => void;
  bulkStatus: BulkBookingStatus;
  onBulkStatusChange: (status: BulkBookingStatus) => void;
  onApplyBulkStatus: () => void;
  selectedBookingIds: number[];
  onToggleBookingSelection: (id: number) => void;
  onClearSelectedSla: () => void;
  bookingModerationActivity: string | null;
  visibleBookings: AdminBooking[];
  providers: Provider[];
  isPending: boolean;
  onReassignProvider: (bookingId: number, providerId: number) => void;
  onOverrideStatus: (bookingId: number, status: BulkBookingStatus) => void;
  onApplyBookingAdjustment: (bookingId: number) => void;
  onMarkCashPaymentReceived: (bookingId: number) => void;
};

export default function AdminBookingsView({
  bookingRiskSummary,
  bookingSearchQuery,
  onSearchChange,
  bookingFilter,
  onFilterChange,
  bookingDateFrom,
  bookingDateTo,
  onDateFromChange,
  onDateToChange,
  onApplyDatePreset,
  onClearDateRange,
  bulkStatus,
  onBulkStatusChange,
  onApplyBulkStatus,
  selectedBookingIds,
  onToggleBookingSelection,
  onClearSelectedSla,
  bookingModerationActivity,
  visibleBookings,
  providers,
  isPending,
  onReassignProvider,
  onOverrideStatus,
  onApplyBookingAdjustment,
  onMarkCashPaymentReceived,
}: AdminBookingsViewProps) {
  const [detailBookingId, setDetailBookingId] = useState<number | null>(null);
  const [messageTarget, setMessageTarget] = useState<{
    recipientId: string;
    recipientName: string;
    bookingId?: number;
  } | null>(null);
  const [isExportColumnPickerOpen, setIsExportColumnPickerOpen] = useState(false);
  const [exportColumnKeys, setExportColumnKeys] = useState<BookingExportColumnKey[]>([
    ...DEFAULT_BOOKING_EXPORT_COLUMN_KEYS,
  ]);

  useEffect(() => {
    const persistedColumnKeys = loadPersistedBookingExportColumnKeys();
    if (persistedColumnKeys) {
      setExportColumnKeys(persistedColumnKeys);
    }
  }, []);

  const exportColumns = resolveBookingExportColumns(exportColumnKeys);

  function updateExportColumnKeys(nextKeys: BookingExportColumnKey[]) {
    setExportColumnKeys(nextKeys);
    persistBookingExportColumnKeys(nextKeys);
  }

  function handleExportBookingsCsv() {
    if (exportColumns.length === 0) {
      return;
    }

    const { headers, rows } = buildBookingExportRows(visibleBookings, exportColumns);
    exportToCsv('bookings-export', headers, rows);
  }

  function renderBookingBadges(booking: AdminBooking) {
    const status = booking.booking_status ?? booking.status;
    const isCashBooking = booking.payment_mode === 'direct_to_provider' || booking.payment_mode === 'mixed';
    const cashReceived = isCashBooking && booking.cash_collected === true;
    const cashPending = isCashBooking && !cashReceived;
    const canCollectCash = status === 'pending' || status === 'confirmed' || status === 'in_progress';

    return (
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={getStatusBadgeVariant(status)} dot>{status.replace('_', ' ')}</Badge>
        {status === 'pending' ? <Badge variant="warning">SLA</Badge> : null}
        {status === 'no_show' ? <Badge variant="error">High risk</Badge> : null}
        {status === 'confirmed' && booking.completion_task_status === 'pending' ? <Badge variant="warning">Follow-up</Badge> : null}
        {cashPending && canCollectCash ? <Badge variant="warning">Awaiting cash</Badge> : null}
        {cashReceived ? <Badge variant="success">Cash received</Badge> : null}
        {booking.completion_task_status === 'completed' ? <Badge variant="success">Feedback logged</Badge> : null}
      </div>
    );
  }

  function renderBookingActions(booking: AdminBooking) {
    const status = booking.booking_status ?? booking.status;
    const isCashBooking = booking.payment_mode === 'direct_to_provider' || booking.payment_mode === 'mixed';
    const cashPending = isCashBooking && booking.cash_collected !== true;
    const isStatusLocked = isStatusLockedForAdminOps(status);

    return (
      <div className="flex flex-wrap gap-1.5">
        <select
          className="input-field !min-h-9 !w-auto !rounded-lg !px-2.5 !py-1.5 text-xs"
          defaultValue=""
          onChange={(event) => {
            const nextStatus = event.target.value as BulkBookingStatus;
            if (!nextStatus) {
              return;
            }

            onOverrideStatus(booking.id, nextStatus);
            event.target.value = '';
          }}
          disabled={isPending}
          aria-label={`Set booking ${booking.id} status`}
        >
          <option value="">Set status…</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In progress</option>
          <option value="completed" disabled={cashPending}>
            {cashPending ? 'Completed (cash pending)' : 'Completed'}
          </option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        {isCashBooking && (status === 'pending' || status === 'confirmed' || status === 'in_progress') && cashPending ? (
          <Button size="sm" variant="secondary" onClick={() => onMarkCashPaymentReceived(booking.id)} disabled={isPending}>
            Cash received
          </Button>
        ) : null}
        {!isStatusLocked ? (
          <Button size="sm" variant="ghost" onClick={() => onApplyBookingAdjustment(booking.id)} disabled={isPending}>
            Reverse
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setDetailBookingId(booking.id)}>
          Details
        </Button>
        {booking.user_id ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMessageTarget({
              recipientId: booking.user_id!,
              recipientName: booking.customer_name || booking.customer_email || 'Pet Parent',
              bookingId: booking.id,
            })}
          >
            Message
          </Button>
        ) : null}
      </div>
    );
  }

  const bookingColumns = [
    {
      key: 'booking',
      header: 'Booking',
      className: 'min-w-[13rem]',
      render: (booking: AdminBooking) => {
        const status = booking.booking_status ?? booking.status;
        return (
          <div>
            <p className="font-semibold text-neutral-950">#{booking.id}</p>
            <p className="mt-1 text-xs text-neutral-500">{bookingTimelineLabel(status)}</p>
            <p className="mt-1 text-xs text-neutral-500">{resolveBookingServiceLabel(booking)}</p>
          </div>
        );
      },
    },
    {
      key: 'customer',
      header: 'Customer',
      className: 'min-w-[14rem]',
      render: (booking: AdminBooking) => (
        <div>
          <p className="font-medium text-neutral-950">{booking.customer_name ?? booking.user_id ?? 'Not assigned'}</p>
          <p className="mt-1 text-xs text-neutral-500">{booking.customer_phone ?? booking.customer_email ?? 'No contact on booking'}</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      className: 'min-w-[13rem]',
      render: (booking: AdminBooking) => (
        <div>
          <p className="font-medium text-neutral-950">{formatBookingDateTime(booking)}</p>
          <p className="mt-1 text-xs text-neutral-500">{formatBookingMode(booking.booking_mode ?? 'home_visit')}</p>
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      className: 'min-w-[13rem]',
      render: (booking: AdminBooking) => {
        const status = booking.booking_status ?? booking.status;
        const isStatusLocked = isStatusLockedForAdminOps(status);

        if (isStatusLocked) {
          return <p className="font-medium text-neutral-950">{booking.provider_name ?? `#${booking.provider_id}`}</p>;
        }

        return (
          <select
            className="input-field !py-2 text-sm"
            value={booking.provider_id ?? ''}
            onChange={(event) => onReassignProvider(booking.id, Number(event.target.value))}
            disabled={isPending}
          >
            <option value="">Reassign...</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      className: 'min-w-[14rem]',
      render: (booking: AdminBooking) => (
        <div>
          <p className="font-medium text-neutral-950">Booked: {formatAmountForDisplay(booking.price_at_booking)}</p>
          <p className="mt-1 text-xs text-neutral-500">Admin ref: {formatAmountForDisplay(booking.admin_price_reference)}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatPaymentModeForDisplay(booking.payment_mode)} • {resolvePaymentStatusLabel(booking)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'min-w-[13rem]',
      render: renderBookingBadges,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'min-w-[20rem]',
      render: renderBookingActions,
    },
  ];

  return (
    <section className="space-y-3.5">
      <details className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-3.5 py-2.5 text-xs font-semibold text-neutral-950 marker:hidden">
          Create booking workflow
          <span className="ml-2 text-xs font-medium text-neutral-500">Open only when scheduling manually</span>
        </summary>
        <div className="border-t border-neutral-200 p-3">
          <AdminBookingFlow defaultMinimized />
        </div>
      </details>

      <div className="grid gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending SLA</p>
          <p className="mt-1 text-lg font-semibold text-amber-900">{bookingRiskSummary.pending}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">In Progress</p>
          <p className="mt-1 text-lg font-semibold text-blue-900">{bookingRiskSummary.inProgress}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Completed</p>
          <p className="mt-1 text-lg font-semibold text-emerald-900">{bookingRiskSummary.completed}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Exceptions</p>
          <p className="mt-1 text-lg font-semibold text-red-900">{bookingRiskSummary.noShow + bookingRiskSummary.cancelled}</p>
        </div>
      </div>

      <div className="sticky top-[4rem] z-10 rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="admin-booking-search" className="mb-1.5 block text-xs font-medium text-neutral-700">
                Search
              </label>
              <input
                id="admin-booking-search"
                type="search"
                placeholder="Booking ID, customer/provider name or ID"
                value={bookingSearchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="input-field !min-h-9 w-full !rounded-lg !px-3 !py-2 !text-xs"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-700">Filter</label>
              <select
                value={bookingFilter}
                onChange={(event) => onFilterChange(event.target.value as BookingFilter)}
                className="input-field !min-h-9 w-full !rounded-lg !px-2.5 !py-1.5 text-xs"
              >
                {BOOKING_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-booking-date-from" className="mb-1.5 block text-xs font-medium text-neutral-700">
                From
              </label>
              <input
                id="admin-booking-date-from"
                type="date"
                value={bookingDateFrom}
                max={bookingDateTo || undefined}
                onChange={(event) => onDateFromChange(event.target.value)}
                className="input-field !min-h-9 w-full !rounded-lg !px-3 !py-2 !text-xs"
              />
            </div>
            <div>
              <label htmlFor="admin-booking-date-to" className="mb-1.5 block text-xs font-medium text-neutral-700">
                To
              </label>
              <input
                id="admin-booking-date-to"
                type="date"
                value={bookingDateTo}
                min={bookingDateFrom || undefined}
                onChange={(event) => onDateToChange(event.target.value)}
                className="input-field !min-h-9 w-full !rounded-lg !px-3 !py-2 !text-xs"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Quick ranges</p>
              <Button size="sm" variant="secondary" onClick={() => onApplyDatePreset('today')}>
                Today
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onApplyDatePreset('last_7_days')}>
                Last 7 days
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onApplyDatePreset('this_month')}>
                This month
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end">
            {(bookingDateFrom || bookingDateTo) ? (
              <Button size="sm" variant="secondary" onClick={onClearDateRange}>
                Clear dates
              </Button>
            ) : null}
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-coral/40 hover:bg-brand-50/40 hover:text-coral disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleExportBookingsCsv}
                  disabled={exportColumns.length === 0}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-semibold text-neutral-700 transition hover:border-coral/40 hover:bg-brand-50/40 hover:text-coral"
                  aria-expanded={isExportColumnPickerOpen}
                  title="Choose which columns to include in the CSV export"
                  onClick={() => setIsExportColumnPickerOpen((isOpen) => !isOpen)}
                >
                  Columns ({exportColumns.length})
                  <span className="ml-1 text-[10px] font-medium text-neutral-500" aria-hidden="true">▾</span>
                </button>
              </div>
              {isExportColumnPickerOpen ? (
                <div className="absolute right-0 top-full z-30 mt-2 max-h-[28rem] w-[23rem] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-neutral-950">Export columns</p>
                    <button
                      type="button"
                      className="text-xs font-medium text-neutral-500 transition hover:text-neutral-900"
                      onClick={() => setIsExportColumnPickerOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {BOOKING_EXPORT_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        title={preset.description}
                        className="min-h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:border-coral/40 hover:bg-brand-50/40 hover:text-coral"
                        onClick={() => updateExportColumnKeys(getBookingExportPresetColumnKeys(preset.key))}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {BOOKING_EXPORT_COLUMN_GROUPS.map((group) => {
                      const groupKeys = group.columns.map((column) => column.key);
                      const selectedInGroupCount = groupKeys.filter((key) => exportColumnKeys.includes(key)).length;
                      const isGroupFullySelected = groupKeys.length > 0 && selectedInGroupCount === groupKeys.length;

                      return (
                        <div key={group.id}>
                          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-950">
                            <input
                              type="checkbox"
                              checked={isGroupFullySelected}
                              onChange={() => updateExportColumnKeys(toggleBookingExportGroup(exportColumnKeys, group.id))}
                              className="h-3.5 w-3.5 rounded border-neutral-300 accent-coral"
                            />
                            {group.label}
                            <span className="text-[10px] font-medium text-neutral-400">
                              {selectedInGroupCount}/{groupKeys.length}
                            </span>
                          </label>
                          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 pl-5">
                            {group.columns.map((column) => (
                              <label key={column.key} className="flex items-center gap-1.5 text-[11px] text-neutral-700">
                                <input
                                  type="checkbox"
                                  checked={exportColumnKeys.includes(column.key)}
                                  onChange={() => updateExportColumnKeys(toggleBookingExportColumn(exportColumnKeys, column.key))}
                                  className="h-3 w-3 rounded border-neutral-300 accent-coral"
                                />
                                <span className="truncate" title={column.label}>{column.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full !rounded-lg"
                    onClick={handleExportBookingsCsv}
                    disabled={exportColumns.length === 0}
                  >
                    Export CSV ({exportColumns.length} {exportColumns.length === 1 ? 'column' : 'columns'})
                  </Button>
                  <p className="mt-1.5 text-center text-[10px] text-neutral-500">
                    Exports the {visibleBookings.length} booking{visibleBookings.length === 1 ? '' : 's'} matching the current filters and search.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {selectedBookingIds.length > 0 ? (
        <AdminBulkActionToolbar selectedCount={selectedBookingIds.length}>
          <select
            value={bulkStatus}
            onChange={(event) => onBulkStatusChange(event.target.value as BulkBookingStatus)}
            className="input-field !min-h-9 !w-auto !rounded-lg !px-2.5 !py-1.5 text-xs"
          >
            <option value="pending">Mark pending</option>
            <option value="confirmed">Mark confirmed</option>
            <option value="in_progress">Mark in progress</option>
            <option value="completed">Mark completed</option>
            <option value="cancelled">Mark cancelled</option>
            <option value="no_show">Mark no-show</option>
          </select>
          <Button size="sm" onClick={onApplyBulkStatus} disabled={isPending}>
            Apply status
          </Button>
          <Button size="sm" variant="secondary" onClick={onClearSelectedSla} disabled={isPending}>
            Clear SLA
          </Button>
        </AdminBulkActionToolbar>
      ) : null}

          {bookingModerationActivity ? (
            <Alert variant="success" className="!py-2 !text-sm">
              Recent moderation activity: {bookingModerationActivity}
            </Alert>
          ) : null}

      <AdminDataTable
        rows={visibleBookings}
        columns={bookingColumns}
        getRowId={(booking) => booking.id}
        selectedRowIds={selectedBookingIds}
        onToggleRow={(booking) => onToggleBookingSelection(booking.id)}
        emptyState={(
          <div>
            <p className="text-sm font-semibold text-neutral-950">No bookings found</p>
            <p className="mt-1 text-sm text-neutral-500">Adjust filters or create a new booking from the workflow above.</p>
          </div>
        )}
      />
      <BookingDetailModal
        bookingId={detailBookingId}
        isOpen={detailBookingId !== null}
        onClose={() => setDetailBookingId(null)}
      />
      <SendMessageModal
        isOpen={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        recipientId={messageTarget?.recipientId ?? ''}
        recipientName={messageTarget?.recipientName ?? ''}
        bookingId={messageTarget?.bookingId}
        senderRole="admin"
      />
    </section>
  );
}
