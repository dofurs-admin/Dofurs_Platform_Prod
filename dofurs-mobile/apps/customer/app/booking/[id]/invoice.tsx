import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);

  const bookingsQuery = useQuery({
    queryKey: ['customer', 'booking', bookingId, 'invoice'],
    queryFn: getUserBookings,
  });

  const booking = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    return rows.find((row) => Number((row as Record<string, unknown>).id ?? NaN) === bookingId) as
      | Record<string, unknown>
      | undefined;
  }, [bookingId, bookingsQuery.data?.bookings]);

  return (
    <Screen>
      {!booking ? (
        <Text style={styles.meta}>{bookingsQuery.isLoading ? 'Loading invoice...' : 'Invoice data not found.'}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>Invoice summary</Text>
          <Text style={styles.meta}>Booking ID: {bookingId}</Text>
          <Text style={styles.meta}>Service: {typeof booking.service_type === 'string' ? booking.service_type : '--'}</Text>
          <Text style={styles.meta}>Date: {typeof booking.booking_date === 'string' ? booking.booking_date : '--'}</Text>
          <Text style={styles.meta}>Time: {typeof booking.start_time === 'string' ? booking.start_time : '--'}</Text>
          <Text style={styles.meta}>Status: {typeof booking.booking_status === 'string' ? booking.booking_status : '--'}</Text>

          <View style={styles.divider} />

          <Text style={styles.amountLabel}>Base amount: {formatCurrency(booking.price_at_booking)}</Text>
          <Text style={styles.amountLabel}>Discount: {formatCurrency(booking.discount_amount)}</Text>
          <Text style={styles.amountLabel}>Wallet credits: {formatCurrency(booking.wallet_credits_applied_inr)}</Text>
          <Text style={styles.amountValue}>Total paid/payable: {formatCurrency(booking.amount ?? booking.final_price ?? booking.price_at_booking)}</Text>

          <Text style={styles.note}>Detailed tax invoice endpoint is not exposed in mobile API yet. This summary uses booking billing fields.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 7,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 21,
    fontWeight: '700',
  },
  meta: {
    color: '#5d5853',
    fontSize: 13,
  },
  divider: {
    marginVertical: 4,
    height: 1,
    backgroundColor: '#e7c4a7',
  },
  amountLabel: {
    color: '#5d5853',
    fontSize: 13,
  },
  amountValue: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    marginTop: 6,
    color: '#7d736c',
    fontSize: 12,
  },
});
