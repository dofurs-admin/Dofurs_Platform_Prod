import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, Screen, dofursColors, patchBookingStatus } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);
  const [reason, setReason] = useState('Need to reschedule');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCancelBooking() {
    setError(null);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      setError('Invalid booking ID.');
      return;
    }

    setLoading(true);

    try {
      await patchBookingStatus(bookingId, {
        status: 'cancelled',
        cancellationReason: reason.trim() || undefined,
      });

      router.replace('/(tabs)/bookings');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to cancel booking (${err.status}).`);
      } else {
        setError('Unable to cancel booking right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Cancel booking</Text>
        <Text style={styles.subtitle}>Share a short reason before cancelling your appointment.</Text>

        <TextInput
          multiline
          numberOfLines={4}
          placeholder="Reason"
          placeholderTextColor="#9b8f87"
          style={styles.textArea}
          value={reason}
          onChangeText={setReason}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.cancelButton, loading && styles.buttonDisabled]} onPress={handleCancelBooking} disabled={loading}>
          <Text style={styles.cancelButtonLabel}>{loading ? 'Cancelling...' : 'Confirm cancellation'}</Text>
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
    fontSize: 21,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  textArea: {
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
  error: {
    color: dofursColors.error,
    fontSize: 12,
  },
  cancelButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#d5654a',
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cancelButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
