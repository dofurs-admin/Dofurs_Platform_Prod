import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getProviderDashboard } from '@dofurs/shared';

export default function ProviderHomeScreen() {
  const router = useRouter();
  const dashboardQuery = useQuery({
    queryKey: ['provider', 'dashboard'],
    queryFn: getProviderDashboard,
  });

  const dashboard = dashboardQuery.data?.dashboard as Record<string, unknown> | null | undefined;
  const provider = (dashboard?.provider as Record<string, unknown> | undefined) ?? null;
  const availability = (dashboard?.availability as Array<unknown> | undefined) ?? [];
  const services = (dashboard?.services as Array<unknown> | undefined) ?? [];
  const reviews = (dashboard?.reviews as Array<unknown> | undefined) ?? [];

  function handleRefresh() {
    void dashboardQuery.refetch();
  }

  return (
    <Screen scroll refreshing={dashboardQuery.isRefetching} onRefresh={handleRefresh}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Dofurs</Text>
        <Text style={styles.title}>Doorstep Pet Grooming, From Verified Groomers Across Bengaluru</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>
      </View>

      {dashboardQuery.isLoading ? <Text style={styles.meta}>Loading dashboard...</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{typeof provider?.business_name === 'string' && provider.business_name.trim().length > 0 ? provider.business_name : 'Dofurs provider'}</Text>
        <Text style={styles.meta}>Type: {typeof provider?.provider_type === 'string' ? provider.provider_type : '--'}</Text>
        <Text style={styles.meta}>Status: {typeof provider?.admin_approval_status === 'string' ? provider.admin_approval_status : '--'}</Text>
        <Text style={styles.meta}>Rating: {typeof provider?.average_rating === 'number' ? provider.average_rating.toFixed(1) : '--'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{availability.length}</Text>
          <Text style={styles.statLabel}>Availability slots</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{services.length}</Text>
          <Text style={styles.statLabel}>Services</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{reviews.length}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.quickGrid}>
          <Pressable style={styles.quickButton} onPress={() => router.push('/(tabs)/bookings')}>
            <Text style={styles.quickButtonLabel}>Bookings</Text>
          </Pressable>
          <Pressable style={styles.quickButton} onPress={() => router.push('/(tabs)/schedule')}>
            <Text style={styles.quickButtonLabel}>Schedule</Text>
          </Pressable>
          <Pressable style={styles.quickButton} onPress={() => router.push('/(tabs)/reviews')}>
            <Text style={styles.quickButtonLabel}>Reviews</Text>
          </Pressable>
          <Pressable style={styles.quickButton} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.quickButtonLabel}>Profile</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 18,
    gap: 8,
    shadowColor: '#c28953',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4f4b47',
    fontSize: 14,
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6d635c',
    fontSize: 11,
    textAlign: 'center',
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
});
