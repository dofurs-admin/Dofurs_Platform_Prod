import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
      <Text style={styles.title}>Bookings</Text>
      <Text style={styles.subtitle}>Track upcoming and past appointments.</Text>

      {bookingsQuery.isLoading ? <Text style={styles.meta}>Loading bookings...</Text> : null}

      {bookingsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load bookings right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => bookingsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {bookings.map((booking) => (
        <Pressable key={booking.id} style={styles.card} onPress={() => router.push(`/booking/${booking.id}`)}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>{booking.service_type ?? `Booking #${booking.id}`}</Text>
            <Text style={styles.meta}>{booking.booking_date ?? 'Date TBA'} {booking.start_time ?? ''}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.status}>{booking.booking_status ?? 'pending'}</Text>
            <Text style={styles.amount}>{formatCurrency(booking.amount)}</Text>
          </View>
        </Pressable>
      ))}

      {!bookingsQuery.isLoading && !bookingsQuery.isError && bookings.length === 0 ? (
        <Text style={styles.meta}>No bookings found yet.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#4f4b47',
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  status: {
    color: '#5d5853',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  amount: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 13,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});
