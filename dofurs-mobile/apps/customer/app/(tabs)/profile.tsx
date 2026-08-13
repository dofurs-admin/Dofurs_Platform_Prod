import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getUserProfile, signOutAndResetClientState, useAuthStore } from '@dofurs/shared';

type AccountLink = {
  label: string;
  subtitle: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function CustomerProfileScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);

  const profileQuery = useQuery({
    queryKey: ['customer', 'profile'],
    queryFn: getUserProfile,
    enabled: Boolean(accessToken),
  });

  async function handleSignOut() {
    await signOutAndResetClientState();
    router.replace('/(auth)/sign-in');
  }

  const profile = profileQuery.data?.profile;

  const accountLinks: AccountLink[] = [
    {
      label: 'Refer & Earn',
      subtitle: 'Share your code and earn INR 500 credits per referral',
      route: '/referral',
      icon: 'gift-outline',
    },
    {
      label: 'Subscriptions',
      subtitle: 'View your active plan and service credits',
      route: '/subscription',
      icon: 'wallet-outline',
    },
    {
      label: 'Billing & Invoices',
      subtitle: 'Download invoices and review payment history',
      route: '/profile/payment-history',
      icon: 'receipt-outline',
    },
    {
      label: 'Saved Addresses',
      subtitle: 'Manage home and pickup locations',
      route: '/profile/addresses',
      icon: 'location-outline',
    },
    {
      label: 'Profile',
      subtitle: 'Update your name, email, and contact details',
      route: '/profile/edit',
      icon: 'person-outline',
    },
    {
      label: 'Settings',
      subtitle: 'Notification preferences and account options',
      route: '/profile/settings',
      icon: 'settings-outline',
    },
    {
      label: 'Support',
      subtitle: 'Get help, FAQs, and contact support options',
      route: '/profile/help',
      icon: 'help-buoy-outline',
    },
  ];

  return (
    <Screen scroll>
      <View style={styles.accountHeader}>
        <Text style={styles.accountHeaderTitle}>Account Settings</Text>
        <Text style={styles.accountHeaderSubtitle}>
          Manage your billing, payment methods, addresses, subscription, and support.
        </Text>
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

      <View style={styles.linksGrid}>
        {accountLinks.map((link) => (
          <Pressable key={link.route} style={styles.linkCard} onPress={() => router.push(link.route as never)}>
            <View style={styles.linkBadge}>
              <Ionicons name={link.icon} color="#8b5f3a" size={16} />
            </View>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Text style={styles.linkMeta}>{link.subtitle}</Text>
            </View>
          </Pressable>
        ))}
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
  accountHeader: {
    gap: 2,
  },
  accountHeaderTitle: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  accountHeaderSubtitle: {
    color: '#6f6259',
    fontSize: 12,
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
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  linkCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 10,
    gap: 8,
  },
  linkBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fff8f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTextWrap: {
    gap: 2,
  },
  linkLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  linkMeta: {
    color: '#7b6959',
    fontSize: 11,
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
