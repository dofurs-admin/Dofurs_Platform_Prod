import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getUserBookings } from '@dofurs/shared';

function formatCurrency(value: unknown) {
  const amount = Number(value ?? NaN);
  if (!Number.isFinite(amount)) {
    return 'INR --';
  }

  return `INR ${Math.round(amount)}`;
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);

  const bookingsQuery = useQuery({
    queryKey: ['customer', 'bookings', 'detail', bookingId],
    queryFn: getUserBookings,
  });

  const booking = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    return rows.find((row) => Number((row as Record<string, unknown>).id ?? NaN) === bookingId) as
      | Record<string, unknown>
      | undefined;
  }, [bookingId, bookingsQuery.data?.bookings]);

  const status =
    typeof booking?.booking_status === 'string'
      ? booking.booking_status
      : (typeof booking?.status === 'string' ? booking.status : 'pending');

  return (
    <Screen scroll>
      {!booking ? (
        <Text style={styles.meta}>{bookingsQuery.isLoading ? 'Loading booking...' : 'Booking not found.'}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>{typeof booking.service_type === 'string' ? booking.service_type : `Booking #${bookingId}`}</Text>
          <Text style={styles.meta}>Status: {status}</Text>
          <Text style={styles.meta}>
            Date: {typeof booking.booking_date === 'string' ? booking.booking_date : '--'} {typeof booking.start_time === 'string' ? booking.start_time : ''}
          </Text>
          <Text style={styles.meta}>Mode: {typeof booking.booking_mode === 'string' ? booking.booking_mode.replace('_', ' ') : '--'}</Text>
          <Text style={styles.meta}>Amount: {formatCurrency(booking.amount ?? booking.final_price ?? booking.price_at_booking)}</Text>
          <Text style={styles.meta}>
            Address: {typeof booking.location_address === 'string' && booking.location_address.trim().length > 0 ? booking.location_address : 'Not available'}
          </Text>

          <View style={styles.row}>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/booking/${bookingId}/invoice`)}>
              <Text style={styles.secondaryButtonLabel}>Invoice</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/booking/${bookingId}/review`)}>
              <Text style={styles.secondaryButtonLabel}>Review</Text>
            </Pressable>
          </View>

          {status === 'pending' || status === 'confirmed' ? (
            <Pressable style={styles.cancelButton} onPress={() => router.push(`/booking/${bookingId}/cancel`)}>
              <Text style={styles.cancelButtonLabel}>Cancel booking</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 8,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  meta: {
    color: '#5d5853',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonLabel: {
    color: '#8a3d2c',
    fontSize: 13,
    fontWeight: '700',
  },
});
