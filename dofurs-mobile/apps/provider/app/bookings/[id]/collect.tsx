import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, Screen, collectProviderBooking, dofursColors } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);

  const [mode, setMode] = useState<'cash' | 'upi' | 'other'>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCollect() {
    setError(null);
    setSuccess(null);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      setError('Invalid booking ID.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await collectProviderBooking(bookingId, {
        collectionMode: mode,
        notes: notes.trim() || undefined,
      });

      const tx = response.transaction as { id?: string; amount_inr?: number } | undefined;
      setSuccess(
        tx?.id
          ? `Collection recorded. Transaction ${tx.id}${typeof tx.amount_inr === 'number' ? ` for INR ${Math.round(tx.amount_inr)}` : ''}.`
          : 'Collection recorded successfully.',
      );
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to mark payment collected (${err.status}).`);
      } else {
        setError('Unable to mark payment collected right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Collect payment</Text>
        <Text style={styles.subtitle}>Booking #{Number.isFinite(bookingId) ? bookingId : '--'}</Text>

        <View style={styles.row}>
          {(['cash', 'upi', 'other'] as const).map((value) => {
            const selected = mode === value;
            return (
              <Pressable key={value} style={[styles.chip, selected && styles.chipSelected]} onPress={() => setMode(value)}>
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{value.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          multiline
          numberOfLines={4}
          style={styles.input}
          placeholder="Collection notes (optional)"
          placeholderTextColor="#9b8f87"
          value={notes}
          onChangeText={setNotes}
        />

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleCollect} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Mark as collected'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 8,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  chipLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: dofursColors.ink,
  },
  input: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
  },
  success: {
    color: '#0f7a44',
    fontSize: 13,
  },
});
