import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getProviderDashboard,
  signOutAndResetClientState,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();

  const dashboardQuery = useQuery({
    queryKey: ['provider', 'dashboard', 'settings'],
    queryFn: getProviderDashboard,
  });

  const dashboard = dashboardQuery.data?.dashboard as Record<string, unknown> | null | undefined;
  const provider = (dashboard?.provider as Record<string, unknown> | undefined) ?? null;

  async function handleSignOut() {
    await signOutAndResetClientState();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Review operational status and manage your account session.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account status</Text>
        <Text style={styles.meta}>Approval: {typeof provider?.admin_approval_status === 'string' ? provider.admin_approval_status : '--'}</Text>
        <Text style={styles.meta}>Verification: {typeof provider?.verification_status === 'string' ? provider.verification_status : '--'}</Text>
        <Text style={styles.meta}>Account: {typeof provider?.account_status === 'string' ? provider.account_status : '--'}</Text>
        <Text style={styles.meta}>Accepts platform payment: {provider?.accepts_platform_payment ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Operational metrics</Text>
        <Text style={styles.meta}>Average rating: {typeof provider?.average_rating === 'number' ? provider.average_rating.toFixed(2) : '--'}</Text>
        <Text style={styles.meta}>Total bookings: {typeof provider?.total_bookings === 'number' ? provider.total_bookings : '--'}</Text>
        <Text style={styles.meta}>Cancellation rate: {typeof provider?.cancellation_rate === 'number' ? provider.cancellation_rate : '--'}</Text>
        <Text style={styles.meta}>No-show count: {typeof provider?.no_show_count === 'number' ? provider.no_show_count : '--'}</Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/profile/edit')}>
        <Text style={styles.secondaryButtonLabel}>Edit profile</Text>
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonLabel}>Sign out</Text>
      </Pressable>

      {dashboardQuery.isLoading ? <Text style={styles.meta}>Loading settings...</Text> : null}
      {dashboardQuery.isError ? <Text style={styles.error}>Unable to load settings details.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
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
    gap: 5,
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
  signOutButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#f8e2d1',
    borderWidth: 1,
    borderColor: '#e7c4a7',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signOutButtonLabel: {
    color: '#8a3d2c',
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: '#a6483b',
    fontSize: 13,
  },
});
