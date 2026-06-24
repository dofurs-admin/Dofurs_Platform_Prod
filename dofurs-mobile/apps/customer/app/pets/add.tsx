import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, Screen, createPet, dofursColors } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [allergies, setAllergies] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreatePet() {
    setError(null);

    if (name.trim().length === 0) {
      setError('Enter pet name.');
      return;
    }

    setLoading(true);

    try {
      await createPet({
        name: name.trim(),
        breed: breed.trim() || null,
        age: age.trim() ? Number.parseFloat(age.trim()) : null,
        allergies: allergies.trim() || null,
      });

      router.replace('/(tabs)/pets');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to add pet (${err.status}).`);
      } else {
        setError('Unable to add pet right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Add pet profile</Text>

        <TextInput placeholder="Pet name" placeholderTextColor="#9b8f87" style={styles.input} value={name} onChangeText={setName} />
        <TextInput placeholder="Breed" placeholderTextColor="#9b8f87" style={styles.input} value={breed} onChangeText={setBreed} />
        <TextInput
          keyboardType="decimal-pad"
          placeholder="Age (years)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={age}
          onChangeText={setAge}
        />
        <TextInput
          placeholder="Allergies (optional)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={allergies}
          onChangeText={setAllergies}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleCreatePet} disabled={loading}>
          <Text style={styles.buttonLabel}>{loading ? 'Saving...' : 'Save pet'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 8,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  error: {
    color: dofursColors.error,
    fontSize: 12,
  },
  button: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
