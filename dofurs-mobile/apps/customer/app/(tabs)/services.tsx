import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
      <View style={styles.heroCard}>
        <View style={styles.heroPill}>
          <Ionicons name="sparkles-outline" color={dofursColors.coral} size={13} />
          <Text style={styles.heroPillLabel}>Pet Grooming Packages</Text>
        </View>

        <Text style={styles.title}>Doorstep Pet Grooming, From Verified Groomers Across Bengaluru</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Doorstep grooming</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Background-verified</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Safe for anxious pets</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Pet-safe products</Text>
          </View>
        </View>
      </View>

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
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="paw-outline" color="#8d5e37" size={14} />
            </View>
            <Text style={styles.cardTitle}>{service.service_type}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="person-outline" color="#97775d" size={12} />
            <Text style={styles.meta}>Provider: {providersById.get(service.provider_id) ?? 'Provider'}</Text>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="home-outline" color="#8d5e37" size={11} />
              <Text style={styles.metaBadgeLabel}>{service.service_mode.replace('_', ' ')}</Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="time-outline" color="#8d5e37" size={11} />
              <Text style={styles.metaBadgeLabel}>{service.service_duration_minutes} mins</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Starting at</Text>
            <Text style={styles.price}>{formatCurrency(service.base_price)}</Text>
          </View>

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
            <Ionicons name="arrow-forward" color="#ffffff" size={14} />
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
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff6ed',
    padding: 18,
    gap: 9,
    shadowColor: '#b47a49',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4c5a8',
    backgroundColor: '#fffaf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPillLabel: {
    color: '#91562b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: dofursColors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 35,
  },
  subtitle: {
    color: '#5f4c3e',
    fontSize: 14,
    lineHeight: 21,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5cab1',
    backgroundColor: '#fff9f3',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipLabel: {
    color: '#6a523f',
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: '#7b6959',
    fontSize: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffbf7',
    padding: 14,
    gap: 9,
    shadowColor: '#b47a49',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e8c9ac',
    backgroundColor: '#fff5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 7,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e7cfbb',
    backgroundColor: '#fff8f1',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaBadgeLabel: {
    color: '#6b513c',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    color: '#7f6a58',
    fontSize: 12,
  },
  price: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    shadowColor: '#b66828',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
});
