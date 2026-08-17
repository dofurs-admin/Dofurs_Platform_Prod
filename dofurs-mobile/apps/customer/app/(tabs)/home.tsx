import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  dofursColors,
  getCreditWallet,
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

function resolveImmediatePhotoUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function extractStoragePath(bucket: 'pet-photos', value: string) {
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

function parseBookingSummary(row: Record<string, unknown>): BookingSummary | null {
  const id = Number(row.id ?? NaN);
  if (!Number.isFinite(id) || id <= 0) return null;
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
  if (!Number.isFinite(id) || id <= 0) return null;
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
  return { id, name, breed, age, photo_url: photoUrl };
}

function formatBookingDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBA';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatBookingTime(timeStr: string | null): string {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function getPetInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getPetAgeLabel(age: number | null): string {
  if (age === null) return '';
  if (age < 1) return `${(age * 12).toFixed(0)}m`;
  return `${age}y`;
}

type HeroState =
  | { kind: 'upcoming-booking'; booking: BookingSummary }
  | { kind: 'default' };

export default function CustomerHomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
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

  const userName =
    typeof profileQuery.data?.profile?.name === 'string' && profileQuery.data.profile.name.trim().length > 0
      ? profileQuery.data.profile.name.trim().split(' ')[0]
      : 'Pet Parent';

  const creditBalance = Math.max(
    0,
    Number(
      (walletQuery.data?.balance as { available_inr?: unknown } | undefined)?.available_inr ??
        (walletQuery.data?.balance as { availableInr?: unknown } | undefined)?.availableInr ??
        0,
    ),
  );

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
          if (!pet.photo_url) return;
          const storagePath = extractStoragePath('pet-photos', pet.photo_url);
          if (!storagePath) return;
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
      if (active) setPetPhotoUrls(nextMap);
    }
    void hydratePetPhotos();
    return () => { active = false; };
  }, [pets]);

  const heroState = useMemo<HeroState>(() => {
    const activeStatuses = new Set(['pending', 'confirmed', 'in_progress']);
    const sorted = bookings.slice().sort((left, right) => {
      const leftKey = `${left.booking_date ?? ''}T${left.start_time ?? '00:00'}`;
      const rightKey = `${right.booking_date ?? ''}T${right.start_time ?? '00:00'}`;
      return leftKey.localeCompare(rightKey);
    });
    const upcoming = sorted.find((b) => b.booking_status && activeStatuses.has(b.booking_status)) ?? null;
    if (upcoming) return { kind: 'upcoming-booking', booking: upcoming };
    return { kind: 'default' };
  }, [bookings]);

  const isLoading =
    bookingsQuery.isLoading || walletQuery.isLoading || profileQuery.isLoading || petsQuery.isLoading;

  const isRefreshing =
    bookingsQuery.isRefetching || walletQuery.isRefetching || profileQuery.isRefetching || petsQuery.isRefetching;

  function handleRefresh() {
    void Promise.all([
      bookingsQuery.refetch(),
      walletQuery.refetch(),
      profileQuery.refetch(),
      petsQuery.refetch(),
    ]);
  }

  return (
    <Screen scroll refreshing={isRefreshing} onRefresh={handleRefresh}>
      {/* Contextual Hero */}
      <View style={styles.heroSection}>
        <Text style={styles.heroGreeting}>Hey {userName} 👋</Text>
        {heroState.kind === 'upcoming-booking' ? (
          <View style={styles.heroContextWrap}>
            <Text style={styles.heroSubtext}>
              {heroState.booking.service_type ?? 'Your grooming'} is on{' '}
              {formatBookingDate(heroState.booking.booking_date)}
              {heroState.booking.start_time ? ` at ${formatBookingTime(heroState.booking.start_time)}` : ''}
            </Text>
            <Pressable
              style={styles.heroCta}
              onPress={() => router.push(`/booking/${heroState.booking.id}`)}
            >
              <Text style={styles.heroCtaLabel}>View booking</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.heroContextWrap}>
            <Text style={styles.heroSubtext}>Your pets are all set! 🐾</Text>
            <Pressable
              style={styles.heroCta}
              onPress={() => router.push('/booking/new/service')}
            >
              <Text style={styles.heroCtaLabel}>Book grooming</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Pet Cards — Horizontal Scroll */}
      <View style={styles.petSection}>
        <Text style={styles.sectionHeading}>Your pets</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.petScrollContent}
          snapToInterval={156}
          decelerationRate="fast"
        >
          {pets.map((pet) => (
            <Pressable
              key={pet.id}
              style={styles.petCard}
              onPress={() => router.push(`/pets/${pet.id}/passport`)}
            >
              <View style={styles.petCardPhotoWrap}>
                {petPhotoUrls[pet.id] ? (
                  <Image source={{ uri: petPhotoUrls[pet.id] }} style={styles.petCardPhoto} />
                ) : (
                  <View style={styles.petCardPhotoPlaceholder}>
                    <Text style={styles.petCardPhotoInitial}>{getPetInitial(pet.name)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.petCardInfo}>
                <Text numberOfLines={1} style={styles.petCardName}>{pet.name}</Text>
                <Text numberOfLines={1} style={styles.petCardMeta}>
                  {[pet.breed, getPetAgeLabel(pet.age)].filter(Boolean).join(' · ') || 'Pet'}
                </Text>
                <View style={styles.petStatusChip}>
                  <View style={styles.petStatusDot} />
                  <Text style={styles.petStatusLabel}>Healthy</Text>
                </View>
              </View>
            </Pressable>
          ))}
          <Pressable
            style={styles.petCardAdd}
            onPress={() => router.push('/pets/add')}
          >
            <View style={styles.petCardAddIconWrap}>
              <Ionicons name="add" size={28} color={dofursColors.coral} />
            </View>
            <Text style={styles.petCardAddLabel}>Add pet</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <View style={styles.quickActionGrid}>
          <Pressable style={styles.quickActionTile} onPress={() => router.push('/booking/new/service')}>
            <View style={styles.quickActionIconWrap}>
              <Ionicons name="cut-outline" size={22} color={dofursColors.coral} />
            </View>
            <Text style={styles.quickActionLabel}>Book{'\n'}Grooming</Text>
          </Pressable>
          <Pressable style={styles.quickActionTile} onPress={() => router.push('/pets')}>
            <View style={styles.quickActionIconWrap}>
              <Ionicons name="medkit-outline" size={22} color={dofursColors.coral} />
            </View>
            <Text style={styles.quickActionLabel}>Health{'\n'}Records</Text>
          </Pressable>
          <Pressable style={styles.quickActionTile} onPress={() => router.push('/subscription/plans')}>
            <View style={styles.quickActionIconWrap}>
              <Ionicons name="card-outline" size={22} color={dofursColors.coral} />
            </View>
            <Text style={styles.quickActionLabel}>Save with{'\n'}Plans</Text>
          </Pressable>
          <Pressable style={styles.quickActionTile} onPress={() => router.push('/referral')}>
            <View style={styles.quickActionIconWrap}>
              <Ionicons name="gift-outline" size={22} color={dofursColors.coral} />
            </View>
            <Text style={styles.quickActionLabel}>Refer &{'\n'}Earn</Text>
          </Pressable>
        </View>
      </View>

      {/* Upcoming Appointment (conditional) */}
      {heroState.kind === 'upcoming-booking' ? (
        <Pressable
          style={styles.upcomingCard}
          onPress={() => router.push(`/booking/${heroState.booking.id}`)}
        >
          <View style={styles.upcomingAccent} />
          <View style={styles.upcomingContent}>
            <Text style={styles.upcomingLabel}>Upcoming appointment</Text>
            <Text style={styles.upcomingTitle}>
              {heroState.booking.service_type ?? 'Grooming'}
            </Text>
            <Text style={styles.upcomingMeta}>
              {formatBookingDate(heroState.booking.booking_date)}
              {heroState.booking.start_time ? ` · ${formatBookingTime(heroState.booking.start_time)}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={dofursColors.inkSoft} />
        </Pressable>
      ) : null}

      {/* Subscription Upsell */}
      <View style={styles.subscriptionCard}>
        <View style={styles.subscriptionContent}>
          <Text style={styles.subscriptionTitle}>Save with a grooming plan</Text>
          <Text style={styles.subscriptionSubtitle}>
            Buy once, book eligible services with credits. Up to 20% savings.
          </Text>
          <Pressable
            style={styles.subscriptionCta}
            onPress={() => router.push('/subscription/plans')}
          >
            <Text style={styles.subscriptionCtaLabel}>Explore plans</Text>
          </Pressable>
        </View>
        <View style={styles.subscriptionIconWrap}>
          <Ionicons name="sparkles" size={32} color={dofursColors.coral} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroSection: {
    backgroundColor: '#fef5eb',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
    shadowColor: '#956038',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroGreeting: {
    color: dofursColors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  heroContextWrap: {
    gap: 12,
  },
  heroSubtext: {
    color: dofursColors.inkSoft,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  heroCta: {
    alignSelf: 'flex-start',
    backgroundColor: dofursColors.coral,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#c7783e',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroCtaLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Pet Cards
  petSection: {
    gap: 12,
  },
  sectionHeading: {
    color: dofursColors.ink,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  } as const,
  petScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  petCard: {
    width: 144,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  petCardPhotoWrap: {
    width: '100%',
    height: 100,
    backgroundColor: '#fdf3e8',
  },
  petCardPhoto: {
    width: '100%',
    height: '100%',
  },
  petCardPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdf3e8',
  },
  petCardPhotoInitial: {
    color: dofursColors.coral,
    fontSize: 36,
    fontWeight: '700',
  },
  petCardInfo: {
    padding: 10,
    gap: 3,
  },
  petCardName: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  petCardMeta: {
    color: dofursColors.inkSoft,
    fontSize: 12,
    fontWeight: '400',
  },
  petStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  petStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  petStatusLabel: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  petCardAdd: {
    width: 144,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e8d5c0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  petCardAddIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef5eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petCardAddLabel: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
  },

  // Quick Actions
  quickActionsSection: {
    gap: 12,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef5eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Upcoming Appointment
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  upcomingAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: dofursColors.coral,
  },
  upcomingContent: {
    flex: 1,
    padding: 16,
    gap: 3,
  },
  upcomingLabel: {
    color: dofursColors.inkSoft,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upcomingTitle: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  upcomingMeta: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    fontWeight: '400',
  },

  // Subscription Upsell
  subscriptionCard: {
    flexDirection: 'row',
    backgroundColor: '#fef5eb',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#956038',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  subscriptionContent: {
    flex: 1,
    gap: 8,
  },
  subscriptionTitle: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as const,
  subscriptionSubtitle: {
    color: dofursColors.inkSoft,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  subscriptionCta: {
    alignSelf: 'flex-start',
    backgroundColor: dofursColors.coral,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  subscriptionCtaLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  subscriptionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});