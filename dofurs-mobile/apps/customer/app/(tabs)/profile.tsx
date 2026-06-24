import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
      <View style={styles.heroCard}>
        <View style={styles.heroPill}>
          <Ionicons name="person-circle-outline" color={dofursColors.coral} size={13} />
          <Text style={styles.heroPillLabel}>Account Center</Text>
        </View>

        <Text style={styles.title}>Your Dofurs profile</Text>
        <Text style={styles.subtitle}>Access identity, communication, and subscription controls from one place.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLabel}>
              {(typeof profile?.name === 'string' ? profile.name : 'Dofurs customer').slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.cardTitle}>{typeof profile?.name === 'string' ? profile.name : 'Dofurs customer'}</Text>
            <Text style={styles.meta}>{typeof profile?.email === 'string' ? profile.email : 'No email found'}</Text>
            <Text style={styles.meta}>{typeof profile?.phone === 'string' ? profile.phone : 'No phone found'}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillLabel}>Role: {profile?.roles?.name ?? 'user'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Ionicons name="grid-outline" color="#8f613b" size={15} />
          <Text style={styles.sectionTitle}>Quick links</Text>
        </View>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/addresses')}>
          <View style={styles.linkLeft}>
            <Ionicons name="location-outline" color="#8b5f3a" size={14} />
            <Text style={styles.linkLabel}>Addresses</Text>
          </View>
          <Ionicons name="chevron-forward" color="#9a816b" size={15} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/messages')}>
          <View style={styles.linkLeft}>
            <Ionicons name="chatbubble-ellipses-outline" color="#8b5f3a" size={14} />
            <Text style={styles.linkLabel}>Messages</Text>
          </View>
          <Ionicons name="chevron-forward" color="#9a816b" size={15} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}>
          <View style={styles.linkLeft}>
            <Ionicons name="notifications-outline" color="#8b5f3a" size={14} />
            <Text style={styles.linkLabel}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" color="#9a816b" size={15} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/subscription')}>
          <View style={styles.linkLeft}>
            <Ionicons name="card-outline" color="#8b5f3a" size={14} />
            <Text style={styles.linkLabel}>Subscription</Text>
          </View>
          <Ionicons name="chevron-forward" color="#9a816b" size={15} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/referral')}>
          <View style={styles.linkLeft}>
            <Ionicons name="gift-outline" color="#8b5f3a" size={14} />
            <Text style={styles.linkLabel}>Referral</Text>
          </View>
          <Ionicons name="chevron-forward" color="#9a816b" size={15} />
        </Pressable>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" color="#8a3d2c" size={14} />
        <Text style={styles.signOutButtonLabel}>Sign out</Text>
      </Pressable>

      {profileQuery.isLoading ? <Text style={styles.meta}>Loading profile...</Text> : null}
      {profileQuery.isError ? <Text style={styles.error}>Unable to load profile details.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff6ed',
    padding: 18,
    gap: 9,
    shadowColor: '#b47a49',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
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
  title: {
    color: dofursColors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 35,
  },
  subtitle: {
    color: '#5f4c3e',
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 14,
    gap: 10,
    shadowColor: '#b47a49',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e8c9ac',
    backgroundColor: '#fff5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: '#8f613b',
    fontSize: 16,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: '#7b6959',
    fontSize: 12,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5cab1',
    backgroundColor: '#fff8f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillLabel: {
    color: '#6e533d',
    fontSize: 11,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#f8e2d1',
    borderWidth: 1,
    borderColor: '#e7c4a7',
    paddingHorizontal: 16,
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
