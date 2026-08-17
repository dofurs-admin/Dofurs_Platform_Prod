import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  calculateServicePrice,
  createBookingOrder,
  createBookingWithIdempotency,
  dofursColors,
  getBookingCatalog,
  getServiceAddOns,
  getSubscriptionCreditEligibility,
  getUserPets,
  previewDiscount,
  useBookingDraftStore,
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

type CatalogService = {
  id: string;
  service_type: string;
  service_duration_minutes: number;
  base_price: number;
};

type PaymentChoice = 'online' | 'cash' | 'subscription_credit';

type CreditEligibilityResponse = {
  eligible: boolean;
  subscriptionId: string | null;
  serviceType: string;
  matchedCreditServiceType?: string | null;
  availableCredits: number;
  totalCredits: number;
  reason?: string | null;
};

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

function formatCreditAmount(value: number) {
  return `INR ${Math.round(Number(value) || 0)}`;
}

function isSlotConflictError(error: ApiError) {
  if (error.status !== 409 && error.status !== 400) {
    return false;
  }

  const detailMessage =
    typeof error.details === 'object' &&
    error.details !== null &&
    'error' in error.details &&
    typeof (error.details as { error?: unknown }).error === 'string'
      ? (error.details as { error: string }).error
      : '';

  const combined = `${error.message} ${detailMessage}`.toLowerCase();
  return (
    combined.includes('slot') ||
    combined.includes('overlap') ||
    combined.includes('no longer available') ||
    combined.includes('already booked')
  );
}

