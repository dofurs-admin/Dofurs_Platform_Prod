import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  ServiceAddOn,
  dofursColors,
  getBookingCatalog,
  getServiceAddOns,
  getUserPets,
  useBookingDraftStore,
} from '@dofurs/shared';

type CatalogService = {
  id: string;
  provider_id: number;
  service_type: string;
  service_mode: string;
  service_duration_minutes: number;
  base_price: number;
};

type PetRow = {
  id: number;
  name: string;
  breed?: string | null;
  photo_url?: string | null;
};

type PetServiceSelection = {
  providerServiceId: string | null;
  quantity: number;
};

const MAX_SERVICE_SELECTIONS = 2;

function toModeLabel(mode: string) {
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'clinic_visit') {
    return 'Clinic visit';
  }
  if (normalized === 'teleconsult' || normalized === 'tele_consult') {
    return 'Teleconsult';
  }
  return 'Home visit';
}

function formatDateLabel(value: string) {
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
  const params = useLocalSearchParams<{ providerServiceId?: string; providerId?: string }>();
  const draft = useBookingDraftStore((state) => state.draft);
  const hasHydratedDraft = useBookingDraftStore((state) => state.hasHydratedDraft);
  const setServiceSelection = useBookingDraftStore((state) => state.setServiceSelection);
  const setPetSelection = useBookingDraftStore((state) => state.setPetSelection);
  const setBundleSelections = useBookingDraftStore((state) => state.setBundleSelections);
  const setAddOnSelection = useBookingDraftStore((state) => state.setAddOnSelection);

  const catalogQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'catalog'],
    queryFn: getBookingCatalog,
  });

  const services = (catalogQuery.data?.services ?? []) as CatalogService[];
  const petsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'pets'],
    queryFn: getUserPets,
  });
  const pets = (petsQuery.data?.pets ?? []) as Array<Record<string, unknown>>;

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

  const displayServices = useMemo(() => {
    const grouped = new Map<string, CatalogService>();

    for (const service of services) {
      const key = service.service_type.trim().toLowerCase();
      if (!key) {
        continue;
      }

      const existing = grouped.get(key);
      if (!existing || service.base_price < existing.base_price) {
        grouped.set(key, service);
      }
    }

    return Array.from(grouped.values()).sort((left, right) =>
      left.service_type.localeCompare(right.service_type, 'en', { sensitivity: 'base' }),
    );
  }, [services]);

  const servicesById = useMemo(() => {
    const map = new Map<string, CatalogService>();
    for (const service of displayServices) {
      map.set(service.id, service);
    }
    return map;
  }, [displayServices]);

  const [selectedPetIds, setSelectedPetIds] = useState<number[]>(() => {
    if (Array.isArray(draft.selectedPetIds) && draft.selectedPetIds.length > 0) {
      return draft.selectedPetIds;
    }

    if (typeof draft.petId === 'number' && Number.isFinite(draft.petId) && draft.petId > 0) {
      return [draft.petId];
    }

    return [];
  });

  const [petServiceSelections, setPetServiceSelections] = useState<Record<number, PetServiceSelection>>(() => {
    const initial: Record<number, PetServiceSelection> = {};

    for (const entry of draft.bundleSelections ?? []) {
      if (!Number.isInteger(entry.petId) || entry.petId <= 0 || typeof entry.providerServiceId !== 'string') {
        continue;
      }

      initial[entry.petId] = {
        providerServiceId: entry.providerServiceId,
        quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Math.round(Number(entry.quantity) || 1))),
      };
    }

    if (
      Object.keys(initial).length === 0 &&
      typeof draft.petId === 'number' &&
      draft.petId > 0 &&
      typeof draft.providerServiceId === 'string' &&
      draft.providerServiceId.length > 0
    ) {
      initial[draft.petId] = {
        providerServiceId: draft.providerServiceId,
        quantity: 1,
      };
    }

    return initial;
  });

  const [selectedAddOnQuantities, setSelectedAddOnQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const addOn of draft.addOns ?? []) {
      if (typeof addOn.id !== 'string') {
        continue;
      }

      const quantity = Number(addOn.quantity);
      if (Number.isFinite(quantity) && quantity > 0) {
        map[addOn.id] = Math.round(quantity);
      }
    }
    return map;
  });

  useEffect(() => {
    if (!hasHydratedDraft) {
      return;
    }

    if (Array.isArray(draft.selectedPetIds) && draft.selectedPetIds.length > 0) {
      setSelectedPetIds(draft.selectedPetIds);
    } else if (typeof draft.petId === 'number' && draft.petId > 0) {
      setSelectedPetIds([draft.petId]);
    }

    if (draft.bundleSelections.length > 0) {
      const restored: Record<number, PetServiceSelection> = {};
      for (const entry of draft.bundleSelections) {
        restored[entry.petId] = {
          providerServiceId: entry.providerServiceId,
          quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Number(entry.quantity) || 1)),
        };
      }
      setPetServiceSelections(restored);
      return;
    }

    if (
      typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0 &&
      typeof draft.petId === 'number' && draft.petId > 0
    ) {
      setPetServiceSelections({
        [draft.petId]: {
          providerServiceId: draft.providerServiceId,
          quantity: 1,
        },
      });
      return;
    }

    if (
      typeof params.providerServiceId === 'string' && params.providerServiceId.length > 0 &&
      selectedPetIds.length > 0
    ) {
      const firstPetId = selectedPetIds[0];
      setPetServiceSelections({
        [firstPetId]: {
          providerServiceId: params.providerServiceId,
          quantity: 1,
        },
      });
    }
  }, [
    draft.bundleSelections,
    draft.petId,
    draft.providerServiceId,
    draft.selectedPetIds,
    hasHydratedDraft,
    params.providerServiceId,
    selectedPetIds,
  ]);

  const totalSelectedServices = useMemo(
    () => selectedPetIds.reduce((sum, petId) => {
      const selection = petServiceSelections[petId];
      if (!selection?.providerServiceId) {
        return sum;
      }

      return sum + Math.max(1, selection.quantity);
    }, 0),
    [petServiceSelections, selectedPetIds],
  );

  const primarySelectedServiceId = useMemo(() => {
    for (const petId of selectedPetIds) {
      const providerServiceId = petServiceSelections[petId]?.providerServiceId;
      if (providerServiceId && providerServiceId.length > 0) {
        return providerServiceId;
      }
    }

    if (typeof params.providerServiceId === 'string' && params.providerServiceId.length > 0) {
      return params.providerServiceId;
    }

    return null;
  }, [params.providerServiceId, petServiceSelections, selectedPetIds]);

  const selectedProviderId = useMemo(() => {
    if (!primarySelectedServiceId) {
      return null;
    }

    const selectedService = servicesById.get(primarySelectedServiceId);
    if (!selectedService) {
      return null;
    }

    return selectedService.provider_id;
  }, [primarySelectedServiceId, servicesById]);

  const addOnsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'step1-service-addons', primarySelectedServiceId],
    queryFn: () => getServiceAddOns(primarySelectedServiceId!),
    enabled: typeof primarySelectedServiceId === 'string' && primarySelectedServiceId.length > 0,
  });

  const serviceAddOns = useMemo(() => {
    const payload = addOnsQuery.data;
    if (!payload?.success || !Array.isArray(payload.data)) {
      return [] as ServiceAddOn[];
    }

    return payload.data;
  }, [addOnsQuery.data]);

  useEffect(() => {
    if (serviceAddOns.length === 0) {
      setSelectedAddOnQuantities({});
      return;
    }

    const availableIds = new Set(serviceAddOns.map((addOn) => addOn.id));
    setSelectedAddOnQuantities((previous) => {
      const next: Record<string, number> = {};
      for (const [id, quantity] of Object.entries(previous)) {
        if (!availableIds.has(id)) {
          continue;
        }

        const normalized = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
        if (normalized > 0) {
          next[id] = normalized;
        }
      }
      return next;
    });
  }, [serviceAddOns]);

  const selectedPetRows = useMemo(
    () => (pets as PetRow[]).filter((pet) => selectedPetIds.includes(Number(pet.id))),
    [pets, selectedPetIds],
  );

  const canContinue = useMemo(() => {
    if (selectedPetIds.length === 0) {
      return false;
    }

    if (totalSelectedServices <= 0) {
      return false;
    }

    return selectedPetIds.every((petId) => Boolean(petServiceSelections[petId]?.providerServiceId));
  }, [petServiceSelections, selectedPetIds, totalSelectedServices]);

  function handlePetToggle(petId: number) {
    setSelectedPetIds((previous) => {
      const exists = previous.includes(petId);
      if (exists) {
        return previous.filter((id) => id !== petId);
      }

      return [...previous, petId];
    });

    setPetServiceSelections((previous) => ({
      ...previous,
      [petId]: previous[petId] ?? { providerServiceId: null, quantity: 1 },
    }));
  }

  function handlePetServiceToggle(petId: number, providerServiceId: string) {
    const service = servicesById.get(providerServiceId);
    if (!service) {
      return;
    }

    setPetServiceSelections((previous) => {
      const current = previous[petId] ?? { providerServiceId: null, quantity: 1 };

      if (current.providerServiceId === providerServiceId) {
        return {
          ...previous,
          [petId]: {
            providerServiceId: null,
            quantity: 1,
          },
        };
      }

      const runningTotal = selectedPetIds.reduce((sum, selectedPetId) => {
        if (selectedPetId === petId) {
          return sum;
        }

        const selection = previous[selectedPetId];
        if (!selection?.providerServiceId) {
          return sum;
        }

        return sum + Math.max(1, selection.quantity);
      }, 0);

      if (runningTotal >= MAX_SERVICE_SELECTIONS) {
        return previous;
      }

      const activeProviderId = selectedProviderId;
      if (activeProviderId && service.provider_id !== activeProviderId) {
        return previous;
      }

      return {
        ...previous,
        [petId]: {
          providerServiceId,
          quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, current.quantity || 1)),
        },
      };
    });
  }

  function handlePetQuantityChange(petId: number, quantity: number) {
    setPetServiceSelections((previous) => {
      const current = previous[petId];
      if (!current?.providerServiceId) {
        return previous;
      }

      const nextQuantity = Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, quantity));
      const delta = nextQuantity - current.quantity;

      if (delta === 0) {
        return previous;
      }

      if (totalSelectedServices + delta > MAX_SERVICE_SELECTIONS) {
        return previous;
      }

      return {
        ...previous,
        [petId]: {
          ...current,
          quantity: nextQuantity,
        },
      };
    });
  }

  function handleContinue() {
    if (!canContinue || selectedPetRows.length === 0) {
      return;
    }

    const bundleSelections = selectedPetIds
      .map((petId) => {
        const selection = petServiceSelections[petId];
        if (!selection?.providerServiceId) {
          return null;
        }

        const quantity = Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Math.round(selection.quantity || 1)));

        return {
          petId,
          providerServiceId: selection.providerServiceId,
          quantity,
        };
      })
      .filter((entry): entry is { petId: number; providerServiceId: string; quantity: number } => Boolean(entry));

    if (bundleSelections.length === 0) {
      return;
    }

    const primaryEntry = bundleSelections[0];
    const primaryService = servicesById.get(primaryEntry.providerServiceId);
    if (!primaryService) {
      return;
    }

    setServiceSelection({
      providerServiceId: primaryService.id,
      providerId: primaryService.provider_id,
      bookingMode:
        primaryService.service_mode === 'clinic_visit' || primaryService.service_mode === 'teleconsult'
          ? primaryService.service_mode
          : 'home_visit',
    });
    setPetSelection(primaryEntry.petId);
    setBundleSelections({
      selectedPetIds,
      bundleSelections,
    });

    const normalizedAddOns = serviceAddOns
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

    setAddOnSelection({ addOns: normalizedAddOns });

    router.push('/booking/new/datetime');
  }

  const selectedCount = totalSelectedServices;
  const addOnSelectedCount = Object.values(selectedAddOnQuantities).filter((quantity) => quantity > 0).length;

  const selectedDateLabel = formatDateLabel(new Date().toISOString().slice(0, 10));

  return (
    <Screen scroll>
      <Stepper activeStep={1} />

      <View style={styles.containerCard}>
        <Text style={styles.stepKicker}>Step 1 of 3</Text>
        <Text style={styles.title}>Select Pets & Service</Text>
        <Text style={styles.subtitle}>Choose which pet(s) to book for and what service they need.</Text>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Pets</Text>
          <Pressable style={styles.addPetButton} onPress={() => router.push('/pets/add')}>
            <Text style={styles.addPetButtonLabel}>+ Add Pet</Text>
          </Pressable>
        </View>

        {petsQuery.isLoading ? <Text style={styles.meta}>Loading pets...</Text> : null}

        <View style={styles.petsGrid}>
          {pets.map((pet) => {
            const petId = Number(pet.id ?? NaN);
            if (!Number.isFinite(petId) || petId <= 0) {
              return null;
            }

            const isSelected = selectedPetIds.includes(petId);
            const imageUrl = typeof pet.photo_url === 'string' && pet.photo_url.trim().length > 0 ? pet.photo_url : null;
            const petName = typeof pet.name === 'string' && pet.name.trim().length > 0 ? pet.name.trim() : `Pet #${petId}`;
            const petBreed = typeof pet.breed === 'string' && pet.breed.trim().length > 0 ? pet.breed.trim() : 'Pet';

            return (
              <Pressable
                key={String(pet.id)}
                style={[styles.petCard, isSelected && styles.petCardSelected]}
                onPress={() => handlePetToggle(petId)}
              >
                <View style={styles.petAvatar}>
                  {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.petAvatarImage} /> : <Text style={styles.petAvatarInitial}>{petName.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={styles.petMetaWrap}>
                  <Text style={styles.petName}>{petName}</Text>
                  <Text style={styles.petBreed}>{petBreed}</Text>
                </View>
                {isSelected ? <Text style={styles.selectedMark}>●</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {!petsQuery.isLoading && pets.length === 0 ? (
          <Text style={styles.meta}>No pet profiles found. Add a pet before booking.</Text>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Service Per Pet</Text>
          <Text style={styles.selectionCount}>{selectedCount}/{MAX_SERVICE_SELECTIONS} selected</Text>
        </View>

        {selectedPetRows.length === 0 ? <Text style={styles.meta}>Select at least one pet to assign service.</Text> : null}

        {selectedProviderId ? (
          <Text style={styles.meta}>All selected services in one booking must belong to the same provider.</Text>
        ) : null}

        {catalogQuery.isLoading ? <Text style={styles.meta}>Loading services...</Text> : null}

        {selectedPetRows.map((pet) => {
          const selection = petServiceSelections[pet.id] ?? { providerServiceId: null, quantity: 1 };

          return (
            <View key={pet.id} style={styles.petServiceBlock}>
              <Text style={styles.petServiceName}>{pet.name}</Text>
              <Text style={styles.petServiceBreed}>{pet.breed ?? 'Pet'}</Text>

              <View style={styles.servicesGrid}>
                {displayServices.map((service) => {
                  const isSelected = selection.providerServiceId === service.id;
                  const blockedByLimit = !isSelected && selectedCount >= MAX_SERVICE_SELECTIONS;
                  const blockedByProvider =
                    !isSelected &&
                    selectedProviderId !== null &&
                    service.provider_id !== selectedProviderId;
                  const isBlocked = blockedByLimit || blockedByProvider;

                  return (
                    <Pressable
                      key={`${pet.id}:${service.id}`}
                      style={[
                        styles.serviceCard,
                        isSelected && styles.serviceCardSelected,
                        isBlocked && styles.serviceCardBlocked,
                      ]}
                      onPress={() => {
                        handlePetServiceToggle(pet.id, service.id);
                        setSelectedAddOnQuantities({});
                      }}
                      disabled={isBlocked}
                    >
                      <Text style={styles.serviceName}>{service.service_type}</Text>
                      <Text style={styles.serviceMeta}>{service.service_duration_minutes} mins • From ₹{Math.round(service.base_price)}</Text>
                      <Text style={styles.serviceMeta}>Mode: {toModeLabel(service.service_mode)}</Text>
                      <Text style={styles.serviceMeta}>By {providersById.get(service.provider_id) ?? 'Provider'}</Text>
                      {isBlocked ? (
                        <Text style={styles.serviceBlockedMeta}>
                          {blockedByLimit ? 'Maximum 2 services reached' : 'Choose service from selected provider'}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {selection.providerServiceId ? (
                <View style={styles.petQuantityControl}>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => handlePetQuantityChange(pet.id, selection.quantity - 1)}
                  >
                    <Text style={styles.qtyButtonLabel}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>x{Math.max(1, selection.quantity)}</Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => handlePetQuantityChange(pet.id, selection.quantity + 1)}
                    disabled={selectedCount >= MAX_SERVICE_SELECTIONS}
                  >
                    <Text style={styles.qtyButtonLabel}>+</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {!catalogQuery.isLoading && displayServices.length === 0 ? (
          <Text style={styles.meta}>No services available for booking right now.</Text>
        ) : null}

        <View style={styles.addOnContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.addOnTitle}>ADD-ONS (OPTIONAL)</Text>
            <Text style={styles.selectionCount}>{addOnSelectedCount} selected</Text>
          </View>

          {addOnsQuery.isLoading ? <Text style={styles.meta}>Loading add-ons...</Text> : null}

          {!addOnsQuery.isLoading && serviceAddOns.length === 0 ? (
            <Text style={styles.meta}>No add-ons available for the selected service.</Text>
          ) : null}

          {serviceAddOns.map((addOn) => {
            const quantity = Math.max(0, Math.round(selectedAddOnQuantities[addOn.id] ?? 0));
            const maxQuantity = Math.max(addOn.minQuantity, addOn.maxQuantity);

            return (
              <View key={addOn.id} style={styles.addOnRow}>
                <View style={styles.addOnInfo}>
                  <Text style={styles.addOnName}>{addOn.name}</Text>
                  <Text style={styles.meta}>From ₹{Math.round(Number(addOn.price ?? 0))}</Text>
                </View>

                <View style={styles.addOnQuantityControl}>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => {
                      setSelectedAddOnQuantities((prev) => ({
                        ...prev,
                        [addOn.id]: Math.max(0, quantity - 1),
                      }));
                    }}
                  >
                    <Text style={styles.qtyButtonLabel}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>x{quantity}</Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => {
                      setSelectedAddOnQuantities((prev) => ({
                        ...prev,
                        [addOn.id]: Math.min(maxQuantity, quantity + 1),
                      }));
                    }}
                  >
                    <Text style={styles.qtyButtonLabel}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>IMPORTANT NOTES</Text>
          <Text style={styles.noteText}>• You can add up to 2 total services per booking.</Text>
          <Text style={styles.noteText}>• Add-ons are optional and final add-on availability is confirmed during booking.</Text>
          <Text style={styles.noteText}>• Next step schedules date and slot from real-time provider availability.</Text>
        </View>

        <Text style={styles.footerHint}>Earliest available date from {selectedDateLabel}</Text>

        <Pressable
          style={[styles.primaryButton, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonLabel}>Continue to Schedule</Text>
        </Pressable>
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
    fontSize: 38,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b5f56',
    fontSize: 17,
  },
  meta: {
    color: '#6d635c',
    fontSize: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  selectionCount: {
    color: '#8f4a1d',
    fontSize: 14,
    fontWeight: '700',
  },
  addPetButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddb995',
    backgroundColor: '#fff9f2',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addPetButtonLabel: {
    color: '#c7773b',
    fontSize: 14,
    fontWeight: '700',
  },
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  petCard: {
    width: '48.8%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8d9cb',
    backgroundColor: '#ffffff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  petCardSelected: {
    borderColor: '#d7935e',
    backgroundColor: '#fff4ea',
  },
  petAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e3c7ae',
    backgroundColor: '#fff8ef',
  },
  petAvatarImage: {
    width: '100%',
    height: '100%',
  },
  petAvatarInitial: {
    color: '#c7773b',
    fontSize: 16,
    fontWeight: '700',
  },
  petMetaWrap: {
    flex: 1,
    gap: 2,
  },
  petName: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  petBreed: {
    color: '#6f6359',
    fontSize: 13,
  },
  selectedMark: {
    color: '#c7773b',
    fontSize: 15,
    fontWeight: '900',
  },
  petServiceBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebdfd3',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  petServiceName: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  petServiceBreed: {
    color: '#6f6359',
    fontSize: 13,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceCard: {
    width: '48.8%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eadccf',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  serviceCardSelected: {
    borderColor: '#d99a66',
    backgroundColor: '#fff5eb',
  },
  serviceCardBlocked: {
    opacity: 0.6,
  },
  serviceName: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  serviceMeta: {
    color: '#6f6359',
    fontSize: 13,
  },
  serviceBlockedMeta: {
    color: '#8f4a1d',
    fontSize: 11,
    fontWeight: '700',
  },
  petQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3c7ae',
    backgroundColor: '#fff8ef',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addOnContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eadccf',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  addOnTitle: {
    color: '#9a6a44',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  addOnRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ebdfd3',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  addOnInfo: {
    gap: 2,
  },
  addOnName: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  addOnQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3c7ae',
    backgroundColor: '#fff8ef',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonLabel: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  qtyValue: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8c9ad',
    backgroundColor: '#fff4e9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  noteTitle: {
    color: '#8f4a1d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  noteText: {
    color: '#8f4a1d',
    fontSize: 13,
  },
  footerHint: {
    color: '#7a6a5d',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: '#df8c4f',
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8c9ad',
    backgroundColor: '#fff4e9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  infoTitle: {
    color: '#8f4a1d',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoText: {
    color: '#8f4a1d',
    fontSize: 12,
  },
});
