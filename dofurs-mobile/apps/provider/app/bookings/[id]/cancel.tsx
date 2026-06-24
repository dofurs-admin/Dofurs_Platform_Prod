import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, Screen, dofursColors, patchProviderBookingStatus } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);

  const [reason, setReason] = useState('');
  const [providerNotes, setProviderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      setError('Invalid booking ID.');
      return;
    }

    if (reason.trim().length < 5) {
      setError('Provide a cancellation reason with at least 5 characters.');
      return;
    }

    setSubmitting(true);

    try {
      await patchProviderBookingStatus(bookingId, {
        status: 'cancelled',
        cancellationReason: reason.trim(),
        providerNotes: providerNotes.trim() || undefined,
      });

      router.replace(`/bookings/${bookingId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to cancel booking (${err.status}).`);
      } else {
        setError('Unable to cancel booking right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Cancel booking</Text>
        <Text style={styles.subtitle}>Booking #{Number.isFinite(bookingId) ? bookingId : '--'}</Text>

        <TextInput
          multiline
          numberOfLines={3}
          style={styles.input}
          placeholder="Cancellation reason"
          placeholderTextColor="#9b8f87"
          value={reason}
          onChangeText={setReason}
        />

        <TextInput
          multiline
          numberOfLines={3}
          style={styles.input}
          placeholder="Additional notes (optional)"
          placeholderTextColor="#9b8f87"
          value={providerNotes}
          onChangeText={setProviderNotes}
        />

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleCancel} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Cancelling...' : 'Confirm cancellation'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  input: {
    minHeight: 88,
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
    backgroundColor: '#b7523f',
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
});
