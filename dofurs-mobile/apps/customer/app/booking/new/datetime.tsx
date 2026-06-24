import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getAvailableSlots } from '@dofurs/shared';

function todayDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerServiceId?: string;
    providerId?: string;
    petId?: string;
  }>();

  const providerId = Number(params.providerId ?? NaN);
  const hasContext =
    typeof params.providerServiceId === 'string' && params.providerServiceId.length > 0 &&
    Number.isFinite(providerId) && providerId > 0 &&
    typeof params.petId === 'string' && params.petId.length > 0;

  const [bookingDate, setBookingDate] = useState(todayDateString());
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [manualStartTime, setManualStartTime] = useState('');
  const [bookingMode, setBookingMode] = useState<'home_visit' | 'clinic_visit' | 'teleconsult'>('home_visit');

  const slotsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'slots', providerId, bookingDate, params.providerServiceId],
    queryFn: () =>
      getAvailableSlots({
        providerId,
        date: bookingDate,
        providerServiceId: params.providerServiceId,
      }),
    enabled: hasContext && /^\d{4}-\d{2}-\d{2}$/.test(bookingDate),
  });

  const slots = useMemo(() => slotsQuery.data?.slots ?? [], [slotsQuery.data?.slots]);

  function handleContinue() {
    if (!hasContext) {
      return;
    }

    const startTime = selectedStartTime ?? manualStartTime.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      return;
    }

    router.push({
      pathname: '/booking/new/address',
      params: {
        providerServiceId: params.providerServiceId,
        providerId: params.providerId,
        petId: params.petId,
        bookingDate,
        startTime,
        bookingMode,
      },
    });
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Choose date & time</Text>
      <Text style={styles.subtitle}>Step 3 of 7</Text>

      {!hasContext ? (
        <Text style={styles.meta}>Booking context is missing. Start again from service selection.</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking date</Text>
        <TextInput
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={bookingDate}
          onChangeText={setBookingDate}
        />

        <Text style={styles.sectionTitle}>Mode</Text>
        <View style={styles.row}>
          {(['home_visit', 'clinic_visit', 'teleconsult'] as const).map((mode) => {
            const selected = bookingMode === mode;
            return (
              <Pressable key={mode} style={[styles.modeChip, selected && styles.modeChipSelected]} onPress={() => setBookingMode(mode)}>
                <Text style={[styles.modeChipLabel, selected && styles.modeChipLabelSelected]}>{mode.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Available slots</Text>
        {slotsQuery.isLoading ? <Text style={styles.meta}>Loading slots...</Text> : null}

        {slots.map((slot) => {
          const selected = selectedStartTime === slot.start_time;
          return (
            <Pressable
              key={`${slot.start_time}-${slot.end_time}`}
              style={[styles.slotRow, selected && styles.slotRowSelected]}
              onPress={() => {
                setSelectedStartTime(slot.start_time);
                setManualStartTime('');
              }}
            >
              <Text style={styles.slotLabel}>{slot.start_time} - {slot.end_time}</Text>
            </Pressable>
          );
        })}

        <Text style={styles.meta}>If no slot appears, enter start time manually (HH:MM).</Text>
        <TextInput
          placeholder="HH:MM"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={manualStartTime}
          onChangeText={(value) => {
            setManualStartTime(value);
            setSelectedStartTime(null);
          }}
        />
      </View>

      <Pressable style={[styles.primaryButton, !hasContext && styles.buttonDisabled]} onPress={handleContinue} disabled={!hasContext}>
        <Text style={styles.primaryButtonLabel}>Continue to address</Text>
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
    gap: 8,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 13,
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modeChipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  modeChipLabel: {
    color: '#6d635c',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modeChipLabelSelected: {
    color: dofursColors.ink,
  },
  slotRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slotRowSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  slotLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '600',
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
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
