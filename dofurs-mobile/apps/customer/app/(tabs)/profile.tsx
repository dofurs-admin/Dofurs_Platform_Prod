import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getSupabaseClient, getUserProfile } from '@dofurs/shared';

export default function CustomerProfileScreen() {
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ['customer', 'profile'],
    queryFn: getUserProfile,
  });

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  const profile = profileQuery.data?.profile;

  return (
    <Screen scroll>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>Manage your profile and preferences.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{typeof profile?.name === 'string' ? profile.name : 'Dofurs customer'}</Text>
        <Text style={styles.meta}>{typeof profile?.email === 'string' ? profile.email : 'No email found'}</Text>
        <Text style={styles.meta}>{typeof profile?.phone === 'string' ? profile.phone : 'No phone found'}</Text>
        <Text style={styles.meta}>Role: {profile?.roles?.name ?? 'user'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick links</Text>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/addresses')}>
          <Text style={styles.linkLabel}>Addresses</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/messages')}>
          <Text style={styles.linkLabel}>Messages</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}>
          <Text style={styles.linkLabel}>Notifications</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/subscription')}>
          <Text style={styles.linkLabel}>Subscription</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/referral')}>
          <Text style={styles.linkLabel}>Referral</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonLabel}>Sign out</Text>
      </Pressable>

      {profileQuery.isLoading ? <Text style={styles.meta}>Loading profile...</Text> : null}
      {profileQuery.isError ? <Text style={styles.error}>Unable to load profile details.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#4f4b47',
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 13,
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
