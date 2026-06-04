'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import AdminBookingsView from '@/components/dashboard/admin/views/AdminBookingsView';
import { useToast } from '@/components/ui/ToastProvider';
import { useAdminBookingRealtime } from '@/lib/hooks/useRealtime';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';
import type { BookingStatus } from '@/lib/bookings/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminBooking = {
  id: number;
  user_id?: string;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: BookingStatus;
  booking_status?: BookingStatus | null;
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  included_services?: string[] | null;
  provider_notes?: string | null;
  internal_notes?: string | null;
  provider_service_id?: string | null;
  admin_price_reference?: number | null;
  price_at_booking?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
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

type BookingFilter = 'all' | 'sla' | 'high-risk' | BookingStatus;
type BulkBookingStatus = Exclude<BookingStatus, 'pending'>;

const ALLOWED_TRANSITIONS: Record<BookingStatus, ReadonlyArray<BookingStatus>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function getEffectiveBookingStatus(booking: AdminBooking): BookingStatus {
  return booking.booking_status ?? booking.status;
}

function matchesBookingFilter(booking: AdminBooking, filter: BookingFilter) {
  const status = getEffectiveBookingStatus(booking);

  if (filter === 'all') {
    return true;
  }

  if (filter === 'sla') {
    return status === 'pending';
  }

  if (filter === 'high-risk') {
    return status === 'no_show' || status === 'cancelled';
  }

  return status === filter;
}

type BookingsTabProps = {
  initialBookings: AdminBooking[];
  providers: Provider[];
  openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
};

