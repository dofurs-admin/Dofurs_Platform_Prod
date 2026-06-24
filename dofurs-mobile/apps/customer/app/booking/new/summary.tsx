import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  calculateServicePrice,
  dofursColors,
  previewDiscount,
} from '@dofurs/shared';

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerServiceId?: string;
    providerId?: string;
    petId?: string;
    bookingDate?: string;
    startTime?: string;
    bookingMode?: string;
    locationAddress?: string;
    latitude?: string;
    longitude?: string;
    pincode?: string;
    discountCode?: string;
    providerNotes?: string;
    walletCreditsAppliedInr?: string;
  }>();

  const providerId = Number(params.providerId ?? NaN);
  const hasContext =
    typeof params.providerServiceId === 'string' &&
    params.providerServiceId.length > 0 &&
    Number.isFinite(providerId) &&
    providerId > 0;

  const priceQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'summary', 'price', params.providerServiceId, providerId],
    queryFn: () =>
      calculateServicePrice({
        serviceId: params.providerServiceId!,
        providerId,
      }),
    enabled: hasContext,
  });

  const discountCode = (params.discountCode ?? '').trim();

  const discountQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'summary', 'discount', discountCode, params.providerServiceId],
    queryFn: () =>
      previewDiscount({
        providerServiceId: params.providerServiceId,
        discountCode,
      }),
    enabled: hasContext && discountCode.length > 0,
  });

  const baseAmount = Number(priceQuery.data?.data?.final_total ?? 0);
  const preview = discountQuery.data?.preview;
  const estimatedTotal = preview ? Number(preview.finalAmount) : baseAmount;

  const walletCreditsAppliedInr = useMemo(() => {
    const parsed = Number(params.walletCreditsAppliedInr ?? '0');
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.round(parsed);
  }, [params.walletCreditsAppliedInr]);

  function handleContinue() {
    if (!hasContext) {
      return;
    }

    router.push({
      pathname: '/booking/new/payment',
      params: {
        ...params,
        estimatedAmountInr: String(estimatedTotal),
        walletCreditsAppliedInr: String(walletCreditsAppliedInr),
      },
    });
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Booking summary</Text>
      <Text style={styles.subtitle}>Step 6 of 7</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Selection</Text>
        <Text style={styles.meta}>Service ID: {params.providerServiceId ?? '--'}</Text>
        <Text style={styles.meta}>Provider ID: {params.providerId ?? '--'}</Text>
        <Text style={styles.meta}>Pet ID: {params.petId ?? '--'}</Text>
        <Text style={styles.meta}>Date: {params.bookingDate ?? '--'}</Text>
        <Text style={styles.meta}>Time: {params.startTime ?? '--'}</Text>
        <Text style={styles.meta}>Mode: {(params.bookingMode ?? 'home_visit').replace('_', ' ')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pricing</Text>
        {priceQuery.isLoading ? <Text style={styles.meta}>Calculating price...</Text> : null}
        <Text style={styles.meta}>Base amount: {formatCurrency(baseAmount)}</Text>
        {discountCode ? <Text style={styles.meta}>Discount code: {discountCode}</Text> : null}
        {preview ? <Text style={styles.meta}>Discount: {formatCurrency(Number(preview.discountAmount ?? 0))}</Text> : null}
        {walletCreditsAppliedInr > 0 ? (
          <Text style={styles.meta}>Wallet credits to apply: {formatCurrency(walletCreditsAppliedInr)}</Text>
        ) : null}
        <Text style={styles.total}>Estimated total: {formatCurrency(Math.max(0, estimatedTotal - walletCreditsAppliedInr))}</Text>
      </View>

      <Pressable style={[styles.primaryButton, !hasContext && styles.buttonDisabled]} onPress={handleContinue} disabled={!hasContext}>
        <Text style={styles.primaryButtonLabel}>Continue to payment</Text>
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
    gap: 6,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  total: {
    marginTop: 2,
    color: dofursColors.ink,
    fontSize: 14,
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
