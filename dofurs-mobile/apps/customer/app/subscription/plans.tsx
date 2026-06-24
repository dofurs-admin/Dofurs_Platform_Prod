import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getSubscriptionPlans,
} from '@dofurs/shared';

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  duration_days: number;
  price_inr: number;
  is_active: boolean;
  subscription_plan_services?: Array<{
    service_type?: string;
    credits_included?: number;
  }>;
};

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const plansQuery = useQuery({
    queryKey: ['customer', 'subscription-plans'],
    queryFn: getSubscriptionPlans,
  });

  const plans = (plansQuery.data?.plans ?? []) as PlanRow[];

  return (
    <Screen scroll>
      <Text style={styles.title}>Subscription plans</Text>
      <Text style={styles.subtitle}>Compare active plans and choose what fits your service usage.</Text>

      {plansQuery.isLoading ? <Text style={styles.meta}>Loading plans...</Text> : null}

      {plansQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load plans right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => plansQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {plans.map((plan) => {
        const services = plan.subscription_plan_services ?? [];

        return (
          <View key={plan.id} style={styles.card}>
            <Text style={styles.cardTitle}>{plan.name}</Text>
            <Text style={styles.meta}>Code: {plan.code}</Text>
            <Text style={styles.meta}>Price: {formatCurrency(plan.price_inr)}</Text>
            <Text style={styles.meta}>Duration: {plan.duration_days} days</Text>
            <Text style={styles.meta}>Status: {plan.is_active ? 'active' : 'inactive'}</Text>

            {plan.description ? <Text style={styles.description}>{plan.description}</Text> : null}

            {services.length > 0 ? (
              <View style={styles.serviceBox}>
                <Text style={styles.serviceTitle}>Included credits</Text>
                {services.map((service, index) => (
                  <Text key={`${service.service_type ?? 'service'}-${index}`} style={styles.meta}>
                    {service.service_type ?? 'service'}: {typeof service.credits_included === 'number' ? service.credits_included : 0}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 ? (
        <Text style={styles.meta}>No active plans available right now.</Text>
      ) : null}

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
    gap: 4,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    marginTop: 2,
    color: '#4f4b47',
    fontSize: 13,
    lineHeight: 19,
  },
  serviceBox: {
    marginTop: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    padding: 8,
    gap: 2,
  },
  serviceTitle: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
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
  errorCard: {
    borderRadius: 12,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});