async function readApiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown } | null;
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Keep the fallback when the response is not JSON.
  }

  return fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingsTab({ initialBookings, providers, openConfirm }: BookingsTabProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [bookings, setBookings] = useState(initialBookings);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingSearchDebounced, setBookingSearchDebounced] = useState('');
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<BulkBookingStatus>('confirmed');
  const [bookingModerationActivity, setBookingModerationActivity] = useState<string | null>(null);

  const bookingActivityTimeoutRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (bookingActivityTimeoutRef.current !== null) {
        window.clearTimeout(bookingActivityTimeoutRef.current);
      }
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBookingSearchDebounced(bookingSearchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [bookingSearchQuery]);

  const refreshBookings = useCallback(async (searchQuery?: string) => {
    try {
      const params = new URLSearchParams();
      const normalizedSearch = (searchQuery ?? '').trim();
      if (normalizedSearch) params.set('q', normalizedSearch);
      params.set('limit', '300');
      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, []);

  useAdminBookingRealtime(refreshBookings);

  // Refresh when debounced search changes
  useEffect(() => {
    void refreshBookings(bookingSearchDebounced);
  }, [bookingSearchDebounced, refreshBookings]);

  const visibleBookings = useMemo(() => {
    const normalizedSearch = bookingSearchDebounced.trim().toLowerCase();
    let filtered = bookings;

    if (normalizedSearch) {
      filtered = filtered.filter((booking) => {
        const status = getEffectiveBookingStatus(booking).replace('_', ' ');
        return [
          booking.id.toString(),
          booking.user_id ?? '',
          booking.provider_id.toString(),
          booking.customer_name ?? '',
          booking.customer_email ?? '',
          booking.customer_phone ?? '',
          booking.provider_name ?? '',
          booking.service_type ?? '',
          (booking.included_services ?? []).join(' '),
          status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      });
    }

    return filtered.filter((booking) => matchesBookingFilter(booking, bookingFilter));
  }, [bookings, bookingFilter, bookingSearchDebounced]);

  const bookingRiskSummary = useMemo(() => ({
    inProgress: bookings.filter((b) => {
      const s = getEffectiveBookingStatus(b);
      return s === 'pending' || s === 'confirmed' || s === 'in_progress';
    }).length,
    completed: bookings.filter((b) => getEffectiveBookingStatus(b) === 'completed').length,
    pending: bookings.filter((b) => getEffectiveBookingStatus(b) === 'pending').length,
    noShow: bookings.filter((b) => getEffectiveBookingStatus(b) === 'no_show').length,
    cancelled: bookings.filter((b) => getEffectiveBookingStatus(b) === 'cancelled').length,
  }), [bookings]);

  const logModerationActivity = useCallback((message: string) => {
    setBookingModerationActivity(message);
    if (bookingActivityTimeoutRef.current !== null) {
      window.clearTimeout(bookingActivityTimeoutRef.current);
    }
    bookingActivityTimeoutRef.current = window.setTimeout(() => {
      setBookingModerationActivity(null);
      bookingActivityTimeoutRef.current = null;
    }, 8000);
  }, []);

  function applyBookingStatusForIds(
    bookingIds: number[],
    status: BulkBookingStatus,
    successMessage: string,
  ) {
    if (bookingIds.length === 0) {
      showToast('Select at least one booking first.', 'error');
      return;
    }

    const selectedBookings = bookingIds
      .map((id) => bookings.find((b) => b.id === id))
      .filter((b): b is AdminBooking => Boolean(b));

    const eligibleIds: number[] = [];
    const ineligible: Array<{ id: number; currentStatus: BookingStatus; reason: 'noop' | 'transition' }> = [];

    for (const booking of selectedBookings) {
      const currentStatus = getEffectiveBookingStatus(booking);
      if (currentStatus === status) {
        ineligible.push({ id: booking.id, currentStatus, reason: 'noop' });
        continue;
      }
      if (!ALLOWED_TRANSITIONS[currentStatus].includes(status)) {
        ineligible.push({ id: booking.id, currentStatus, reason: 'transition' });
        continue;
      }
      eligibleIds.push(booking.id);
    }

    if (eligibleIds.length === 0) {
      const sample = ineligible[0];
      if (sample?.reason === 'transition') {
        showToast(
          `No eligible bookings. ${sample.currentStatus.replace('_', ' ')} cannot move to ${status.replace('_', ' ')}.`,
          'error',
        );
        return;
      }
      showToast(`No changes applied. Already ${status.replace('_', ' ')}.`, 'error');
      return;
    }

    if (ineligible.length > 0) {
      showToast(`Skipped ${ineligible.length} booking(s) with incompatible status.`, 'error');
    }

    setBookings((current) =>
      current.map((b) =>
        eligibleIds.includes(b.id)
          ? { ...b, status, booking_status: status }
          : b,
      ),
    );

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/bookings/bulk-status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingIds: eligibleIds, status }),
        });
        const payload = await response.json().catch(() => ({})) as {
          success?: boolean;
          updated?: number;
          failed?: number;
          results?: Array<{ bookingId: number; success: boolean; error?: string }>;
          error?: string;
        };

        await refreshBookings(bookingSearchDebounced);

        if (!response.ok) {
          throw new Error(payload.error ?? 'Bulk update failed.');
        }

        if ((payload.failed ?? 0) > 0) {
          const firstFailure = payload.results?.find((r) => !r.success);
          throw new Error(firstFailure?.error ?? `${payload.failed} booking update(s) rejected.`);
        }

        setSelectedBookingIds((current) => current.filter((id) => !eligibleIds.includes(id)));
        showToast(successMessage, 'success');
        logModerationActivity(`${eligibleIds.length} booking(s) updated to ${status.replace('_', ' ')}.`);
      } catch (error) {
        await refreshBookings(bookingSearchDebounced);
        showToast(error instanceof Error ? error.message : 'Bulk update failed.', 'error');
      }
    });
  }

  function overrideStatus(bookingId: number, status: BulkBookingStatus) {
    if (status === 'cancelled' || status === 'no_show') {
      openConfirm({
        title: status === 'cancelled' ? 'Cancel Booking' : 'Mark as No-Show',
        description: status === 'cancelled'
          ? `Cancel booking #${bookingId}? The customer will be notified.`
          : `Mark booking #${bookingId} as no-show?`,
        confirmLabel: status === 'cancelled' ? 'Cancel Booking' : 'Mark No-Show',
        confirmVariant: status === 'cancelled' ? 'danger' : 'warning',
        onConfirm: () =>
          applyBookingStatusForIds(
            [bookingId],
            status,
            `Booking #${bookingId} marked ${status.replace('_', ' ')}.`,
          ),
      });
      return;
    }
    applyBookingStatusForIds([bookingId], status, `Booking #${bookingId} marked ${status.replace('_', ' ')}.`);
  }

  function applyBulkStatus() {
    if (bulkStatus === 'cancelled' || bulkStatus === 'no_show') {
      const count = selectedBookingIds.length;
      openConfirm({
        title: bulkStatus === 'cancelled' ? 'Cancel Selected Bookings' : 'Mark Selected as No-Show',
        description: bulkStatus === 'cancelled'
          ? `Cancel ${count} selected booking(s)?`
          : `Mark ${count} selected booking(s) as no-show?`,
        confirmLabel: bulkStatus === 'cancelled' ? 'Cancel Bookings' : 'Mark No-Show',
        confirmVariant: bulkStatus === 'cancelled' ? 'danger' : 'warning',
        onConfirm: () =>
          applyBookingStatusForIds(selectedBookingIds, bulkStatus, `Status updated to ${bulkStatus.replace('_', ' ')}.`),
      });
      return;
    }
    // Require confirmation for large bulk operations (>10 bookings) to prevent accidental changes
    if (selectedBookingIds.length > 10) {
      openConfirm({
        title: `Update ${selectedBookingIds.length} Bookings`,
        description: `You are about to change ${selectedBookingIds.length} bookings to "${bulkStatus.replace('_', ' ')}". This cannot be easily reversed.`,
        confirmLabel: `Update ${selectedBookingIds.length} Bookings`,
        confirmVariant: 'warning',
        onConfirm: () =>
          applyBookingStatusForIds(selectedBookingIds, bulkStatus, `Status updated to ${bulkStatus.replace('_', ' ')}.`),
      });
      return;
    }
    applyBookingStatusForIds(selectedBookingIds, bulkStatus, `Status updated to ${bulkStatus.replace('_', ' ')}.`);
  }

  function clearSelectedSla() {
    const pendingSelectedIds = bookings
      .filter((b) => selectedBookingIds.includes(b.id) && getEffectiveBookingStatus(b) === 'pending')
      .map((b) => b.id);

    if (pendingSelectedIds.length === 0) {
      showToast('Select at least one pending booking to clear SLA.', 'error');
      return;
    }
    if (pendingSelectedIds.length > 10) {
      openConfirm({
        title: `Clear SLA for ${pendingSelectedIds.length} Bookings`,
        description: `Confirm ${pendingSelectedIds.length} pending bookings to "confirmed"?`,
        confirmLabel: `Confirm ${pendingSelectedIds.length} Bookings`,
        confirmVariant: 'warning',
        onConfirm: () =>
          applyBookingStatusForIds(pendingSelectedIds, 'confirmed', `SLA cleared for ${pendingSelectedIds.length} booking(s).`),
      });
      return;
    }
    applyBookingStatusForIds(pendingSelectedIds, 'confirmed', `SLA cleared for ${pendingSelectedIds.length} booking(s).`);
  }

  function reassignProvider(bookingId: number, providerId: number) {
    if (!Number.isFinite(providerId) || providerId <= 0) {
      showToast('Choose a provider to reassign.', 'error');
      return;
    }

    const previous = bookings;
    setBookings((current) =>
      current.map((b) =>
        b.id === bookingId
          ? { ...b, provider_id: providerId, provider_name: providers.find((provider) => provider.id === providerId)?.name ?? b.provider_name }
          : b,
      ),
    );

    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast(await readApiErrorMessage(response, 'Reassign failed.'), 'error');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { booking?: Partial<AdminBooking> } | null;
      if (payload?.booking) {
        setBookings((current) =>
          current.map((booking) =>
            booking.id === bookingId
              ? {
                  ...booking,
                  provider_id: payload.booking?.provider_id ?? providerId,
                  provider_service_id: payload.booking?.provider_service_id ?? booking.provider_service_id,
                  service_type: payload.booking?.service_type ?? booking.service_type,
                  provider_notes: payload.booking?.provider_notes ?? booking.provider_notes,
                  internal_notes: payload.booking?.internal_notes ?? booking.internal_notes,
                  status: payload.booking?.status ?? booking.status,
                  booking_status: payload.booking?.booking_status ?? booking.booking_status,
                }
              : booking,
          ),
        );
      }
      showToast('Provider reassigned.', 'success');
    });
  }

  function applyBookingAdjustment(bookingId: number) {
    openConfirm({
      title: 'Apply Booking Adjustment',
      description: 'Cancel the booking and record an adjustment for the direct provider payment model.',
      confirmLabel: 'Apply Adjustment',
      confirmVariant: 'warning',
      inputLabel: 'Adjustment note',
      inputDefaultValue: 'Booking cancelled by admin (direct provider payment model)',
      onConfirm: (reason) =>
        doApplyBookingAdjustment(
          bookingId,
          reason?.trim() || 'Booking cancelled by admin (direct provider payment model)',
        ),
    });
  }

  function doApplyBookingAdjustment(bookingId: number, reason: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/bookings/${bookingId}/adjustment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Unable to apply adjustment.');
        setBookings((current) =>
          current.map((b) =>
            b.id === bookingId ? { ...b, status: 'cancelled', booking_status: 'cancelled' } : b,
          ),
        );
        showToast('Booking adjustment applied and status set to cancelled.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to apply booking adjustment.', 'error');
      }
    });
  }

  function markCashPaymentReceived(bookingId: number) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) {
      showToast('Booking not found.', 'error');
      return;
    }

    if (booking.payment_mode !== 'direct_to_provider' && booking.payment_mode !== 'mixed') {
      showToast('Manual collection is only available for direct-to-provider or mixed payments.', 'error');
      return;
    }

    if (booking.cash_collected) {
      showToast('Payment is already marked as received.', 'success');
      return;
    }

    openConfirm({
      title: 'Mark Cash As Received',
      description: `Confirm cash has been collected for booking #${bookingId}. This will allow completion.`,
      confirmLabel: 'Mark Received',
      confirmVariant: 'warning',
      onConfirm: () => doMarkCashPaymentReceived(bookingId),
    });
  }

  function doMarkCashPaymentReceived(bookingId: number) {

    setBookings((current) =>
      current.map((item) => (item.id === bookingId ? { ...item, cash_collected: true } : item)),
    );

    startTransition(async () => {
      try {
        const response = await fetch(`/api/payments/bookings/${bookingId}/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionMode: 'cash' }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to mark payment as received.');
        }

        await refreshBookings(bookingSearchDebounced);
        showToast(`Cash payment received for booking #${bookingId}.`, 'success');
      } catch (error) {
        await refreshBookings(bookingSearchDebounced);
        showToast(error instanceof Error ? error.message : 'Unable to mark payment as received.', 'error');
      }
    });
  }

  function toggleBookingSelection(bookingId: number) {
    setSelectedBookingIds((current) =>
      current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId],
    );
  }

  return (
    <div className="space-y-5">
      <AdminBookingsView
        bookingRiskSummary={bookingRiskSummary}
        bookingSearchQuery={bookingSearchQuery}
        onSearchChange={setBookingSearchQuery}
        bookingFilter={bookingFilter}
        onFilterChange={setBookingFilter}
        bulkStatus={bulkStatus}
        onBulkStatusChange={setBulkStatus}
        onApplyBulkStatus={applyBulkStatus}
        selectedBookingIds={selectedBookingIds}
        onToggleBookingSelection={toggleBookingSelection}
        onClearSelectedSla={clearSelectedSla}
        bookingModerationActivity={bookingModerationActivity}
        visibleBookings={visibleBookings}
        providers={providers}
        isPending={isPending}
        onReassignProvider={reassignProvider}
        onOverrideStatus={overrideStatus}
        onApplyBookingAdjustment={applyBookingAdjustment}
        onMarkCashPaymentReceived={markCashPaymentReceived}
      />
    </div>
  );
}
