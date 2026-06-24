import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getSubscriptions } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const subscriptionsQuery = useQuery({
    queryKey: ['customer', 'subscriptions'],
    queryFn: getSubscriptions,
  });

  const subscriptions = subscriptionsQuery.data?.subscriptions ?? [];

  return (
    <Screen scroll>
      <Text style={styles.title}>My subscription</Text>
      <Text style={styles.subtitle}>Track active plans and service credits.</Text>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/subscription/plans')}>
        <Text style={styles.secondaryButtonLabel}>View available plans</Text>
      </Pressable>

      {subscriptionsQuery.isLoading ? <Text style={styles.meta}>Loading subscription details...</Text> : null}

      {subscriptions.map((item, index) => {
        const row = item as Record<string, unknown>;
        const status = typeof row.status === 'string' ? row.status : 'unknown';
        const startsAt = typeof row.starts_at === 'string' ? row.starts_at : null;
        const endsAt = typeof row.ends_at === 'string' ? row.ends_at : null;
        const plan = row.subscription_plans as { name?: string; code?: string } | null;

        return (
          <View key={`${startsAt}-${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>{plan?.name ?? plan?.code ?? 'Subscription plan'}</Text>
            <Text style={styles.meta}>Status: {status}</Text>
            <Text style={styles.meta}>Start: {startsAt ? new Date(startsAt).toLocaleDateString() : '--'}</Text>
            <Text style={styles.meta}>End: {endsAt ? new Date(endsAt).toLocaleDateString() : '--'}</Text>
          </View>
        );
      })}

      {!subscriptionsQuery.isLoading && subscriptions.length === 0 ? (
        <Text style={styles.meta}>No subscription records found.</Text>
      ) : null}
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
    marginTop: 4,
    color: '#4f4b47',
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 4,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
});
