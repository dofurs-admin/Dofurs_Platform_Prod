import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
      <View style={styles.heroCard}>
        <View style={styles.heroPill}>
          <Ionicons name="paw-outline" color={dofursColors.coral} size={13} />
          <Text style={styles.heroPillLabel}>Companions</Text>
        </View>
        <Text style={styles.title}>Pet profiles with complete care context</Text>
        <Text style={styles.subtitle}>Keep breed, age, and profile completion in one clean mobile view.</Text>
      </View>

      <Pressable style={styles.addButton} onPress={() => router.push('/pets/add')}>
        <Ionicons name="add-circle-outline" color="#ffffff" size={14} />
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
          <View style={styles.cardLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLabel}>{pet.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.petTextBlock}>
              <Text style={styles.cardTitle}>{pet.name}</Text>
              <Text style={styles.meta}>{pet.breed ?? 'Breed not specified'}</Text>
            </View>
          </View>

          <View style={styles.rightAlign}>
            <Text style={styles.meta}>{pet.age != null ? `${pet.age} yrs` : 'Age not set'}</Text>
            <View style={styles.progressPill}>
              <Text style={styles.progress}>{Math.round(pet.completion_percent ?? 0)}% complete</Text>
            </View>
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
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff6ed',
    padding: 18,
    gap: 9,
    shadowColor: '#b47a49',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4c5a8',
    backgroundColor: '#fffaf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPillLabel: {
    color: '#91562b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: dofursColors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 35,
  },
  subtitle: {
    color: '#5f4c3e',
    fontSize: 14,
    lineHeight: 21,
  },
  addButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#b66828',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    gap: 4,
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
