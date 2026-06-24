import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getUserPets } from '@dofurs/shared';

type PetRow = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  completion_percent: number | null;
};

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
  };
}

export default function CustomerPetsScreen() {
  const router = useRouter();
  const petsQuery = useQuery({
    queryKey: ['customer', 'pets'],
    queryFn: getUserPets,
  });

  const pets = useMemo(() => {
    const rows = petsQuery.data?.pets ?? [];
    return rows
      .map((row) => toPetRow(row as Record<string, unknown>))
      .filter((row): row is PetRow => Boolean(row));
  }, [petsQuery.data?.pets]);

  return (
    <Screen scroll>
      <Text style={styles.title}>My pets</Text>
      <Text style={styles.subtitle}>Manage pet profiles used during booking.</Text>

      <Pressable style={styles.addButton} onPress={() => router.push('/pets/add')}>
        <Text style={styles.addButtonLabel}>Add pet profile</Text>
      </Pressable>

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
          <View>
            <Text style={styles.cardTitle}>{pet.name}</Text>
            <Text style={styles.meta}>{pet.breed ?? 'Breed not specified'}</Text>
          </View>

          <View style={styles.rightAlign}>
            <Text style={styles.meta}>{pet.age != null ? `${pet.age} yrs` : 'Age not set'}</Text>
            <Text style={styles.progress}>{Math.round(pet.completion_percent ?? 0)}% complete</Text>
          </View>
        </Pressable>
      ))}

      {!petsQuery.isLoading && !petsQuery.isError && pets.length === 0 ? (
        <Text style={styles.meta}>No pets added yet.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#4f4b47',
    fontSize: 14,
  },
  addButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: dofursColors.coral,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
  },
  rightAlign: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 13,
  },
  progress: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});
