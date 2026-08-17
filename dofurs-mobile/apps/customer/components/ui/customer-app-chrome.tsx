import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  dofursColors,
  getStorageSignedReadUrl,
  getUserProfile,
  useAuthStore,
} from '@dofurs/shared';

const DOFURS_LOGO = require('../../assets/brand-logo.png');

type ShortcutRoute = '/home' | '/bookings' | '/services' | '/pets';

type ShortcutItem = {
  id: 'home' | 'bookings' | 'services' | 'pets';
  label: string;
  route: ShortcutRoute;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const SHORTCUTS: ShortcutItem[] = [
  { id: 'home', label: 'Home', route: '/home', icon: 'home-outline', iconActive: 'home' },
  { id: 'bookings', label: 'Bookings', route: '/bookings', icon: 'calendar-clear-outline', iconActive: 'calendar' },
  { id: 'services', label: 'Services', route: '/services', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { id: 'pets', label: 'Pets', route: '/pets', icon: 'paw-outline', iconActive: 'paw' },
];

function resolveActiveShortcut(pathname: string): ShortcutItem['id'] | null {
  if (pathname === '/home' || pathname === '/') return 'home';
  if (pathname.startsWith('/booking') || pathname.startsWith('/bookings')) return 'bookings';
  if (pathname.startsWith('/services') || pathname.startsWith('/subscription')) return 'services';
  if (pathname.startsWith('/pets')) return 'pets';
  return null;
}

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

export function CustomerHeaderBar() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [resolvedProfilePhotoUrl, setResolvedProfilePhotoUrl] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['customer', 'chrome', 'profile'],
    queryFn: getUserProfile,
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

  useEffect(() => {
    let active = true;
    async function hydrateProfilePhoto() {
      const immediate = resolveImmediatePhotoUrl(profilePhotoUrl);
      if (immediate) {
        if (active) setResolvedProfilePhotoUrl(immediate);
        return;
      }
      if (!profilePhotoUrl) {
        if (active) setResolvedProfilePhotoUrl(null);
        return;
      }
      const storagePath = extractStoragePath('user-photos', profilePhotoUrl);
      if (!storagePath) {
        if (active) setResolvedProfilePhotoUrl(null);
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
      if (active) setResolvedProfilePhotoUrl(null);
    }
    void hydrateProfilePhoto();
    return () => { active = false; };
  }, [profilePhotoUrl]);

  return (
    <View style={styles.headerRoot}>
      <View style={styles.headerRow}>
        <View style={styles.headerLogoWrap}>
          <Image source={DOFURS_LOGO} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="Dofurs logo" />
        </View>
        <Pressable
          style={styles.profileCircleButton}
          onPress={() => router.push('/profile')}
          accessibilityLabel="Open account profile"
        >
          {resolvedProfilePhotoUrl ? (
            <Image source={{ uri: resolvedProfilePhotoUrl }} style={styles.profileCircleImage} />
          ) : (
            <Text style={styles.profileCircleLabel}>{userName.slice(0, 1).toUpperCase()}</Text>
          )}
        </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLogoWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerLogo: {
    width: 122,
    height: 38,
  },
  profileCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
