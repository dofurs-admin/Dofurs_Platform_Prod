import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  ServiceAddOn,
  dofursColors,
  getBookingCatalog,
  getServiceAddOns,
  getStorageSignedReadUrl,
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

type GroomingPackage = {
  title: string;
  price: number;
  mrp: number;
  features: string[];
  serviceTypeKeywords: string[];
};

const GROOMING_PACKAGES: GroomingPackage[] = [
  {
    title: 'Monthly Care', price: 699, mrp: 899,
    features: ['Nail Clipping', 'Nail Grinding', 'Knot Removal', 'Eye & Ear Cleaning', 'Paw Hair Trimming & Cleaning', 'De-shedding'],
    serviceTypeKeywords: ['monthly care', 'monthly hygiene', 'doorstep pet grooming', 'basic package'],
  },
  {
    title: 'Fur Bath Care', price: 999, mrp: 1399,
    features: ['Anti-Tick Medicated Bath', 'Drying', 'Brushing', 'De-shedding', 'De-matting (Knot Removal)'],
    serviceTypeKeywords: ['fur bath care', 'summer pack', 'summer bonanza', 'offer package'],
  },
  {
    title: 'Fur Makeover', price: 1199, mrp: 1499,
    features: ['Hair Cut', 'Paw Hair Cleaning', 'Sanitary Area Hair Cleaning', 'De-matting', 'Brushing', 'Ear & Eye Cleaning', 'De-shedding'],
    serviceTypeKeywords: ['fur makeover', 'fur makeover package'],
  },
  {
    title: 'Essential Grooming', price: 1599, mrp: 1799,
    features: ['Bathing & Drying', 'Shampoo & Conditioning', 'Nail Clipping', 'Paw Hair Cleaning', 'Sanitary Area Cleaning (Hygiene Trim)', 'Brushing & De-shedding', 'De-matting (Knot Removal)', 'Eye Cleaning / Eye Stain Cleaning', 'Paw Moisturizing / Paw Massage', 'Machine Trim (Max 15mm)'],
    serviceTypeKeywords: ['essential grooming'],
  },
  {
    title: 'Complete Care', price: 1999, mrp: 2299,
    features: ['Bathing & Drying', 'Shampoo & Conditioning', 'Brushing & De-shedding', 'De-matting (Knot Removal)', 'Scissor Haircut (as per your preference)', 'Face Styling & Eye Area Trimming', 'Hygiene Trim / Sanitary Area Cleaning', 'Paw Hair Cleaning', 'Nail Clipping & Grinding (Smooth Finish)', 'Paw Moisturizing / Paw Massage', 'Eye Stain & Ear Cleaning', 'Nose Cleaning & Moisturizing', 'Machine Trim (Upto Zero)'],
    serviceTypeKeywords: ['complete care'],
  },
];

