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

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

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
  if (value == null) {
    return 'INR --';
  }

  return `INR ${Math.round(value)}`;
}

function getStatusTone(status: string | null) {
  if (!status) {
    return {
      labelColor: '#7b6959',
      backgroundColor: '#fff8f1',
      borderColor: '#e9cfb8',
    };
  }

  if (status === 'completed') {
    return {
      labelColor: '#356c47',
      backgroundColor: '#eef9f1',
      borderColor: '#cce7d6',
    };
  }

  if (status === 'cancelled') {
    return {
      labelColor: '#9a4538',
      backgroundColor: '#fff2ef',
      borderColor: '#f0c3ba',
    };
  }

  if (status === 'confirmed' || status === 'in_progress') {
    return {
      labelColor: '#6a4b31',
      backgroundColor: '#fff4e6',
      borderColor: '#ecccae',
    };
  }

  return {
    labelColor: '#7b6959',
    backgroundColor: '#fff8f1',
    borderColor: '#e9cfb8',
  };
}

export default function CustomerBookingsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'active' | 'history'>('all');

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

  const bookingCounts = useMemo(() => {
    const active = bookings.filter((booking) => {
      const status = booking.booking_status ?? '';
      return status === 'pending' || status === 'confirmed' || status === 'in_progress';
    }).length;

    const completed = bookings.filter((booking) => booking.booking_status === 'completed').length;
    const noShows = bookings.filter((booking) => booking.booking_status === 'no_show').length;

    return {
      active,
      completed,
      noShows,
      total: bookings.length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (bookingFilter === 'all') {
      return bookings;
    }

    if (bookingFilter === 'active') {
      return bookings.filter((booking) => {
        const status = booking.booking_status ?? '';
        return status === 'pending' || status === 'confirmed' || status === 'in_progress';
      });
    }

    return bookings.filter((booking) => {
      const status = booking.booking_status ?? '';
      return status === 'completed' || status === 'cancelled' || status === 'no_show';
    });
  }, [bookingFilter, bookings]);

  const bookingSummaryText = useMemo(() => {
    if (bookingFilter === 'active') {
      return `${bookingCounts.active} active bookings`;
    }

    if (bookingFilter === 'history') {
      return `${filteredBookings.length} bookings in history`;
    }

    return `${bookingCounts.active} active and ${bookingCounts.total} total`;
  }, [bookingCounts.active, bookingCounts.total, bookingFilter, filteredBookings.length]);

  function handleRefresh() {
    void bookingsQuery.refetch();
  }

  return (
    <Screen scroll refreshing={bookingsQuery.isRefetching} onRefresh={handleRefresh}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Manage Bookings</Text>
        <Pressable style={styles.newBookingButton} onPress={() => router.push('/booking/new/service')}>
          <Ionicons name="add-circle-outline" color="#ffffff" size={14} />
          <Text style={styles.newBookingButtonLabel}>Book new</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Your Bookings at a Glance</Text>
        <View style={styles.glanceGrid}>
          <View style={styles.glanceStatCard}>
            <Text style={styles.glanceStatLabel}>Active Bookings</Text>
            <Text style={styles.glanceStatValue}>{bookingCounts.active}</Text>
          </View>
          <View style={styles.glanceStatCard}>
            <Text style={styles.glanceStatLabel}>Completed</Text>
            <Text style={styles.glanceStatValue}>{bookingCounts.completed}</Text>
          </View>
          <View style={styles.glanceStatCard}>
            <Text style={styles.glanceStatLabel}>No Shows</Text>
            <Text style={styles.glanceStatValue}>{bookingCounts.noShows}</Text>
          </View>
          <View style={styles.glanceStatCard}>
            <Text style={styles.glanceStatLabel}>Total Bookings</Text>
            <Text style={styles.glanceStatValue}>{bookingCounts.total}</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.filterSummaryText}>{bookingSummaryText}</Text>
        <View style={styles.filterChipRow}>
          <Pressable
            style={[styles.filterChip, bookingFilter === 'all' ? styles.filterChipActive : null]}
            onPress={() => setBookingFilter('all')}
          >
            <Text style={[styles.filterChipLabel, bookingFilter === 'all' ? styles.filterChipLabelActive : null]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, bookingFilter === 'active' ? styles.filterChipActive : null]}
            onPress={() => setBookingFilter('active')}
          >
            <Text style={[styles.filterChipLabel, bookingFilter === 'active' ? styles.filterChipLabelActive : null]}>Active</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, bookingFilter === 'history' ? styles.filterChipActive : null]}
            onPress={() => setBookingFilter('history')}
          >
            <Text style={[styles.filterChipLabel, bookingFilter === 'history' ? styles.filterChipLabelActive : null]}>History</Text>
          </Pressable>
        </View>
      </View>

      {bookingsQuery.isLoading ? <Text style={styles.meta}>Loading bookings...</Text> : null}

      {bookingsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load bookings right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => bookingsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {filteredBookings.map((booking) => {
        const statusTone = getStatusTone(booking.booking_status);

        return (
          <Pressable key={booking.id} style={styles.card} onPress={() => router.push(`/booking/${booking.id}`)}>
            <View style={styles.cardLeft}>
              <View style={styles.listTitleRow}>
                <View style={styles.listIconWrap}>
                  <Ionicons name="paw-outline" color="#8d5e37" size={14} />
                </View>
                <Text style={styles.cardTitle}>{booking.service_type ?? `Booking #${booking.id}`}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" color="#97775d" size={12} />
                <Text style={styles.meta}>{booking.booking_date ?? 'Date TBA'} {booking.start_time ?? ''}</Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusTone.backgroundColor,
                    borderColor: statusTone.borderColor,
                  },
                ]}
              >
                <Text style={[styles.status, { color: statusTone.labelColor }]}>
                  {booking.booking_status ?? 'pending'}
                </Text>
              </View>

              <Text style={styles.amount}>{formatCurrency(booking.amount)}</Text>
            </View>
          </Pressable>
        );
      })}

      {!bookingsQuery.isLoading && !bookingsQuery.isError && filteredBookings.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Ionicons name="calendar-outline" color="#8f735d" size={18} />
          <Text style={styles.emptyStateTitle}>{bookingFilter === 'active' ? 'No Active Bookings' : 'No Bookings'}</Text>
          <Text style={styles.emptyStateSubtitle}>
            {bookingFilter === 'active'
              ? 'You are all caught up. Create a new booking when you are ready.'
              : 'Start by booking grooming for your pet.'}
          </Text>
          {bookingFilter !== 'active' ? (
            <Pressable style={styles.emptyStateButton} onPress={() => router.push('/booking/new/service')}>
              <Text style={styles.emptyStateButtonLabel}>Book now</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fffaf4',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  glanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  glanceStatCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fffdf9',
    padding: 10,
    gap: 3,
  },
  glanceStatLabel: {
    color: '#6b7280',
    fontSize: 11,
  },
  glanceStatValue: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
  },
  filterCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  filterSummaryText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff8f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: '#ca7d44',
    backgroundColor: '#ffeedf',
  },
  filterChipLabel: {
    color: '#6b4328',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipLabelActive: {
    color: '#8b4a1a',
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  newBookingButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c97a42',
    backgroundColor: dofursColors.coral,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBookingButtonLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 13,
    shadowColor: '#b47a49',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 7,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e8c9ac',
    backgroundColor: '#fff5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  status: {
    fontSize: 11,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  amount: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: '#7b6959',
    fontSize: 12,
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1b5a8',
    backgroundColor: '#fff2ef',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#a6483b',
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyStateTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyStateSubtitle: {
    color: '#7b6959',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyStateButtonLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
