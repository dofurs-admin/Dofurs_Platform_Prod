import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getProviderAvailability,
  getProviderBlockedDates,
} from '@dofurs/shared';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProviderScheduleScreen() {
  const router = useRouter();

  const availabilityQuery = useQuery({
    queryKey: ['provider', 'availability'],
    queryFn: getProviderAvailability,
  });

  const blockedDatesQuery = useQuery({
    queryKey: ['provider', 'blocked-dates'],
    queryFn: getProviderBlockedDates,
  });

  const availability = availabilityQuery.data?.availability ?? [];
  const blockedDates = blockedDatesQuery.data?.blockedDates ?? [];

  const activeDaySet = new Set(
    availability
      .filter((slot) => slot.is_available !== false)
      .map((slot) => Number(slot.day_of_week))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 6),
  );

  const activeDays = Array.from(activeDaySet)
    .sort((left, right) => left - right)
    .map((day) => dayNames[day]);

  return (
    <Screen scroll>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Dofurs</Text>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current coverage</Text>
        <Text style={styles.meta}>Active days: {activeDays.length > 0 ? activeDays.join(', ') : 'No active schedule yet'}</Text>
        <Text style={styles.meta}>Time windows: {availability.length}</Text>
        <Text style={styles.meta}>Blocked dates: {blockedDates.length}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick actions</Text>

        <Pressable style={styles.linkRow} onPress={() => router.push('/schedule/weekly')}>
          <Text style={styles.linkLabel}>Edit weekly availability</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/schedule/block-date')}>
          <Text style={styles.linkLabel}>Manage blocked dates</Text>
        </Pressable>
      </View>

      {availabilityQuery.isLoading || blockedDatesQuery.isLoading ? (
        <Text style={styles.meta}>Loading schedule data...</Text>
      ) : null}

      {availabilityQuery.isError || blockedDatesQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load schedule details.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              availabilityQuery.refetch();
              blockedDatesQuery.refetch();
            }}
          >
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {blockedDates.slice(0, 5).map((row, index) => {
        const blocked = row as Record<string, unknown>;
        const date = typeof blocked.blocked_date === 'string' ? blocked.blocked_date : '--';
        const start = typeof blocked.block_start_time === 'string' ? blocked.block_start_time : null;
        const end = typeof blocked.block_end_time === 'string' ? blocked.block_end_time : null;
        const reason = typeof blocked.reason === 'string' ? blocked.reason : 'No reason provided';

        return (
          <View key={`${date}-${index}`} style={styles.blockedCard}>
            <Text style={styles.blockedDate}>{date}</Text>
            <Text style={styles.meta}>{start && end ? `${start} - ${end}` : 'Full day blocked'}</Text>
            <Text style={styles.meta}>{reason}</Text>
          </View>
        );
      })}
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
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 12,
    gap: 7,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  linkRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkLabel: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
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
  blockedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 10,
    gap: 3,
  },
  blockedDate: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
