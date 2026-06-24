import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getCreditWallet, getUserBookings } from '@dofurs/shared';

type BookingSummary = {
  id: number;
  booking_date: string | null;
  start_time: string | null;
  booking_status: string | null;
  amount: number | null;
  service_type: string | null;
};

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

function parseBookingSummary(row: Record<string, unknown>): BookingSummary | null {
  const id = Number(row.id ?? NaN);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    booking_date: typeof row.booking_date === 'string' ? row.booking_date : null,
    start_time: typeof row.start_time === 'string' ? row.start_time : null,
    booking_status: typeof row.booking_status === 'string' ? row.booking_status : (typeof row.status === 'string' ? row.status : null),
    amount: typeof row.amount === 'number' ? row.amount : (typeof row.final_price === 'number' ? row.final_price : null),
    service_type: typeof row.service_type === 'string' ? row.service_type : null,
  };
}

export default function CustomerHomeScreen() {
  const router = useRouter();

  const bookingsQuery = useQuery({
    queryKey: ['customer', 'home', 'bookings'],
    queryFn: getUserBookings,
  });

  const walletQuery = useQuery({
    queryKey: ['customer', 'home', 'wallet'],
    queryFn: getCreditWallet,
  });

  const bookings = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    return rows
      .map((row) => parseBookingSummary(row as Record<string, unknown>))
      .filter((row): row is BookingSummary => Boolean(row));
  }, [bookingsQuery.data?.bookings]);

  const upcomingBooking = useMemo(() => {
    const activeStatuses = new Set(['pending', 'confirmed', 'in_progress']);
    const sorted = bookings.slice().sort((left, right) => {
      const leftKey = `${left.booking_date ?? ''}T${left.start_time ?? '00:00'}`;
      const rightKey = `${right.booking_date ?? ''}T${right.start_time ?? '00:00'}`;
      return leftKey.localeCompare(rightKey);
    });

    return sorted.find((booking) => booking.booking_status && activeStatuses.has(booking.booking_status)) ?? null;
  }, [bookings]);

  const creditBalance = Math.max(
    0,
    Number(
      (walletQuery.data?.balance as { available_inr?: unknown } | undefined)?.available_inr ??
        (walletQuery.data?.balance as { availableInr?: unknown } | undefined)?.availableInr ??
        0,
    ),
  );

  const isLoading = bookingsQuery.isLoading || walletQuery.isLoading;

  return (
    <Screen scroll>
      <Text style={styles.title}>Welcome to Dofurs</Text>
      <Text style={styles.subtitle}>Book premium pet care with trusted providers in Bengaluru.</Text>

      {isLoading ? <Text style={styles.meta}>Loading your dashboard...</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Next booking</Text>
        {upcomingBooking ? (
          <>
            <Text style={styles.cardValue}>{upcomingBooking.service_type ?? 'Service booking'}</Text>
            <Text style={styles.meta}>
              {upcomingBooking.booking_date ?? 'Date TBA'} {upcomingBooking.start_time ?? ''}
            </Text>
          </>
        ) : (
          <Text style={styles.cardValue}>No upcoming bookings</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Subscription credits</Text>
        <Text style={styles.cardValue}>{formatCurrency(creditBalance)} available</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Quick actions</Text>
        <View style={styles.row}>
          <Pressable style={styles.quickAction} onPress={() => router.push('/(tabs)/services')}>
            <Text style={styles.quickActionLabel}>Browse services</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/(tabs)/bookings')}>
            <Text style={styles.quickActionLabel}>View bookings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Recent bookings</Text>
        {bookings.slice(0, 3).map((booking) => (
          <Pressable
            key={booking.id}
            style={styles.listItem}
            onPress={() => router.push(`/booking/${booking.id}`)}
          >
            <View>
              <Text style={styles.listTitle}>{booking.service_type ?? `Booking #${booking.id}`}</Text>
              <Text style={styles.meta}>{booking.booking_date ?? 'Date TBA'} {booking.start_time ?? ''}</Text>
            </View>
            <Text style={styles.listValue}>{booking.booking_status ?? 'pending'}</Text>
          </Pressable>
        ))}
        {bookings.length === 0 && !isLoading ? <Text style={styles.meta}>No bookings found yet.</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: dofursColors.ink,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#4f4b47',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 16,
    gap: 6,
  },
  cardLabel: {
    fontSize: 13,
    color: '#7d736c',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '600',
    color: dofursColors.ink,
  },
  meta: {
    color: '#7d736c',
    fontSize: 13,
  },
  quickAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#fffdfb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickActionLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  listValue: {
    color: '#5d5853',
    fontSize: 12,
    textTransform: 'capitalize',
  },
});