function normalizeServiceType(value: string): string {
  return value.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getGroomingPackageByServiceType(serviceType: string): GroomingPackage | null {
  const normalized = normalizeServiceType(serviceType);
  return GROOMING_PACKAGES.find((pkg) =>
    pkg.serviceTypeKeywords.some((keyword) => normalized.includes(normalizeServiceType(keyword))),
  ) ?? null;
}

function resolveImmediatePhotoUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function extractStoragePath(bucket: 'pet-photos', value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const isStoragePath = trimmed.startsWith('/storage/v1/object/');
  if (isAbsolute || isStoragePath) {
    try {
      const parsedUrl = new URL(trimmed, isStoragePath ? 'https://placeholder.local' : undefined);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex(
        (segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
      );
      if (markerIndex === -1) return null;
      const objectSegments = segments.slice(markerIndex + 3);
      const mode = objectSegments[0];
      const offset = mode === 'public' || mode === 'authenticated' || mode === 'sign' ? 1 : (mode === 'render' && objectSegments[1] === 'image' ? 2 : 0);
      const bucketName = objectSegments[offset];
      const pathParts = objectSegments.slice(offset + 1);
      if (bucketName !== bucket || pathParts.length === 0) return null;
      return decodeURIComponent(pathParts.join('/'));
    } catch { return null; }
  }
  const normalized = trimmed.replace(/^\/+/, '');
  const prefixed = `${bucket}/`;
  if (normalized.startsWith(prefixed)) return normalized.slice(prefixed.length);
  return normalized;
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function ProgressBar({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [{ id: 1, label: 'Pets & Service' }, { id: 2, label: 'Schedule' }, { id: 3, label: 'Review' }] as const;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        {steps.map((step, index) => {
          const isCompleted = activeStep > step.id;
          const isActive = activeStep === step.id;
          return (
            <View key={step.id} style={styles.progressStep}>
              <View style={styles.progressNodeRow}>
                {index > 0 ? <View style={[styles.progressBar, (isCompleted || isActive) && styles.progressBarFilled]} /> : null}
                <View style={[styles.progressNode, isCompleted && styles.progressNodeCompleted, isActive && styles.progressNodeActive]}>
                  {isCompleted ? <Ionicons name="checkmark" size={10} color="#ffffff" /> : <View style={[styles.progressNodeDot, (isActive || isCompleted) && styles.progressNodeDotActive]} />}
                </View>
                {index < steps.length - 1 ? <View style={[styles.progressBar, isCompleted && styles.progressBarFilled]} /> : null}
              </View>
              <Text style={[styles.progressLabel, (isActive || isCompleted) && styles.progressLabelActive]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function BookingServiceStep() {
  const router = useRouter();
  const params = useLocalSearchParams<{ providerServiceId?: string; providerId?: string }>();
  const draft = useBookingDraftStore((state) => state.draft);
  const hasHydratedDraft = useBookingDraftStore((state) => state.hasHydratedDraft);
  const setServiceSelection = useBookingDraftStore((state) => state.setServiceSelection);
  const setPetSelection = useBookingDraftStore((state) => state.setPetSelection);
  const setBundleSelections = useBookingDraftStore((state) => state.setBundleSelections);
  const setAddOnSelection = useBookingDraftStore((state) => state.setAddOnSelection);

  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});
  const [serviceInfoModal, setServiceInfoModal] = useState<CatalogService | null>(null);

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

  const displayServices = useMemo(() => {
    const grouped = new Map<string, CatalogService>();
    for (const service of services) {
      const key = service.service_type.trim().toLowerCase();
      if (!key) continue;
      const existing = grouped.get(key);
      if (!existing || service.base_price < existing.base_price) grouped.set(key, service);
    }
    return Array.from(grouped.values()).sort((left, right) => left.service_type.localeCompare(right.service_type, 'en', { sensitivity: 'base' }));
  }, [services]);

  const servicesById = useMemo(() => {
    const map = new Map<string, CatalogService>();
    for (const service of displayServices) map.set(service.id, service);
    return map;
  }, [displayServices]);

  const [selectedPetIds, setSelectedPetIds] = useState<number[]>(() => {
    if (Array.isArray(draft.selectedPetIds) && draft.selectedPetIds.length > 0) return draft.selectedPetIds;
    if (typeof draft.petId === 'number' && Number.isFinite(draft.petId) && draft.petId > 0) return [draft.petId];
    return [];
  });

  const [petServiceSelections, setPetServiceSelections] = useState<Record<number, PetServiceSelection>>(() => {
    const initial: Record<number, PetServiceSelection> = {};
    for (const entry of draft.bundleSelections ?? []) {
      if (!Number.isInteger(entry.petId) || entry.petId <= 0 || typeof entry.providerServiceId !== 'string') continue;
      initial[entry.petId] = { providerServiceId: entry.providerServiceId, quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Math.round(Number(entry.quantity) || 1))) };
    }
    if (Object.keys(initial).length === 0 && typeof draft.petId === 'number' && draft.petId > 0 && typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0) {
      initial[draft.petId] = { providerServiceId: draft.providerServiceId, quantity: 1 };
    }
    return initial;
  });

  const [selectedAddOnQuantities, setSelectedAddOnQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const addOn of draft.addOns ?? []) {
      if (typeof addOn.id !== 'string') continue;
      const quantity = Number(addOn.quantity);
      if (Number.isFinite(quantity) && quantity > 0) map[addOn.id] = Math.round(quantity);
    }
    return map;
  });

  useEffect(() => {
    if (!hasHydratedDraft) return;
    if (Array.isArray(draft.selectedPetIds) && draft.selectedPetIds.length > 0) {
      setSelectedPetIds(draft.selectedPetIds);
    } else if (typeof draft.petId === 'number' && draft.petId > 0) {
      setSelectedPetIds([draft.petId]);
    }
    if (draft.bundleSelections.length > 0) {
      const restored: Record<number, PetServiceSelection> = {};
      for (const entry of draft.bundleSelections) {
        restored[entry.petId] = { providerServiceId: entry.providerServiceId, quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Number(entry.quantity) || 1)) };
      }
      setPetServiceSelections(restored);
      return;
    }
    if (typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0 && typeof draft.petId === 'number' && draft.petId > 0) {
      setPetServiceSelections({ [draft.petId]: { providerServiceId: draft.providerServiceId, quantity: 1 } });
      return;
    }
    if (typeof params.providerServiceId === 'string' && params.providerServiceId.length > 0 && selectedPetIds.length > 0) {
      setPetServiceSelections({ [selectedPetIds[0]]: { providerServiceId: params.providerServiceId, quantity: 1 } });
    }
  }, [draft.bundleSelections, draft.petId, draft.providerServiceId, draft.selectedPetIds, hasHydratedDraft, params.providerServiceId, selectedPetIds]);

  const totalSelectedServices = useMemo(
    () => selectedPetIds.reduce((sum, petId) => { const s = petServiceSelections[petId]; return s?.providerServiceId ? sum + Math.max(1, s.quantity) : sum; }, 0),
    [petServiceSelections, selectedPetIds],
  );

  const primarySelectedServiceId = useMemo(() => {
    for (const petId of selectedPetIds) {
      const id = petServiceSelections[petId]?.providerServiceId;
      if (id && id.length > 0) return id;
    }
    if (typeof params.providerServiceId === 'string' && params.providerServiceId.length > 0) return params.providerServiceId;
    return null;
  }, [params.providerServiceId, petServiceSelections, selectedPetIds]);

  const selectedProviderId = useMemo(() => {
    if (!primarySelectedServiceId) return null;
    const svc = servicesById.get(primarySelectedServiceId);
    return svc ? svc.provider_id : null;
  }, [primarySelectedServiceId, servicesById]);

  // Add-ons: only fetch when a service is actually selected
  const addOnsEnabled = typeof primarySelectedServiceId === 'string' && primarySelectedServiceId.length > 0;
  const addOnsQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'step1-service-addons', primarySelectedServiceId ?? ''],
    queryFn: async () => {
      if (!primarySelectedServiceId) return [] as ServiceAddOn[];
      try {
        const result = await getServiceAddOns(primarySelectedServiceId);
        if (result && typeof result === 'object' && 'success' in result && (result as { success: boolean }).success && Array.isArray((result as { data: ServiceAddOn[] }).data)) {
          return (result as { data: ServiceAddOn[] }).data;
        }
      } catch {
        // Silently return empty — add-ons are optional
      }
      return [] as ServiceAddOn[];
    },
    enabled: addOnsEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  const serviceAddOns = useMemo(() => {
    if (!addOnsEnabled) return [] as ServiceAddOn[];
    const data = addOnsQuery.data;
    if (!Array.isArray(data)) return [] as ServiceAddOn[];
    return data;
  }, [addOnsQuery.data, addOnsEnabled]);

  // Hydrate pet photos
  useEffect(() => {
    let active = true;
    async function hydrate() {
      const nextMap: Record<number, string> = {};
      const rows = pets as PetRow[];
      await Promise.all(rows.map(async (pet) => {
        const immediate = resolveImmediatePhotoUrl(pet.photo_url ?? null);
        if (immediate) { nextMap[pet.id] = immediate; return; }
        if (!pet.photo_url) return;
        const sp = extractStoragePath('pet-photos', pet.photo_url);
        if (!sp) return;
        try {
          const r = await getStorageSignedReadUrl({ bucket: 'pet-photos', path: sp, expiresIn: 3600 });
          if (typeof r.signedUrl === 'string' && r.signedUrl.length > 0) nextMap[pet.id] = r.signedUrl;
        } catch { /* fallback */ }
      }));
      if (active) setPetPhotoUrls(nextMap);
    }
    void hydrate();
    return () => { active = false; };
  }, [pets]);

  const selectedPetRows = useMemo(() => (pets as PetRow[]).filter((p) => selectedPetIds.includes(Number(p.id))), [pets, selectedPetIds]);

  const canContinue = useMemo(() => {
    if (selectedPetIds.length === 0) return false;
    if (totalSelectedServices <= 0) return false;
    return selectedPetIds.every((pid) => Boolean(petServiceSelections[pid]?.providerServiceId));
  }, [petServiceSelections, selectedPetIds, totalSelectedServices]);

  const handlePetToggle = useCallback((petId: number) => {
    setSelectedPetIds((prev) => prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]);
    setPetServiceSelections((prev) => ({ ...prev, [petId]: prev[petId] ?? { providerServiceId: null, quantity: 1 } }));
  }, []);

  const handlePetServiceToggle = useCallback((petId: number, providerServiceId: string) => {
    const service = servicesById.get(providerServiceId);
    if (!service) return;
    setPetServiceSelections((prev) => {
      const cur = prev[petId] ?? { providerServiceId: null, quantity: 1 };
      if (cur.providerServiceId === providerServiceId) return { ...prev, [petId]: { providerServiceId: null, quantity: 1 } };
      const running = selectedPetIds.reduce((sum, pid) => {
        if (pid === petId) return sum;
        const s = prev[pid];
        return s?.providerServiceId ? sum + Math.max(1, s.quantity) : sum;
      }, 0);
      if (running >= MAX_SERVICE_SELECTIONS) return prev;
      if (selectedProviderId && service.provider_id !== selectedProviderId) return prev;
      return { ...prev, [petId]: { providerServiceId, quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, cur.quantity || 1)) } };
    });
  }, [servicesById, selectedPetIds, selectedProviderId]);

  const handlePetQuantityChange = useCallback((petId: number, quantity: number) => {
    setPetServiceSelections((prev) => {
      const cur = prev[petId];
      if (!cur?.providerServiceId) return prev;
      const nq = Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, quantity));
      if (nq === cur.quantity) return prev;
      if (totalSelectedServices + (nq - cur.quantity) > MAX_SERVICE_SELECTIONS) return prev;
      return { ...prev, [petId]: { ...cur, quantity: nq } };
    });
  }, [totalSelectedServices]);

  const handleContinue = useCallback(() => {
    if (!canContinue || selectedPetRows.length === 0) return;
    const bundle = selectedPetIds
      .map((pid) => {
        const s = petServiceSelections[pid];
        if (!s?.providerServiceId) return null;
        return { petId: pid, providerServiceId: s.providerServiceId, quantity: Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Math.round(s.quantity || 1))) };
      })
      .filter((e): e is { petId: number; providerServiceId: string; quantity: number } => Boolean(e));
    if (bundle.length === 0) return;
    const primary = servicesById.get(bundle[0].providerServiceId);
    if (!primary) return;
    setServiceSelection({
      providerServiceId: primary.id, providerId: primary.provider_id,
      bookingMode: primary.service_mode === 'clinic_visit' || primary.service_mode === 'teleconsult' ? primary.service_mode : 'home_visit',
    });
    setPetSelection(bundle[0].petId);
    setBundleSelections({ selectedPetIds, bundleSelections: bundle });
    const addOns = serviceAddOns
      .map((a) => { const q = Number(selectedAddOnQuantities[a.id] ?? 0); if (!Number.isFinite(q) || q <= 0) return null; return { id: a.id, quantity: Math.min(a.maxQuantity, Math.max(a.minQuantity, Math.round(q))) }; })
      .filter((e): e is { id: string; quantity: number } => Boolean(e));
    setAddOnSelection({ addOns });
    router.push('/booking/new/datetime');
  }, [canContinue, selectedPetRows, selectedPetIds, petServiceSelections, servicesById, setServiceSelection, setPetSelection, setBundleSelections, serviceAddOns, selectedAddOnQuantities, setAddOnSelection, router]);

  const selectedCount = totalSelectedServices;
  const addOnSelectedCount = Object.values(selectedAddOnQuantities).filter((q) => q > 0).length;
  const selectedDateLabel = formatDateLabel(new Date().toISOString().slice(0, 10));
  const infoPackage = serviceInfoModal ? getGroomingPackageByServiceType(serviceInfoModal.service_type) : null;

  return (
    <Screen scroll>
      <ProgressBar activeStep={1} />
      <View style={styles.containerCard}>
        <Text style={styles.stepKicker}>Step 1 of 3</Text>
        <Text style={styles.title}>Select Pets & Service</Text>
        <Text style={styles.subtitle}>Choose which pet(s) to book for and what service they need.</Text>

        {/* Pet Selection */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Pets</Text>
          <Pressable style={styles.addPetButton} onPress={() => router.push('/pets/add')}><Text style={styles.addPetButtonLabel}>+ Add Pet</Text></Pressable>
        </View>
        {petsQuery.isLoading ? <Text style={styles.meta}>Loading pets...</Text> : null}
        <View style={styles.petsGrid}>
          {pets.map((pet) => {
            const petId = Number(pet.id ?? NaN);
            if (!Number.isFinite(petId) || petId <= 0) return null;
            const isSelected = selectedPetIds.includes(petId);
            const petName = typeof pet.name === 'string' && pet.name.trim().length > 0 ? pet.name.trim() : `Pet #${petId}`;
            const petBreed = typeof pet.breed === 'string' && pet.breed.trim().length > 0 ? pet.breed.trim() : 'Pet';
            const photoUrl = petPhotoUrls[petId] ?? null;
            return (
              <Pressable key={String(pet.id)} style={[styles.petCard, isSelected && styles.petCardSelected]} onPress={() => handlePetToggle(petId)}>
                <View style={styles.petAvatar}>
                  {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.petAvatarImage} /> : <Text style={styles.petAvatarInitial}>{petName.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={styles.petMetaWrap}><Text style={styles.petName}>{petName}</Text><Text style={styles.petBreed}>{petBreed}</Text></View>
                {isSelected ? <View style={styles.selectedCheckmark}><Ionicons name="checkmark" size={12} color="#ffffff" /></View> : null}
              </Pressable>
            );
          })}
        </View>
        {!petsQuery.isLoading && pets.length === 0 ? <Text style={styles.meta}>No pet profiles found. Add a pet before booking.</Text> : null}

        {/* Service Selection */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Service Per Pet</Text>
          <Text style={styles.selectionCount}>{selectedCount}/{MAX_SERVICE_SELECTIONS} selected</Text>
        </View>
        {selectedPetRows.length === 0 ? <Text style={styles.meta}>Select at least one pet to assign service.</Text> : null}
        {selectedProviderId ? <Text style={styles.meta}>All selected services in one booking must belong to the same provider.</Text> : null}
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
                  const blockedByProvider = !isSelected && selectedProviderId !== null && service.provider_id !== selectedProviderId;
                  const isBlocked = blockedByLimit || blockedByProvider;
                  const pkg = getGroomingPackageByServiceType(service.service_type);
                  const displayPrice = pkg ? pkg.price : Math.round(service.base_price);
                  const displayMrp = pkg ? pkg.mrp : undefined;
                  return (
                    <View key={`${pet.id}:${service.id}`} style={styles.serviceCardWrap}>
                      <Pressable style={[styles.serviceCard, isSelected && styles.serviceCardSelected, isBlocked && styles.serviceCardBlocked]} onPress={() => handlePetServiceToggle(pet.id, service.id)} disabled={isBlocked}>
                        <Text style={styles.serviceName}>{service.service_type}</Text>
                        <View style={styles.servicePriceRow}>
                          <Text style={styles.servicePrice}>₹{displayPrice}</Text>
                          {displayMrp ? <Text style={styles.serviceMrp}>₹{displayMrp}</Text> : null}
                        </View>
                        <Text style={styles.serviceMeta}>{service.service_duration_minutes} mins</Text>
                        {isBlocked ? <Text style={styles.serviceBlockedMeta}>{blockedByLimit ? 'Maximum 2 services reached' : 'Choose service from selected provider'}</Text> : null}
                      </Pressable>
                      <Pressable style={styles.serviceInfoButton} onPress={() => setServiceInfoModal(service)}>
                        <Ionicons name="information-circle-outline" size={18} color="#8f4a1d" />
                      </Pressable>
                      {isSelected && (
                        <View style={styles.petQuantityControl}>
                          <Pressable style={styles.qtyButton} onPress={() => handlePetQuantityChange(pet.id, selection.quantity - 1)}><Text style={styles.qtyButtonLabel}>-</Text></Pressable>
                          <Text style={styles.qtyValue}>x{Math.max(1, selection.quantity)}</Text>
                          <Pressable style={styles.qtyButton} onPress={() => handlePetQuantityChange(pet.id, selection.quantity + 1)} disabled={selectedCount >= MAX_SERVICE_SELECTIONS}><Text style={styles.qtyButtonLabel}>+</Text></Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        {!catalogQuery.isLoading && displayServices.length === 0 ? <Text style={styles.meta}>No services available for booking right now.</Text> : null}

        {/* Add-ons */}
        <View style={styles.addOnContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.addOnTitle}>Add-ons (Optional)</Text>
            <Text style={styles.selectionCount}>{addOnSelectedCount} selected</Text>
          </View>
          {!addOnsEnabled ? <Text style={styles.meta}>Select a service to see available add-ons.</Text> : null}
          {addOnsEnabled && addOnsQuery.isLoading ? <Text style={styles.meta}>Loading add-ons...</Text> : null}
          {addOnsEnabled && !addOnsQuery.isLoading && serviceAddOns.length === 0 ? <Text style={styles.meta}>No add-ons available for the selected service.</Text> : null}
          {serviceAddOns.map((addOn) => {
            const quantity = Math.max(0, Math.round(selectedAddOnQuantities[addOn.id] ?? 0));
            const maxQ = Math.max(addOn.minQuantity, addOn.maxQuantity);
            return (
              <View key={addOn.id} style={styles.addOnRow}>
                <View style={styles.addOnInfo}><Text style={styles.addOnName}>{addOn.name}</Text><Text style={styles.meta}>From ₹{Math.round(Number(addOn.price ?? 0))}</Text></View>
                <View style={styles.addOnQuantityControl}>
                  <Pressable style={styles.qtyButton} onPress={() => setSelectedAddOnQuantities((prev) => ({ ...prev, [addOn.id]: Math.max(0, quantity - 1) }))}><Text style={styles.qtyButtonLabel}>-</Text></Pressable>
                  <Text style={styles.qtyValue}>x{quantity}</Text>
                  <Pressable style={styles.qtyButton} onPress={() => setSelectedAddOnQuantities((prev) => ({ ...prev, [addOn.id]: Math.min(maxQ, quantity + 1) }))}><Text style={styles.qtyButtonLabel}>+</Text></Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Important notes</Text>
          <Text style={styles.noteText}>• You can add up to 2 total services per booking.</Text>
          <Text style={styles.noteText}>• Add-ons are optional and final add-on availability is confirmed during booking.</Text>
          <Text style={styles.noteText}>• Next step schedules date and slot from real-time provider availability.</Text>
        </View>
        <Text style={styles.footerHint}>Earliest available date from {selectedDateLabel}</Text>
        <Pressable style={[styles.primaryButton, !canContinue && styles.buttonDisabled]} onPress={handleContinue} disabled={!canContinue}>
          <Text style={styles.primaryButtonLabel}>Continue to Schedule</Text>
        </Pressable>
      </View>

      {/* Service Info Modal */}
      <Modal visible={Boolean(serviceInfoModal)} transparent animationType="fade" onRequestClose={() => setServiceInfoModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setServiceInfoModal(null)}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{serviceInfoModal?.service_type ?? 'Service details'}</Text>
              <Pressable onPress={() => setServiceInfoModal(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={dofursColors.ink} />
              </Pressable>
            </View>
            {serviceInfoModal ? (
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} bounces={false} showsVerticalScrollIndicator={true}>
                <View style={styles.modalPriceRow}>
                  <Text style={styles.modalPriceText}>{serviceInfoModal.service_duration_minutes} mins • From ₹{Math.round(serviceInfoModal.base_price)}</Text>
                  <Text style={styles.modalPriceHint}>Base service rate before add-ons and provider-specific final pricing.</Text>
                </View>
                {infoPackage ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Included services</Text>
                    {infoPackage.features.map((f) => <Text key={f} style={styles.modalFeatureItem}>• {f}</Text>)}
                  </View>
                ) : <Text style={styles.modalHint}>Included services will be confirmed based on the selected package.</Text>}
                <Text style={styles.modalHint}>Additional services can be included using add-ons.</Text>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: 4, paddingVertical: 8 },
  progressTrack: { flexDirection: 'row', alignItems: 'flex-start' },
  progressStep: { flex: 1, alignItems: 'center', gap: 6 },
  progressNodeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  progressBar: { flex: 1, height: 3, backgroundColor: '#e5d8cd', borderRadius: 2 },
  progressBarFilled: { backgroundColor: dofursColors.coral },
  progressNode: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#d8cec4', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  progressNodeCompleted: { borderColor: dofursColors.coral, backgroundColor: dofursColors.coral },
  progressNodeActive: { borderColor: dofursColors.coral, backgroundColor: '#ffffff' },
  progressNodeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d8cec4' },
  progressNodeDotActive: { backgroundColor: dofursColors.coral },
  progressLabel: { fontSize: 11, color: '#9a9189', fontWeight: '600' },
  progressLabelActive: { color: dofursColors.coral },
  containerCard: { borderRadius: 16, borderWidth: 1, borderColor: '#e7c4a7', backgroundColor: '#fffefb', padding: 12, gap: 10 },
  stepKicker: { color: '#9a6a44', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: dofursColors.ink, fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#6b5f56', fontSize: 14 },
  meta: { color: '#6d635c', fontSize: 13 },
  errorText: { color: dofursColors.error, fontSize: 13 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: dofursColors.ink, fontSize: 16, fontWeight: '700' },
  selectionCount: { color: '#8f4a1d', fontSize: 13, fontWeight: '700' },
  addPetButton: { borderRadius: 999, borderWidth: 1, borderColor: '#ddb995', backgroundColor: '#fff9f2', paddingHorizontal: 14, paddingVertical: 6 },
  addPetButtonLabel: { color: '#c7773b', fontSize: 13, fontWeight: '700' },
  petsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  petCard: { width: '48.8%', borderRadius: 14, borderWidth: 1, borderColor: '#e8d9cb', backgroundColor: '#ffffff', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' },
  petCardSelected: { borderColor: '#d7935e', backgroundColor: '#fff4ea' },
  petAvatar: { width: 36, height: 36, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e3c7ae', backgroundColor: '#fff8ef' },
  petAvatarImage: { width: '100%', height: '100%' },
  petAvatarInitial: { color: '#c7773b', fontSize: 16, fontWeight: '700' },
  petMetaWrap: { flex: 1, gap: 2 },
  petName: { color: dofursColors.ink, fontSize: 13, fontWeight: '700' },
  petBreed: { color: '#6f6359', fontSize: 12 },
  selectedCheckmark: { position: 'absolute', right: 8, top: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#c7773b', alignItems: 'center', justifyContent: 'center' },
  petServiceBlock: { borderRadius: 12, borderWidth: 1, borderColor: '#ebdfd3', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  petServiceName: { color: dofursColors.ink, fontSize: 15, fontWeight: '700' },
  petServiceBreed: { color: '#6f6359', fontSize: 12 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceCardWrap: { width: '48.8%', position: 'relative' },
  serviceCard: { borderRadius: 12, borderWidth: 1, borderColor: '#eadccf', backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 9, gap: 3, paddingRight: 30 },
  serviceCardSelected: { borderColor: '#d99a66', backgroundColor: '#fff5eb' },
  serviceCardBlocked: { opacity: 0.6 },
  serviceName: { color: dofursColors.ink, fontSize: 14, fontWeight: '700' },
  servicePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  servicePrice: { color: dofursColors.ink, fontSize: 15, fontWeight: '700' },
  serviceMrp: { color: '#a89b8e', fontSize: 12, textDecorationLine: 'line-through' },
  serviceMeta: { color: '#6f6359', fontSize: 12 },
  serviceBlockedMeta: { color: '#8f4a1d', fontSize: 10, fontWeight: '700' },
  serviceInfoButton: { position: 'absolute', right: 4, top: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  petQuantityControl: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e3c7ae', backgroundColor: '#fff8ef', paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  addOnContainer: { borderRadius: 12, borderWidth: 1, borderColor: '#eadccf', backgroundColor: '#fffdf9', paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  addOnTitle: { color: '#9a6a44', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  addOnRow: { borderRadius: 10, borderWidth: 1, borderColor: '#ebdfd3', backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  addOnInfo: { gap: 2 },
  addOnName: { color: dofursColors.ink, fontSize: 14, fontWeight: '700' },
  addOnQuantityControl: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e3c7ae', backgroundColor: '#fff8ef', paddingHorizontal: 8, paddingVertical: 4 },
  qtyButton: { width: 24, height: 24, borderRadius: 999, borderWidth: 1, borderColor: '#d7bda8', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  qtyButtonLabel: { color: dofursColors.ink, fontSize: 14, fontWeight: '700' },
  qtyValue: { color: dofursColors.ink, fontSize: 12, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  noteCard: { borderRadius: 12, borderWidth: 1, borderColor: '#e8c9ad', backgroundColor: '#fff4e9', paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  noteTitle: { color: '#8f4a1d', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  noteText: { color: '#8f4a1d', fontSize: 12 },
  footerHint: { color: '#7a6a5d', fontSize: 12 },
  primaryButton: { marginTop: 2, borderRadius: 12, backgroundColor: dofursColors.coral, alignItems: 'center', paddingVertical: 12 },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, width: '100%', maxHeight: '65%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0e8df' },
  modalTitle: { color: dofursColors.ink, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  modalBody: { maxHeight: 280 },
  modalBodyContent: { padding: 20, gap: 16, paddingBottom: 32 },
  modalPriceRow: { borderRadius: 12, borderWidth: 1, borderColor: '#ead8c7', backgroundColor: '#fffdfb', padding: 14, gap: 4 },
  modalPriceText: { color: dofursColors.ink, fontSize: 15, fontWeight: '600' },
  modalPriceHint: { color: '#6e4d35', fontSize: 12 },
  modalSection: { gap: 6 },
  modalSectionTitle: { color: '#9a6a44', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  modalFeatureItem: { color: dofursColors.ink, fontSize: 14, lineHeight: 22 },
  modalHint: { color: '#8f4a1d', fontSize: 12, fontStyle: 'italic' },
});