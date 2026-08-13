import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getStorageSignedReadUrl, getUserPets, useAuthStore } from '@dofurs/shared';

type PetRow = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  completion_percent: number | null;
  photo_url: string | null;
};

function resolveImmediatePhotoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/storage/v1/object/public/')) {
    return value;
  }

  return null;
}

function toPetRow(value: Record<string, unknown>): PetRow | null {
  const id = Number(value.id ?? NaN);
  const name = typeof value.name === 'string' ? value.name.trim() : '';

  if (!Number.isFinite(id) || id <= 0 || !name) {
    return null;
  }

  return {
    id,
    name,
    breed: typeof value.breed === 'string' ? value.breed : null,
    age: typeof value.age === 'number' ? value.age : null,
    completion_percent:
      typeof value.completion_percent === 'number' ? value.completion_percent : null,
    photo_url: typeof value.photo_url === 'string' ? value.photo_url : null,
  };
}

export default function CustomerPetsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const petsQuery = useQuery({
    queryKey: ['customer', 'pets'],
    queryFn: getUserPets,
    enabled: Boolean(accessToken),
  });

  const pets = useMemo(() => {
    const rows = petsQuery.data?.pets ?? [];
    return rows
      .map((row) => toPetRow(row as Record<string, unknown>))
      .filter((row): row is PetRow => Boolean(row));
  }, [petsQuery.data?.pets]);

  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});

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

          try {
            const response = await getStorageSignedReadUrl({
              bucket: 'pet-photos',
              path: pet.photo_url,
              expiresIn: 3600,
            });

            if (typeof response.signedUrl === 'string' && response.signedUrl.length > 0) {
              nextMap[pet.id] = response.signedUrl;
            }
          } catch {
            // Keep avatar fallback when signed URL resolution fails.
          }
        }),
      );

      if (!active) {
        return;
      }

      setPetPhotoUrls(nextMap);
    }

    void hydratePetPhotos();

    return () => {
      active = false;
    };
  }, [pets]);

  function handleRefresh() {
    void petsQuery.refetch();
  }

  return (
    <Screen scroll refreshing={petsQuery.isRefetching} onRefresh={handleRefresh}>
      <Text style={styles.pageTitle}>Pet Profiles</Text>

      {petsQuery.isLoading ? <Text style={styles.meta}>Loading pets...</Text> : null}

      {petsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load pets right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => petsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {pets.map((pet) => (
        <Pressable key={pet.id} style={styles.card} onPress={() => router.push(`/pets/${pet.id}`)}>
          <View style={styles.cardLeft}>
            <View style={styles.avatarCircle}>
              {petPhotoUrls[pet.id] ? (
                <Image source={{ uri: petPhotoUrls[pet.id] }} style={styles.petPhoto} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarLabel}>{pet.name.slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.petTextBlock}>
              <Text style={styles.cardTitle}>{pet.name}</Text>
              <Text style={styles.meta}>{pet.breed ?? 'Breed not specified'}</Text>
              <Text style={styles.meta}>{pet.age != null ? `${pet.age} yrs` : 'Age not set'}</Text>
            </View>
          </View>

          <View style={styles.rightAlign}>
            <View style={styles.progressPill}>
              <Text style={styles.progress}>{Math.round(pet.completion_percent ?? 0)}% complete</Text>
            </View>
            <Pressable style={styles.passportButton} onPress={() => router.push(`/pets/${pet.id}/passport`)}>
              <Text style={styles.passportButtonLabel}>View Passport</Text>
            </Pressable>
          </View>
        </Pressable>
      ))}

      {!petsQuery.isLoading && !petsQuery.isError && pets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🐾</Text>
          <Text style={styles.emptyTitle}>No Pets Yet</Text>
          <Text style={styles.emptySubtitle}>
            Create pet profiles with complete medical, behavioral, and care information.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.push('/pets/add')}>
            <Text style={styles.emptyButtonLabel}>Add Your First Pet</Text>
          </Pressable>
        </View>
      ) : null}

      {!petsQuery.isLoading && !petsQuery.isError && pets.length > 0 ? (
        <View style={styles.addAnotherCard}>
          <Text style={styles.addAnotherTitle}>Add Another Pet?</Text>
          <Text style={styles.addAnotherSubtitle}>
            Create a complete passport with all medical and behavioral information.
          </Text>
          <Pressable style={styles.addAnotherButton} onPress={() => router.push('/pets/add')}>
            <Text style={styles.addAnotherButtonLabel}>Add New Pet</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 12,
    shadowColor: '#b47a49',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e8c9ac',
    backgroundColor: '#fff5e8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petPhoto: {
    width: '100%',
    height: '100%',
  },
  avatarLabel: {
    color: '#8f613b',
    fontSize: 14,
    fontWeight: '800',
  },
  petTextBlock: {
    gap: 1,
  },
  rightAlign: {
    alignItems: 'flex-end',
    gap: 8,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: '#7b6959',
    fontSize: 12,
  },
  progressPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e6cfbb',
    backgroundColor: '#fff8f1',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  progress: {
    color: '#72563f',
    fontSize: 11,
    fontWeight: '700',
  },
  passportButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e6cfbb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  passportButtonLabel: {
    color: '#6e533d',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 20,
  },
  emptyTitle: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#7b6959',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyButtonLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  addAnotherCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ead3bf',
    backgroundColor: '#fffaf4',
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  addAnotherTitle: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  addAnotherSubtitle: {
    color: '#7b6959',
    fontSize: 13,
    textAlign: 'center',
  },
  addAnotherButton: {
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addAnotherButtonLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1b5a8',
    backgroundColor: '#fff2ef',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#a6483b',
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
});
