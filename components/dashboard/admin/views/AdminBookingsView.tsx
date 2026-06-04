'use client';

import { useState } from 'react';
import { Button, Alert, Badge } from '@/components/ui';
import AdminBookingFlow from '@/components/forms/AdminBookingFlow';
import AdminBulkActionToolbar from '@/components/dashboard/admin/AdminBulkActionToolbar';
import AdminDataTable from '@/components/dashboard/admin/AdminDataTable';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import BookingDetailModal from '@/components/dashboard/admin/BookingDetailModal';
import SendMessageModal from '@/components/dashboard/SendMessageModal';
import { exportToCsv } from '@/lib/utils/export';
import { buildIncludedServicesLabel } from '@/lib/bookings/included-services';
import type { BookingStatus } from '@/lib/bookings/types';

type AdminBookingStatus = BookingStatus;
type BookingFilter = 'all' | 'sla' | 'high-risk' | AdminBookingStatus;
type BulkBookingStatus = Exclude<AdminBookingStatus, 'pending'>;

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
  included_services?: string[] | null;
  payment_mode?: string | null;
  cash_collected?: boolean;
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

const ALLOWED_TRANSITIONS: Record<AdminBookingStatus, ReadonlyArray<AdminBookingStatus>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
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

function resolveBookingServiceLabel(booking: AdminBooking) {
  return buildIncludedServicesLabel(booking.included_services ?? [], booking.service_type);
}

function getStatusBadgeVariant(status: AdminBookingStatus) {
  if (status === 'completed') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'cancelled' || status === 'no_show') return 'error';
  return 'info';
}

type AdminBookingsViewProps = {
  bookingRiskSummary: BookingRiskSummary;
  bookingSearchQuery: string;
  onSearchChange: (query: string) => void;
  bookingFilter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
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
    const allowedTransitions = ALLOWED_TRANSITIONS[status];
    const canConfirm = allowedTransitions.includes('confirmed');
    const canStart = allowedTransitions.includes('in_progress');
    const canComplete = allowedTransitions.includes('completed');
    const canNoShow = allowedTransitions.includes('no_show');
    const canCancel = allowedTransitions.includes('cancelled');
    const isCashBooking = booking.payment_mode === 'direct_to_provider' || booking.payment_mode === 'mixed';
    const cashPending = isCashBooking && booking.cash_collected !== true;
    const isTerminalStatus = allowedTransitions.length === 0;

    return (
      <div className="flex flex-wrap gap-1.5">
        {canConfirm ? (
          <Button size="sm" variant="secondary" onClick={() => onOverrideStatus(booking.id, 'confirmed')} disabled={isPending}>
            {status === 'pending' ? 'Clear SLA' : 'Confirm'}
          </Button>
        ) : null}
        {canStart ? (
          <Button size="sm" variant="secondary" onClick={() => onOverrideStatus(booking.id, 'in_progress')} disabled={isPending}>
            Start
          </Button>
        ) : null}
        {canComplete ? (
          <Button
            size="sm"
            variant="success"
            onClick={() => onOverrideStatus(booking.id, 'completed')}
            disabled={isPending || cashPending}
            title={cashPending ? 'Mark cash as received first' : undefined}
          >
            Complete
          </Button>
        ) : null}
        {isCashBooking && (status === 'pending' || status === 'confirmed' || status === 'in_progress') && cashPending ? (
          <Button size="sm" variant="secondary" onClick={() => onMarkCashPaymentReceived(booking.id)} disabled={isPending}>
            Cash received
          </Button>
        ) : null}
        {canNoShow ? (
          <Button size="sm" variant="ghost" onClick={() => onOverrideStatus(booking.id, 'no_show')} disabled={isPending}>
            No-show
          </Button>
        ) : null}
        {canCancel ? (
          <Button size="sm" variant="danger" onClick={() => onOverrideStatus(booking.id, 'cancelled')} disabled={isPending}>
            Cancel
          </Button>
        ) : null}
        {!isTerminalStatus ? (
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
        const isTerminalStatus = ALLOWED_TRANSITIONS[status].length === 0;

        if (isTerminalStatus) {
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
          <div className="grid flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
          <button
            type="button"
            className="min-h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-coral/40 hover:bg-brand-50/40 hover:text-coral"
            onClick={() => exportToCsv('bookings-export', ['ID', 'Customer', 'Phone', 'Provider', 'Date', 'Status', 'Service', 'Mode'], visibleBookings.map((b) => [b.id, b.customer_name ?? b.user_id ?? '', b.customer_phone ?? '', b.provider_name ?? b.provider_id, b.booking_date ?? b.booking_start, b.booking_status ?? b.status, resolveBookingServiceLabel(b), b.booking_mode ?? '']))}
          >
            Export CSV
          </button>
        </div>
      </div>

      {selectedBookingIds.length > 0 ? (
        <AdminBulkActionToolbar selectedCount={selectedBookingIds.length}>
          <select
            value={bulkStatus}
            onChange={(event) => onBulkStatusChange(event.target.value as BulkBookingStatus)}
            className="input-field !min-h-9 !w-auto !rounded-lg !px-2.5 !py-1.5 text-xs"
          >
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
