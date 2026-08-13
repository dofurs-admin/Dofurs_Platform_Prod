import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getCreditWallet,
  getNotifications,
  getStorageSignedReadUrl,
  getUserBookings,
  getUserPets,
  getUserProfile,
  useAuthStore,
} from '@dofurs/shared';

type BookingSummary = {
  id: number;
  booking_date: string | null;
  start_time: string | null;
  booking_status: string | null;
  amount: number | null;
  service_type: string | null;
};

type PetSummary = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  photo_url: string | null;
};

type ActivitySummary = {
  id: string;
  message: string;
  timestamp: string;
};

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

function extractStoragePath(bucket: 'user-photos' | 'pet-photos', value: string) {
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

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

function parseBookingSummary(row: Record<string, unknown>): BookingSummary | null {
  const id = Number(row.id ?? NaN);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    booking_date: typeof row.booking_date === 'string' ? row.booking_date : null,
    start_time: typeof row.start_time === 'string' ? row.start_time : null,
    booking_status: typeof row.booking_status === 'string' ? row.booking_status : (typeof row.status === 'string' ? row.status : null),
    amount: typeof row.amount === 'number' ? row.amount : (typeof row.final_price === 'number' ? row.final_price : null),
    service_type: typeof row.service_type === 'string' ? row.service_type : null,
  };
}

function parsePetSummary(row: Record<string, unknown>): PetSummary | null {
  const id = Number(row.id ?? NaN);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const name = typeof row.name === 'string' && row.name.trim().length > 0 ? row.name.trim() : `Pet #${id}`;
  const breed = typeof row.breed === 'string' ? row.breed : null;
  const age = typeof row.age === 'number' && Number.isFinite(row.age) ? row.age : null;
  const photoSource =
    (typeof row.photo_url === 'string' ? row.photo_url : null)
    ?? (typeof row.photoUrl === 'string' ? row.photoUrl : null)
    ?? (typeof row.avatar_url === 'string' ? row.avatar_url : null)
    ?? (typeof row.image_url === 'string' ? row.image_url : null)
    ?? null;
  const photoUrl = typeof photoSource === 'string' && photoSource.trim().length > 0 ? photoSource.trim() : null;

  return {
    id,
    name,
    breed,
    age,
    photo_url: photoUrl,
  };
}

function parseActivitySummary(row: Record<string, unknown>): ActivitySummary | null {
  const idValue = row.id;
  const id = typeof idValue === 'string' ? idValue : (typeof idValue === 'number' ? String(idValue) : null);
  const message =
    typeof row.message === 'string'
      ? row.message
      : (typeof row.title === 'string' ? row.title : (typeof row.body === 'string' ? row.body : null));

  if (!id || !message) {
    return null;
  }

  const timestamp = typeof row.created_at === 'string' ? row.created_at : 'Just now';

  return {
    id,
    message,
    timestamp,
  };
}

function formatBookingWindow(booking: BookingSummary) {
  const dateText = booking.booking_date ?? 'Date TBA';
  const timeText = booking.start_time ? ` at ${booking.start_time}` : '';
  return `${dateText}${timeText}`;
}

