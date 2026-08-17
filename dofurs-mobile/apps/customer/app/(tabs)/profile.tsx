import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getStorageSignedReadUrl,
  getUserProfile,
  signOutAndResetClientState,
  useAuthStore,
} from '@dofurs/shared';

type ListItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  subtitle?: string;
  isSignOut?: boolean;
};

function resolveImmediatePhotoUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function extractStoragePath(bucket: 'user-photos', value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const isStoragePath = trimmed.startsWith('/storage/v1/object/');
  if (isAbsolute || isStoragePath) {
    try {
      const parsedUrl = new URL(trimmed, isStoragePath ? 'https://placeholder.local' : undefined);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex(
        (segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
      );
      if (markerIndex === -1) return null;
      const objectSegments = segments.slice(markerIndex + 3);
      const mode = objectSegments[0];
      const offset = mode === 'public' || mode === 'authenticated' || mode === 'sign'
        ? 1
        : (mode === 'render' && objectSegments[1] === 'image' ? 2 : 0);
      const bucketName = objectSegments[offset];
      const pathParts = objectSegments.slice(offset + 1);
      if (bucketName !== bucket || pathParts.length === 0) return null;
      return decodeURIComponent(pathParts.join('/'));
    } catch {
      return null;
    }
  }
  const normalized = trimmed.replace(/^\/+/, '');
  const prefixed = `${bucket}/`;
  if (normalized.startsWith(prefixed)) return normalized.slice(prefixed.length);
  return normalized;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return phone;
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['customer', 'profile'],
    queryFn: getUserProfile,
    enabled: Boolean(accessToken),
  });

  const profile = profileQuery.data?.profile;
  const userName = typeof profile?.name === 'string' && profile.name.trim().length > 0
    ? profile.name.trim()
    : 'Dofurs customer';
  const userEmail = typeof profile?.email === 'string' ? profile.email : '';
  const userPhone = typeof profile?.phone === 'string' ? profile.phone : '';
  const profilePhotoUrl =
    (typeof profile?.photo_url === 'string' && profile.photo_url.trim().length > 0 ? profile.photo_url : null)
    ?? (typeof profile?.photoUrl === 'string' && profile.photoUrl.trim().length > 0 ? profile.photoUrl : null)
    ?? (typeof profile?.avatar_url === 'string' && profile.avatar_url.trim().length > 0 ? profile.avatar_url : null)
    ?? null;

  useEffect(() => {
    let active = true;
    async function hydratePhoto() {
      const immediate = resolveImmediatePhotoUrl(profilePhotoUrl);
      if (immediate) {
        if (active) setResolvedPhotoUrl(immediate);
        return;
      }
      if (!profilePhotoUrl) {
        if (active) setResolvedPhotoUrl(null);
        return;
      }
      const storagePath = extractStoragePath('user-photos', profilePhotoUrl);
      if (!storagePath) {
        if (active) setResolvedPhotoUrl(null);
        return;
      }
      try {
        const response = await getStorageSignedReadUrl({
          bucket: 'user-photos',
          path: storagePath,
          expiresIn: 3600,
        });
        if (active && typeof response.signedUrl === 'string' && response.signedUrl.length > 0) {
          setResolvedPhotoUrl(response.signedUrl);
          return;
        }
      } catch {
        // Keep fallback initial.
      }
      if (active) setResolvedPhotoUrl(null);
    }
    void hydratePhoto();
    return () => { active = false; };
  }, [profilePhotoUrl]);

  async function handleSignOut() {
    Alert.alert('Sign out of Dofurs?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOutAndResetClientState();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }

  const accountItems: ListItem[] = [
    { id: 'personal', label: 'Personal Information', icon: 'person-outline', route: '/profile/edit' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications-outline', route: '/profile/settings' },
    { id: 'addresses', label: 'Saved Addresses', icon: 'location-outline', route: '/profile/addresses' },
  ];

  const paymentItems: ListItem[] = [
    { id: 'billing', label: 'Billing & Invoices', icon: 'receipt-outline', route: '/profile/payment-history' },
    { id: 'subscription', label: 'Subscription & Plans', icon: 'card-outline', route: '/subscription/plans' },
  ];

  const rewardsItems: ListItem[] = [
    { id: 'referral', label: 'Refer & Earn', icon: 'gift-outline', route: '/referral', subtitle: 'Give ₹500, Get ₹500' },
  ];

  const helpItems: ListItem[] = [
    { id: 'support', label: 'Support & FAQs', icon: 'help-buoy-outline', route: '/profile/help' },
    { id: 'terms', label: 'Terms & Privacy', icon: 'document-text-outline', route: '/profile/support/faqs' },
  ];

  function renderSectionLabel(label: string) {
    return <Text style={styles.sectionLabel}>{label}</Text>;
  }

  function renderListGroup(items: ListItem[]) {
    return (
      <View style={styles.listGroup}>
        {items.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={styles.listSeparator} /> : null}
            <Pressable
              style={({ pressed }) => [
                styles.listItem,
                pressed ? styles.listItemPressed : null,
              ]}
              onPress={() => {
                if (item.route) router.push(item.route as never);
              }}
            >
              <View style={styles.listItemIconWrap}>
                <Ionicons name={item.icon} size={20} color={dofursColors.inkSoft} />
              </View>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemLabel}>{item.label}</Text>
                {item.subtitle ? (
                  <Text style={styles.listItemSubtitle}>{item.subtitle}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color="#b8a99a" />
            </Pressable>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Screen scroll>
      {/* Back navigation */}
      <Pressable style={styles.backRow} onPress={() => router.replace('/home')}>
        <Ionicons name="arrow-back" size={24} color={dofursColors.ink} />
        <Text style={styles.backLabel}>Account</Text>
      </Pressable>

      {/* Profile Header Card */}
      <Pressable
        style={({ pressed }) => [
          styles.profileCard,
          pressed ? styles.profileCardPressed : null,
        ]}
        onPress={() => router.push('/profile/edit')}
      >
        <View style={styles.profilePhotoWrap}>
          {resolvedPhotoUrl ? (
            <Image source={{ uri: resolvedPhotoUrl }} style={styles.profilePhoto} />
          ) : (
            <Text style={styles.profilePhotoInitial}>{userName.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text numberOfLines={1} style={styles.profileName}>{userName}</Text>
          {userEmail ? (
            <Text numberOfLines={1} style={styles.profileDetail}>{userEmail}</Text>
          ) : null}
          {userPhone ? (
            <Text style={styles.profileDetail}>{formatPhone(userPhone)}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#b8a99a" />
      </Pressable>

      {/* Account Section */}
      {renderSectionLabel('Account')}
      {renderListGroup(accountItems)}

      {/* Payments Section */}
      {renderSectionLabel('Payments')}
      {renderListGroup(paymentItems)}

      {/* Rewards Section */}
      {renderSectionLabel('Rewards')}
      {renderListGroup(rewardsItems)}

      {/* Help Section */}
      {renderSectionLabel('Help')}
      {renderListGroup(helpItems)}

      {/* Sign Out */}
      <View style={styles.signOutGroup}>
        <Pressable
          style={({ pressed }) => [
            styles.listItem,
            pressed ? styles.listItemPressed : null,
          ]}
          onPress={handleSignOut}
        >
          <View style={styles.listItemIconWrap}>
            <Ionicons name="log-out-outline" size={20} color="#d14343" />
          </View>
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </View>

      {/* App Version */}
      <Text style={styles.versionText}>App version 2.1.0</Text>

      {profileQuery.isLoading ? <Text style={styles.loadingText}>Loading profile...</Text> : null}
      {profileQuery.isError ? <Text style={styles.errorText}>Unable to load profile details.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Back navigation
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
  },
  backLabel: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '600',
  },

  // Profile Header Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  profileCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  profilePhotoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fdf3e8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  profilePhotoInitial: {
    color: dofursColors.coral,
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: dofursColors.ink,
    fontSize: 17,
    fontWeight: '600',
  },
  profileDetail: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    fontWeight: '400',
  },

  // Section Labels
  sectionLabel: {
    color: '#a89b8e',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },

  // List Groups
  listGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    gap: 12,
  },
  listItemPressed: {
    backgroundColor: 'rgba(227, 154, 93, 0.08)',
  },
  listItemIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  listItemContent: {
    flex: 1,
    gap: 1,
  },
  listItemLabel: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  listItemSubtitle: {
    color: '#a89b8e',
    fontSize: 13,
    fontWeight: '400',
  },
  listSeparator: {
    height: 1,
    backgroundColor: '#f0e8df',
    marginLeft: 54,
  },

  // Sign Out
  signOutGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
  },
  signOutLabel: {
    color: '#d14343',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },

  // Version
  versionText: {
    color: '#c4b8ab',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
  },

  // States
  loadingText: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    color: '#a6483b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});