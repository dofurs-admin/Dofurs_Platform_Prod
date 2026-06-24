import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getUserPets } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ providerServiceId?: string; providerId?: string }>();

  const petsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'pets'],
    queryFn: getUserPets,
  });

  const pets = (petsQuery.data?.pets ?? []) as Array<Record<string, unknown>>;
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);

  const hasServiceContext =
    typeof params.providerServiceId === 'string' && params.providerServiceId.length > 0 &&
    typeof params.providerId === 'string' && params.providerId.length > 0;

  const selectedPet = useMemo(() => {
    return pets.find((pet) => Number(pet.id ?? NaN) === selectedPetId) ?? null;
  }, [pets, selectedPetId]);

  function handleContinue() {
    if (!selectedPet || !hasServiceContext) {
      return;
    }

    router.push({
      pathname: '/booking/new/datetime',
      params: {
        providerServiceId: params.providerServiceId,
        providerId: params.providerId,
        petId: String(selectedPetId),
      },
    });
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Select pet</Text>
      <Text style={styles.subtitle}>Step 2 of 7</Text>

      {!hasServiceContext ? (
        <Text style={styles.meta}>Service context is missing. Start again from service selection.</Text>
      ) : null}

      {petsQuery.isLoading ? <Text style={styles.meta}>Loading pets...</Text> : null}

      {pets.map((pet) => {
        const id = Number(pet.id ?? NaN);
        const isSelected = id === selectedPetId;

        return (
          <Pressable key={String(pet.id)} style={[styles.card, isSelected && styles.cardSelected]} onPress={() => setSelectedPetId(id)}>
            <Text style={styles.cardTitle}>{typeof pet.name === 'string' ? pet.name : `Pet #${pet.id}`}</Text>
            <Text style={styles.meta}>{typeof pet.breed === 'string' ? pet.breed : 'Breed not specified'}</Text>
          </Pressable>
        );
      })}

      {!petsQuery.isLoading && pets.length === 0 ? (
        <Text style={styles.meta}>No pet profiles found. Add a pet before booking.</Text>
      ) : null}

      <Pressable style={[styles.primaryButton, (!selectedPet || !hasServiceContext) && styles.buttonDisabled]} onPress={handleContinue} disabled={!selectedPet || !hasServiceContext}>
        <Text style={styles.primaryButtonLabel}>Continue to date & time</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/pets/add')}>
        <Text style={styles.secondaryButtonLabel}>Add a new pet</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 4,
  },
  cardSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 11,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  secondaryButtonLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '700',
  },
});