export default function CustomerHomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isVaccinationSectionOpen, setIsVaccinationSectionOpen] = useState(false);
  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});

  const bookingsQuery = useQuery({
    queryKey: ['customer', 'home', 'bookings'],
    queryFn: getUserBookings,
    enabled: Boolean(accessToken),
  });

  const walletQuery = useQuery({
    queryKey: ['customer', 'home', 'wallet'],
    queryFn: getCreditWallet,
    enabled: Boolean(accessToken),
  });

  const profileQuery = useQuery({
    queryKey: ['customer', 'home', 'profile'],
    queryFn: getUserProfile,
    enabled: Boolean(accessToken),
  });

  const petsQuery = useQuery({
    queryKey: ['customer', 'home', 'pets'],
    queryFn: getUserPets,
    enabled: Boolean(accessToken),
  });

  const notificationsQuery = useQuery({
    queryKey: ['customer', 'home', 'activity'],
    queryFn: () => getNotifications({ limit: 3, unreadOnly: false }),
    enabled: Boolean(accessToken),
  });

  const bookings = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    return rows
      .map((row) => parseBookingSummary(row as Record<string, unknown>))
      .filter((row): row is BookingSummary => Boolean(row));
  }, [bookingsQuery.data?.bookings]);

  const pets = useMemo(() => {
    const rows = petsQuery.data?.pets ?? [];
    return rows
      .map((row) => parsePetSummary(row as Record<string, unknown>))
      .filter((row): row is PetSummary => Boolean(row));
  }, [petsQuery.data?.pets]);

  const activityItems = useMemo(() => {
    const rows = notificationsQuery.data?.notifications ?? [];
    const parsed = rows
      .map((row) => parseActivitySummary(row as Record<string, unknown>))
      .filter((row): row is ActivitySummary => Boolean(row));

    if (parsed.length > 0) {
      return parsed;
    }

    return [
      {
        id: 'default-activity',
        message: 'No active notifications. Start your next booking when ready.',
        timestamp: 'Just now',
      },
    ];
  }, [notificationsQuery.data?.notifications]);

  const userName =
    typeof profileQuery.data?.profile?.name === 'string' && profileQuery.data.profile.name.trim().length > 0
      ? profileQuery.data.profile.name.trim().split(' ')[0]
      : 'Pet Parent';

  useEffect(() => {
    let active = true;

    async function hydratePetPhotos() {
      const nextMap: Record<number, string> = {};

      await Promise.all(
        pets.map(async (pet) => {
          const immediate = resolveImmediatePhotoUrl(pet.photo_url);
          if (immediate) {
            nextMap[pet.id] = immediate;
            return;
          }

          if (!pet.photo_url) {
            return;
          }

          const storagePath = extractStoragePath('pet-photos', pet.photo_url);
          if (!storagePath) {
            return;
          }

          try {
            const response = await getStorageSignedReadUrl({
              bucket: 'pet-photos',
              path: storagePath,
              expiresIn: 3600,
            });

            if (typeof response.signedUrl === 'string' && response.signedUrl.length > 0) {
              nextMap[pet.id] = response.signedUrl;
            }
          } catch {
            // Keep fallback initial when signed URL cannot be resolved.
          }
        }),
      );

      if (active) {
        setPetPhotoUrls(nextMap);
      }
    }

    void hydratePetPhotos();

    return () => {
      active = false;
    };
  }, [pets]);

  const upcomingBooking = useMemo(() => {
    const activeStatuses = new Set(['pending', 'confirmed', 'in_progress']);
    const sorted = bookings.slice().sort((left, right) => {
      const leftKey = `${left.booking_date ?? ''}T${left.start_time ?? '00:00'}`;
      const rightKey = `${right.booking_date ?? ''}T${right.start_time ?? '00:00'}`;
      return leftKey.localeCompare(rightKey);
    });

    return sorted.find((booking) => booking.booking_status && activeStatuses.has(booking.booking_status)) ?? null;
  }, [bookings]);

  const creditBalance = Math.max(
    0,
    Number(
      (walletQuery.data?.balance as { available_inr?: unknown } | undefined)?.available_inr ??
        (walletQuery.data?.balance as { availableInr?: unknown } | undefined)?.availableInr ??
        0,
    ),
  );

  const isLoading =
    bookingsQuery.isLoading
    || walletQuery.isLoading
    || profileQuery.isLoading
    || petsQuery.isLoading
    || notificationsQuery.isLoading;

  const isRefreshing =
    bookingsQuery.isRefetching
    || walletQuery.isRefetching
    || profileQuery.isRefetching
    || petsQuery.isRefetching
    || notificationsQuery.isRefetching;

  function handleRefresh() {
    void Promise.all([
      bookingsQuery.refetch(),
      walletQuery.refetch(),
      profileQuery.refetch(),
      petsQuery.refetch(),
      notificationsQuery.refetch(),
    ]);
  }

  const activeBookings = bookings.filter((booking) => {
    if (!booking.booking_status) {
      return false;
    }

    return ['pending', 'confirmed', 'in_progress'].includes(booking.booking_status);
  }).length;

  const recentBookings = bookings.slice(0, 2);
  const recentPets = pets.slice(0, 2);

  return (
    <Screen scroll refreshing={isRefreshing} onRefresh={handleRefresh}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Dofurs Customer Dashboard</Text>
        <Text style={styles.heroTitle}>Welcome back, {userName}</Text>
        <Text style={styles.heroSubtitle}>Plan grooming, track bookings, and keep pet passports complete.</Text>

        <View style={styles.heroActionRow}>
          <Pressable style={styles.primaryCtaButton} onPress={() => router.push('/booking/new/service')}>
            <Text style={styles.primaryCtaLabel}>Book Now</Text>
          </Pressable>
          <Pressable style={styles.secondaryCtaButton} onPress={() => router.push('/pets')}>
            <Text style={styles.secondaryCtaLabel}>Manage Pet Profiles</Text>
          </Pressable>
        </View>

        {pets.length > 0 ? (
          <View style={styles.passportRailSection}>
            <Text style={styles.passportRailTitle}>Open Pet Passport</Text>
            <View style={styles.passportRail}>
              {pets.map((pet) => (
                <Pressable
                  key={pet.id}
                  style={styles.passportChip}
                  onPress={() => router.push(`/pets/${pet.id}/passport`)}
                >
                  <View style={styles.passportAvatarWrap}>
                    {petPhotoUrls[pet.id] ? (
                      <Image source={{ uri: petPhotoUrls[pet.id] }} style={styles.passportAvatarImage} />
                    ) : (
                      <Text style={styles.passportAvatarEmoji}>P</Text>
                    )}
                  </View>
                  <Text numberOfLines={1} style={styles.passportChipLabel}>{pet.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{activeBookings}</Text>
          <Text style={styles.kpiLabel}>Active bookings</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{formatCurrency(creditBalance)}</Text>
          <Text style={styles.kpiLabel}>Credits</Text>
        </View>
      </View>

      {isLoading ? <Text style={styles.metaInfo}>Loading your dashboard...</Text> : null}

      <View style={styles.sectionCard}>
        <View style={styles.referBannerRow}>
          <View style={styles.referBannerCopyWrap}>
            <Text style={styles.referBannerEyebrow}>Refer and Earn</Text>
            <Text style={styles.referBannerTitle}>Invite friends. Both of you earn INR 500.</Text>
            <Text style={styles.referBannerSubtitle}>Share your unique code and earn Dofurs Credits on any service.</Text>
          </View>
          <Text style={styles.referBannerIcon}>GIFT</Text>
        </View>
        <Pressable style={styles.inlineLinkButton} onPress={() => router.push('/referral')}>
          <Text style={styles.inlineLinkLabel}>Open referral center</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Subscription Services</Text>
        <Text style={styles.metaInfo}>Save more with a grooming subscription. Buy once, then book eligible services with credits.</Text>
        <Pressable style={styles.inlineLinkButton} onPress={() => router.push('/subscription/plans')}>
          <Text style={styles.inlineLinkLabel}>Explore plans and start saving</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {activityItems.map((item) => (
          <View key={item.id} style={styles.activityItem}>
            <Text style={styles.activityMessage}>{item.message}</Text>
            <Text style={styles.activityTimestamp}>{item.timestamp}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Your Bookings</Text>

        {recentBookings.length === 0 && !isLoading ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No Bookings Yet</Text>
            <Text style={styles.metaInfo}>Start by booking a service for your pet. Your provider will confirm and manage the appointment.</Text>
            <Pressable style={styles.primaryActionFull} onPress={() => router.push('/booking/new/service')}>
              <Text style={styles.primaryActionFullLabel}>Book Your First Service</Text>
            </Pressable>
          </View>
        ) : null}

        {recentBookings.map((booking) => (
          <Pressable
            key={booking.id}
            style={styles.listItem}
            onPress={() => router.push(`/booking/${booking.id}`)}
          >
            <View style={styles.listItemLeft}>
              <Text style={styles.listTitle}>{booking.service_type ?? `Booking #${booking.id}`}</Text>
              <Text style={styles.metaInfo}>{formatBookingWindow(booking)}</Text>
            </View>

            <Text style={styles.listValue}>{booking.booking_status ?? 'pending'}</Text>
          </Pressable>
        ))}

        {bookings.length > 2 ? (
          <Pressable style={styles.inlineLinkButton} onPress={() => router.push('/bookings')}>
            <Text style={styles.inlineLinkLabel}>View All Bookings</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Your Pets</Text>

        {recentPets.length === 0 && !isLoading ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No Pets Yet</Text>
            <Text style={styles.metaInfo}>Add your first pet to get started. Create a complete passport with medical and behavioral info.</Text>
            <Pressable style={styles.primaryActionFull} onPress={() => router.push('/pets/add')}>
              <Text style={styles.primaryActionFullLabel}>Add Your First Pet</Text>
            </Pressable>
          </View>
        ) : null}

        {recentPets.map((pet) => (
          <Pressable
            key={pet.id}
            style={styles.petCard}
            onPress={() => router.push(`/pets/${pet.id}/passport`)}
          >
            <View style={styles.petCardAvatarWrap}>
              {petPhotoUrls[pet.id]
                ? <Image source={{ uri: petPhotoUrls[pet.id] }} style={styles.petCardAvatarImage} />
                : <Text style={styles.petCardAvatarText}>P</Text>}
            </View>
            <View style={styles.petCardCopy}>
              <Text style={styles.petCardName}>{pet.name}</Text>
              <Text style={styles.petCardMeta}>
                {pet.breed ?? 'Pet'}{pet.age !== null ? `  |  ${pet.age} years` : ''}
              </Text>
              <Text style={styles.inlineLinkLabel}>View Pet Passport</Text>
            </View>
          </Pressable>
        ))}

        {pets.length > 2 ? (
          <Pressable style={styles.inlineLinkButton} onPress={() => router.push('/pets')}>
            <Text style={styles.inlineLinkLabel}>Manage All Pets</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={styles.reminderHeader}
        onPress={() => setIsVaccinationSectionOpen((open) => !open)}
      >
        <View>
          <Text style={styles.sectionTitle}>Vaccination Reminders</Text>
          <Text style={styles.metaInfo}>No upcoming reminders</Text>
        </View>
        <Text style={styles.inlineLinkLabel}>{isVaccinationSectionOpen ? 'Hide' : 'Show'}</Text>
      </Pressable>

      {isVaccinationSectionOpen ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reminder Preferences (7 days window)</Text>
          <Text style={styles.metaInfo}>Choose channels and reminder window.</Text>
          <View style={styles.preferencesRow}>
            <View style={styles.preferenceChip}><Text style={styles.preferenceChipText}>In-App</Text></View>
            <View style={styles.preferenceChip}><Text style={styles.preferenceChipText}>Email</Text></View>
            <View style={styles.preferenceChip}><Text style={styles.preferenceChipText}>WhatsApp</Text></View>
          </View>
          <Text style={styles.metaInfo}>No upcoming reminders. Your due vaccinations will appear here when dates are within the selected window.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topShellCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e3c8ae',
    backgroundColor: '#fff9f3',
    padding: 14,
    gap: 10,
  },
  topShellHeaderRow: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topShellLogoOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topShellLogo: {
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
  },
  locationRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead6c4',
    backgroundColor: '#fffefb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  locationText: {
    flex: 1,
    color: '#5b4b3f',
    fontSize: 12,
    fontWeight: '700',
  },
  searchRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6d2bf',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchPlaceholder: {
    color: '#8a796a',
    fontSize: 13,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fff8ef',
    padding: 20,
    gap: 12,
  },
  heroEyebrow: {
    color: '#a05a2c',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#5f5f66',
    fontSize: 14,
    lineHeight: 20,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: dofursColors.coral,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flex: 1,
  },
  primaryCtaLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryCtaButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfc4a8',
    backgroundColor: '#fffefb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryCtaLabel: {
    color: '#3d3129',
    fontSize: 13,
    fontWeight: '700',
  },
  passportRailSection: {
    gap: 8,
  },
  passportRailTitle: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  passportRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  passportChip: {
    width: 74,
    alignItems: 'center',
    gap: 4,
  },
  passportAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: '#dfbe9f',
    backgroundColor: '#fff3e4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  passportAvatarImage: {
    width: '100%',
    height: '100%',
  },
  passportAvatarEmoji: {
    color: '#8b5f3a',
    fontSize: 18,
    fontWeight: '700',
  },
  passportChipLabel: {
    color: '#334155',
    fontSize: 12,
    maxWidth: 72,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4d3c2',
    backgroundColor: '#fffdf9',
    padding: 12,
    gap: 4,
  },
  kpiValue: {
    color: dofursColors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  kpiLabel: {
    color: '#7a6758',
    fontSize: 12,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fffbf7',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  referBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  referBannerCopyWrap: {
    flex: 1,
    gap: 3,
  },
  referBannerEyebrow: {
    color: '#a05a2c',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  referBannerTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  referBannerSubtitle: {
    color: '#6b7280',
    fontSize: 13,
  },
  referBannerIcon: {
    color: '#ffffff',
    backgroundColor: dofursColors.coral,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  inlineLinkButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4c7ab',
    backgroundColor: '#fff8ee',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineLinkLabel: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
  },
  activityItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 10,
    gap: 4,
  },
  activityMessage: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
  activityTimestamp: {
    color: '#9ca3af',
    fontSize: 11,
  },
  emptyStateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 14,
    gap: 8,
  },
  emptyStateTitle: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryActionFull: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  primaryActionFullLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  metaInfo: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 19,
  },
  listItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  listItemLeft: {
    gap: 2,
  },
  listTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  listValue: {
    color: '#7c2d12',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  petCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  petCardAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e8c9ac',
    backgroundColor: '#fff3e4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petCardAvatarImage: {
    width: '100%',
    height: '100%',
  },
  petCardAvatarText: {
    color: '#8b5f3a',
    fontSize: 15,
    fontWeight: '700',
  },
  petCardCopy: {
    flex: 1,
    gap: 2,
  },
  petCardName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  petCardMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  reminderHeader: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferencesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fff8ee',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  preferenceChipText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
});
