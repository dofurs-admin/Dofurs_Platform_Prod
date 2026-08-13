import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  dofursColors,
  getOwnerAddresses,
  getStorageSignedReadUrl,
  getUserProfile,
  useAuthStore,
} from '@dofurs/shared';

const DOFURS_LOGO = require('../../assets/brand-logo.png');

type AddressSummary = {
  id: string;
  label: string | null;
  city: string | null;
  pincode: string | null;
  is_default: boolean;
};

type ShortcutRoute = '/home' | '/bookings' | '/services' | '/pets';

type ShortcutItem = {
  id: 'home' | 'bookings' | 'services' | 'pets';
  label: string;
  route: ShortcutRoute;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const SHORTCUTS: ShortcutItem[] = [
  {
    id: 'home',
    label: 'Home',
    route: '/home',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    id: 'bookings',
    label: 'Bookings',
    route: '/bookings',
    icon: 'calendar-clear-outline',
    iconActive: 'calendar',
  },
  {
    id: 'services',
    label: 'Services',
    route: '/services',
    icon: 'sparkles-outline',
    iconActive: 'sparkles',
  },
  {
    id: 'pets',
    label: 'Pets',
    route: '/pets',
    icon: 'paw-outline',
    iconActive: 'paw',
  },
];

function resolveImmediatePhotoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function extractStoragePath(bucket: 'user-photos', value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const isStoragePath = trimmed.startsWith('/storage/v1/object/');

  if (isAbsolute || isStoragePath) {
    try {
      const parsedUrl = new URL(trimmed, isStoragePath ? 'https://placeholder.local' : undefined);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex(
        (segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
      );

      if (markerIndex === -1) {
        return null;
      }

      const objectSegments = segments.slice(markerIndex + 3);
      const mode = objectSegments[0];
      const offset = mode === 'public' || mode === 'authenticated' || mode === 'sign'
        ? 1
        : (mode === 'render' && objectSegments[1] === 'image' ? 2 : 0);
      const bucketName = objectSegments[offset];
      const pathParts = objectSegments.slice(offset + 1);

      if (bucketName !== bucket || pathParts.length === 0) {
        return null;
      }

      return decodeURIComponent(pathParts.join('/'));
    } catch {
      return null;
    }
  }

  const normalized = trimmed.replace(/^\/+/, '');
  const prefixed = `${bucket}/`;
  if (normalized.startsWith(prefixed)) {
    return normalized.slice(prefixed.length);
  }

  return normalized;
}

function parseAddressSummary(row: Record<string, unknown>): AddressSummary | null {
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) {
    return null;
  }

  const city = typeof row.city === 'string' && row.city.trim().length > 0 ? row.city.trim() : null;
  const pincode = typeof row.pincode === 'string' && row.pincode.trim().length > 0 ? row.pincode.trim() : null;
  const label = typeof row.label === 'string' && row.label.trim().length > 0 ? row.label.trim() : null;

  return {
    id,
    label,
    city,
    pincode,
    is_default: row.is_default === true,
  };
}

function resolveActiveShortcut(pathname: string): ShortcutItem['id'] | null {
  if (pathname === '/home' || pathname === '/') {
    return 'home';
  }

  if (pathname.startsWith('/booking') || pathname.startsWith('/bookings')) {
    return 'bookings';
  }

  if (pathname.startsWith('/services') || pathname.startsWith('/subscription')) {
    return 'services';
  }

  if (pathname.startsWith('/pets')) {
    return 'pets';
  }

  return null;
}

export function CustomerHeaderBar() {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [resolvedProfilePhotoUrl, setResolvedProfilePhotoUrl] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['customer', 'chrome', 'profile'],
    queryFn: getUserProfile,
    enabled: Boolean(accessToken),
  });

  const addressesQuery = useQuery({
    queryKey: ['customer', 'chrome', 'addresses'],
    queryFn: getOwnerAddresses,
    enabled: Boolean(accessToken),
  });

  const userName =
    typeof profileQuery.data?.profile?.name === 'string' && profileQuery.data.profile.name.trim().length > 0
      ? profileQuery.data.profile.name.trim().split(' ')[0]
      : 'Pet Parent';

  const profilePhotoUrl =
    (typeof profileQuery.data?.profile?.photo_url === 'string' && profileQuery.data.profile.photo_url.trim().length > 0
      ? profileQuery.data.profile.photo_url
      : null)
    ?? (typeof profileQuery.data?.profile?.photoUrl === 'string' && profileQuery.data.profile.photoUrl.trim().length > 0
      ? profileQuery.data.profile.photoUrl
      : null)
    ?? (typeof profileQuery.data?.profile?.avatar_url === 'string' && profileQuery.data.profile.avatar_url.trim().length > 0
      ? profileQuery.data.profile.avatar_url
      : null);

  const addresses = useMemo(() => {
    const rows = addressesQuery.data?.addresses ?? [];
    return rows
      .map((row) => parseAddressSummary(row as Record<string, unknown>))
      .filter((row): row is AddressSummary => Boolean(row));
  }, [addressesQuery.data?.addresses]);

  const locationText = useMemo(() => {
    const preferred = addresses.find((address) => address.is_default) ?? addresses[0] ?? null;
    if (!preferred) {
      return 'Set your location';
    }

    const city = preferred.city ?? preferred.label ?? 'Saved address';
    if (preferred.pincode) {
      return `${city} • ${preferred.pincode}`;
    }

    return city;
  }, [addresses]);

  useEffect(() => {
    setIsOptionsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function hydrateProfilePhoto() {
      const immediate = resolveImmediatePhotoUrl(profilePhotoUrl);
      if (immediate) {
        if (active) {
          setResolvedProfilePhotoUrl(immediate);
        }
        return;
      }

      if (!profilePhotoUrl) {
        if (active) {
          setResolvedProfilePhotoUrl(null);
        }
        return;
      }

      const storagePath = extractStoragePath('user-photos', profilePhotoUrl);
      if (!storagePath) {
        if (active) {
          setResolvedProfilePhotoUrl(null);
        }
        return;
      }

      try {
        const response = await getStorageSignedReadUrl({
          bucket: 'user-photos',
          path: storagePath,
          expiresIn: 3600,
        });

        if (active && typeof response.signedUrl === 'string' && response.signedUrl.length > 0) {
          setResolvedProfilePhotoUrl(response.signedUrl);
          return;
        }
      } catch {
        // Keep initial fallback if signed URL cannot be resolved.
      }

      if (active) {
        setResolvedProfilePhotoUrl(null);
      }
    }

    void hydrateProfilePhoto();

    return () => {
      active = false;
    };
  }, [profilePhotoUrl]);

  return (
    <View style={styles.headerRoot}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.iconCircleButton}
            onPress={() => setIsOptionsMenuOpen((open) => !open)}
            accessibilityLabel="Open app menu"
          >
            <Ionicons name="menu" size={20} color="#5e4939" />
          </Pressable>

          <View style={styles.headerLogoWrap}>
            <Image source={DOFURS_LOGO} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="Dofurs logo" />
          </View>

          <Pressable style={styles.profileCircleButton} onPress={() => router.push('/profile')} accessibilityLabel="Open account profile">
            {resolvedProfilePhotoUrl ? (
              <Image source={{ uri: resolvedProfilePhotoUrl }} style={styles.profileCircleImage} />
            ) : (
              <Text style={styles.profileCircleLabel}>{userName.slice(0, 1).toUpperCase()}</Text>
            )}
          </Pressable>
        </View>

        {isOptionsMenuOpen ? (
          <View style={styles.optionsPanel}>
            <Pressable style={styles.optionsPanelItem} onPress={() => router.push('/profile/addresses')}>
              <Ionicons name="location-outline" size={14} color="#8a5c38" />
              <Text numberOfLines={1} style={styles.optionsPanelItemLabel}>{locationText}</Text>
              <Ionicons name="chevron-down" size={14} color="#8a5c38" />
            </Pressable>
            <Pressable style={styles.optionsPanelItem} onPress={() => router.push('/services')}>
              <Ionicons name="search" size={14} color="#8a5c38" />
              <Text style={styles.optionsPanelItemLabel}>Search services and subscriptions</Text>
            </Pressable>
            <Pressable style={styles.optionsPanelItem} onPress={() => router.push('/services')}>
              <Ionicons name="sparkles-outline" size={14} color="#8a5c38" />
              <Text style={styles.optionsPanelItemLabel}>Services</Text>
            </Pressable>
            <Pressable style={styles.optionsPanelItem} onPress={() => router.push('/subscription/plans')}>
              <Ionicons name="wallet-outline" size={14} color="#8a5c38" />
              <Text style={styles.optionsPanelItemLabel}>Subscriptions</Text>
            </Pressable>
            <Pressable style={styles.optionsPanelItem} onPress={() => router.push('/bookings')}>
              <Ionicons name="calendar-clear-outline" size={14} color="#8a5c38" />
              <Text style={styles.optionsPanelItemLabel}>Bookings</Text>
            </Pressable>
            <Pressable style={styles.optionsPanelItem} onPress={() => router.push('/profile')}>
              <Ionicons name="person-outline" size={14} color="#8a5c38" />
              <Text style={styles.optionsPanelItemLabel}>Account</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function CustomerShortcutBar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeShortcut = resolveActiveShortcut(pathname);

  return (
    <View style={styles.shortcutRoot}>
      <View style={styles.shortcutBar}>
        {SHORTCUTS.map((item) => {
          const isActive = item.id === activeShortcut;
          const tintColor = isActive ? dofursColors.coral : '#7a6a5b';

          return (
            <Pressable
              key={item.id}
              style={styles.shortcutItem}
              accessibilityLabel={`${item.label} shortcut`}
              onPress={() => {
                if (pathname !== item.route) {
                  router.replace(item.route);
                }
              }}
            >
              <Ionicons name={isActive ? item.iconActive : item.icon} size={18} color={tintColor} />
              <Text style={[styles.shortcutLabel, isActive ? styles.shortcutLabelActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRoot: {
    backgroundColor: '#fff9f2',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e3c8ae',
    backgroundColor: '#fff9f3',
    padding: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLogoWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerLogo: {
    width: 122,
    height: 38,
  },
  iconCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#e4cab1',
    backgroundColor: '#fffefb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#e4cab1',
    backgroundColor: '#fff2e4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileCircleImage: {
    width: '100%',
    height: '100%',
  },
  profileCircleLabel: {
    color: '#7f5837',
    fontSize: 16,
    fontWeight: '800',
  },
  optionsPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6d2bf',
    backgroundColor: '#fffefb',
    overflow: 'hidden',
  },
  optionsPanelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2e4d5',
  },
  optionsPanelItemLabel: {
    color: '#5e4939',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  shortcutRoot: {
    backgroundColor: '#fff9f2',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  shortcutBar: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
    backgroundColor: '#fff7ee',
    borderTopColor: '#e3c7ad',
    borderTopWidth: 1,
    borderRadius: 22,
    shadowColor: '#956038',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  shortcutItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginHorizontal: 2,
    gap: 4,
  },
  shortcutLabel: {
    color: '#7a6a5b',
    fontSize: 10,
    fontWeight: '700',
  },
  shortcutLabelActive: {
    color: dofursColors.coral,
  },
});