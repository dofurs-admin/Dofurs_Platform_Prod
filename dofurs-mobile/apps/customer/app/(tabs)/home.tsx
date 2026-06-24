import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  const activeBookings = bookings.filter((booking) => {
    if (!booking.booking_status) {
      return false;
    }

    return ['pending', 'confirmed', 'in_progress'].includes(booking.booking_status);
  }).length;

  return (
    <Screen scroll>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroPill}>
            <Ionicons name="sparkles" color={dofursColors.coral} size={13} />
            <Text style={styles.heroPillLabel}>Pet Grooming Packages</Text>
          </View>
          <View style={styles.cityPill}>
            <Ionicons name="location-outline" color="#9a663f" size={12} />
            <Text style={styles.cityPillLabel}>All Bengaluru pincodes</Text>
          </View>
        </View>

        <Text style={styles.title}>Doorstep Pet Grooming, From Verified Groomers Across Bengaluru</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name="shield-checkmark-outline" color="#876448" size={12} />
            <Text style={styles.chipLabel}>Doorstep grooming</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="person-circle-outline" color="#876448" size={12} />
            <Text style={styles.chipLabel}>Background-verified</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="heart-outline" color="#876448" size={12} />
            <Text style={styles.chipLabel}>Safe for anxious pets</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="leaf-outline" color="#876448" size={12} />
            <Text style={styles.chipLabel}>Pet-safe products</Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <Ionicons name="calendar-outline" color="#8b5f3a" size={15} />
            <Text style={styles.heroStatValue}>{activeBookings}</Text>
            <Text style={styles.heroStatLabel}>Active bookings</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Ionicons name="wallet-outline" color="#8b5f3a" size={15} />
            <Text style={styles.heroStatValue}>{formatCurrency(creditBalance)}</Text>
            <Text style={styles.heroStatLabel}>Credits</Text>
          </View>
        </View>
      </View>

      {isLoading ? <Text style={styles.metaInfo}>Loading your dashboard...</Text> : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" color="#8f613b" size={15} />
          <Text style={styles.sectionTitle}>Next booking</Text>
        </View>
        {upcomingBooking ? (
          <>
            <Text style={styles.cardValue}>{upcomingBooking.service_type ?? 'Service booking'}</Text>
            <Text style={styles.metaInfo}>
              {upcomingBooking.booking_date ?? 'Date TBA'} {upcomingBooking.start_time ?? ''}
            </Text>
          </>
        ) : (
          <Text style={styles.cardValue}>No upcoming bookings</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash-outline" color="#8f613b" size={15} />
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryAction} onPress={() => router.push('/(tabs)/services')}>
            <Ionicons name="sparkles-outline" color="#ffffff" size={14} />
            <Text style={styles.primaryActionLabel}>Browse services</Text>
          </Pressable>

          <Pressable style={styles.secondaryAction} onPress={() => router.push('/(tabs)/bookings')}>
            <Ionicons name="calendar-clear-outline" color="#6b4328" size={14} />
            <Text style={styles.secondaryActionLabel}>View bookings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" color="#8f613b" size={15} />
          <Text style={styles.sectionTitle}>Recent bookings</Text>
        </View>

        {bookings.slice(0, 3).map((booking) => (
          <Pressable
            key={booking.id}
            style={styles.listItem}
            onPress={() => router.push(`/booking/${booking.id}`)}
          >
            <View style={styles.listItemLeft}>
              <View style={styles.listIconWrap}>
                <Ionicons name="paw-outline" color="#8d5e37" size={14} />
              </View>
              <View>
                <Text style={styles.listTitle}>{booking.service_type ?? `Booking #${booking.id}`}</Text>
                <Text style={styles.metaInfo}>{booking.booking_date ?? 'Date TBA'} {booking.start_time ?? ''}</Text>
              </View>
            </View>

            <View style={styles.listItemRight}>
              <Text style={styles.listValue}>{booking.booking_status ?? 'pending'}</Text>
              <Ionicons name="chevron-forward" color="#9a816b" size={15} />
            </View>
          </Pressable>
        ))}

        {bookings.length === 0 && !isLoading ? <Text style={styles.metaInfo}>No bookings found yet.</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff6ed',
    padding: 20,
    gap: 10,
    shadowColor: '#b47a49',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heroPill: {
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
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ead1ba',
    backgroundColor: '#fffaf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cityPillLabel: {
    color: '#8e6140',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: dofursColors.ink,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: '#5f4c3e',
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4c8ae',
    backgroundColor: '#fff9f3',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipLabel: {
    color: '#6a523f',
    fontSize: 12,
    fontWeight: '600',
  },
  heroStatsRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 12,
    gap: 3,
  },
  heroStatValue: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: '#7a6758',
    fontSize: 11,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 16,
    gap: 10,
    shadowColor: '#b47a49',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: dofursColors.ink,
  },
  metaInfo: {
    color: '#7b6959',
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    paddingVertical: 11,
    shadowColor: '#b66828',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryActionLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e1c3a7',
    backgroundColor: '#fff8f1',
    paddingVertical: 11,
  },
  secondaryActionLabel: {
    color: '#6b4328',
    fontSize: 13,
    fontWeight: '700',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e8c9ac',
    backgroundColor: '#fff5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listValue: {
    color: '#7a6758',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
});
