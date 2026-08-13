import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, dofursColors, useBookingDraftStore } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; status?: string; mode?: string }>();
  const clearDraft = useBookingDraftStore((state) => state.clearDraft);

  useEffect(() => {
    clearDraft();
  }, [clearDraft]);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Booking submitted</Text>
        <Text style={styles.subtitle}>Your booking request has been recorded successfully.</Text>

        <Text style={styles.meta}>Booking ID: {params.bookingId ?? 'Pending assignment'}</Text>
        <Text style={styles.meta}>Status: {params.status ?? 'pending'}</Text>
        <Text style={styles.meta}>Checkout mode: {params.mode ?? 'direct booking'}</Text>

        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)/bookings')}>
            <Text style={styles.primaryButtonLabel}>View bookings</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={styles.secondaryButtonLabel}>Go home</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 34,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
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
  meta: {
    color: '#5d5853',
    fontSize: 13,
  },
  row: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
