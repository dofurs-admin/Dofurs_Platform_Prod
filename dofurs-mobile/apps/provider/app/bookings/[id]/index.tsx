import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  dofursColors,
  getProviderBookings,
  patchProviderBookingStatus,
} from '@dofurs/shared';

type ProviderBookingRow = {
  id: number;
  service_type?: string | null;
  booking_date?: string | null;
  start_time?: string | null;
  booking_status?: string | null;
  payment_mode?: string | null;
  owner_name?: string | null;
  final_price?: number | null;
  location_address?: string | null;
  provider_notes?: string | null;
};

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);

  const bookingQuery = useQuery({
    queryKey: ['provider', 'booking', bookingId],
    queryFn: async () => {
      const response = await getProviderBookings({ limit: 500 });
      const row = (response.bookings ?? []).find((booking) => Number((booking as Record<string, unknown>).id ?? NaN) === bookingId);
      return (row as ProviderBookingRow | undefined) ?? null;
    },
    enabled: Number.isFinite(bookingId) && bookingId > 0,
  });

  const booking = bookingQuery.data;
  const status = booking?.booking_status ?? 'pending';

  const canConfirm = status === 'pending';
  const canMarkComplete = status === 'confirmed' || status === 'in_progress';
  const canCancel = status !== 'cancelled' && status !== 'completed' && status !== 'no_show';

  async function handleQuickStatus(nextStatus: 'confirmed' | 'in_progress') {
    try {
      await patchProviderBookingStatus(bookingId, { status: nextStatus });
      await bookingQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        return;
      }
    }
  }

  const title = useMemo(() => {
    if (!booking) {
      return `Booking #${bookingId}`;
    }

    return booking.service_type ?? `Booking #${bookingId}`;
  }, [booking, bookingId]);

  return (
    <Screen scroll>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Provider booking control panel</Text>

      {bookingQuery.isLoading ? <Text style={styles.meta}>Loading booking...</Text> : null}

      {booking ? (
        <View style={styles.card}>
          <Text style={styles.meta}>Status: {booking.booking_status ?? '--'}</Text>
          <Text style={styles.meta}>Date: {booking.booking_date ?? '--'} {booking.start_time ?? ''}</Text>
          <Text style={styles.meta}>Payment mode: {booking.payment_mode ?? '--'}</Text>
          <Text style={styles.meta}>Customer: {booking.owner_name ?? '--'}</Text>
          <Text style={styles.meta}>Amount: {typeof booking.final_price === 'number' ? `INR ${Math.round(booking.final_price)}` : 'INR --'}</Text>
          <Text style={styles.meta}>Address: {booking.location_address ?? 'Not shared'}</Text>
          <Text style={styles.meta}>Notes: {booking.provider_notes ?? 'No notes'}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <Pressable
          style={[styles.button, !canConfirm && styles.buttonDisabled]}
          onPress={() => handleQuickStatus('confirmed')}
          disabled={!canConfirm}
        >
          <Text style={styles.buttonLabel}>Confirm booking</Text>
        </Pressable>

        <Pressable
          style={[styles.button, !canMarkComplete && styles.buttonDisabled]}
          onPress={() => router.push(`/bookings/${bookingId}/complete`)}
          disabled={!canMarkComplete}
        >
          <Text style={styles.buttonLabel}>Complete booking</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, !canCancel && styles.buttonDisabled]}
          onPress={() => router.push(`/bookings/${bookingId}/cancel`)}
          disabled={!canCancel}
        >
          <Text style={styles.secondaryButtonLabel}>Cancel booking</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/bookings/${bookingId}/collect`)}>
          <Text style={styles.secondaryButtonLabel}>Collect payment</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(tabs)/bookings')}>
          <Text style={styles.secondaryButtonLabel}>Back to bookings</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  button: {
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 10,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
