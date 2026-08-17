import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getUserBookings, useAuthStore } from '@dofurs/shared';

type BookingRow = {
  id: number;
  service_type: string | null;
  booking_date: string | null;
  start_time: string | null;
  booking_status: string | null;
  amount: number | null;
};

function toBookingRow(value: Record<string, unknown>): BookingRow | null {
  const id = Number(value.id ?? NaN);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    service_type: typeof value.service_type === 'string' ? value.service_type : null,
    booking_date: typeof value.booking_date === 'string' ? value.booking_date : null,
    start_time: typeof value.start_time === 'string' ? value.start_time : null,
    booking_status:
      typeof value.booking_status === 'string' ? value.booking_status : (typeof value.status === 'string' ? value.status : null),
    amount: typeof value.amount === 'number' ? value.amount : (typeof value.final_price === 'number' ? value.final_price : null),
  };
}

function formatCurrency(value: number | null) {
  if (value == null) return 'INR --';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatBookingDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBA';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatBookingTime(timeStr: string | null): string {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function getStatusConfig(status: string | null) {
  if (status === 'completed') return { label: 'Completed', dotColor: '#22c55e', bgColor: '#f0fdf4', textColor: '#166534' };
  if (status === 'cancelled') return { label: 'Cancelled', dotColor: '#ef4444', bgColor: '#fef2f2', textColor: '#991b1b' };
  if (status === 'confirmed' || status === 'in_progress') return { label: 'Confirmed', dotColor: '#f59e0b', bgColor: '#fffbeb', textColor: '#92400e' };
  if (status === 'pending') return { label: 'Pending', dotColor: '#f59e0b', bgColor: '#fffbeb', textColor: '#92400e' };
  return { label: status ?? 'Pending', dotColor: '#a8a29e', bgColor: '#fafaf9', textColor: '#57534e' };
}

export default function CustomerBookingsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const bookingsQuery = useQuery({
    queryKey: ['customer', 'bookings'],
    queryFn: getUserBookings,
    enabled: Boolean(accessToken),
  });

  const bookings = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    return rows
      .map((row) => toBookingRow(row as Record<string, unknown>))
      .filter((row): row is BookingRow => Boolean(row))
      .sort((left, right) => {
        const leftKey = `${left.booking_date ?? ''}T${left.start_time ?? '00:00'}`;
        const rightKey = `${right.booking_date ?? ''}T${right.start_time ?? '00:00'}`;
        return rightKey.localeCompare(leftKey);
      });
  }, [bookingsQuery.data?.bookings]);

  const filteredBookings = useMemo(() => {
    if (bookingFilter === 'all') return bookings;
    if (bookingFilter === 'upcoming') {
      return bookings.filter((b) => {
        const status = b.booking_status ?? '';
        return status === 'pending' || status === 'confirmed' || status === 'in_progress';
      });
    }
    return bookings.filter((b) => {
      const status = b.booking_status ?? '';
      return status === 'completed' || status === 'cancelled' || status === 'no_show';
    });
  }, [bookingFilter, bookings]);

  const upcomingCount = bookings.filter((b) => {
    const status = b.booking_status ?? '';
    return status === 'pending' || status === 'confirmed' || status === 'in_progress';
  }).length;

  function handleRefresh() {
    void bookingsQuery.refetch();
  }

  return (
    <Screen scroll refreshing={bookingsQuery.isRefetching} onRefresh={handleRefresh}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Bookings</Text>
        <Pressable style={styles.newBookingButton} onPress={() => router.push('/booking/new/service')}>
          <Ionicons name="add" size={16} color={dofursColors.coral} />
          <Text style={styles.newBookingButtonLabel}>Book New</Text>
        </Pressable>
      </View>

      {/* Subtle count line (only when bookings exist) */}
      {bookings.length > 0 ? (
        <Text style={styles.countLine}>{upcomingCount} upcoming · {bookings.length} total</Text>
      ) : null}

      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        {(['all', 'upcoming', 'past'] as const).map((filter) => {
          const isActive = bookingFilter === filter;
          const label = filter === 'all' ? 'All' : filter === 'upcoming' ? 'Upcoming' : 'Past';
          return (
            <Pressable
              key={filter}
              style={[styles.segmentItem, isActive && styles.segmentItemActive]}
              onPress={() => setBookingFilter(filter)}
            >
              <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Loading */}
      {bookingsQuery.isLoading ? <Text style={styles.meta}>Loading bookings...</Text> : null}

      {/* Error */}
      {bookingsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load bookings right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => bookingsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Booking Cards */}
      {filteredBookings.map((booking) => {
        const statusConfig = getStatusConfig(booking.booking_status);
        const isUpcoming = booking.booking_status === 'pending' || booking.booking_status === 'confirmed' || booking.booking_status === 'in_progress';

        return (
          <Pressable
            key={booking.id}
            style={styles.bookingCard}
            onPress={() => router.push(`/booking/${booking.id}`)}
          >
            {isUpcoming ? <View style={styles.bookingCardAccent} /> : null}
            <View style={styles.bookingCardContent}>
              <View style={styles.bookingCardLeft}>
                <Text style={styles.bookingServiceName}>{booking.service_type ?? `Booking #${booking.id}`}</Text>
                <Text style={styles.bookingMeta}>
                  {formatBookingDate(booking.booking_date)}
                  {booking.start_time ? ` · ${formatBookingTime(booking.start_time)}` : ''}
                </Text>
              </View>
              <View style={styles.bookingCardRight}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusConfig.dotColor }]} />
                  <Text style={[styles.statusLabel, { color: statusConfig.textColor }]}>{statusConfig.label}</Text>
                </View>
                {booking.amount ? (
                  <Text style={styles.bookingAmount}>{formatCurrency(booking.amount)}</Text>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#b8a99a" />
          </Pressable>
        );
      })}

      {/* Empty State */}
      {!bookingsQuery.isLoading && !bookingsQuery.isError && filteredBookings.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyStateIconWrap}>
            <Ionicons name="calendar-outline" size={40} color={dofursColors.coral} />
          </View>
          <Text style={styles.emptyStateTitle}>
            {bookingFilter === 'upcoming' ? 'No upcoming bookings' : 'No bookings yet'}
          </Text>
          <Text style={styles.emptyStateSubtitle}>
            {bookingFilter === 'upcoming'
              ? 'You\'re all caught up. Create a new booking when you\'re ready.'
              : 'Book a grooming session and it\'ll show up here.'}
          </Text>
          <Pressable style={styles.emptyStateButton} onPress={() => router.push('/booking/new/service')}>
            <Text style={styles.emptyStateButtonLabel}>Book your first session</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: dofursColors.ink,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  newBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#fef5eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newBookingButtonLabel: {
    color: dofursColors.coral,
    fontSize: 13,
    fontWeight: '600',
  },
  countLine: {
    color: '#a89b8e',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f5f0eb',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
  },
  segmentItemActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentLabel: {
    color: '#78716c',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: dofursColors.ink,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bookingCardAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: dofursColors.coral,
  },
  bookingCardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  bookingCardLeft: {
    flex: 1,
    gap: 3,
  },
  bookingServiceName: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  bookingMeta: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    fontWeight: '400',
  },
  bookingCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  bookingAmount: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    textAlign: 'center',
  },
  errorCard: {
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    padding: 14,
    gap: 8,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyStateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef5eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateSubtitle: {
    color: dofursColors.inkSoft,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: 8,
    backgroundColor: dofursColors.coral,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyStateButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});