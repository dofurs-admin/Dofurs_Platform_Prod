import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getOwnerProfile,
  getUserProfile,
  signOutAndResetClientState,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();

  const userProfileQuery = useQuery({
    queryKey: ['customer', 'profile', 'settings', 'user'],
    queryFn: getUserProfile,
  });

  const ownerProfileQuery = useQuery({
    queryKey: ['customer', 'profile', 'settings', 'owner'],
    queryFn: getOwnerProfile,
  });

  const userProfile = userProfileQuery.data?.profile as Record<string, unknown> | undefined;
  const ownerProfile = ownerProfileQuery.data?.profile as Record<string, unknown> | undefined;

  async function handleSignOut() {
    await signOutAndResetClientState();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Review account details and manage your session.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account summary</Text>
        <Text style={styles.meta}>Name: {typeof userProfile?.name === 'string' ? userProfile.name : '--'}</Text>
        <Text style={styles.meta}>Email: {typeof userProfile?.email === 'string' ? userProfile.email : '--'}</Text>
        <Text style={styles.meta}>Phone: {typeof userProfile?.phone === 'string' ? userProfile.phone : '--'}</Text>
        <Text style={styles.meta}>First pet owner: {ownerProfile?.first_pet_owner ? 'Yes' : 'No'}</Text>
        <Text style={styles.meta}>Total pets: {typeof ownerProfile?.total_pets === 'number' ? ownerProfile.total_pets : '--'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/edit')}>
          <Text style={styles.linkLabel}>Edit profile</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/addresses')}>
          <Text style={styles.linkLabel}>Manage addresses</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/payment-history')}>
          <Text style={styles.linkLabel}>Payment history</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/help')}>
          <Text style={styles.linkLabel}>Help center</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonLabel}>Sign out</Text>
      </Pressable>

      {userProfileQuery.isLoading || ownerProfileQuery.isLoading ? <Text style={styles.meta}>Loading settings...</Text> : null}
      {userProfileQuery.isError || ownerProfileQuery.isError ? <Text style={styles.error}>Unable to load settings details.</Text> : null}
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