function ProgressBar({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { id: 1, label: 'Pets & Service' },
    { id: 2, label: 'Schedule' },
    { id: 3, label: 'Review' },
  ] as const;

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        {steps.map((step, index) => {
          const isCompleted = activeStep > step.id;
          const isActive = activeStep === step.id;
          return (
            <View key={step.id} style={styles.progressStep}>
              <View style={styles.progressNodeRow}>
                {index > 0 ? (
                  <View style={[styles.progressBar, (isCompleted || isActive) && styles.progressBarFilled]} />
                ) : null}
                <View
                  style={[
                    styles.progressNode,
                    isCompleted && styles.progressNodeCompleted,
                    isActive && styles.progressNodeActive,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={10} color="#ffffff" />
                  ) : (
                    <View style={[styles.progressNodeDot, (isActive || isCompleted) && styles.progressNodeDotActive]} />
                  )}
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.progressBar, isCompleted && styles.progressBarFilled]} />
                ) : null}
              </View>
              <Text style={[styles.progressLabel, (isActive || isCompleted) && styles.progressLabelActive]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerOrderId?: string;
    providerPaymentId?: string;
    providerSignature?: string;
  }>();

  const draft = useBookingDraftStore((state) => state.draft);
  const ensureDirectBookingOperationKey = useBookingDraftStore((state) => state.ensureDirectBookingOperationKey);
  const ensureBookingOrderOperationKey = useBookingDraftStore((state) => state.ensureBookingOrderOperationKey);
  const ensurePaymentVerificationOperationKey = useBookingDraftStore((state) => state.ensurePaymentVerificationOperationKey);
  const setPendingPaymentOrder = useBookingDraftStore((state) => state.setPendingPaymentOrder);
  const clearPendingPaymentOrder = useBookingDraftStore((state) => state.clearPendingPaymentOrder);
  const resetOnlinePaymentAttempt = useBookingDraftStore((state) => state.resetOnlinePaymentAttempt);
  const resetAfterSlotConflict = useBookingDraftStore((state) => state.resetAfterSlotConflict);
  const setPaymentChoice = useBookingDraftStore((state) => state.setPaymentChoice);

  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'direct' | 'order' | 'verify' | null>(null);
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const autoVerifyAttemptedRef = useRef(false);

  const paymentChoice: PaymentChoice =
    draft.paymentChoice === 'online' || draft.paymentChoice === 'subscription_credit' || draft.paymentChoice === 'cash'
      ? draft.paymentChoice
      : 'cash';

  const providerId = typeof draft.providerId === 'number' ? draft.providerId : NaN;
  const petId = typeof draft.petId === 'number' ? draft.petId : NaN;
  const bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' =
    draft.bookingMode === 'clinic_visit' || draft.bookingMode === 'teleconsult' ? draft.bookingMode : 'home_visit';

  const providerServiceId = draft.providerServiceId;
  const hasRequiredFields =
    typeof providerServiceId === 'string' &&
    providerServiceId.length > 0 &&
    Number.isFinite(providerId) &&
    providerId > 0 &&
    Number.isFinite(petId) &&
    petId > 0 &&
    typeof draft.bookingDate === 'string' &&
    typeof draft.startTime === 'string';

  const pendingOrderId = draft.pendingPaymentOrderId;
  const callbackOrderId = typeof params.providerOrderId === 'string' ? params.providerOrderId.trim() : '';
  const callbackPaymentId = typeof params.providerPaymentId === 'string' ? params.providerPaymentId.trim() : '';
  const callbackSignature = typeof params.providerSignature === 'string' ? params.providerSignature.trim() : '';

  const canVerifyFromCallback =
    typeof pendingOrderId === 'string' &&
    pendingOrderId.length > 0 &&
    callbackOrderId === pendingOrderId &&
    callbackPaymentId.length > 0 &&
    callbackSignature.length > 0;

  const selectedAddOns = useMemo(() => {
    if (!Array.isArray(draft.addOns)) {
      return [] as Array<{ id: string; quantity: number }>;
    }

    return draft.addOns
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const id = typeof entry.id === 'string' ? entry.id.trim() : '';
        const quantityValue = Number(entry.quantity ?? NaN);
        const quantity = Number.isFinite(quantityValue) ? Math.max(1, Math.round(quantityValue)) : 0;
        if (!id || quantity <= 0) {
          return null;
        }

        return { id, quantity };
      })
      .filter((entry): entry is { id: string; quantity: number } => Boolean(entry));
  }, [draft.addOns]);

  const payload = useMemo(() => {
    if (!hasRequiredFields) {
      return null;
    }

    return {
      petId,
      providerId,
      providerServiceId: draft.providerServiceId!,
      bookingDate: draft.bookingDate!,
      startTime: draft.startTime!,
      bookingMode,
      locationAddress: draft.locationAddress?.trim() || undefined,
      latitude: typeof draft.latitude === 'number' ? draft.latitude : undefined,
      longitude: typeof draft.longitude === 'number' ? draft.longitude : undefined,
      providerNotes: draft.providerNotes?.trim() || undefined,
      discountCode: draft.discountCode?.trim() || undefined,
      addOns: selectedAddOns.length > 0 ? selectedAddOns : undefined,
      walletCreditsAppliedInr: Math.max(0, Math.round(Number(draft.walletCreditsAppliedInr || 0))),
      pincode: draft.pincode?.trim() || undefined,
    };
  }, [
    bookingMode,
    draft.bookingDate,
    draft.discountCode,
    hasRequiredFields,
    draft.latitude,
    draft.locationAddress,
    draft.longitude,
    draft.petId,
    draft.pincode,
    draft.providerNotes,
    draft.providerServiceId,
    draft.startTime,
    draft.walletCreditsAppliedInr,
    petId,
    providerId,
    selectedAddOns,
  ]);

  useEffect(() => {
    if (!canVerifyFromCallback || autoVerifyAttemptedRef.current) {
      return;
    }

    autoVerifyAttemptedRef.current = true;
    void handleVerifyOrder();
  }, [canVerifyFromCallback]);

  const catalogQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'summary', 'catalog'],
    queryFn: getBookingCatalog,
    enabled: hasRequiredFields,
  });

  const selectedService = useMemo(() => {
    const services = (catalogQuery.data?.services ?? []) as CatalogService[];
    if (typeof providerServiceId !== 'string' || providerServiceId.length === 0) {
      return null;
    }

    return services.find((service) => service.id === providerServiceId) ?? null;
  }, [catalogQuery.data?.services, providerServiceId]);

  const addOnsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'summary', 'service-addons', providerServiceId],
    queryFn: () => getServiceAddOns(providerServiceId!),
    enabled: hasRequiredFields && typeof providerServiceId === 'string' && providerServiceId.length > 0,
  });

  const addOnNameById = useMemo(() => {
    const names = new Map<string, string>();
    const loadedAddOns = addOnsQuery.data?.success ? addOnsQuery.data.data : [];
    for (const addOn of loadedAddOns ?? []) {
      if (typeof addOn.id === 'string' && addOn.id.length > 0) {
        names.set(addOn.id, addOn.name || 'Add-on');
      }
    }

    return names;
  }, [addOnsQuery.data]);

  const bundleEntries = useMemo(() => {
    const entries: Array<{ petId: number; providerServiceId: string }> = [];

    if (Array.isArray(draft.bundleSelections) && draft.bundleSelections.length > 0) {
      for (const selection of draft.bundleSelections) {
        const petIdValue = Number(selection.petId);
        const providerServiceIdValue = String(selection.providerServiceId ?? '').trim();
        const quantity = Math.max(1, Math.round(Number(selection.quantity) || 1));

        if (!Number.isInteger(petIdValue) || petIdValue <= 0 || providerServiceIdValue.length === 0) {
          continue;
        }

        for (let index = 0; index < quantity; index += 1) {
          entries.push({
            petId: petIdValue,
            providerServiceId: providerServiceIdValue,
          });
        }
      }
    }

    if (entries.length > 0) {
      return entries;
    }

    if (!hasRequiredFields || !payload) {
      return [] as Array<{ petId: number; providerServiceId: string }>;
    }

    return [{
      petId: payload.petId,
      providerServiceId: payload.providerServiceId,
    }];
  }, [draft.bundleSelections, hasRequiredFields, payload]);

  const uniqueBundleProviderServiceIds = useMemo(
    () => Array.from(new Set(bundleEntries.map((entry) => entry.providerServiceId))),
    [bundleEntries],
  );

  const priceQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'summary', 'price', providerServiceId, providerId, payload?.addOns],
    queryFn: () =>
      calculateServicePrice({
        serviceId: providerServiceId!,
        providerId,
        addOns: payload?.addOns,
      }),
    enabled: hasRequiredFields,
  });

  const petsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'pets'],
    queryFn: getUserPets,
  });

  const selectedPet = useMemo(() => {
    if (typeof draft.petId !== 'number') {
      return null;
    }

    const pets = (petsQuery.data?.pets ?? []) as Array<Record<string, unknown>>;
    return pets.find((pet) => Number(pet.id ?? NaN) === draft.petId) ?? null;
  }, [draft.petId, petsQuery.data?.pets]);

  const serviceById = useMemo(() => {
    const map = new Map<string, CatalogService>();
    for (const service of (catalogQuery.data?.services ?? []) as CatalogService[]) {
      map.set(service.id, service);
    }
    return map;
  }, [catalogQuery.data?.services]);

  const petNameById = useMemo(() => {
    const map = new Map<number, string>();
    const pets = (petsQuery.data?.pets ?? []) as Array<Record<string, unknown>>;
    for (const pet of pets) {
      const petIdValue = Number(pet.id ?? NaN);
      if (!Number.isInteger(petIdValue) || petIdValue <= 0) {
        continue;
      }

      const label = typeof pet.name === 'string' && pet.name.trim().length > 0
        ? pet.name.trim()
        : `Pet #${petIdValue}`;
      map.set(petIdValue, label);
    }
    return map;
  }, [petsQuery.data?.pets]);

  const selectedBundleRows = useMemo(
    () => bundleEntries.map((entry, index) => {
      const service = serviceById.get(entry.providerServiceId);
      return {
        key: `${entry.petId}:${entry.providerServiceId}:${index}`,
        petLabel: petNameById.get(entry.petId) ?? `Pet #${entry.petId}`,
        serviceLabel: service?.service_type ?? entry.providerServiceId,
      };
    }),
    [bundleEntries, petNameById, serviceById],
  );

  const selectedAddOnAmount = useMemo(() => {
    const loadedAddOns = addOnsQuery.data?.success ? addOnsQuery.data.data : [];
    const priceById = new Map<string, number>();
    for (const addOn of loadedAddOns ?? []) {
      priceById.set(addOn.id, Math.max(0, Number(addOn.price ?? 0)));
    }

    return selectedAddOns.reduce((sum, addOn) => {
      const price = priceById.get(addOn.id) ?? 0;
      return sum + (price * Math.max(1, addOn.quantity));
    }, 0);
  }, [addOnsQuery.data, selectedAddOns]);

  const bundleBaseAmount = useMemo(() => {
    if (bundleEntries.length <= 1) {
      return 0;
    }

    const servicesTotal = bundleEntries.reduce((sum, entry) => {
      const service = serviceById.get(entry.providerServiceId);
      return sum + Math.max(0, Number(service?.base_price ?? 0));
    }, 0);

    return servicesTotal + selectedAddOnAmount;
  }, [bundleEntries, selectedAddOnAmount, serviceById]);

  const discountCode = (draft.discountCode ?? '').trim();

  const discountQuery = useQuery({
    queryKey: [
      'customer',
      'booking-flow',
      'summary',
      'discount',
      discountCode,
      providerServiceId,
      uniqueBundleProviderServiceIds.join('|'),
      Math.max(1, Math.round(bundleBaseAmount)),
    ],
    queryFn: () =>
      bundleEntries.length > 1
        ? previewDiscount({
            bundleProviderServiceIds: uniqueBundleProviderServiceIds,
            bundleEstimatedTotalInr: Math.max(1, Math.round(bundleBaseAmount)),
            discountCode,
          })
        : previewDiscount({
            providerServiceId: providerServiceId ?? undefined,
            discountCode,
          }),
    enabled: hasRequiredFields && discountCode.length > 0,
  });

  const singleBaseAmount = Number(priceQuery.data?.data?.final_total ?? 0);
  const baseAmount = bundleEntries.length > 1 ? bundleBaseAmount : singleBaseAmount;
  const preview = discountQuery.data?.preview;

  const walletCreditsAppliedInr = useMemo(() => {
    const parsed = Number(draft.walletCreditsAppliedInr ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.round(parsed);
  }, [draft.walletCreditsAppliedInr]);

  const serviceTypeForCredits = selectedService?.service_type?.trim() ?? '';

  const creditEligibilityQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'summary', 'credit-eligibility', serviceTypeForCredits],
    queryFn: () =>
      getSubscriptionCreditEligibility({
        serviceType: serviceTypeForCredits,
      }),
    enabled: hasRequiredFields && serviceTypeForCredits.length > 0,
  });

  const creditEligibility = (creditEligibilityQuery.data ?? null) as CreditEligibilityResponse | null;
  const subscriptionCreditUnavailableReason =
    creditEligibility?.reason ?? 'Subscription credits are not available for this service right now.';

  useEffect(() => {
    if (paymentChoice === 'subscription_credit' && creditEligibility && !creditEligibility.eligible) {
      setPaymentChoice('cash');
    }
  }, [creditEligibility, paymentChoice, setPaymentChoice]);

  const isBundledBooking = bundleEntries.length > 1;
  const bundleEstimatedTotalInr = isBundledBooking ? Math.max(1, Math.round(baseAmount)) : undefined;
  const bundleSummary = isBundledBooking
    ? [
        `Bundled services (${bundleEntries.length})`,
        ...selectedBundleRows.map((row, index) => `${index + 1}. ${row.petLabel} | ${row.serviceLabel}`),
      ].join('\n')
    : undefined;

  const bundleMetadata = isBundledBooking
    ? {
        bundleProviderServiceIds: uniqueBundleProviderServiceIds,
        bundleEstimatedTotalInr,
        bundleSummary,
      }
    : {};

  async function handleDirectBooking() {
    setError(null);
    if (!payload) {
      setError('Missing booking details. Please restart the flow.');
      return;
    }

    if (
      payload.bookingMode === 'home_visit' &&
      (
        !payload.locationAddress ||
        !Number.isFinite(payload.latitude) ||
        !Number.isFinite(payload.longitude) ||
        !payload.pincode ||
        !/^[1-9]\d{5}$/.test(payload.pincode)
      )
    ) {
      setError('Home visit booking requires a saved address with valid location coordinates.');
      return;
    }

    setActionLoading('direct');

    try {
      const operationKey = ensureDirectBookingOperationKey();
      const response = await createBookingWithIdempotency(
        {
          ...payload,
          ...bundleMetadata,
          paymentMode: 'direct_to_provider',
        },
        operationKey,
      );
      const bookingId = Number((response.booking as { id?: unknown } | undefined)?.id ?? NaN);

      clearPendingPaymentOrder();

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
        if (isSlotConflictError(err)) {
          clearPendingPaymentOrder();
          resetAfterSlotConflict();
          router.replace('/booking/new/datetime');
          return;
        }

        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to create booking (${err.status}).`);
      } else {
        setError('Unable to create booking right now.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubscriptionCreditBooking() {
    setError(null);

    if (!payload) {
      setError('Missing booking details. Please restart the flow.');
      return;
    }

    if (!creditEligibility?.eligible) {
      setError(subscriptionCreditUnavailableReason);
      return;
    }

    if (
      payload.bookingMode === 'home_visit' &&
      (
        !payload.locationAddress ||
        !Number.isFinite(payload.latitude) ||
        !Number.isFinite(payload.longitude) ||
        !payload.pincode ||
        !/^[1-9]\d{5}$/.test(payload.pincode)
      )
    ) {
      setError('Home visit booking requires a saved address with valid location coordinates.');
      return;
    }

    setActionLoading('direct');

    try {
      const operationKey = ensureDirectBookingOperationKey();
      const response = await createBookingWithIdempotency(
        {
          ...payload,
          ...bundleMetadata,
          useSubscriptionCredit: true,
        },
        operationKey,
      );

      const bookingId = Number((response.booking as { id?: unknown } | undefined)?.id ?? NaN);
      clearPendingPaymentOrder();

      router.replace({
        pathname: '/booking/confirmation',
        params: {
          bookingId: Number.isFinite(bookingId) ? String(bookingId) : undefined,
          status: 'confirmed',
          mode: 'subscription_credit',
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (isSlotConflictError(err)) {
          clearPendingPaymentOrder();
          resetAfterSlotConflict();
          router.replace('/booking/new/datetime');
          return;
        }

        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to create subscription-credit booking (${err.status}).`);
      } else {
        setError('Unable to create booking with subscription credits right now.');
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
      const operationKey = ensureBookingOrderOperationKey();
      const response = (await createBookingOrder(
        isBundledBooking
          ? {
              entries: bundleEntries.map((entry, index) => ({
                ...payload,
                petId: entry.petId,
                providerServiceId: entry.providerServiceId,
                addOns: index === 0 ? payload.addOns : undefined,
                discountCode: index === 0 ? payload.discountCode : undefined,
                walletCreditsAppliedInr: index === 0 ? payload.walletCreditsAppliedInr : 0,
                ...bundleMetadata,
                paymentMode: 'platform',
              })),
            }
          : { ...payload, paymentMode: 'platform' },
        { idempotencyKey: operationKey },
      )) as OrderResponse;
      setOrderData(response);

      const providerOrderId = response.razorpay?.orderId?.trim();
      if (providerOrderId) {
        setPendingPaymentOrder({
          providerOrderId,
          transactionId: response.transaction?.id?.trim() || null,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (isSlotConflictError(err)) {
          clearPendingPaymentOrder();
          resetAfterSlotConflict();
          router.replace('/booking/new/datetime');
          return;
        }

        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to create payment order (${err.status}).`);
      } else {
        setError('Unable to create payment order right now.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConfirmByPaymentChoice() {
    if (paymentChoice === 'online') {
      await handleCreateOrder();
      return;
    }

    if (paymentChoice === 'subscription_credit') {
      await handleSubscriptionCreditBooking();
      return;
    }

    await handleDirectBooking();
  }

  async function handleVerifyOrder() {
    setError(null);

    if (!canVerifyFromCallback) {
      setError('Verification callback is missing or does not match the pending order.');
      return;
    }

    setActionLoading('verify');

    try {
      const operationKey = ensurePaymentVerificationOperationKey();
      const response = await verifyBookingOrder({
        providerOrderId: callbackOrderId,
        providerPaymentId: callbackPaymentId,
        providerSignature: callbackSignature,
      }, {
        idempotencyKey: operationKey,
      });

      const bookingId = Number((response.booking as { id?: unknown } | undefined)?.id ?? NaN);

      clearPendingPaymentOrder();

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
        if (isSlotConflictError(err)) {
          clearPendingPaymentOrder();
          resetAfterSlotConflict();
          router.replace('/booking/new/datetime');
          return;
        }

        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to verify payment (${err.status}).`);
      } else {
        setError('Unable to verify payment right now.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  const activeOrderId = orderData?.razorpay?.orderId ?? pendingOrderId ?? null;
  const estimatedTotal = Math.max(0, (preview ? Number(preview.finalAmount) : baseAmount) - walletCreditsAppliedInr);

  const paymentDescription =
    walletCreditsAppliedInr > 0 && estimatedTotal === 0
      ? 'Your Dofurs wallet credits cover the full amount. No additional payment is needed.'
      : paymentChoice === 'subscription_credit'
        ? 'Subscription credit value is reserved when booking is created and restored if the booking is cancelled.'
        : paymentChoice === 'cash'
          ? 'Cash will be collected after the service is completed.'
          : 'Secure Razorpay checkout is required before your booking is scheduled.';

  const submitButtonLabel =
    actionLoading === 'direct'
      ? 'Creating booking...'
      : actionLoading === 'order'
        ? 'Creating order...'
        : paymentChoice === 'online'
          ? 'Proceed to payment'
          : 'Confirm booking';

  return (
    <Screen scroll>
      <ProgressBar activeStep={3} />

      <View style={styles.containerCard}>
        <Text style={styles.stepKicker}>Step 3 of 3</Text>
        <Text style={styles.title}>Review & confirm</Text>
        <Text style={styles.subtitle}>Confirm all booking details before placing your request.</Text>

        {!hasRequiredFields ? (
          <Text style={styles.error}>Missing booking context. Restart booking from service selection.</Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Selection</Text>
          <Text style={styles.meta}>Services selected: {bundleEntries.length}</Text>
          {selectedBundleRows.map((row) => (
            <Text key={row.key} style={styles.meta}>• {row.petLabel}: {row.serviceLabel}</Text>
          ))}
          <Text style={styles.meta}>Provider ID: {draft.providerId ?? '--'}</Text>
          <Text style={styles.meta}>Primary pet: {typeof selectedPet?.name === 'string' ? selectedPet.name : draft.petId ?? '--'}</Text>
          <Text style={styles.meta}>Date: {draft.bookingDate ?? '--'}</Text>
          <Text style={styles.meta}>Time: {draft.startTime ?? '--'}</Text>
          <Text style={styles.meta}>Mode: {bookingMode.replace('_', ' ')}</Text>
          {draft.locationAddress ? <Text style={styles.meta}>Address: {draft.locationAddress}</Text> : null}
          {selectedAddOns.length > 0 ? (
            <View style={styles.metaGroup}>
              <Text style={styles.meta}>Add-ons:</Text>
              {selectedAddOns.map((addOn) => (
                <Text key={addOn.id} style={styles.meta}>
                  • {addOnNameById.get(addOn.id) ?? 'Add-on'} x{addOn.quantity}
                </Text>
              ))}
            </View>
          ) : null}
          {draft.providerNotes ? <Text style={styles.meta}>Notes: {draft.providerNotes}</Text> : null}
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
          <Text style={styles.total}>Estimated total: {formatCurrency(estimatedTotal)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment option</Text>

          <Pressable
            style={styles.radioRow}
            onPress={() => setPaymentChoice('online')}
            disabled={actionLoading !== null}
          >
            <View style={[styles.radioOuter, paymentChoice === 'online' && styles.radioOuterActive]}>
              {paymentChoice === 'online' ? <View style={styles.radioInner} /> : null}
            </View>
            <Text style={styles.radioLabel}>Pay online now (Razorpay)</Text>
          </Pressable>

          <Pressable
            style={styles.radioRow}
            onPress={() => {
              if (!creditEligibility?.eligible || creditEligibilityQuery.isLoading) {
                return;
              }
              setPaymentChoice('subscription_credit');
            }}
            disabled={actionLoading !== null || !creditEligibility?.eligible || creditEligibilityQuery.isLoading}
          >
            <View
              style={[
                styles.radioOuter,
                paymentChoice === 'subscription_credit' && styles.radioOuterActive,
                (!creditEligibility?.eligible || creditEligibilityQuery.isLoading) && styles.radioOuterDisabled,
              ]}
            >
              {paymentChoice === 'subscription_credit' ? <View style={styles.radioInner} /> : null}
            </View>
            <View style={styles.radioLabelBlock}>
              <Text style={styles.radioLabel}>Use subscription credit</Text>
              <Text style={styles.radioHint}>
                {creditEligibilityQuery.isLoading
                  ? 'Checking availability...'
                  : creditEligibility?.eligible
                    ? `${formatCreditAmount(creditEligibility.availableCredits)} credit value available`
                    : subscriptionCreditUnavailableReason}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.radioRow}
            onPress={() => setPaymentChoice('cash')}
            disabled={actionLoading !== null}
          >
            <View style={[styles.radioOuter, paymentChoice === 'cash' && styles.radioOuterActive]}>
              {paymentChoice === 'cash' ? <View style={styles.radioInner} /> : null}
            </View>
            <Text style={styles.radioLabel}>Pay in cash after service</Text>
          </Pressable>

          <Text style={styles.paymentDescription}>{paymentDescription}</Text>
          <Text style={styles.paymentMeta}>
            Subscription credits can be used for eligible grooming services. Birthday and boarding bookings are excluded.
          </Text>

          <Pressable
            style={[styles.primaryButton, (!payload || actionLoading !== null) && styles.buttonDisabled]}
            onPress={handleConfirmByPaymentChoice}
            disabled={!payload || actionLoading !== null}
          >
            <Text style={styles.primaryButtonLabel}>{submitButtonLabel}</Text>
          </Pressable>

          <Text style={styles.termsText}>
            By clicking {paymentChoice === 'online' ? 'Proceed to payment' : 'Confirm booking'}, you accept the Dofurs terms and pet safety clauses.
          </Text>

          {activeOrderId ? (
            <View style={styles.orderBlock}>
              <Text style={styles.meta}>Order ID: {activeOrderId}</Text>
              <Text style={styles.meta}>Amount: {orderData?.razorpay?.amount ?? '--'} {orderData?.razorpay?.currency ?? 'INR'}</Text>
              <Text style={styles.meta}>Transaction ID: {orderData?.transaction?.id ?? '--'}</Text>

              <Text style={styles.meta}>
                Verification runs automatically when callback params are present.
              </Text>

              <Pressable
                style={[styles.secondaryButton, (!canVerifyFromCallback || actionLoading !== null) && styles.buttonDisabled]}
                onPress={handleVerifyOrder}
                disabled={!canVerifyFromCallback || actionLoading !== null}
              >
                <Text style={styles.secondaryButtonLabel}>{actionLoading === 'verify' ? 'Verifying...' : 'Verify payment and finalize booking'}</Text>
              </Pressable>

              <Pressable style={styles.resetButton} onPress={resetOnlinePaymentAttempt}>
                <Text style={styles.resetButtonLabel}>Reset online payment attempt</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.backButton} onPress={() => router.replace('/booking/new/datetime')}>
          <Text style={styles.backButtonLabel}>Back to date & details</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  progressTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  progressNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: '#e5d8cd',
    borderRadius: 2,
  },
  progressBarFilled: {
    backgroundColor: dofursColors.coral,
  },
  progressNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d8cec4',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNodeCompleted: {
    borderColor: dofursColors.coral,
    backgroundColor: dofursColors.coral,
  },
  progressNodeActive: {
    borderColor: dofursColors.coral,
    backgroundColor: '#ffffff',
  },
  progressNodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d8cec4',
  },
  progressNodeDotActive: {
    backgroundColor: dofursColors.coral,
  },
  progressLabel: {
    fontSize: 11,
    color: '#9a9189',
    fontWeight: '600',
  },
  progressLabelActive: {
    color: dofursColors.coral,
  },
  containerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffefb',
    padding: 12,
    gap: 10,
  },
  stepKicker: {
    color: '#9a6a44',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b5f56',
    fontSize: 16,
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
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 13,
  },
  metaGroup: {
    gap: 2,
  },
  total: {
    marginTop: 2,
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  radioOuter: {
    marginTop: 2,
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#d7bda8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  radioOuterActive: {
    borderColor: dofursColors.coral,
  },
  radioOuterDisabled: {
    opacity: 0.55,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: dofursColors.coral,
  },
  radioLabelBlock: {
    flex: 1,
    gap: 2,
  },
  radioLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  radioHint: {
    color: '#6d635c',
    fontSize: 12,
  },
  paymentDescription: {
    color: '#6d635c',
    fontSize: 12,
    marginTop: 2,
  },
  paymentMeta: {
    color: '#6d635c',
    fontSize: 11,
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 11,
  },
  termsText: {
    color: '#6d635c',
    fontSize: 11,
    lineHeight: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
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
  backButton: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  backButtonLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '700',
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  resetButtonLabel: {
    color: '#6d635c',
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
  },
});
