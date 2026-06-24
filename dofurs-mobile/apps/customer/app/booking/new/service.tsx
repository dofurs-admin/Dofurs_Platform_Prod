import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ providerServiceId?: string; providerId?: string }>();

  const catalogQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'catalog'],
    queryFn: getBookingCatalog,
  });

  const services = (catalogQuery.data?.services ?? []) as CatalogService[];
  const providersById = useMemo(() => {
    const entries = catalogQuery.data?.providers ?? [];
    const map = new Map<number, string>();
    for (const provider of entries) {
      if (typeof provider.id === 'number') {
        map.set(provider.id, provider.name?.trim() || 'Provider');
      }
    }
    return map;
  }, [catalogQuery.data?.providers]);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    typeof params.providerServiceId === 'string' ? params.providerServiceId : null,
  );

  useEffect(() => {
    if (typeof params.providerServiceId === 'string') {
      setSelectedServiceId(params.providerServiceId);
    }
  }, [params.providerServiceId]);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;

  function handleContinue() {
    if (!selectedService) {
      return;
    }

    router.push({
      pathname: '/booking/new/pet',
      params: {
        providerServiceId: selectedService.id,
        providerId: String(selectedService.provider_id),
      },
    });
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Select service</Text>
      <Text style={styles.subtitle}>Step 1 of 7</Text>

      {catalogQuery.isLoading ? <Text style={styles.meta}>Loading services...</Text> : null}

      {services.map((service) => {
        const isSelected = selectedServiceId === service.id;

        return (
          <Pressable key={service.id} style={[styles.card, isSelected && styles.cardSelected]} onPress={() => setSelectedServiceId(service.id)}>
            <Text style={styles.cardTitle}>{service.service_type}</Text>
            <Text style={styles.meta}>Provider: {providersById.get(service.provider_id) ?? 'Provider'}</Text>
            <Text style={styles.meta}>Mode: {service.service_mode.replace('_', ' ')}</Text>
            <Text style={styles.meta}>Duration: {service.service_duration_minutes} minutes</Text>
            <Text style={styles.amount}>{formatCurrency(service.base_price)}</Text>
          </Pressable>
        );
      })}

      {!catalogQuery.isLoading && services.length === 0 ? (
        <Text style={styles.meta}>No services available for booking right now.</Text>
      ) : null}

      <Pressable style={[styles.primaryButton, !selectedService && styles.buttonDisabled]} onPress={handleContinue} disabled={!selectedService}>
        <Text style={styles.primaryButtonLabel}>Continue to pet selection</Text>
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
  cardSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  amount: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
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
