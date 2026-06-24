import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  dofursColors,
  getProviderAvailability,
  putProviderAvailability,
} from '@dofurs/shared';

type AvailabilityDraft = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
};

const dayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function PlaceholderScreen() {
  const router = useRouter();

  const availabilityQuery = useQuery({
    queryKey: ['provider', 'availability', 'weekly-edit'],
    queryFn: getProviderAvailability,
  });

  const [rows, setRows] = useState<AvailabilityDraft[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const serverRows = useMemo(() => {
    const values = availabilityQuery.data?.availability ?? [];
    return values.map((row) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
      is_available: row.is_available !== false,
      slot_duration_minutes: row.slot_duration_minutes ?? 60,
      buffer_time_minutes: row.buffer_time_minutes ?? 0,
    }));
  }, [availabilityQuery.data?.availability]);

  if (!initialized && !availabilityQuery.isLoading) {
    setRows(serverRows.length > 0 ? serverRows : [
      {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '18:00',
        is_available: true,
        slot_duration_minutes: 60,
        buffer_time_minutes: 0,
      },
    ]);
    setInitialized(true);
  }

  function updateRow(index: number, patch: Partial<AvailabilityDraft>) {
    setRows((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((previous) => [
      ...previous,
      {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '18:00',
        is_available: true,
        slot_duration_minutes: 60,
        buffer_time_minutes: 0,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (rows.length === 0) {
      setError('Add at least one availability slot.');
      return;
    }

    for (const row of rows) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end_time)) {
        setError('Use HH:MM format for all time values.');
        return;
      }

      if (row.end_time <= row.start_time) {
        setError('End time must be after start time.');
        return;
      }
    }

    setSubmitting(true);

    try {
      await putProviderAvailability(
        rows.map((row) => ({
          id: row.id,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          is_available: row.is_available,
          slot_duration_minutes: row.slot_duration_minutes ?? 60,
          buffer_time_minutes: row.buffer_time_minutes ?? 0,
        })),
      );

      await availabilityQuery.refetch();
      setSuccess('Weekly availability updated.');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to update availability (${err.status}).`);
      } else {
        setError('Unable to update availability right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Weekly availability</Text>
      <Text style={styles.subtitle}>Define service windows used for slot generation.</Text>

      {availabilityQuery.isLoading ? <Text style={styles.meta}>Loading weekly slots...</Text> : null}

      {rows.map((row, index) => (
        <View key={`${row.id ?? 'new'}-${index}`} style={styles.card}>
          <Text style={styles.sectionTitle}>Slot {index + 1}</Text>

          <View style={styles.row}>
            {dayOptions.map((day) => {
              const selected = row.day_of_week === day.value;
              return (
                <Pressable key={day.value} style={[styles.dayChip, selected && styles.dayChipSelected]} onPress={() => updateRow(index, { day_of_week: day.value })}>
                  <Text style={[styles.dayChipLabel, selected && styles.dayChipLabelSelected]}>{day.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timeRow}>
            <TextInput
              style={styles.input}
              value={row.start_time}
              onChangeText={(value) => updateRow(index, { start_time: value })}
              placeholder="Start HH:MM"
              placeholderTextColor="#9b8f87"
            />
            <TextInput
              style={styles.input}
              value={row.end_time}
              onChangeText={(value) => updateRow(index, { end_time: value })}
              placeholder="End HH:MM"
              placeholderTextColor="#9b8f87"
            />
          </View>

          <View style={styles.timeRow}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(row.slot_duration_minutes ?? 60)}
              onChangeText={(value) => updateRow(index, { slot_duration_minutes: Number(value || 60) })}
              placeholder="Slot minutes"
              placeholderTextColor="#9b8f87"
            />
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(row.buffer_time_minutes ?? 0)}
              onChangeText={(value) => updateRow(index, { buffer_time_minutes: Number(value || 0) })}
              placeholder="Buffer minutes"
              placeholderTextColor="#9b8f87"
            />
          </View>

          <View style={styles.row}>
            <Pressable
              style={[styles.toggleChip, row.is_available && styles.toggleChipSelected]}
              onPress={() => updateRow(index, { is_available: !row.is_available })}
            >
              <Text style={[styles.toggleChipLabel, row.is_available && styles.toggleChipLabelSelected]}>
                {row.is_available ? 'Available' : 'Unavailable'}
              </Text>
            </Pressable>

            <Pressable style={styles.removeButton} onPress={() => removeRow(index)}>
              <Text style={styles.removeButtonLabel}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.secondaryButton} onPress={addRow}>
        <Text style={styles.secondaryButtonLabel}>Add slot</Text>
      </Pressable>

      <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSave} disabled={submitting}>
        <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Save weekly availability'}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonLabel}>Back</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
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
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  dayChipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  dayChipLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '700',
  },
  dayChipLabelSelected: {
    color: dofursColors.ink,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  toggleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toggleChipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  toggleChipLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleChipLabelSelected: {
    color: dofursColors.ink,
  },
  removeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4b8ae',
    backgroundColor: '#fff2ef',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeButtonLabel: {
    color: '#a6483b',
    fontSize: 12,
    fontWeight: '700',
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
  meta: {
    color: '#6d635c',
    fontSize: 12,
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
