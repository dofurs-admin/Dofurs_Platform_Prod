import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getProviderBookings } from '@dofurs/shared';

type ProviderBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

type ProviderBookingRow = {
  id: number;
  serviceType: string | null;
  bookingDate: string | null;
  startTime: string | null;
  bookingStatus: string | null;
  customerName: string | null;
  petName: string | null;
  finalPrice: number | null;
  paymentMode: string | null;
};

const statusFilters: Array<'all' | ProviderBookingStatus> = [
  'all',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

function toProviderBookingRow(value: Record<string, unknown>): ProviderBookingRow | null {
  const id = Number(value.id ?? NaN);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const ownerProfile = value.owner_profile as Record<string, unknown> | undefined;
  const owner = value.owner as Record<string, unknown> | undefined;
  const customerName =
    typeof value.owner_name === 'string'
      ? value.owner_name
      : (typeof ownerProfile?.full_name === 'string'
          ? ownerProfile.full_name
          : (typeof owner?.name === 'string' ? owner.name : null));

  return {
    id,
    serviceType: typeof value.service_type === 'string' ? value.service_type : null,
    bookingDate: typeof value.booking_date === 'string' ? value.booking_date : null,
    startTime: typeof value.start_time === 'string' ? value.start_time : null,
    bookingStatus: typeof value.booking_status === 'string' ? value.booking_status : null,
    customerName,
    petName:
      typeof value.pet_name === 'string'
        ? value.pet_name
        : (typeof value.primary_pet_name === 'string' ? value.primary_pet_name : null),
    finalPrice:
      typeof value.final_price === 'number'
        ? value.final_price
        : (typeof value.amount === 'number' ? value.amount : null),
    paymentMode: typeof value.payment_mode === 'string' ? value.payment_mode : null,
  };
}

function formatCurrency(value: number | null) {
  if (value == null) {
    return 'INR --';
  }

  return `INR ${Math.round(value)}`;
}

export default function ProviderBookingsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'all' | ProviderBookingStatus>('all');

  const bookingsQuery = useQuery({
    queryKey: ['provider', 'bookings', status],
    queryFn: () => getProviderBookings(status === 'all' ? { limit: 200 } : { status, limit: 200 }),
  });

  const bookings = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];

    return rows
      .map((row) => toProviderBookingRow(row as Record<string, unknown>))
      .filter((row): row is ProviderBookingRow => Boolean(row))
      .sort((left, right) => {
        const leftKey = `${left.bookingDate ?? ''}T${left.startTime ?? '00:00'}`;
        const rightKey = `${right.bookingDate ?? ''}T${right.startTime ?? '00:00'}`;
        return rightKey.localeCompare(leftKey);
      });
  }, [bookingsQuery.data?.bookings]);

  function handleRefresh() {
    void bookingsQuery.refetch();
  }

  return (
    <Screen scroll refreshing={bookingsQuery.isRefetching} onRefresh={handleRefresh}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Dofurs</Text>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>
      </View>

      <View style={styles.filterRow}>
        {statusFilters.map((value) => {
          const selected = status === value;
          return (
            <Pressable key={value} style={[styles.filterChip, selected && styles.filterChipSelected]} onPress={() => setStatus(value)}>
              <Text style={[styles.filterChipLabel, selected && styles.filterChipLabelSelected]}>{value.replace('_', ' ')}</Text>
            </Pressable>
          );
        })}
      </View>

      {bookingsQuery.isLoading ? <Text style={styles.meta}>Loading bookings...</Text> : null}

      {bookingsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load provider bookings.</Text>
          <Pressable style={styles.retryButton} onPress={() => bookingsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {bookings.map((booking) => (
        <Pressable key={booking.id} style={styles.card} onPress={() => router.push(`/bookings/${booking.id}`)}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>{booking.serviceType ?? `Booking #${booking.id}`}</Text>
            <Text style={styles.meta}>Customer: {booking.customerName ?? 'Unknown'}</Text>
            <Text style={styles.meta}>Pet: {booking.petName ?? 'Not specified'}</Text>
            <Text style={styles.meta}>{booking.bookingDate ?? '--'} {booking.startTime ?? ''}</Text>
          </View>

          <View style={styles.cardRight}>
            <Text style={styles.status}>{booking.bookingStatus ?? 'pending'}</Text>
            <Text style={styles.amount}>{formatCurrency(booking.finalPrice)}</Text>
            <Text style={styles.metaSmall}>{booking.paymentMode ?? 'payment mode --'}</Text>
          </View>
        </Pressable>
      ))}

      {!bookingsQuery.isLoading && !bookingsQuery.isError && bookings.length === 0 ? (
        <Text style={styles.meta}>No bookings found for this filter.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 16,
    gap: 6,
  },
  heroEyebrow: {
    color: '#9b5f2f',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: dofursColors.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4f4b47',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  filterChipLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterChipLabelSelected: {
    color: dofursColors.ink,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 12,
    gap: 10,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 3,
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
    fontSize: 12,
  },
  metaSmall: {
    color: '#7d736c',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  errorCard: {
    borderRadius: 12,
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
