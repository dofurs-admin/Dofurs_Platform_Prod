import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  ServiceAddOn,
  dofursColors,
  getAdminFlowAvailability,
  getAvailableSlots,
  getBookingCatalog,
  getCreditWallet,
  getServiceAddOns,
  getOwnerAddresses,
  useBookingDraftStore,
} from '@dofurs/shared';

type AddressRow = {
  id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  is_default?: boolean;
};

type AvailabilityProvider = {
  providerId: number;
  providerServiceId: string;
  availableForSelectedSlot: boolean;
  recommended: boolean;
};

function todayDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateChipLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function buildUpcomingDateOptions(days: number) {
  const options: string[] = [];
  const now = new Date();

  for (let index = 0; index < days; index += 1) {
    const next = new Date(now);
    next.setDate(now.getDate() + index);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    options.push(`${year}-${month}-${day}`);
  }

  return options;
}

function Stepper({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { id: 1, label: 'Pets & Service' },
    { id: 2, label: 'Schedule' },
    { id: 3, label: 'Review' },
  ] as const;

  return (
    <View style={styles.stepperWrap}>
      <View style={styles.stepperRow}>
        {steps.map((step, index) => {
          const isActive = activeStep === step.id;
          const isCompleted = activeStep > step.id;

          return (
            <View key={step.id} style={styles.stepItem}>
              <View style={[styles.stepCircle, (isActive || isCompleted) && styles.stepCircleActive]}>
                <Text style={[styles.stepCircleLabel, (isActive || isCompleted) && styles.stepCircleLabelActive]}>{step.id}</Text>
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
              {index < steps.length - 1 ? <View style={styles.stepConnector} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function PlaceholderScreen() {
  const router = useRouter();
  const draft = useBookingDraftStore((state) => state.draft);
  const setDateTimeSelection = useBookingDraftStore((state) => state.setDateTimeSelection);
  const setAddressSelection = useBookingDraftStore((state) => state.setAddressSelection);
  const setAddOnSelection = useBookingDraftStore((state) => state.setAddOnSelection);
  const setPricingSelection = useBookingDraftStore((state) => state.setPricingSelection);
  const reconcileProviderSelection = useBookingDraftStore((state) => state.reconcileProviderSelection);

  const providerId = typeof draft.providerId === 'number' ? draft.providerId : NaN;
  const hasContext =
    typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0 &&
    Number.isFinite(providerId) && providerId > 0 &&
    typeof draft.petId === 'number' && Number.isFinite(draft.petId) && draft.petId > 0;

  const bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' =
    draft.bookingMode === 'clinic_visit' || draft.bookingMode === 'teleconsult'
      ? draft.bookingMode
      : 'home_visit';

  const [bookingDate, setBookingDate] = useState(draft.bookingDate ?? todayDateString());
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(draft.startTime);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(draft.selectedAddressId ?? null);
  const [selectedAddOnQuantities, setSelectedAddOnQuantities] = useState<Record<string, number>>(() => {
    const fromDraft = Array.isArray(draft.addOns) ? draft.addOns : [];
    const map: Record<string, number> = {};
    for (const addOn of fromDraft) {
      if (typeof addOn.id === 'string' && addOn.id.trim().length > 0) {
        const quantity = Number(addOn.quantity);
        if (Number.isFinite(quantity) && quantity > 0) {
          map[addOn.id] = Math.round(quantity);
        }
      }
    }
    return map;
  });
  const [discountCode, setDiscountCode] = useState(draft.discountCode ?? '');
  const [providerNotes, setProviderNotes] = useState(draft.providerNotes ?? '');
  const [walletCredits, setWalletCredits] = useState(String(draft.walletCreditsAppliedInr || 0));

  const catalogQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'catalog'],
    queryFn: getBookingCatalog,
    enabled: hasContext,
  });

  const addressesQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'addresses'],
    queryFn: getOwnerAddresses,
    enabled: hasContext,
  });

  const walletQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'wallet'],
    queryFn: getCreditWallet,
    enabled: hasContext,
  });

  const selectedServiceDurationMinutes = useMemo(() => {
    if (typeof draft.providerServiceId !== 'string' || draft.providerServiceId.length === 0) {
      return undefined;
    }

    const services = catalogQuery.data?.services ?? [];
    const selectedService = services.find((service) => service.id === draft.providerServiceId);

    const duration = Number(selectedService?.service_duration_minutes ?? NaN);
    return Number.isFinite(duration) && duration > 0 ? duration : undefined;
  }, [catalogQuery.data?.services, draft.providerServiceId]);

  const selectedService = useMemo(() => {
    if (typeof draft.providerServiceId !== 'string' || draft.providerServiceId.length === 0) {
      return null;
    }

    const services = catalogQuery.data?.services ?? [];
    return services.find((service) => service.id === draft.providerServiceId) ?? null;
  }, [catalogQuery.data?.services, draft.providerServiceId]);

  const addOnsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'service-addons', draft.providerServiceId],
    queryFn: () => getServiceAddOns(draft.providerServiceId!),
    enabled: typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0,
  });

  const serviceAddOns = useMemo(() => {
    const payload = addOnsQuery.data;
    if (!payload?.success || !Array.isArray(payload.data)) {
      return [] as ServiceAddOn[];
    }

    return payload.data;
  }, [addOnsQuery.data]);

  const slotsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'slots', providerId, bookingDate, draft.providerServiceId],
    queryFn: () =>
      getAvailableSlots({
        providerId,
        date: bookingDate,
        providerServiceId: draft.providerServiceId ?? undefined,
        serviceDurationMinutes: selectedServiceDurationMinutes,
      }),
    enabled: hasContext && /^\d{4}-\d{2}-\d{2}$/.test(bookingDate),
  });

  const slots = useMemo(
    () => (slotsQuery.data?.slots ?? []).filter((slot) => slot.is_available),
    [slotsQuery.data?.slots],
  );

  const addresses = (addressesQuery.data?.addresses ?? []) as AddressRow[];

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const availableWalletCredits = useMemo(() => {
    const raw = walletQuery.data?.balance?.available_inr;
    const parsed = Number(raw ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.round(parsed);
  }, [walletQuery.data?.balance]);

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) {
      return;
    }

    const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0];
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (slots.length === 0) {
      setSelectedStartTime(null);
      return;
    }

    const selectedStillAvailable = selectedStartTime
      ? slots.some((slot) => slot.start_time === selectedStartTime)
      : false;

    if (!selectedStillAvailable) {
      const firstAvailable = slots[0];
      setSelectedStartTime(firstAvailable.start_time);
    }
  }, [selectedStartTime, slots]);

  useEffect(() => {
    if (serviceAddOns.length === 0) {
      setSelectedAddOnQuantities((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    const availableIds = new Set(serviceAddOns.map((addOn) => addOn.id));
    setSelectedAddOnQuantities((prev) => {
      let changed = false;
      const next: Record<string, number> = {};

      for (const [addOnId, quantity] of Object.entries(prev)) {
        if (!availableIds.has(addOnId)) {
          changed = true;
          continue;
        }

        const normalized = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
        if (normalized !== quantity) {
          changed = true;
        }

        if (normalized > 0) {
          next[addOnId] = normalized;
        }
      }

      return changed ? next : prev;
    });
  }, [serviceAddOns]);

  const canUseSelectedAddress =
    Boolean(selectedAddress) &&
    typeof selectedAddress?.pincode === 'string' && /^[1-9]\d{5}$/.test(selectedAddress.pincode) &&
    typeof selectedAddress?.latitude === 'number' && Number.isFinite(selectedAddress.latitude) &&
    typeof selectedAddress?.longitude === 'number' && Number.isFinite(selectedAddress.longitude);

  const canRunAvailabilityCheck =
    bookingMode === 'home_visit' &&
    hasContext &&
    canUseSelectedAddress &&
    typeof selectedService?.service_type === 'string' &&
    selectedService.service_type.length > 0 &&
    Boolean(selectedStartTime);

  const availabilityQuery = useQuery({
    queryKey: [
      'customer',
      'booking-flow',
      'datetime-availability',
      selectedAddress?.pincode,
      bookingDate,
      selectedStartTime,
      selectedService?.service_type,
      draft.providerServiceId,
    ],
    queryFn: () =>
      getAdminFlowAvailability({
        pincode: selectedAddress!.pincode,
        serviceType: selectedService!.service_type,
        bookingMode,
        bookingDate,
        startTime: selectedStartTime!,
        serviceDurationMinutes:
          Number.isFinite(Number(selectedService?.service_duration_minutes ?? NaN))
            ? Number(selectedService?.service_duration_minutes)
            : undefined,
        strictCoverage: true,
      }),
    enabled: canRunAvailabilityCheck,
  });

  const availabilityProviders = useMemo(
    () => (availabilityQuery.data?.providers ?? []) as AvailabilityProvider[],
    [availabilityQuery.data?.providers],
  );

  const selectedSlotSupported =
    bookingMode !== 'home_visit'
      ? true
      : (availabilityQuery.data?.slotOptions ?? []).some(
          (slot) =>
            slot.startTime === selectedStartTime &&
            Number(slot.availableProviderCount ?? 0) > 0,
        );

  const currentProviderSupported =
    bookingMode !== 'home_visit'
      ? true
      : availabilityProviders.some(
          (provider) =>
            provider.providerServiceId === draft.providerServiceId &&
            provider.availableForSelectedSlot,
        );

  const recommendedProvider = useMemo(() => {
    if (bookingMode !== 'home_visit') {
      return null;
    }

    const byRecommendationFlag = availabilityProviders.find((provider) => provider.recommended);
    if (byRecommendationFlag) {
      return byRecommendationFlag;
    }

    const recommendedId = availabilityQuery.data?.recommendedProviderServiceId;
    if (typeof recommendedId !== 'string' || recommendedId.length === 0) {
      return null;
    }

    return availabilityProviders.find((provider) => provider.providerServiceId === recommendedId) ?? null;
  }, [availabilityProviders, availabilityQuery.data?.recommendedProviderServiceId, bookingMode]);

  const recommendedSlotStartTime = availabilityQuery.data?.recommendedSlotStartTime ?? null;
  const requiresSlotReselection =
    bookingMode === 'home_visit' &&
    typeof recommendedSlotStartTime === 'string' &&
    recommendedSlotStartTime.length > 0 &&
    recommendedSlotStartTime !== selectedStartTime;

  const canContinue =
    hasContext &&
    /^\d{4}-\d{2}-\d{2}$/.test(bookingDate) &&
    Boolean(selectedStartTime) &&
    (
      bookingMode !== 'home_visit' ||
      (
        canUseSelectedAddress &&
        canRunAvailabilityCheck &&
        !availabilityQuery.isLoading &&
        !availabilityQuery.isError &&
        selectedSlotSupported &&
        currentProviderSupported &&
        !requiresSlotReselection
      )
    );

  const upcomingDateOptions = useMemo(() => buildUpcomingDateOptions(7), []);

  const selectedBundleRows = useMemo(
    () =>
      (Array.isArray(draft.bundleSelections) ? draft.bundleSelections : [])
        .map((entry) => {
          const pet = (catalogQuery.data?.pets ?? []).find((item) => Number(item.id) === entry.petId);
          const service = (catalogQuery.data?.services ?? []).find((item) => item.id === entry.providerServiceId);

          return {
            key: `${entry.petId}:${entry.providerServiceId}`,
            petLabel: pet?.name ?? `Pet #${entry.petId}`,
            serviceLabel: service?.service_type ?? 'Service',
            quantity: Math.max(1, Number(entry.quantity) || 1),
          };
        }),
    [catalogQuery.data?.pets, catalogQuery.data?.services, draft.bundleSelections],
  );

  function handleUseRecommendedProvider() {
    if (!recommendedProvider) {
      return;
    }

    reconcileProviderSelection({
      providerServiceId: recommendedProvider.providerServiceId,
      providerId: recommendedProvider.providerId,
      bookingMode,
    });
  }

  function handleContinue() {
    if (!canContinue || !selectedStartTime) {
      return;
    }

    setDateTimeSelection({
      bookingDate,
      startTime: selectedStartTime,
      bookingMode,
    });

    const addressLabel = selectedAddress
      ? [selectedAddress.address_line_1, selectedAddress.address_line_2, selectedAddress.city, selectedAddress.state, selectedAddress.pincode]
          .filter((value): value is string => Boolean(value && value.trim().length > 0))
          .join(', ')
      : null;

    setAddressSelection({
      locationAddress: bookingMode === 'home_visit' ? addressLabel : null,
      latitude: bookingMode === 'home_visit' ? selectedAddress?.latitude ?? null : null,
      longitude: bookingMode === 'home_visit' ? selectedAddress?.longitude ?? null : null,
      pincode: bookingMode === 'home_visit' ? selectedAddress?.pincode ?? null : null,
      selectedAddressId: bookingMode === 'home_visit' ? selectedAddress?.id ?? null : null,
    });

    const selectedAddOns = serviceAddOns
      .map((addOn) => {
        const quantity = Number(selectedAddOnQuantities[addOn.id] ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }

        return {
          id: addOn.id,
          quantity: Math.min(addOn.maxQuantity, Math.max(addOn.minQuantity, Math.round(quantity))),
        };
      })
      .filter((entry): entry is { id: string; quantity: number } => Boolean(entry));

    setAddOnSelection({ addOns: selectedAddOns });

    const requestedCredits = Number(walletCredits);
    const normalizedCredits = Number.isFinite(requestedCredits) && requestedCredits > 0
      ? Math.min(Math.round(requestedCredits), availableWalletCredits)
      : 0;

    setPricingSelection({
      discountCode: discountCode.trim() || null,
      providerNotes: providerNotes.trim() || null,
      walletCreditsAppliedInr: normalizedCredits,
    });

    router.push('/booking/new/summary');
  }

  return (
    <Screen scroll>
      <Stepper activeStep={2} />

      <View style={styles.containerCard}>
        <Text style={styles.stepKicker}>Step 2 of 3</Text>
        <Text style={styles.title}>Choose Date, Time & Details</Text>
        <Text style={styles.subtitle}>Select your preferred date, slot and booking preferences.</Text>

        {!hasContext ? (
          <Text style={styles.meta}>Booking context is missing. Start again from service selection.</Text>
        ) : null}

        {selectedBundleRows.length > 0 ? (
          <View style={styles.selectionCard}>
            <Text style={styles.selectionTitle}>Selected Services</Text>
            {selectedBundleRows.map((row) => (
              <Text key={row.key} style={styles.meta}>{row.petLabel}: {row.serviceLabel} x{row.quantity}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Booking date</Text>
          <View style={styles.dateChipWrap}>
            {upcomingDateOptions.map((dateValue) => {
              const selected = dateValue === bookingDate;
              return (
                <Pressable
                  key={dateValue}
                  style={[styles.dateChip, selected && styles.dateChipSelected]}
                  onPress={() => setBookingDate(dateValue)}
                >
                  <Text style={[styles.dateChipLabel, selected && styles.dateChipLabelSelected]}>{formatDateChipLabel(dateValue)}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9b8f87"
            style={styles.input}
            value={bookingDate}
            onChangeText={setBookingDate}
          />
          <Text style={styles.meta}>Booking mode is locked to your selected service: {bookingMode.replace('_', ' ')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Available slots</Text>
          {slotsQuery.isLoading ? <Text style={styles.meta}>Loading slots...</Text> : null}

          {slots.map((slot) => {
            const selected = selectedStartTime === slot.start_time;
            return (
              <Pressable
                key={`${slot.start_time}-${slot.end_time}`}
                style={[styles.slotRow, selected && styles.slotRowSelected]}
                onPress={() => {
                  setSelectedStartTime(slot.start_time);
                }}
              >
                <Text style={styles.slotLabel}>{slot.start_time} - {slot.end_time}</Text>
              </Pressable>
            );
          })}

          {!slotsQuery.isLoading && slots.length === 0 ? (
            <Text style={styles.meta}>No slots available for this date. Choose another date.</Text>
          ) : null}
        </View>

        {bookingMode === 'home_visit' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Saved address</Text>
            {addressesQuery.isLoading ? <Text style={styles.meta}>Loading saved addresses...</Text> : null}

            {addresses.map((address) => {
              const isSelected = selectedAddressId === address.id;
              return (
                <Pressable key={address.id} style={[styles.slotRow, isSelected && styles.slotRowSelected]} onPress={() => setSelectedAddressId(address.id)}>
                  <Text style={styles.slotLabel}>{address.address_line_1}</Text>
                  {address.address_line_2 ? <Text style={styles.meta}>{address.address_line_2}</Text> : null}
                  <Text style={styles.meta}>{address.city}, {address.state} {address.pincode}</Text>
                </Pressable>
              );
            })}

            {!addressesQuery.isLoading && addresses.length === 0 ? (
              <Text style={styles.meta}>No saved addresses found. Add one from your profile before continuing.</Text>
            ) : null}

            <Pressable style={styles.secondaryButton} onPress={() => router.push('/profile/addresses')}>
              <Text style={styles.secondaryButtonLabel}>Manage saved addresses</Text>
            </Pressable>

            {!canUseSelectedAddress ? (
              <Text style={styles.meta}>Choose an address with valid pincode and mapped coordinates.</Text>
            ) : null}

            {canRunAvailabilityCheck && availabilityQuery.isLoading ? (
              <Text style={styles.meta}>Checking serviceability for selected address and time...</Text>
            ) : null}

            {canRunAvailabilityCheck && availabilityQuery.isError ? (
              <Text style={styles.meta}>Unable to verify serviceability right now. Please try again.</Text>
            ) : null}

            {canRunAvailabilityCheck && !availabilityQuery.isLoading && !availabilityQuery.isError && !selectedSlotSupported ? (
              <Text style={styles.meta}>Selected time is no longer available for this address. Pick another slot.</Text>
            ) : null}

            {canRunAvailabilityCheck && !availabilityQuery.isLoading && !availabilityQuery.isError && selectedSlotSupported && !currentProviderSupported ? (
              <View style={styles.noticeCard}>
                <Text style={styles.meta}>Selected professional is unavailable for this address/time.</Text>
                {recommendedProvider ? (
                  <Pressable style={styles.reconcileButton} onPress={handleUseRecommendedProvider}>
                    <Text style={styles.reconcileButtonLabel}>Use recommended professional</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {canRunAvailabilityCheck && !availabilityQuery.isLoading && !availabilityQuery.isError && requiresSlotReselection ? (
              <Text style={styles.meta}>Recommended slot has changed. Choose another slot and continue.</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.meta}>Address is optional for this booking mode.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add-ons and preferences</Text>

          <Text style={styles.meta}>Add-ons are optional and final pricing is confirmed during booking creation.</Text>

          {addOnsQuery.isLoading ? <Text style={styles.meta}>Loading service add-ons...</Text> : null}

          {!addOnsQuery.isLoading && serviceAddOns.length === 0 ? (
            <Text style={styles.meta}>No add-ons are available for this service.</Text>
          ) : null}

          {serviceAddOns.map((addOn) => {
            const quantity = Math.max(0, Math.round(selectedAddOnQuantities[addOn.id] ?? 0));
            const maxQuantity = Math.max(addOn.minQuantity, addOn.maxQuantity);

            return (
              <View key={addOn.id} style={styles.addOnRow}>
                <View style={styles.addOnInfo}>
                  <Text style={styles.addOnName}>{addOn.name}</Text>
                  <Text style={styles.meta}>From INR {Math.round(Number(addOn.price ?? 0))}</Text>
                  {addOn.description ? <Text style={styles.meta}>{addOn.description}</Text> : null}
                </View>

                <View style={styles.addOnQuantityControl}>
                  <Pressable
                    style={styles.addOnQtyButton}
                    onPress={() => {
                      setSelectedAddOnQuantities((prev) => ({
                        ...prev,
                        [addOn.id]: Math.max(0, quantity - 1),
                      }));
                    }}
                  >
                    <Text style={styles.addOnQtyButtonLabel}>-</Text>
                  </Pressable>

                  <Text style={styles.addOnQtyValue}>x{quantity}</Text>

                  <Pressable
                    style={styles.addOnQtyButton}
                    onPress={() => {
                      setSelectedAddOnQuantities((prev) => ({
                        ...prev,
                        [addOn.id]: Math.min(maxQuantity, quantity + 1),
                      }));
                    }}
                  >
                    <Text style={styles.addOnQtyButtonLabel}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <TextInput
            autoCapitalize="characters"
            placeholder="Discount code (optional)"
            placeholderTextColor="#9b8f87"
            style={styles.input}
            value={discountCode}
            onChangeText={setDiscountCode}
          />

          <TextInput
            keyboardType="number-pad"
            placeholder="Wallet credits to apply (INR)"
            placeholderTextColor="#9b8f87"
            style={styles.input}
            value={walletCredits}
            onChangeText={setWalletCredits}
          />

          <Text style={styles.meta}>Available wallet credits: INR {availableWalletCredits}</Text>

          <TextInput
            multiline
            numberOfLines={4}
            placeholder="Notes for provider (optional)"
            placeholderTextColor="#9b8f87"
            style={styles.textArea}
            value={providerNotes}
            onChangeText={setProviderNotes}
          />
        </View>

        <Pressable
          style={[styles.primaryButton, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonLabel}>Continue to review</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Important notes</Text>
          <Text style={styles.noteText}>Selected slot and provider availability is revalidated before final confirmation.</Text>
          <Text style={styles.noteText}>For home visits, only saved addresses with mapped coordinates are accepted.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepperWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ead5c2',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    gap: 4,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#d8cec4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  stepCircleActive: {
    borderColor: '#d78346',
    backgroundColor: '#ef9e5f',
  },
  stepCircleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e857c',
  },
  stepCircleLabelActive: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 11,
    color: '#9a9189',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#a55f2f',
  },
  stepConnector: {
    position: 'absolute',
    top: 12,
    right: -20,
    width: 40,
    height: 2,
    backgroundColor: '#e5d8cd',
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
  selectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eadccf',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  selectionTitle: {
    color: '#8f4a1d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    fontSize: 15,
    fontWeight: '700',
  },
  dateChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e0d1c2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateChipSelected: {
    borderColor: '#d99a66',
    backgroundColor: '#fff4ea',
  },
  dateChipLabel: {
    color: '#6e4d35',
    fontSize: 12,
    fontWeight: '600',
  },
  dateChipLabelSelected: {
    color: '#8f4a1d',
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
  slotRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slotRowSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  slotLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    color: '#6d635c',
    fontSize: 13,
  },
  addOnRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  addOnInfo: {
    gap: 2,
  },
  addOnName: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  addOnQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3c7ae',
    backgroundColor: '#fff8ef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
  },
  addOnQtyButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7bda8',
  },
  addOnQtyButtonLabel: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  addOnQtyValue: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  noticeCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    padding: 10,
    gap: 6,
  },
  reconcileButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reconcileButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 90,
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
  secondaryButton: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  secondaryButtonLabel: {
    color: '#5d5853',
    fontSize: 12,
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
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8c9ad',
    backgroundColor: '#fff4e9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  noteTitle: {
    color: '#8f4a1d',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  noteText: {
    color: '#8f4a1d',
    fontSize: 12,
  },
});
