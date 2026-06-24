import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getProviderDashboard,
  getSupabaseClient,
} from '@dofurs/shared';

export default function ProviderProfileScreen() {
  const router = useRouter();

  const dashboardQuery = useQuery({
    queryKey: ['provider', 'profile-dashboard'],
    queryFn: getProviderDashboard,
  });

  const dashboard = dashboardQuery.data?.dashboard as Record<string, unknown> | null | undefined;
  const provider = (dashboard?.provider as Record<string, unknown> | undefined) ?? null;

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen scroll>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Dofurs</Text>
        <Text style={styles.title}>Doorstep Pet Grooming, From Verified Groomers Across Bengaluru</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{typeof provider?.business_name === 'string' && provider.business_name.trim().length > 0 ? provider.business_name : 'Dofurs provider'}</Text>
        <Text style={styles.meta}>Provider type: {typeof provider?.provider_type === 'string' ? provider.provider_type : '--'}</Text>
        <Text style={styles.meta}>Status: {typeof provider?.admin_approval_status === 'string' ? provider.admin_approval_status : '--'}</Text>
        <Text style={styles.meta}>Phone: {typeof provider?.phone_number === 'string' ? provider.phone_number : '--'}</Text>
        <Text style={styles.meta}>Email: {typeof provider?.email === 'string' ? provider.email : '--'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Manage profile</Text>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/edit')}>
          <Text style={styles.linkLabel}>Edit profile</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/services')}>
          <Text style={styles.linkLabel}>Service details</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/documents')}>
          <Text style={styles.linkLabel}>Documents</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/settings')}>
          <Text style={styles.linkLabel}>Settings</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Communication</Text>

        <Pressable style={styles.linkRow} onPress={() => router.push('/messages')}>
          <Text style={styles.linkLabel}>Messages</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}>
          <Text style={styles.linkLabel}>Notifications</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonLabel}>Sign out</Text>
      </Pressable>

      {dashboardQuery.isLoading ? <Text style={styles.meta}>Loading profile details...</Text> : null}
      {dashboardQuery.isError ? <Text style={styles.error}>Unable to load profile details.</Text> : null}
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
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 17,
    fontWeight: '700',
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
