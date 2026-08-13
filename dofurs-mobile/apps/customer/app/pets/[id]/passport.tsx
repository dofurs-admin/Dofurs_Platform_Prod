import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getPetPassport, getStorageSignedReadUrl } from '@dofurs/shared';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveImmediatePhotoUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/storage/v1/object/public/')) {
    return value;
  }

  return null;
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toLocaleDateString();
}

function dueStatus(nextDueDate: unknown) {
  if (typeof nextDueDate !== 'string' || nextDueDate.trim().length === 0) {
    return { label: 'Complete', color: '#356c47', bg: '#eef9f1' };
  }

  const dueDate = new Date(nextDueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return { label: 'Complete', color: '#356c47', bg: '#eef9f1' };
  }

  const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Overdue', color: '#9a4538', bg: '#fff2ef' };
  }

  if (diffDays <= 14) {
    return { label: 'Due soon', color: '#7a5a2b', bg: '#fff4e6' };
  }

  return { label: 'Up to date', color: '#356c47', bg: '#eef9f1' };
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const petId = Number(params.id ?? NaN);

  const passportQuery = useQuery({
    queryKey: ['customer', 'pets', 'passport', petId],
    queryFn: () => getPetPassport(petId),
    enabled: Number.isFinite(petId) && petId > 0,
  });

  const profile = passportQuery.data?.profile;
  const pet = useMemo(() => {
    if (!isRecord(profile) || !isRecord(profile.pet)) {
      return null;
    }

    return profile.pet;
  }, [profile]);

  const vaccinations = useMemo(() => {
    if (!isRecord(profile) || !Array.isArray(profile.vaccinations)) {
      return [];
    }

    return profile.vaccinations.filter((row): row is Record<string, unknown> => isRecord(row));
  }, [profile]);

  const medicalRecords = useMemo(() => {
    if (!isRecord(profile) || !Array.isArray(profile.medicalRecords)) {
      return [];
    }

    return profile.medicalRecords.filter((row): row is Record<string, unknown> => isRecord(row));
  }, [profile]);

  const feedingInfo = isRecord(profile) && isRecord(profile.feedingInfo) ? profile.feedingInfo : null;
  const groomingInfo = isRecord(profile) && isRecord(profile.groomingInfo) ? profile.groomingInfo : null;
  const emergencyInfo = isRecord(profile) && isRecord(profile.emergencyInfo) ? profile.emergencyInfo : null;

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

  return (
    <Screen scroll>
      <Text style={styles.pageTitle}>Pet passport</Text>

      {passportQuery.isLoading ? <Text style={styles.meta}>Loading passport details...</Text> : null}
      {passportQuery.isError ? <Text style={styles.error}>Unable to load passport right now.</Text> : null}

      {!passportQuery.isLoading && !passportQuery.isError && pet ? (
        <>
          <View style={styles.card}>
            <View style={styles.heroRow}>
              <View style={styles.photoWrap}>
                {petPhotoUrl ? (
                  <Image source={{ uri: petPhotoUrl }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <Text style={styles.photoFallback}>{typeof pet.name === 'string' ? pet.name.slice(0, 1).toUpperCase() : 'P'}</Text>
                )}
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.title}>{typeof pet.name === 'string' ? pet.name : `Pet #${petId}`}</Text>
                <Text style={styles.meta}>Breed: {typeof pet.breed === 'string' ? pet.breed : 'Not set'}</Text>
                <Text style={styles.meta}>Age: {typeof pet.age === 'number' ? `${pet.age} years` : 'Not set'}</Text>
                <Text style={styles.meta}>Gender: {typeof pet.gender === 'string' ? pet.gender : 'Not set'}</Text>
              </View>
            </View>

            <Text style={styles.meta}>Microchip: {typeof pet.microchip_number === 'string' ? pet.microchip_number : 'Not set'}</Text>
            <Text style={styles.meta}>Allergies: {typeof pet.allergies === 'string' && pet.allergies.trim().length > 0 ? pet.allergies : 'None'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vaccination timeline</Text>
            {vaccinations.length === 0 ? <Text style={styles.meta}>No vaccinations recorded yet.</Text> : null}
            {vaccinations.map((item) => {
              const status = dueStatus(item.next_due_date);
              return (
                <View key={String(item.id ?? Math.random())} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{typeof item.vaccine_name === 'string' ? item.vaccine_name : 'Vaccination'}</Text>
                    <View style={[styles.statusPill, { backgroundColor: status.bg }]}> 
                      <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>Administered: {formatDate(item.administered_date)}</Text>
                  <Text style={styles.meta}>Next due: {formatDate(item.next_due_date)}</Text>
                  <Text style={styles.meta}>Vet: {typeof item.veterinarian_name === 'string' ? item.veterinarian_name : 'Not set'}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Medical records</Text>
            {medicalRecords.length === 0 ? <Text style={styles.meta}>No medical records added yet.</Text> : null}
            {medicalRecords.map((item) => (
              <View key={String(item.id ?? Math.random())} style={styles.entryCard}>
                <Text style={styles.entryTitle}>{typeof item.condition_name === 'string' ? item.condition_name : 'Condition'}</Text>
                <Text style={styles.meta}>Diagnosis: {formatDate(item.diagnosis_date)}</Text>
                <Text style={styles.meta}>Ongoing: {item.ongoing ? 'Yes' : 'No'}</Text>
                <Text style={styles.meta}>
                  Medications: {typeof item.medications === 'string' && item.medications.trim().length > 0 ? item.medications : 'Not set'}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Care snapshot</Text>
            <Text style={styles.meta}>Food: {feedingInfo && typeof feedingInfo.food_type === 'string' ? feedingInfo.food_type : 'Not set'}</Text>
            <Text style={styles.meta}>Feeding schedule: {feedingInfo && typeof feedingInfo.feeding_schedule === 'string' ? feedingInfo.feeding_schedule : 'Not set'}</Text>
            <Text style={styles.meta}>Coat type: {groomingInfo && typeof groomingInfo.coat_type === 'string' ? groomingInfo.coat_type : 'Not set'}</Text>
            <Text style={styles.meta}>
              Emergency contact: {emergencyInfo && typeof emergencyInfo.emergency_contact_phone === 'string' ? emergencyInfo.emergency_contact_phone : 'Not set'}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/pets/${petId}/edit`)}>
              <Text style={styles.secondaryButtonLabel}>Edit profile</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryButtonLabel}>Back</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    color: dofursColors.ink,
    fontSize: 23,
    fontWeight: '700',
  },
  card: {
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
  photoWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddc0a6',
    backgroundColor: '#fff2e4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
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
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  entryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 9,
    gap: 4,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  entryTitle: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: '#7d736c',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: '#a6483b',
    fontSize: 13,
  },
});
