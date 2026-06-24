import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ApiError,
  Screen,
  createBooking,
  createBookingOrder,
  dofursColors,
  verifyBookingOrder,
} from '@dofurs/shared';

type OrderResponse = {
  transaction?: {
    id?: string;
    amount_inr?: number;
    currency?: string;
    status?: string;
  };
  razorpay?: {
    orderId?: string;
    keyId?: string;
    amount?: number;
    currency?: string;
  };
};

function parsePositiveNumber(input: string | undefined, fallback = 0) {
  const value = Number(input ?? NaN);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value;
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

  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'direct' | 'order' | 'verify' | null>(null);
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const [providerPaymentId, setProviderPaymentId] = useState('');
  const [providerSignature, setProviderSignature] = useState('');

  const providerId = Number(params.providerId ?? NaN);
  const petId = Number(params.petId ?? NaN);
  const latitude = parsePositiveNumber(params.latitude, 12.9716);
  const longitude = parsePositiveNumber(params.longitude, 77.5946);
  const walletCreditsAppliedInr = Math.max(0, Math.round(parsePositiveNumber(params.walletCreditsAppliedInr, 0)));

  const bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' =
    params.bookingMode === 'clinic_visit' || params.bookingMode === 'teleconsult'
      ? params.bookingMode
      : 'home_visit';

  const hasRequiredFields =
    Number.isFinite(providerId) &&
    providerId > 0 &&
    Number.isFinite(petId) &&
    petId > 0 &&
    typeof params.providerServiceId === 'string' &&
    typeof params.bookingDate === 'string' &&
    typeof params.startTime === 'string';

  const payload = useMemo(() => {
    if (!hasRequiredFields) {
      return null;
    }

    return {
      petId,
      providerId,
      providerServiceId: params.providerServiceId!,
      bookingDate: params.bookingDate!,
      startTime: params.startTime!,
      bookingMode,
      locationAddress: params.locationAddress?.trim() || 'Bengaluru, Karnataka',
      latitude,
      longitude,
      providerNotes: params.providerNotes?.trim() || undefined,
      discountCode: params.discountCode?.trim() || undefined,
      walletCreditsAppliedInr,
      pincode: params.pincode?.trim() || undefined,
    };
  }, [
    bookingMode,
    hasRequiredFields,
    latitude,
    longitude,
    params.bookingDate,
    params.discountCode,
    params.locationAddress,
    params.pincode,
    params.providerNotes,
    params.providerServiceId,
    params.startTime,
    petId,
    providerId,
    walletCreditsAppliedInr,
  ]);

  async function handleDirectBooking() {
    setError(null);
    if (!payload) {
      setError('Missing booking details. Please restart the flow.');
      return;
    }

    setActionLoading('direct');

    try {
      const response = await createBooking({ ...payload, paymentMode: 'direct_to_provider' });
      const bookingId = Number((response.booking as { id?: unknown } | undefined)?.id ?? NaN);

      router.replace({
        pathname: '/booking/confirmation',
        params: {
          bookingId: Number.isFinite(bookingId) ? String(bookingId) : undefined,
          status: 'pending',
          mode: 'direct_to_provider',
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to create booking (${err.status}).`);
      } else {
        setError('Unable to create booking right now.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateOrder() {
    setError(null);
    if (!payload) {
      setError('Missing booking details. Please restart the flow.');
      return;
    }

    setActionLoading('order');

    try {
      const response = (await createBookingOrder({ ...payload, paymentMode: 'platform' })) as OrderResponse;
      setOrderData(response);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to create payment order (${err.status}).`);
      } else {
        setError('Unable to create payment order right now.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVerifyOrder() {
    setError(null);

    const providerOrderId = orderData?.razorpay?.orderId?.trim() ?? '';
    if (!providerOrderId || !providerPaymentId.trim() || !providerSignature.trim()) {
      setError('Order ID, payment ID, and signature are required to verify payment.');
      return;
    }

    setActionLoading('verify');

    try {
      const response = await verifyBookingOrder({
        providerOrderId,
        providerPaymentId: providerPaymentId.trim(),
        providerSignature: providerSignature.trim(),
      });

      const bookingId = Number((response.booking as { id?: unknown } | undefined)?.id ?? NaN);

      router.replace({
        pathname: '/booking/confirmation',
        params: {
          bookingId: Number.isFinite(bookingId) ? String(bookingId) : undefined,
          status: 'confirmed',
          mode: 'platform',
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to verify payment (${err.status}).`);
      } else {
        setError('Unable to verify payment right now.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Payment & confirmation</Text>
      <Text style={styles.subtitle}>Step 7 of 7</Text>

      {!hasRequiredFields ? (
        <Text style={styles.error}>Missing booking context. Restart booking from service selection.</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking payload</Text>
        <Text style={styles.meta}>Service ID: {params.providerServiceId ?? '--'}</Text>
        <Text style={styles.meta}>Provider ID: {params.providerId ?? '--'}</Text>
        <Text style={styles.meta}>Pet ID: {params.petId ?? '--'}</Text>
        <Text style={styles.meta}>Date: {params.bookingDate ?? '--'}</Text>
        <Text style={styles.meta}>Time: {params.startTime ?? '--'}</Text>
        <Text style={styles.meta}>Mode: {bookingMode.replace('_', ' ')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Option 1: Direct booking (pay provider later)</Text>
        <Pressable style={[styles.primaryButton, (!payload || actionLoading !== null) && styles.buttonDisabled]} onPress={handleDirectBooking} disabled={!payload || actionLoading !== null}>
          <Text style={styles.primaryButtonLabel}>{actionLoading === 'direct' ? 'Creating booking...' : 'Create direct booking'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Option 2: Online payment order</Text>
        <Pressable style={[styles.primaryButton, (!payload || actionLoading !== null) && styles.buttonDisabled]} onPress={handleCreateOrder} disabled={!payload || actionLoading !== null}>
          <Text style={styles.primaryButtonLabel}>{actionLoading === 'order' ? 'Creating order...' : 'Create Razorpay order'}</Text>
        </Pressable>

        {orderData?.razorpay?.orderId ? (
          <View style={styles.orderBlock}>
            <Text style={styles.meta}>Order ID: {orderData.razorpay.orderId}</Text>
            <Text style={styles.meta}>Amount: {orderData.razorpay.amount ?? '--'} {orderData.razorpay.currency ?? 'INR'}</Text>
            <Text style={styles.meta}>Transaction ID: {orderData.transaction?.id ?? '--'}</Text>

            <TextInput
              placeholder="Razorpay payment ID"
              placeholderTextColor="#9b8f87"
              style={styles.input}
              value={providerPaymentId}
              onChangeText={setProviderPaymentId}
            />
            <TextInput
              placeholder="Razorpay signature"
              placeholderTextColor="#9b8f87"
              style={styles.input}
              value={providerSignature}
              onChangeText={setProviderSignature}
            />

            <Pressable style={[styles.secondaryButton, actionLoading !== null && styles.buttonDisabled]} onPress={handleVerifyOrder} disabled={actionLoading !== null}>
              <Text style={styles.secondaryButtonLabel}>{actionLoading === 'verify' ? 'Verifying...' : 'Verify payment and finalize booking'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    gap: 7,
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
  primaryButton: {
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 11,
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
  orderBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    padding: 10,
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
  },
});
