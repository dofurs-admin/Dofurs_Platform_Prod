'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

type BookingFilter = 'all' | 'sla' | 'high-risk' | BookingStatus;
type BulkBookingStatus = BookingStatus;
type BookingDatePreset = 'today' | 'last_7_days' | 'this_month';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_FILTER_VALUES: ReadonlyArray<BookingFilter> = [
  'all',
  'sla',
  'high-risk',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];

function normalizeSearchQueryValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeBookingFilterValue(value: string | null | undefined): BookingFilter {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return 'all';
  }

  return BOOKING_FILTER_VALUES.includes(normalizedValue as BookingFilter)
    ? (normalizedValue as BookingFilter)
    : 'all';
}

function normalizeDateInputValue(value: string | null | undefined): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return '';
  }

  return DATE_INPUT_PATTERN.test(normalizedValue) ? normalizedValue : '';
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function resolveBookingDateKey(booking: Pick<AdminBooking, 'booking_date' | 'booking_start'>): string | null {
  const normalizedBookingDate = booking.booking_date?.trim();
  if (normalizedBookingDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedBookingDate)) {
    return normalizedBookingDate;
  }

  const normalizedBookingStart = booking.booking_start?.trim();
  if (!normalizedBookingStart) {
    return null;
  }

  const bookingStartDate = normalizedBookingStart.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(bookingStartDate)) {
    return bookingStartDate;
  }

  const parsedDate = new Date(normalizedBookingStart);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function matchesBookingDateRange(
  booking: Pick<AdminBooking, 'booking_date' | 'booking_start'>,
  fromDate?: string,
  toDate?: string,
) {
  if (!fromDate && !toDate) {
    return true;
  }

  const bookingDateKey = resolveBookingDateKey(booking);
  if (!bookingDateKey) {
    return false;
  }

  if (fromDate && bookingDateKey < fromDate) {
    return false;
  }

  if (toDate && bookingDateKey > toDate) {
    return false;
  }

  return true;
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [bookings, setBookings] = useState(initialBookings);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>(() => normalizeBookingFilterValue(searchParams.get('filter')));
  const [bookingSearchQuery, setBookingSearchQuery] = useState(() => normalizeSearchQueryValue(searchParams.get('q')));
  const [bookingSearchDebounced, setBookingSearchDebounced] = useState(() => normalizeSearchQueryValue(searchParams.get('q')));
  const [bookingDateFrom, setBookingDateFrom] = useState(() => normalizeDateInputValue(searchParams.get('fromDate')));
  const [bookingDateTo, setBookingDateTo] = useState(() => normalizeDateInputValue(searchParams.get('toDate')));
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<BulkBookingStatus>('confirmed');
  const [bookingModerationActivity, setBookingModerationActivity] = useState<string | null>(null);

  const bookingActivityTimeoutRef = useRef<number | null>(null);
  const bookingSearchRef = useRef(bookingSearchDebounced);
  const bookingDateFromRef = useRef(bookingDateFrom);
  const bookingDateToRef = useRef(bookingDateTo);

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

  useEffect(() => {
    bookingSearchRef.current = bookingSearchDebounced;
  }, [bookingSearchDebounced]);

  useEffect(() => {
    bookingDateFromRef.current = bookingDateFrom;
  }, [bookingDateFrom]);

  useEffect(() => {
    bookingDateToRef.current = bookingDateTo;
  }, [bookingDateTo]);

  useEffect(() => {
    const searchQueryFromQuery = normalizeSearchQueryValue(searchParams.get('q'));
    const filterFromQuery = normalizeBookingFilterValue(searchParams.get('filter'));
    const fromDateFromQuery = normalizeDateInputValue(searchParams.get('fromDate'));
    const toDateFromQuery = normalizeDateInputValue(searchParams.get('toDate'));

    setBookingSearchQuery((current) => (current === searchQueryFromQuery ? current : searchQueryFromQuery));
    setBookingSearchDebounced((current) => (current === searchQueryFromQuery ? current : searchQueryFromQuery));
    setBookingFilter((current) => (current === filterFromQuery ? current : filterFromQuery));
    setBookingDateFrom((current) => (current === fromDateFromQuery ? current : fromDateFromQuery));
    setBookingDateTo((current) => (current === toDateFromQuery ? current : toDateFromQuery));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedSearchQuery = bookingSearchQuery.trim();

    if (normalizedSearchQuery) {
      params.set('q', normalizedSearchQuery);
    } else {
      params.delete('q');
    }

    if (bookingFilter !== 'all') {
      params.set('filter', bookingFilter);
    } else {
      params.delete('filter');
    }

    if (bookingDateFrom) {
      params.set('fromDate', bookingDateFrom);
    } else {
      params.delete('fromDate');
    }

    if (bookingDateTo) {
      params.set('toDate', bookingDateTo);
    } else {
      params.delete('toDate');
    }

    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();

    if (currentQuery === nextQuery) {
      return;
    }

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [bookingDateFrom, bookingDateTo, bookingFilter, bookingSearchQuery, pathname, router, searchParams]);

  const refreshBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const normalizedSearch = bookingSearchRef.current.trim();
      if (normalizedSearch) params.set('q', normalizedSearch);
      if (bookingDateFromRef.current) params.set('fromDate', bookingDateFromRef.current);
      if (bookingDateToRef.current) params.set('toDate', bookingDateToRef.current);
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

  // Refresh when search or date filters change
  useEffect(() => {
    void refreshBookings();
  }, [bookingDateFrom, bookingDateTo, bookingSearchDebounced, refreshBookings]);

  const bookingsWithinDateRange = useMemo(
    () =>
      bookings.filter((booking) =>
        matchesBookingDateRange(booking, bookingDateFrom || undefined, bookingDateTo || undefined),
      ),
    [bookings, bookingDateFrom, bookingDateTo],
  );

  const visibleBookings = useMemo(() => {
    const normalizedSearch = bookingSearchDebounced.trim().toLowerCase();
    let filtered = bookingsWithinDateRange;

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
  }, [bookingFilter, bookingSearchDebounced, bookingsWithinDateRange]);

  const bookingRiskSummary = useMemo(() => ({
    inProgress: bookingsWithinDateRange.filter((b) => {
      const s = getEffectiveBookingStatus(b);
      return s === 'pending' || s === 'confirmed' || s === 'in_progress';
    }).length,
    completed: bookingsWithinDateRange.filter((b) => getEffectiveBookingStatus(b) === 'completed').length,
    pending: bookingsWithinDateRange.filter((b) => getEffectiveBookingStatus(b) === 'pending').length,
    noShow: bookingsWithinDateRange.filter((b) => getEffectiveBookingStatus(b) === 'no_show').length,
    cancelled: bookingsWithinDateRange.filter((b) => getEffectiveBookingStatus(b) === 'cancelled').length,
  }), [bookingsWithinDateRange]);

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
    let skippedNoopCount = 0;

    for (const booking of selectedBookings) {
      const currentStatus = getEffectiveBookingStatus(booking);
      if (currentStatus === status) {
        skippedNoopCount += 1;
        continue;
      }

      eligibleIds.push(booking.id);
    }

    if (eligibleIds.length === 0) {
      showToast(`No changes applied. Already ${status.replace('_', ' ')}.`, 'error');
      return;
    }

    if (skippedNoopCount > 0) {
      showToast(`Skipped ${skippedNoopCount} booking(s) already in ${status.replace('_', ' ')}.`, 'error');
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

        await refreshBookings();

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
        await refreshBookings();
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

        await refreshBookings();
        showToast(`Cash payment received for booking #${bookingId}.`, 'success');
      } catch (error) {
        await refreshBookings();
        showToast(error instanceof Error ? error.message : 'Unable to mark payment as received.', 'error');
      }
    });
  }

  function clearDateRange() {
    setBookingDateFrom('');
    setBookingDateTo('');
  }

  function handleDateFromChange(value: string) {
    const normalizedValue = normalizeDateInputValue(value);
    setBookingDateFrom(normalizedValue);
    setBookingDateTo((current) => {
      if (!current || !normalizedValue || current >= normalizedValue) {
        return current;
      }
      return normalizedValue;
    });
  }

  function handleDateToChange(value: string) {
    const normalizedValue = normalizeDateInputValue(value);
    setBookingDateTo(normalizedValue);
    setBookingDateFrom((current) => {
      if (!current || !normalizedValue || current <= normalizedValue) {
        return current;
      }
      return normalizedValue;
    });
  }

  function applyDatePreset(preset: BookingDatePreset) {
    const today = new Date();

    if (preset === 'today') {
      const todayValue = formatDateForInput(today);
      setBookingDateFrom(todayValue);
      setBookingDateTo(todayValue);
      return;
    }

    if (preset === 'last_7_days') {
      setBookingDateFrom(formatDateForInput(addDays(today, -6)));
      setBookingDateTo(formatDateForInput(today));
      return;
    }

    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setBookingDateFrom(formatDateForInput(firstDay));
    setBookingDateTo(formatDateForInput(lastDay));
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
        bookingDateFrom={bookingDateFrom}
        bookingDateTo={bookingDateTo}
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
        onApplyDatePreset={applyDatePreset}
        onClearDateRange={clearDateRange}
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
