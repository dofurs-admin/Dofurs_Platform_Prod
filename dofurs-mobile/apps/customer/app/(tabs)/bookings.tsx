import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getUserBookings } from '@dofurs/shared';

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
  const bookingsQuery = useQuery({
    queryKey: ['customer', 'bookings'],
    queryFn: getUserBookings,
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

  return (
    <Screen scroll>
      <View style={styles.heroCard}>
        <View style={styles.heroPill}>
          <Ionicons name="calendar-clear-outline" color={dofursColors.coral} size={13} />
          <Text style={styles.heroPillLabel}>Bookings</Text>
        </View>
        <Text style={styles.title}>Track upcoming and past grooming appointments</Text>
        <Text style={styles.subtitle}>View date, time, status, and amount for every booking in one place.</Text>
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Upcoming</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>History</Text>
          </View>
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

      {bookings.map((booking) => {
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

      {!bookingsQuery.isLoading && !bookingsQuery.isError && bookings.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Ionicons name="calendar-outline" color="#8f735d" size={18} />
          <Text style={styles.emptyStateTitle}>No bookings yet</Text>
          <Text style={styles.emptyStateSubtitle}>Your upcoming and past appointments will appear here.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff6ed',
    padding: 18,
    gap: 9,
    shadowColor: '#b47a49',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4c5a8',
    backgroundColor: '#fffaf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPillLabel: {
    color: '#91562b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: dofursColors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 35,
  },
  subtitle: {
    color: '#5f4c3e',
    fontSize: 14,
    lineHeight: 21,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5cab1',
    backgroundColor: '#fff9f3',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipLabel: {
    color: '#6a523f',
    fontSize: 12,
    fontWeight: '600',
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
});
