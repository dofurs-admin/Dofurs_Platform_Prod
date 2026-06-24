import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getBookingCatalog } from '@dofurs/shared';

type CatalogService = {
  id: string;
  provider_id: number;
  service_type: string;
  service_mode: string;
  service_duration_minutes: number;
  base_price: number;
};

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

export default function CustomerServicesScreen() {
  const router = useRouter();
  const catalogQuery = useQuery({
    queryKey: ['customer', 'catalog'],
    queryFn: getBookingCatalog,
  });

  const providersById = useMemo(() => {
    const map = new Map<number, string>();

    for (const provider of catalogQuery.data?.providers ?? []) {
      if (typeof provider.id === 'number') {
        map.set(provider.id, provider.name?.trim() || 'Provider');
      }
    }

    return map;
  }, [catalogQuery.data?.providers]);

  const services = useMemo(() => {
    return (catalogQuery.data?.services ?? []) as CatalogService[];
  }, [catalogQuery.data?.services]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Service catalog</Text>
      <Text style={styles.subtitle}>Choose a service and continue to the booking flow.</Text>

      {catalogQuery.isLoading ? <Text style={styles.meta}>Loading services...</Text> : null}

      {catalogQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load service catalog right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => catalogQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {services.map((service) => (
        <View key={service.id} style={styles.card}>
          <Text style={styles.cardTitle}>{service.service_type}</Text>
          <Text style={styles.meta}>Provider: {providersById.get(service.provider_id) ?? 'Provider'}</Text>
          <Text style={styles.meta}>Mode: {service.service_mode.replace('_', ' ')}</Text>
          <Text style={styles.meta}>Duration: {service.service_duration_minutes} mins</Text>
          <Text style={styles.price}>{formatCurrency(service.base_price)}</Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: '/booking/new/service',
                params: {
                  providerServiceId: service.id,
                  providerId: String(service.provider_id),
                },
              })
            }
          >
            <Text style={styles.primaryButtonLabel}>Book this service</Text>
          </Pressable>
        </View>
      ))}

      {!catalogQuery.isLoading && !catalogQuery.isError && services.length === 0 ? (
        <Text style={styles.meta}>No bookable services are available right now.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#4f4b47',
    fontSize: 14,
  },
  meta: {
    color: '#6d635c',
    fontSize: 13,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  price: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 16,
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
