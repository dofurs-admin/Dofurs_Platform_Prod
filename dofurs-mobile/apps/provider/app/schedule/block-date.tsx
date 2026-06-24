import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  createProviderBlockedDate,
  deleteProviderBlockedDate,
  dofursColors,
  getProviderBlockedDates,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const blockedDatesQuery = useQuery({
    queryKey: ['provider', 'blocked-dates', 'manage'],
    queryFn: getProviderBlockedDates,
  });

  const [blockedDate, setBlockedDate] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockedDate.trim())) {
      setError('Use date format YYYY-MM-DD.');
      return;
    }

    if ((blockStartTime && !blockEndTime) || (!blockStartTime && blockEndTime)) {
      setError('Provide both start and end time, or keep both empty.');
      return;
    }

    if (blockStartTime && blockEndTime && blockEndTime <= blockStartTime) {
      setError('End time must be after start time.');
      return;
    }

    setSubmitting(true);

    try {
      await createProviderBlockedDate({
        blockedDate: blockedDate.trim(),
        blockStartTime: blockStartTime.trim() || undefined,
        blockEndTime: blockEndTime.trim() || undefined,
        reason: reason.trim() || undefined,
      });

      setBlockedDate('');
      setBlockStartTime('');
      setBlockEndTime('');
      setReason('');
      await blockedDatesQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to add blocked date (${err.status}).`);
      } else {
        setError('Unable to add blocked date right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);

    try {
      await deleteProviderBlockedDate(id);
      await blockedDatesQuery.refetch();
    } catch {
      setError('Unable to delete blocked date right now.');
    }
  }

  const rows = blockedDatesQuery.data?.blockedDates ?? [];

  return (
    <Screen scroll>
      <Text style={styles.title}>Blocked dates</Text>
      <Text style={styles.subtitle}>Block full days or specific windows when you are unavailable.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add blocked date</Text>

        <TextInput
          style={styles.input}
          placeholder="Date YYYY-MM-DD"
          placeholderTextColor="#9b8f87"
          value={blockedDate}
          onChangeText={setBlockedDate}
        />

        <View style={styles.timeRow}>
          <TextInput
            style={styles.input}
            placeholder="Start HH:MM (optional)"
            placeholderTextColor="#9b8f87"
            value={blockStartTime}
            onChangeText={setBlockStartTime}
          />
          <TextInput
            style={styles.input}
            placeholder="End HH:MM (optional)"
            placeholderTextColor="#9b8f87"
            value={blockEndTime}
            onChangeText={setBlockEndTime}
          />
        </View>

        <TextInput
          multiline
          numberOfLines={3}
          style={styles.textArea}
          placeholder="Reason"
          placeholderTextColor="#9b8f87"
          value={reason}
          onChangeText={setReason}
        />

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleCreate} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Add blocked date'}</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {blockedDatesQuery.isLoading ? <Text style={styles.meta}>Loading blocked dates...</Text> : null}

      {rows.map((row, index) => {
        const value = row as Record<string, unknown>;
        const id = typeof value.id === 'string' ? value.id : null;
        const date = typeof value.blocked_date === 'string' ? value.blocked_date : '--';
        const start = typeof value.block_start_time === 'string' ? value.block_start_time : null;
        const end = typeof value.block_end_time === 'string' ? value.block_end_time : null;
        const reasonText = typeof value.reason === 'string' ? value.reason : 'No reason provided';

        return (
          <View key={`${id ?? index}`} style={styles.blockedCard}>
            <Text style={styles.blockedDate}>{date}</Text>
            <Text style={styles.meta}>{start && end ? `${start} - ${end}` : 'Full day blocked'}</Text>
            <Text style={styles.meta}>{reasonText}</Text>

            {id ? (
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(id)}>
                <Text style={styles.deleteButtonLabel}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {!blockedDatesQuery.isLoading && rows.length === 0 ? <Text style={styles.meta}>No blocked dates yet.</Text> : null}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonLabel}>Back</Text>
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
    fontSize: 14,
    fontWeight: '700',
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
  textArea: {
    minHeight: 80,
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
  timeRow: {
    flexDirection: 'row',
    gap: 8,
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
  blockedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 10,
    gap: 4,
  },
  blockedDate: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  deleteButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4b8ae',
    backgroundColor: '#fff2ef',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonLabel: {
    color: '#a6483b',
    fontSize: 12,
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
