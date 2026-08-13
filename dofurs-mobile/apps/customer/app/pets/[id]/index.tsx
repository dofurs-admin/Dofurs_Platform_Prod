import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, deletePet, dofursColors, getStorageSignedReadUrl, getUserPets } from '@dofurs/shared';

function resolveImmediatePhotoUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/storage/v1/object/public/')) {
    return value;
  }

  return null;
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const petId = Number(params.id ?? NaN);

  const petsQuery = useQuery({
    queryKey: ['customer', 'pets', 'detail', petId],
    queryFn: getUserPets,
  });

  const pet = useMemo(() => {
    const rows = petsQuery.data?.pets ?? [];
    return rows.find((row) => Number((row as Record<string, unknown>).id ?? NaN) === petId) as
      | Record<string, unknown>
      | undefined;
  }, [petId, petsQuery.data?.pets]);

  const [petPhotoUrl, setPetPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function hydratePhoto() {
      const rawValue = typeof pet?.photo_url === 'string' ? pet.photo_url : null;
      const immediate = resolveImmediatePhotoUrl(rawValue);

      if (immediate) {
        if (active) {
          setPetPhotoUrl(immediate);
        }
        return;
      }

      if (!rawValue) {
        if (active) {
          setPetPhotoUrl(null);
        }
        return;
      }

      try {
        const response = await getStorageSignedReadUrl({
          bucket: 'pet-photos',
          path: rawValue,
          expiresIn: 3600,
        });

        if (active) {
          setPetPhotoUrl(typeof response.signedUrl === 'string' ? response.signedUrl : null);
        }
      } catch {
        if (active) {
          setPetPhotoUrl(null);
        }
      }
    }

    void hydratePhoto();

    return () => {
      active = false;
    };
  }, [pet]);

  async function handleDeletePet() {
    if (!Number.isFinite(petId) || petId <= 0) {
      return;
    }

    await deletePet(petId);
    router.replace('/(tabs)/pets');
  }

  return (
    <Screen scroll>
      {!pet ? (
        <Text style={styles.meta}>{petsQuery.isLoading ? 'Loading pet profile...' : 'Pet not found.'}</Text>
      ) : (
        <View style={styles.card}>
          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              {petPhotoUrl ? (
                <Image source={{ uri: petPhotoUrl }} style={styles.avatarPhoto} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarLabel}>{typeof pet.name === 'string' ? pet.name.slice(0, 1).toUpperCase() : 'P'}</Text>
              )}
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.title}>{typeof pet.name === 'string' ? pet.name : 'Pet profile'}</Text>
              <Text style={styles.meta}>{typeof pet.breed === 'string' ? pet.breed : 'Breed not set'}</Text>
            </View>
          </View>

          <Text style={styles.meta}>Breed: {typeof pet.breed === 'string' ? pet.breed : 'Not set'}</Text>
          <Text style={styles.meta}>Age: {typeof pet.age === 'number' ? `${pet.age} years` : 'Not set'}</Text>
          <Text style={styles.meta}>
            Allergies: {typeof pet.allergies === 'string' && pet.allergies.trim().length > 0 ? pet.allergies : 'None'}
          </Text>

          <View style={styles.row}>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/pets/${petId}/passport`)}>
              <Text style={styles.secondaryButtonLabel}>View passport</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/pets/${petId}/edit`)}>
              <Text style={styles.secondaryButtonLabel}>Edit</Text>
            </Pressable>
          </View>

          <Pressable style={styles.deleteButton} onPress={handleDeletePet}>
            <Text style={styles.deleteButtonLabel}>Delete pet</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 8,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dec1a6',
    backgroundColor: '#fff2e4',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  avatarLabel: {
    color: '#8f613b',
    fontSize: 20,
    fontWeight: '800',
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: '#5d5853',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonLabel: {
    color: '#8a3d2c',
    fontSize: 13,
    fontWeight: '700',
  },
});
