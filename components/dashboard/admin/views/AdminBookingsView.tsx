'use client';

import { useState } from 'react';
import { Card, Input, Button, Alert, Badge } from '@/components/ui';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import AdminBookingFlow from '@/components/forms/AdminBookingFlow';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import BookingDetailModal from '@/components/dashboard/admin/BookingDetailModal';
import SendMessageModal from '@/components/dashboard/SendMessageModal';
import { exportToCsv } from '@/lib/utils/export';

type AdminBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

type AdminBooking = {
  id: number;
  user_id?: string;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: AdminBookingStatus;
  booking_status?: AdminBookingStatus;
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
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
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

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

type AdminBookingsViewProps = {
  bookingRiskSummary: BookingRiskSummary;
  bookingSearchQuery: string;
  onSearchChange: (query: string) => void;
  bookingFilter: 'all' | 'sla' | 'high-risk';
  onFilterChange: (filter: 'all' | 'sla' | 'high-risk') => void;
  bulkStatus: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  onBulkStatusChange: (status: 'confirmed' | 'completed' | 'cancelled' | 'no_show') => void;
  onApplyBulkStatus: () => void;
  selectedBookingIds: number[];
  onToggleBookingSelection: (id: number) => void;
  onClearSelectedSla: () => void;
  bookingModerationActivity: string | null;
  visibleBookings: AdminBooking[];
  providers: Provider[];
  isPending: boolean;
  onReassignProvider: (bookingId: number, providerId: number) => void;
  onOverrideStatus: (bookingId: number, status: 'confirmed' | 'completed' | 'cancelled' | 'no_show') => void;
  onApplyBookingAdjustment: (bookingId: number) => void;
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
}: AdminBookingsViewProps) {
  const [detailBookingId, setDetailBookingId] = useState<number | null>(null);
  const [messageTarget, setMessageTarget] = useState<{
    recipientId: string;
    recipientName: string;
    bookingId?: number;
  } | null>(null);

  return (
    <section className="space-y-6">
      <AdminSectionGuide
        title="How to Use Bookings"
        subtitle="Create, track, and manage all pet service bookings"
        steps={[
          { title: 'Create a Booking', description: 'Use the booking form below to schedule a new service for a customer. Follow the 5-step wizard.' },
          { title: 'Search & Filter', description: 'Find bookings by customer name, phone number, or status. Use the filters to narrow results.' },
          { title: 'View Booking Details', description: 'Click on any booking row to see full details, provider info, and status history.' },
          { title: 'Update Status', description: 'Change booking status (confirm, complete, cancel) using the actions in the detail view.' },
          { title: 'Send Messages', description: 'Communicate with customers or providers directly from the booking detail panel.' },
          { title: 'Export Data', description: 'Download all visible bookings as a CSV file for reporting or reconciliation.' },
        ]}
      />

      <div className="space-y-2">
        <h2 className="text-section-title">Create Booking</h2>
        <p className="text-muted">Premium 5-step booking orchestration for admin and staff operations.</p>
      </div>
      <AdminBookingFlow />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-section-title">All Bookings</h2>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
            onClick={() => exportToCsv('bookings-export', ['ID', 'Customer', 'Phone', 'Provider', 'Date', 'Status', 'Service', 'Mode'], visibleBookings.map((b) => [b.id, b.customer_name ?? b.user_id ?? '', b.customer_phone ?? '', b.provider_name ?? b.provider_id, b.booking_date ?? b.booking_start, b.booking_status ?? b.status, b.service_type ?? '', b.booking_mode ?? '']))}
          >
            Export CSV
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-neutral-600">
          <span>Pending SLA: <span className="font-semibold text-neutral-900">{bookingRiskSummary.pending}</span></span>
          <span className="hidden sm:inline text-neutral-300">•</span>
          <span>No-show: <span className="font-semibold text-neutral-900">{bookingRiskSummary.noShow}</span></span>
          <span className="hidden sm:inline text-neutral-300">•</span>
          <span>Cancelled: <span className="font-semibold text-neutral-900">{bookingRiskSummary.cancelled}</span></span>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              type="search"
              label="Search"
              placeholder="Booking ID, customer/provider name or ID"
              value={bookingSearchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-2">Filter</label>
              <select
                value={bookingFilter}
                onChange={(event) => onFilterChange(event.target.value as 'all' | 'sla' | 'high-risk')}
                className="input-field w-full"
              >
                <option value="all">All Bookings</option>
                <option value="sla">SLA Queue</option>
                <option value="high-risk">High Risk</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-2">Bulk Action</label>
              <select
                value={bulkStatus}
                onChange={(event) => onBulkStatusChange(event.target.value as 'confirmed' | 'completed' | 'cancelled' | 'no_show')}
                className="input-field w-full"
              >
                <option value="confirmed">Mark: Confirmed</option>
                <option value="completed">Mark: Completed</option>
                <option value="cancelled">Mark: Cancelled</option>
                <option value="no_show">Mark: No-show</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={onApplyBulkStatus}
                disabled={isPending || selectedBookingIds.length === 0}
                className="w-full"
              >
                Apply to {selectedBookingIds.length} Selected
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={onClearSelectedSla}
              disabled={isPending || selectedBookingIds.length === 0}
            >
              Clear SLA (Selected)
            </Button>
          </div>

          {bookingModerationActivity ? (
            <Alert variant="success" className="!py-2 !text-sm">
              Recent moderation activity: {bookingModerationActivity}
            </Alert>
          ) : null}

          {visibleBookings.length === 0 ? (
            <p className="text-body text-neutral-500 text-center py-8">No bookings found</p>
          ) : (
            <div className="space-y-3">
              {visibleBookings.map((booking) => {
                const status = booking.booking_status ?? booking.status;
                const allowedTransitions = ALLOWED_TRANSITIONS[status];
                const canConfirm = allowedTransitions.includes('confirmed');
                const canComplete = allowedTransitions.includes('completed');
                const canNoShow = allowedTransitions.includes('no_show');
                const canCancel = allowedTransitions.includes('cancelled');
                const isTerminalStatus = allowedTransitions.length === 0;
                const nextAllowedStatusLabel = isTerminalStatus
                  ? 'Final state'
                  : `Next allowed: ${allowedTransitions.map((value) => value.replace('_', ' ')).join(', ')}`;

                return (
                  <div key={booking.id} className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.includes(booking.id)}
                          onChange={() => onToggleBookingSelection(booking.id)}
                          className="w-4 h-4 rounded border-neutral-300 mt-1"
                        />
                        <div>
                          <p className="font-semibold text-neutral-900">Booking #{booking.id}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Customer: {booking.customer_name ?? booking.user_id ?? '—'}
                            {booking.customer_phone ? ` • ${booking.customer_phone}` : ''}
                          </p>
                          <p className="text-xs text-neutral-500">
                            Provider: {booking.provider_name ?? `#${booking.provider_id}`}
                          </p>
                          <p className="text-sm text-neutral-600">
                            {formatBookingDateTime(booking)}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">{bookingTimelineLabel(status)}</p>
                          <p className="text-xs text-neutral-500">
                            {booking.service_type ?? 'Service'} • {formatBookingMode(booking.booking_mode ?? 'home_visit')}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {status === 'pending' && (
                          <Alert variant="warning" className="!p-2 !text-xs">SLA Queue</Alert>
                        )}
                        {status === 'no_show' && (
                          <Alert variant="error" className="!p-2 !text-xs">High Risk</Alert>
                        )}
                        {status === 'confirmed' && booking.completion_task_status === 'pending' && (
                          <Alert variant="warning" className="!p-2 !text-xs">Provider Follow-up Pending</Alert>
                        )}
                        {booking.completion_task_status === 'completed' && (
                          <Alert variant="success" className="!p-2 !text-xs">Provider Feedback Logged</Alert>
                        )}
                        <Badge>{status.replace('_', ' ')}</Badge>
                        <span className="text-xs text-neutral-500 self-center">{nextAllowedStatusLabel}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-neutral-200/60">
                      {!isTerminalStatus && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select
                            className="input-field text-sm"
                            defaultValue={booking.provider_id}
                            onChange={(event) => onReassignProvider(booking.id, Number(event.target.value))}
                            disabled={isPending}
                          >
                            <option value="">Reassign to provider...</option>
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {canConfirm ? (
                          <Button size="sm" variant="secondary" onClick={() => onOverrideStatus(booking.id, 'confirmed')} disabled={isPending}>
                            {status === 'pending' ? 'Clear SLA' : 'Confirm'}
                          </Button>
                        ) : null}
                        {canComplete ? (
                          <Button size="sm" variant="success" onClick={() => onOverrideStatus(booking.id, 'completed')} disabled={isPending}>
                            Complete
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
                            Cancel + Reverse
                          </Button>
                        ) : null}
                        {isTerminalStatus ? (
                          <span className="text-xs text-neutral-500 self-center">Finalized — no further actions.</span>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setDetailBookingId(booking.id)}>
                          View Details
                        </Button>
                        {booking.user_id && (
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
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
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
