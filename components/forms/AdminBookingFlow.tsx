'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import AsyncState from '@/components/ui/AsyncState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import AvailabilityCalendar from '@/components/ui/AvailabilityCalendar';
import { apiRequest } from '@/lib/api/client';
import { useToast } from '@/components/ui/ToastProvider';
import { formatSavedAddress } from '@/lib/utils/address';
import {
  PET_AGE_INPUT_MAX_LENGTH,
  PET_AGE_INPUT_PATTERN,
  PET_AGE_VALIDATION_MESSAGE,
  isValidPetAgeValue,
  parsePetAgeInput,
  sanitizePetAgeInput,
} from '@/lib/pets/age';

const LocationPinMap = dynamic(() => import('./LocationPinMap'), { ssr: false });

type BookableUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type Pet = {
  id: number;
  name: string;
};

type PetServiceSelection = {
  serviceType: string | null;
  quantity: number;
};

type CatalogService = {
  id: string;
  provider_id: number;
  service_type: string;
  service_mode?: string | null;
  service_duration_minutes?: number | null;
  base_price: number;
  source: 'provider_services' | 'services';
};

type SavedAddress = {
  id: string;
  label: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

type CatalogDiscount = {
  id: string;
  code: string;
  title: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  max_discount_amount: number | null;
  min_booking_amount: number | null;
  applies_to_service_type: string | null;
  first_booking_only: boolean;
  valid_until: string | null;
};

type ServiceAddonOption = {
  id: string;
  addonTemplateId?: string;
  name: string;
  description: string | null;
  price: number;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  isRequired: boolean;
};

type DiscountPreview = {
  discountId: string;
  code: string;
  title: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountAmount: number;
  baseAmount: number;
  finalAmount: number;
  appliesToServiceType: string | null;
  validUntil: string | null;
};

type AvailabilityServiceSummary = {
  serviceType: string;
  minBasePrice: number;
  maxBasePrice: number;
  providerCount: number;
};

type AvailabilityProvider = {
  providerId: number;
  providerName: string;
  providerType: string | null;
  providerServiceId: string;
  serviceType: string;
  serviceMode: string | null;
  basePrice: number;
  serviceDurationMinutes: number;
  availableSlotCount: number;
  availableForSelectedSlot: boolean;
  recommended: boolean;
};

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  availableProviderCount: number;
  recommended: boolean;
};

type AdminFlowAvailabilityResponse = {
  services: AvailabilityServiceSummary[];
  providers: AvailabilityProvider[];
  slotOptions: AvailabilitySlot[];
  recommendedSlotStartTime: string | null;
  recommendedProviderServiceId: string | null;
  debug?: {
    requested: {
      pincode: string;
      serviceType: string | null;
      serviceTypes: string[];
      bookingMode: string | null;
      bookingDate: string | null;
      startTime: string | null;
      serviceDurationMinutes: number | null;
      strictCoverage: boolean;
      allowCoverageFallback: boolean;
      allowPastSlots?: boolean;
    };
    counts: Record<string, number>;
    exclusions: {
      byBookingMode: Array<{ providerServiceId: string; providerId: number; serviceType: string; serviceMode: string | null }>;
      byRequestedServiceType: Array<{ providerServiceId: string; providerId: number; serviceType: string }>;
      byCoverage: Array<{ providerServiceId: string; providerId: number; serviceType: string; configuredPincodes: string[] }>;
      byNoSlotsOnDate: Array<{ providerServiceId: string; providerId: number; serviceType: string }>;
      bySelectedStartTime: Array<{
        providerServiceId: string;
        providerId: number;
        serviceType: string;
        selectedStartTime: string;
      }>;
    };
  };
};

type BookingCreateResponse = {
  success: boolean;
  booking: { id: number };
};

type BookingConfirmation = {
  bookingIds: number[];
  serviceCount: number;
  customerName: string;
  providerName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  address: string;
  paymentMode: 'cash' | 'subscription_credit';
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  offlineMode: boolean;
};

type CreditEligibilityResponse = {
  eligible: boolean;
  subscriptionId: string | null;
  serviceType: string;
  matchedCreditServiceType: string | null;
  availableCredits: number;
  totalCredits: number;
  reason?: string | null;
};

function formatCreditAmount(value: number) {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

type CreditWalletResponse = {
  balance?: {
    available_inr?: number;
  };
};

type CatalogResponse = {
  actorRole?: 'user' | 'provider' | 'admin' | 'staff' | null;
  canBookForUsers: boolean;
  bookableUsers: BookableUser[];
  selectedUserId: string | null;
  pets: Pet[];
  services?: CatalogService[];
  addresses: SavedAddress[];
  discounts: CatalogDiscount[];
};

type QuickCustomerResponse = {
  success: boolean;
  user: BookableUser;
  isNewUser: boolean;
  inviteSent: boolean;
};

type QuickPetResponse = {
  success: boolean;
  pet: Pet;
};

type BookingMode = 'home_visit' | 'clinic_visit' | 'teleconsult';

type MultiDayAvailabilityResponse = {
  availability?: Array<{
    date: string;
    is_blocked: boolean;
    slots: Array<{ is_available: boolean }>;
  }>;
};

const STEPS = [
  { id: 1, title: 'User & Address' },
  { id: 2, title: 'Service & Discount' },
  { id: 3, title: 'Date & Slot' },
  { id: 4, title: 'Provider Match' },
  { id: 5, title: 'Summary & Create' },
] as const;

const ADD_ADDRESS_OPTION_VALUE = '__add_new_address__';

function resolveBookingMode(value: string | null | undefined): BookingMode {
  if (value === 'clinic_visit' || value === 'teleconsult' || value === 'home_visit') {
    return value;
  }

  return 'home_visit';
}

type AdminBookingFlowProps = {
  defaultMinimized?: boolean;
};

export default function AdminBookingFlow({ defaultMinimized = false }: AdminBookingFlowProps) {
  const { showToast } = useToast();

  const searchParams = useSearchParams();
  const rescheduleQuery = searchParams.get('reschedule');
  const rescheduleBookingId = useMemo(() => {
    if (!rescheduleQuery) return null;
    const parsed = Number.parseInt(rescheduleQuery, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [rescheduleQuery]);
  const availabilityDebugEnabled = searchParams.get('availabilityDebug') === '1';
  const isRescheduleMode = rescheduleBookingId !== null;
  const hasHydratedRescheduleRef = useRef(false);

  const [step, setStep] = useState<(typeof STEPS)[number]['id']>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [apiError, setApiError] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);

  const [bookableUsers, setBookableUsers] = useState<BookableUser[]>([]);
  const [actorRole, setActorRole] = useState<'user' | 'provider' | 'admin' | 'staff' | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [discounts, setDiscounts] = useState<CatalogDiscount[]>([]);

  const [bookingUserSearch, setBookingUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<BookableUser[]>([]);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [customerEntryMode, setCustomerEntryMode] = useState<'search' | 'create'>('search');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerNoEmailInvite, setNewCustomerNoEmailInvite] = useState(true);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const [selectedBookingUserId, setSelectedBookingUserId] = useState<string | null>(null);
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [petServiceSelections, setPetServiceSelections] = useState<Record<number, PetServiceSelection>>({});
  const [isQuickPetFormOpen, setIsQuickPetFormOpen] = useState(false);
  const [quickPetName, setQuickPetName] = useState('');
  const [quickPetBreed, setQuickPetBreed] = useState('');
  const [quickPetAge, setQuickPetAge] = useState('');
  const [quickPetGender, setQuickPetGender] = useState<'' | 'male' | 'female'>('');
  const [quickPetError, setQuickPetError] = useState<string | null>(null);
  const [isSavingQuickPet, setIsSavingQuickPet] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isDetectingAddress, setIsDetectingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState<'Home' | 'Office' | 'Other'>('Other');
  const [newAddressLine1, setNewAddressLine1] = useState('');
  const [newAddressLine2, setNewAddressLine2] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressPincode, setNewAddressPincode] = useState('');
  const [newAddressCountry, setNewAddressCountry] = useState('India');
  const [newAddressLatitude, setNewAddressLatitude] = useState('');
  const [newAddressLongitude, setNewAddressLongitude] = useState('');
  const [newAddressError, setNewAddressError] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState<string>('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [manualDiscountAmountInr, setManualDiscountAmountInr] = useState('');
  const [manualDiscountReason, setManualDiscountReason] = useState('');
  const [serviceAddOns, setServiceAddOns] = useState<ServiceAddonOption[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [isLoadingAddOns, setIsLoadingAddOns] = useState(false);
  const [isAddOnDropdownOpen, setIsAddOnDropdownOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<'cash' | 'subscription_credit'>('cash');
  const [walletBalanceInr, setWalletBalanceInr] = useState(0);
  const [walletCreditsToApply, setWalletCreditsToApply] = useState(0);
  const [isLoadingWalletBalance, setIsLoadingWalletBalance] = useState(false);
  const [creditEligibility, setCreditEligibility] = useState<CreditEligibilityResponse | null>(null);
  const [isCheckingCreditEligibility, setIsCheckingCreditEligibility] = useState(false);
  const [subscriptionCreditUnavailableReason, setSubscriptionCreditUnavailableReason] = useState<string | null>(null);

  const [bookingDate, setBookingDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [slotEndTime, setSlotEndTime] = useState('');
  const [allowPastSlots, setAllowPastSlots] = useState(false);
  const [availableDateOptions, setAvailableDateOptions] = useState<string[]>([]);
  const [isLoadingAvailableDateOptions, setIsLoadingAvailableDateOptions] = useState(false);

  const [providerServiceId, setProviderServiceId] = useState<string | null>(null);
  const [providerNotes, setProviderNotes] = useState('');

  const [availability, setAvailability] = useState<AdminFlowAvailabilityResponse>({
    services: [],
    providers: [],
    slotOptions: [],
    recommendedSlotStartTime: null,
    recommendedProviderServiceId: null,
  });
  const [serviceOptions, setServiceOptions] = useState<AvailabilityServiceSummary[]>([]);
  const availabilityRequestSeqRef = useRef(0);

  const selectedUser = useMemo(
    () => bookableUsers.find((item) => item.id === selectedBookingUserId) ?? null,
    [bookableUsers, selectedBookingUserId],
  );

  const canQuickCreateCustomers = (actorRole === 'admin' || actorRole === 'staff') && !isRescheduleMode;

  const resetNewCustomerForm = useCallback(() => {
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerNoEmailInvite(true);
    setNewCustomerError(null);
  }, []);

  const resetQuickPetForm = useCallback(() => {
    setIsQuickPetFormOpen(false);
    setQuickPetName('');
    setQuickPetBreed('');
    setQuickPetAge('');
    setQuickPetGender('');
    setQuickPetError(null);
  }, []);

  const resetStepTwoToFive = useCallback(() => {
    setServiceType('');
    setPetServiceSelections({});
    setBookingDate('');
    setSlotStartTime('');
    setSlotEndTime('');
    setAllowPastSlots(false);
    setProviderServiceId(null);
    setDiscountCode('');
    setDiscountPreview(null);
    setManualDiscountAmountInr('');
    setManualDiscountReason('');
    setServiceAddOns([]);
    setSelectedAddOns({});
    setIsAddOnDropdownOpen(false);
    setPaymentChoice('cash');
    setWalletCreditsToApply(0);
    setCreditEligibility(null);
    setSubscriptionCreditUnavailableReason(null);
    setProviderNotes('');
    setAvailability({
      services: [],
      providers: [],
      slotOptions: [],
      recommendedSlotStartTime: null,
      recommendedProviderServiceId: null,
    });
    setServiceOptions([]);
    setAvailableDateOptions([]);
    setBookingConfirmation(null);
    setStep(1);
  }, []);

  const prepareAddAddressModal = useCallback(() => {
    setNewAddressLabel('Other');
    setNewAddressLine1('');
    setNewAddressLine2('');
    setNewAddressCity('');
    setNewAddressState('');
    setNewAddressPincode('');
    setNewAddressCountry('India');
    setNewAddressLatitude('');
    setNewAddressLongitude('');
    setNewAddressError(null);
    setShowAddAddressModal(true);
  }, []);

  const selectedAddress = useMemo(
    () => addresses.find((item) => item.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const selectedProvider = useMemo(
    () => availability.providers.find((item) => item.providerServiceId === providerServiceId) ?? null,
    [availability.providers, providerServiceId],
  );

  const selectedPets = useMemo(() => pets.filter((item) => selectedPetIds.includes(item.id)), [pets, selectedPetIds]);

  const totalSelectedServices = useMemo(
    () =>
      selectedPetIds.reduce((sum, selectedPetId) => {
        const selection = petServiceSelections[selectedPetId];
        if (!selection?.serviceType) {
          return sum;
        }

        return sum + Math.max(1, selection.quantity);
      }, 0),
    [petServiceSelections, selectedPetIds],
  );

  const selectedServiceTypesForBundle = useMemo(
    () =>
      Array.from(
        new Set(
          selectedPetIds
            .map((selectedPetId) => petServiceSelections[selectedPetId]?.serviceType?.trim())
            .filter((value): value is string => Boolean(value && value.length > 0)),
        ),
      ),
    [petServiceSelections, selectedPetIds],
  );

  const bookingBundleRows = useMemo(
    () =>
      selectedPets
        .map((pet) => {
          const selection = petServiceSelections[pet.id];
          if (!selection?.serviceType) {
            return null;
          }

          return {
            petId: pet.id,
            petName: pet.name,
            serviceType: selection.serviceType,
            quantity: Math.max(1, selection.quantity),
          };
        })
        .filter((item): item is { petId: number; petName: string; serviceType: string; quantity: number } => Boolean(item)),
    [petServiceSelections, selectedPets],
  );

  const primarySelectedServiceType = useMemo(() => {
    for (const pet of selectedPets) {
      const candidate = petServiceSelections[pet.id]?.serviceType?.trim();
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }, [petServiceSelections, selectedPets]);

  const selectedAddressDisplay = useMemo(() => {
    if (!selectedAddress) {
      return 'Not selected';
    }

    return formatSavedAddress(selectedAddress);
  }, [selectedAddress]);

  const pincode = selectedAddress?.pincode?.trim() ?? '';
  const isFlowCompleted = bookingConfirmation !== null;
  const [isOrchestratorMinimized, setIsOrchestratorMinimized] = useState(() => defaultMinimized && !isRescheduleMode);

  const stepProgress = isFlowCompleted ? 100 : (step / STEPS.length) * 100;
  const availabilityDebug = availability.debug ?? null;

  const summaryBaseAmount = useMemo(() => {
    if (!selectedProvider) {
      return 0;
    }

    let total = 0;
    let hasSelectedService = false;

    for (const selectedPetId of selectedPetIds) {
      const selection = petServiceSelections[selectedPetId];
      if (!selection?.serviceType) {
        continue;
      }

      const selectedServiceType = selection.serviceType;

      const providerService = catalogServices.find(
        (service) =>
          service.provider_id === selectedProvider.providerId &&
          service.source === 'provider_services' &&
          service.service_type.toLowerCase() === selectedServiceType.toLowerCase(),
      );
      const quantity = Math.max(1, selection.quantity);
      total += Math.max(0, Number(providerService?.base_price ?? selectedProvider.basePrice ?? 0)) * quantity;
      hasSelectedService = true;
    }

    return hasSelectedService
      ? total
      : (selectedProvider.basePrice ?? 0) * Math.max(1, totalSelectedServices || 1);
  }, [catalogServices, petServiceSelections, selectedPetIds, selectedProvider, totalSelectedServices]);
  const summaryAddOnAmount = useMemo(
    () =>
      serviceAddOns.reduce((sum, addOn) => {
        const quantity = selectedAddOns[addOn.id] ?? 0;
        return sum + quantity * addOn.price;
      }, 0),
    [selectedAddOns, serviceAddOns],
  );
  const canApplyManualDiscount = actorRole === 'admin' || actorRole === 'staff';
  const promoDiscountAmount = totalSelectedServices > 1 ? 0 : discountPreview?.discountAmount ?? 0;
  const summarySubtotal = summaryBaseAmount + summaryAddOnAmount;
  const manualDiscountCap = Math.max(0, summarySubtotal - promoDiscountAmount);
  const enteredManualDiscountAmount = Number(manualDiscountAmountInr);
  const manualDiscountAmount = canApplyManualDiscount && Number.isFinite(enteredManualDiscountAmount)
    ? Math.min(Math.max(0, Math.floor(enteredManualDiscountAmount)), manualDiscountCap)
    : 0;
  const summaryDiscount = promoDiscountAmount + manualDiscountAmount;
  const summaryTotal = Math.max(0, summarySubtotal - summaryDiscount);
  const summaryPayableAfterWallet = Math.max(0, summaryTotal - walletCreditsToApply);
  const minBookableDate = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    [],
  );
  const maxBookableDate = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + 30);
    return now.toISOString().split('T')[0];
  }, []);

  const resetAddressDependentState = useCallback(() => {
    setPetServiceSelections({});
    setServiceType('');
    setBookingDate('');
    setSlotStartTime('');
    setSlotEndTime('');
    setAllowPastSlots(false);
    setProviderServiceId(null);
    setDiscountCode('');
    setDiscountPreview(null);
    setManualDiscountAmountInr('');
    setManualDiscountReason('');
    setServiceAddOns([]);
    setSelectedAddOns({});
    setIsAddOnDropdownOpen(false);
    setPaymentChoice('cash');
    setWalletCreditsToApply(0);
    setCreditEligibility(null);
    setSubscriptionCreditUnavailableReason(null);
    setServiceAddOns([]);
    setSelectedAddOns({});
    setIsAddOnDropdownOpen(false);
    setAvailableDateOptions([]);
    if (step > 1) {
      setStep(1);
    }
  }, [step]);

  useEffect(() => {
    if (!selectedBookingUserId) {
      setWalletBalanceInr(0);
      setWalletCreditsToApply(0);
      return;
    }

    const bookingUserId = selectedBookingUserId;

    let isMounted = true;

    async function loadWalletBalance() {
      setIsLoadingWalletBalance(true);

      try {
        const payload = await apiRequest<CreditWalletResponse>(
          `/api/user/credit-wallet?userId=${encodeURIComponent(bookingUserId)}`,
        );

        if (!isMounted) {
          return;
        }

        const available = Math.max(0, Math.floor(Number(payload.balance?.available_inr ?? 0)));
        setWalletBalanceInr(available);
      } catch {
        if (isMounted) {
          setWalletBalanceInr(0);
          setWalletCreditsToApply(0);
        }
      } finally {
        if (isMounted) {
          setIsLoadingWalletBalance(false);
        }
      }
    }

    void loadWalletBalance();

    return () => {
      isMounted = false;
    };
  }, [selectedBookingUserId]);

  useEffect(() => {
    setWalletCreditsToApply((previous) => {
      if (paymentChoice === 'subscription_credit') {
        return 0;
      }

      const nextCap = Math.max(0, Math.min(walletBalanceInr, summaryTotal));
      return Math.max(0, Math.min(previous, nextCap));
    });
  }, [paymentChoice, summaryTotal, walletBalanceInr]);

  useEffect(() => {
    if (!selectedBookingUserId || selectedServiceTypesForBundle.length === 0) {
      setCreditEligibility(null);
      setSubscriptionCreditUnavailableReason(null);
      return;
    }

    const bookingUserId = selectedBookingUserId;

    let isMounted = true;

    async function loadCreditEligibility() {
      setIsCheckingCreditEligibility(true);

      try {
        const responses = await Promise.all(
          selectedServiceTypesForBundle.map(async (selectedServiceType) => {
            const params = new URLSearchParams({
              serviceType: selectedServiceType,
              userId: bookingUserId,
            });

            return apiRequest<CreditEligibilityResponse>(`/api/credits/eligibility?${params.toString()}`);
          }),
        );

        if (!isMounted) {
          return;
        }

        const ineligible = responses.find((payload) => !payload.eligible);
        if (ineligible) {
          setCreditEligibility(ineligible);
          setSubscriptionCreditUnavailableReason(
            ineligible.reason ?? 'Subscription credits are not available for one or more selected services.',
          );
          return;
        }

        const primary = responses[0];
        const creditsByBucket = new Map<string, number>();

        for (const response of responses) {
          const bucketKey = (response.matchedCreditServiceType ?? response.serviceType).trim().toLowerCase();
          const existing = creditsByBucket.get(bucketKey) ?? 0;
          creditsByBucket.set(bucketKey, Math.max(existing, Number(response.availableCredits ?? 0)));
        }

        const totalAvailableCredits = Array.from(creditsByBucket.values()).reduce((sum, value) => sum + value, 0);
        const hasEnoughCredits = totalAvailableCredits >= summaryTotal;

        setCreditEligibility({
          ...primary,
          availableCredits: totalAvailableCredits,
          eligible: hasEnoughCredits,
        });

        setSubscriptionCreditUnavailableReason(
          hasEnoughCredits
            ? null
            : `Need ${formatCreditAmount(summaryTotal)} credit value, but only ${formatCreditAmount(totalAvailableCredits)} is available.`,
        );
      } catch {
        if (isMounted) {
          setCreditEligibility(null);
          setSubscriptionCreditUnavailableReason('Unable to verify subscription credit eligibility right now.');
        }
      } finally {
        if (isMounted) {
          setIsCheckingCreditEligibility(false);
        }
      }
    }

    void loadCreditEligibility();

    return () => {
      isMounted = false;
    };
  }, [selectedBookingUserId, selectedServiceTypesForBundle, summaryTotal]);

  useEffect(() => {
    if (paymentChoice === 'subscription_credit' && !creditEligibility?.eligible) {
      setPaymentChoice('cash');
    }
  }, [creditEligibility?.eligible, paymentChoice]);

  const openAddAddressModal = useCallback(() => {
    if (!selectedBookingUserId) {
      showToast('Select a customer first.', 'error');
      return;
    }

    prepareAddAddressModal();
  }, [prepareAddAddressModal, selectedBookingUserId, showToast]);

  const closeAddAddressModal = useCallback(() => {
    setShowAddAddressModal(false);
    setNewAddressError(null);
  }, []);

  const detectCoordinatesFromAddress = useCallback(async () => {
    const addressParts = [newAddressLine1, newAddressLine2, newAddressCity, newAddressState, newAddressPincode, newAddressCountry]
      .map((value) => value.trim())
      .filter(Boolean);

    if (addressParts.length === 0) {
      setNewAddressError('Enter address details first, then detect location.');
      return;
    }

    setIsDetectingAddress(true);
    setNewAddressError(null);

    try {
      const query = encodeURIComponent(addressParts.join(', '));
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Unable to detect location from this address right now.');
      }

      const rows = (await response.json().catch(() => [])) as Array<{ lat?: string; lon?: string }>;
      const firstMatch = rows[0];

      if (!firstMatch?.lat || !firstMatch?.lon) {
        throw new Error('Could not match this address. Try adding more detail.');
      }

      setNewAddressLatitude(firstMatch.lat);
      setNewAddressLongitude(firstMatch.lon);
    } catch (error) {
      setNewAddressError(error instanceof Error ? error.message : 'Unable to detect coordinates.');
    } finally {
      setIsDetectingAddress(false);
    }
  }, [newAddressCity, newAddressCountry, newAddressLine1, newAddressLine2, newAddressPincode, newAddressState]);

  const saveNewAddress = useCallback(async () => {
    if (!selectedBookingUserId) {
      setNewAddressError('Select a customer first.');
      return;
    }

    const addressLine1 = newAddressLine1.trim();
    const city = newAddressCity.trim();
    const state = newAddressState.trim();
    const pincodeValue = newAddressPincode.trim();
    const country = newAddressCountry.trim() || 'India';
    const latitudeValue = Number(newAddressLatitude);
    const longitudeValue = Number(newAddressLongitude);

    if (addressLine1.length < 5) {
      setNewAddressError('Address line 1 must be at least 5 characters.');
      return;
    }

    if (!/^\d{6}$/.test(pincodeValue)) {
      setNewAddressError('Enter a valid 6-digit pincode.');
      return;
    }

    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      setNewAddressError('Set valid latitude and longitude before saving.');
      return;
    }

    setIsSavingAddress(true);
    setNewAddressError(null);

    try {
      const payload = await apiRequest<{ success: boolean; address: SavedAddress }>(
        `/api/bookings/user-addresses?userId=${encodeURIComponent(selectedBookingUserId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            label: newAddressLabel,
            addressLine1,
            addressLine2: newAddressLine2.trim() || undefined,
            city,
            state,
            pincode: pincodeValue,
            country,
            latitude: latitudeValue,
            longitude: longitudeValue,
          }),
        },
      );

      setAddresses((previous) => [payload.address, ...previous]);
      setSelectedAddressId(payload.address.id);
      resetAddressDependentState();
      setShowAddAddressModal(false);
      showToast('Address added for customer.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save address.';
      setNewAddressError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingAddress(false);
    }
  }, [
    newAddressCity,
    newAddressCountry,
    newAddressLabel,
    newAddressLatitude,
    newAddressLine1,
    newAddressLine2,
    newAddressLongitude,
    newAddressPincode,
    newAddressState,
    resetAddressDependentState,
    selectedBookingUserId,
    showToast,
  ]);

  const handlePetToggle = useCallback((nextPetId: number) => {
    setSelectedPetIds((prev) => {
      const exists = prev.includes(nextPetId);
      return exists ? prev.filter((id) => id !== nextPetId) : [...prev, nextPetId];
    });

    setPetServiceSelections((prev) => ({
      ...prev,
      [nextPetId]: prev[nextPetId] ?? { serviceType: null, quantity: 1 },
    }));
  }, []);

  const handlePetServiceChange = useCallback((selectedPetId: number, selectedServiceType: string | null) => {
    setPetServiceSelections((prev) => ({
      ...prev,
      [selectedPetId]: {
        serviceType: selectedServiceType,
        quantity: Math.max(1, prev[selectedPetId]?.quantity ?? 1),
      },
    }));

    setBookingDate('');
    setSlotStartTime('');
    setSlotEndTime('');
    setProviderServiceId(null);
    setDiscountPreview(null);
    setManualDiscountAmountInr('');
    setManualDiscountReason('');
  }, []);

  const handlePetQuantityChange = useCallback((selectedPetId: number, quantity: number) => {
    setPetServiceSelections((prev) => ({
      ...prev,
      [selectedPetId]: {
        serviceType: prev[selectedPetId]?.serviceType ?? null,
        quantity: Math.max(1, Math.min(5, quantity)),
      },
    }));
  }, []);

  const handleApplyServiceToAll = useCallback(
    (nextServiceType: string) => {
      const normalizedServiceType = nextServiceType.trim();

      if (!normalizedServiceType) {
        showToast('Select a primary service first.', 'error');
        return;
      }

      setPetServiceSelections((prev) => {
        const next = { ...prev };
        for (const selectedPetId of selectedPetIds) {
          next[selectedPetId] = {
            serviceType: normalizedServiceType,
            quantity: Math.max(1, prev[selectedPetId]?.quantity ?? 1),
          };
        }
        return next;
      });

      setServiceType(normalizedServiceType);

      setBookingDate('');
      setSlotStartTime('');
      setSlotEndTime('');
      setProviderServiceId(null);
      setDiscountPreview(null);
      setManualDiscountAmountInr('');
      setManualDiscountReason('');
    },
    [selectedPetIds, showToast],
  );

  const suggestedDiscounts = useMemo(() => {
    if (!serviceType) {
      return [] as CatalogDiscount[];
    }

    const normalizedServiceType = serviceType.trim().toLowerCase();

    return discounts.filter((item) => {
      if (item.applies_to_service_type === null) {
        return true;
      }

      return item.applies_to_service_type.trim().toLowerCase() === normalizedServiceType;
    });
  }, [discounts, serviceType]);

  const availableProviderCards = useMemo(() => {
    if (allowPastSlots) {
      return availability.providers;
    }

    if (!bookingDate || !slotStartTime) {
      return availability.providers;
    }

    const providersForSelectedSlot = availability.providers.filter((provider) => provider.availableForSelectedSlot);
    return providersForSelectedSlot.length > 0 ? providersForSelectedSlot : availability.providers;
  }, [allowPastSlots, availability.providers, bookingDate, slotStartTime]);

  const hasProviderForSelectedSlot = useMemo(
    () => availability.providers.some((provider) => provider.availableForSelectedSlot),
    [availability.providers],
  );

  const loadAvailableDateOptions = useCallback(async () => {
    if (allowPastSlots || !pincode || !serviceType || step !== 3) {
      setAvailableDateOptions([]);
      setIsLoadingAvailableDateOptions(false);
      return;
    }

    setIsLoadingAvailableDateOptions(true);

    try {
      let providerIds = Array.from(new Set(availability.providers.map((provider) => provider.providerId))).slice(0, 10);

      if (providerIds.length === 0) {
        const params = new URLSearchParams({ pincode, serviceType });

        if (selectedServiceTypesForBundle.length > 0) {
          params.set('serviceTypes', selectedServiceTypesForBundle.join(','));
        }

        const providerSnapshot = await apiRequest<AdminFlowAvailabilityResponse>(
          `/api/bookings/admin-flow-availability?${params.toString()}`,
        );

        providerIds = Array.from(new Set((providerSnapshot.providers ?? []).map((provider) => provider.providerId))).slice(0, 10);
      }

      if (providerIds.length === 0) {
        setAvailableDateOptions([]);
        return;
      }

      const dateAvailabilityResponses = await Promise.all(
        providerIds.map(async (providerId) => {
          const params = new URLSearchParams({
            providerId: String(providerId),
            fromDate: minBookableDate,
            toDate: maxBookableDate,
          });

          try {
            return await apiRequest<MultiDayAvailabilityResponse>(`/api/bookings/availability-calendar?${params.toString()}`);
          } catch {
            return null;
          }
        }),
      );

      const availableDateSet = new Set<string>();

      for (const response of dateAvailabilityResponses) {
        if (!response?.availability) {
          continue;
        }

        for (const day of response.availability) {
          if (day.is_blocked) {
            continue;
          }

          const hasAvailableSlots = (day.slots ?? []).some((slot) => slot.is_available);
          if (hasAvailableSlots) {
            availableDateSet.add(day.date);
          }
        }
      }

      const sortedAvailableDates = Array.from(availableDateSet)
        .filter((date) => date >= minBookableDate && date <= maxBookableDate)
        .sort((left, right) => left.localeCompare(right));

      setAvailableDateOptions(sortedAvailableDates);

      if (sortedAvailableDates.length === 0) {
        return;
      }

      if (!bookingDate || !sortedAvailableDates.includes(bookingDate)) {
        setBookingDate(sortedAvailableDates[0]);
        setSlotStartTime('');
        setSlotEndTime('');
      }
    } finally {
      setIsLoadingAvailableDateOptions(false);
    }
  }, [
    allowPastSlots,
    availability.providers,
    bookingDate,
    maxBookableDate,
    minBookableDate,
    pincode,
    selectedServiceTypesForBundle,
    serviceType,
    step,
  ]);

  useEffect(() => {
    void loadAvailableDateOptions();
  }, [loadAvailableDateOptions]);

  const loadCatalog = useCallback(async (nextUserId: string | null) => {
    const searchParams = new URLSearchParams();

    if (nextUserId) {
      searchParams.set('userId', nextUserId);
    }

    const payload = await apiRequest<CatalogResponse>(
      `/api/bookings/catalog${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    );

    setActorRole(payload.actorRole ?? null);
    setBookableUsers(payload.bookableUsers ?? []);
    setPets(payload.pets ?? []);
    setCatalogServices(payload.services ?? []);
    setAddresses(payload.addresses ?? []);
    setDiscounts(payload.discounts ?? []);

    const effectiveUserId = nextUserId ?? payload.selectedUserId ?? null;
    setSelectedBookingUserId(effectiveUserId);

    const nextPetId = payload.pets?.[0]?.id ?? null;
    setSelectedPetIds(nextPetId ? [nextPetId] : []);

    const defaultAddress =
      (payload.addresses ?? []).find((item) => item.is_default) ??
      (payload.addresses ?? [])[0] ??
      null;

    setSelectedAddressId(defaultAddress?.id ?? null);

    // Reset downstream choices when user context changes.
    resetStepTwoToFive();
    resetQuickPetForm();

    return payload;
  }, [resetQuickPetForm, resetStepTwoToFive]);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoading(true);
      setApiError(null);

      try {
        await loadCatalog(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load booking catalog.';
        setApiError(message);
        showToast(message, 'error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [loadCatalog, showToast]);

  // --- Reschedule: hydrate form from original booking ---
  useEffect(() => {
    if (isLoading || !rescheduleBookingId || hasHydratedRescheduleRef.current) {
      return;
    }

    hasHydratedRescheduleRef.current = true;

    let isMounted = true;

    async function hydrateReschedule() {
      try {
        const detail = await apiRequest<{
          booking: {
            id: number;
            user_id: string;
            booking_status: string | null;
            status: string;
            service_type: string | null;
            pincode: string | null;
            pets: Array<{ id: string | number }> | null;
          } | null;
        }>(`/api/admin/bookings/${rescheduleBookingId}`);
        const sourceBooking = detail.booking;
        if (!sourceBooking || !isMounted) return;

        const bookingStatus = sourceBooking.booking_status ?? sourceBooking.status ?? '';
        if (bookingStatus !== 'pending' && bookingStatus !== 'confirmed') {
          showToast('Only pending or confirmed bookings can be rescheduled.', 'error');
          return;
        }

        // Load catalog for the booking's user — this resets selections and step
        const userId = sourceBooking.user_id;
        if (!userId) {
          showToast('Booking has no associated user.', 'error');
          return;
        }

        // Fetch catalog for the target user so we have their pets, addresses, and services
        const catalogQuery = new URLSearchParams();
        catalogQuery.set('userId', userId);
        const catalogPayload = await apiRequest<CatalogResponse>(
          `/api/bookings/catalog?${catalogQuery.toString()}`,
        );
        if (!isMounted) return;

        // Apply catalog data
        setBookableUsers(catalogPayload.bookableUsers ?? []);
        setPets(catalogPayload.pets ?? []);
        setCatalogServices(catalogPayload.services ?? []);
        setAddresses(catalogPayload.addresses ?? []);
        setDiscounts(catalogPayload.discounts ?? []);
        setSelectedBookingUserId(userId);

        // Match address from original booking by pincode, falling back to default
        const bookingPincode = sourceBooking.pincode?.trim() ?? '';
        const userAddresses = catalogPayload.addresses ?? [];
        const matchedAddress =
          (bookingPincode ? userAddresses.find((a) => a.pincode?.trim() === bookingPincode) : null) ??
          userAddresses.find((a) => a.is_default) ??
          userAddresses[0] ??
          null;
        setSelectedAddressId(matchedAddress?.id ?? null);

        // Pre-populate pets and service from original booking
        const petIds = (sourceBooking.pets ?? [])
          .map((p: { id: string | number }) => Number(p.id))
          .filter((id: number) => Number.isFinite(id) && id > 0);

        // Verify pets still exist in user's profile
        const catalogPetIds = new Set((catalogPayload.pets ?? []).map((p) => p.id));
        const validPetIds = petIds.filter((id: number) => catalogPetIds.has(id));

        if (validPetIds.length === 0) {
          // Fall back to first available pet
          const fallbackPetId = catalogPayload.pets?.[0]?.id;
          if (fallbackPetId) {
            setSelectedPetIds([fallbackPetId]);
          }
          showToast('Original pets are no longer available. Please select a pet.', 'error');
          setStep(1);
          return;
        }

        setSelectedPetIds(validPetIds);

        const svcType = sourceBooking.service_type?.trim() ?? '';
        if (svcType) {
          const selections: Record<number, PetServiceSelection> = {};
          for (const pid of validPetIds) {
            selections[pid] = { serviceType: svcType, quantity: 1 };
          }
          setPetServiceSelections(selections);
          setServiceType(svcType);
        }

        // Reset date/slot/provider so admin must pick new ones
        setBookingDate('');
        setSlotStartTime('');
        setSlotEndTime('');
        setProviderServiceId(null);
        setDiscountCode('');
        setDiscountPreview(null);
        setManualDiscountAmountInr('');
        setManualDiscountReason('');
        setProviderNotes('');

        // Jump to date & slot step so admin can pick new schedule
        setStep(3);
        showToast(`Rescheduling booking #${rescheduleBookingId}. Select a new date and time.`, 'success');
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Unable to start reschedule flow.';
        showToast(message, 'error');
      }
    }

    void hydrateReschedule();

    return () => {
      isMounted = false;
    };
  }, [isLoading, rescheduleBookingId, showToast]);

  // Cancel original booking after reschedule creates a new one
  const cancelOriginalBookingAfterReschedule = useCallback(
    async (newBookingId?: number) => {
      if (!rescheduleBookingId) return;

      try {
        await apiRequest(`/api/bookings/${rescheduleBookingId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            cancellationReason: newBookingId
              ? `Rescheduled to booking #${newBookingId} by admin`
              : 'Rescheduled by admin from booking flow',
          }),
        });
        } catch (error) {
          if (!newBookingId) {
            throw error;
          }

          try {
            await apiRequest(`/api/bookings/${newBookingId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'cancelled',
                cancellationReason: `Automatic rollback: failed to cancel original booking #${rescheduleBookingId} during admin reschedule`,
              }),
            });

            throw new Error(
              `Reschedule could not complete because original booking #${rescheduleBookingId} could not be cancelled. New booking #${newBookingId} was automatically cancelled.`,
            );
          } catch {
            throw new Error(
              `Reschedule failed after creating booking #${newBookingId}. Original booking #${rescheduleBookingId} is still active and automatic rollback failed. Cancel manually and investigate immediately.`,
            );
          }
      }
    },
      [rescheduleBookingId],
  );

  const refreshAvailability = useCallback(
    async ({
      targetServiceType,
      targetServiceTypes,
      targetDate,
      targetStartTime,
      preserveProviderSelection,
    }: {
      targetServiceType?: string;
      targetServiceTypes?: string[];
      targetDate?: string;
      targetStartTime?: string;
      preserveProviderSelection?: boolean;
    }) => {
      if (!pincode) {
        availabilityRequestSeqRef.current += 1;
        setAvailability({
          services: [],
          providers: [],
          slotOptions: [],
          recommendedSlotStartTime: null,
          recommendedProviderServiceId: null,
        });
        setServiceOptions([]);
        return;
      }

      const query = new URLSearchParams({ pincode });

      if (targetServiceType) {
        query.set('serviceType', targetServiceType);
      }

      if (targetServiceTypes && targetServiceTypes.length > 0) {
        query.set('serviceTypes', targetServiceTypes.join(','));
      }

      if (targetDate) {
        query.set('bookingDate', targetDate);
      }

      if (targetStartTime) {
        query.set('startTime', targetStartTime);
      }

      if (allowPastSlots) {
        query.set('allowPastSlots', 'true');
      }

      if (availabilityDebugEnabled) {
        query.set('debug', 'true');
      }

      const requestSeq = ++availabilityRequestSeqRef.current;
      const payload = await apiRequest<AdminFlowAvailabilityResponse>(`/api/bookings/admin-flow-availability?${query.toString()}`);

      if (requestSeq !== availabilityRequestSeqRef.current) {
        return;
      }

      if (availabilityDebugEnabled && payload.debug && (payload.services.length === 0 || payload.slotOptions.length === 0)) {
        console.info('[AdminBookingFlow] availability-debug', payload.debug);
      }

      if (!targetServiceType && (!targetServiceTypes || targetServiceTypes.length === 0)) {
        setServiceOptions(payload.services);
      } else if ((payload.services?.length ?? 0) > 0) {
        setServiceOptions((previous) => (previous.length > 0 ? previous : payload.services));
      }

      setAvailability(payload);

      if (!targetServiceType) {
        return;
      }

      const keepCurrent = Boolean(
        preserveProviderSelection &&
          providerServiceId &&
          payload.providers.some(
            (item) =>
              item.providerServiceId === providerServiceId &&
              (!targetStartTime || item.availableForSelectedSlot),
          ),
      );

      if (keepCurrent) {
        return;
      }

      setProviderServiceId(payload.recommendedProviderServiceId ?? payload.providers[0]?.providerServiceId ?? null);
    },
    [allowPastSlots, availabilityDebugEnabled, pincode, providerServiceId],
  );

  useEffect(() => {
    if (!pincode) {
      return;
    }

    startTransition(async () => {
      try {
        await refreshAvailability({});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load services for selected area.';
        showToast(message, 'error');
      }
    });
  }, [pincode, refreshAvailability, showToast]);

  useEffect(() => {
    if (selectedPetIds.length === 0) {
      setServiceType('');
      return;
    }

    const primaryServiceType = petServiceSelections[selectedPetIds[0]]?.serviceType ?? '';
    setServiceType(primaryServiceType || '');
  }, [petServiceSelections, selectedPetIds]);

  useEffect(() => {
    if (!serviceType || !pincode) {
      return;
    }

    startTransition(async () => {
      try {
        await refreshAvailability({
          targetServiceType: serviceType,
          targetServiceTypes: selectedServiceTypesForBundle,
          targetDate: bookingDate || undefined,
          targetStartTime: slotStartTime || undefined,
          preserveProviderSelection: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to refresh service availability.';
        showToast(message, 'error');
      }
    });
  }, [allowPastSlots, bookingDate, pincode, refreshAvailability, selectedServiceTypesForBundle, serviceType, slotStartTime, showToast]);

  useEffect(() => {
    if (totalSelectedServices > 1 || !serviceType) {
      setServiceAddOns([]);
      setSelectedAddOns({});
      return;
    }

    const normalizedServiceType = serviceType.trim().toLowerCase();
    const serviceLookupId =
      providerServiceId ??
      availability.providers.find(
        (provider) => provider.serviceType.trim().toLowerCase() === normalizedServiceType,
      )?.providerServiceId ??
      null;

    if (!serviceLookupId) {
      setServiceAddOns([]);
      setSelectedAddOns({});
      return;
    }

    let isMounted = true;

    async function loadServiceAddOns() {
      setIsLoadingAddOns(true);

      try {
        const payload = await apiRequest<{ success: boolean; data: ServiceAddonOption[] }>(
          `/api/services/addons-v2/${serviceLookupId}`,
        );

        if (!isMounted) {
          return;
        }

        const nextOptions = payload.data ?? [];
        setServiceAddOns(nextOptions);

        setSelectedAddOns((previous) => {
          const next: Record<string, number> = {};

          for (const addOn of nextOptions) {
            const minQty = addOn.isRequired ? Math.max(1, addOn.minQuantity) : Math.max(0, addOn.minQuantity);
            const maxQty = Math.max(minQty, addOn.maxQuantity);
            const defaultQty = Math.max(minQty, Math.min(maxQty, addOn.defaultQuantity));
            const previousQty = previous[addOn.id] ?? 0;

            if (addOn.isRequired) {
              next[addOn.id] = Math.max(defaultQty, previousQty, 1);
            } else if (previousQty > 0) {
              next[addOn.id] = Math.max(minQty, Math.min(maxQty, previousQty));
            }
          }

          return next;
        });
      } catch {
        if (isMounted) {
          setServiceAddOns([]);
          setSelectedAddOns({});
        }
      } finally {
        if (isMounted) {
          setIsLoadingAddOns(false);
        }
      }
    }

    void loadServiceAddOns();

    return () => {
      isMounted = false;
    };
  }, [availability.providers, providerServiceId, serviceType, totalSelectedServices]);

  useEffect(() => {
    if (!serviceType) {
      return;
    }

    const serviceStillAvailable = availability.services.some((item) => item.serviceType === serviceType);

    if (serviceStillAvailable) {
      return;
    }

    setServiceType('');
    setPetServiceSelections((previous) => {
      const next = { ...previous };

      for (const selectedPetId of selectedPetIds) {
        const current = next[selectedPetId] ?? { serviceType: null, quantity: 1 };
        next[selectedPetId] = {
          ...current,
          serviceType: null,
        };
      }

      return next;
    });
    setBookingDate('');
    setSlotStartTime('');
    setSlotEndTime('');
    setProviderServiceId(null);
    setDiscountCode('');
    setDiscountPreview(null);
    setManualDiscountAmountInr('');
    setManualDiscountReason('');

    if (pincode) {
      startTransition(async () => {
        try {
          await refreshAvailability({});
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to refresh service availability.';
          showToast(message, 'error');
        }
      });
    }
  }, [availability.services, pincode, refreshAvailability, selectedPetIds, serviceType, showToast]);

  useEffect(() => {
    if (!serviceType) {
      return;
    }

    if (availableProviderCards.length === 0) {
      setProviderServiceId(null);
      return;
    }

    if (providerServiceId && availableProviderCards.some((item) => item.providerServiceId === providerServiceId)) {
      return;
    }

    const recommendedProvider = availableProviderCards.find((item) => item.recommended);
    setProviderServiceId(recommendedProvider?.providerServiceId ?? availableProviderCards[0]?.providerServiceId ?? null);
  }, [availableProviderCards, providerServiceId, serviceType]);

  useEffect(() => {
    if (totalSelectedServices > 1) {
      setDiscountPreview(null);
      return;
    }

    if (!discountCode.trim() || !providerServiceId) {
      return;
    }

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
          method: 'POST',
          body: JSON.stringify({
            providerServiceId,
            discountCode: discountCode.trim().toUpperCase(),
            bookingUserId: selectedBookingUserId ?? undefined,
          }),
        });

        setDiscountPreview(payload.preview ?? null);
      } catch (err) { console.error(err);
        setDiscountPreview(null);
      }
    });
  }, [discountCode, providerServiceId, selectedBookingUserId, totalSelectedServices]);

  async function searchUsers() {
    const query = bookingUserSearch.trim();

    if (query.length < 2) {
      showToast('Enter at least 2 characters to search users.', 'error');
      return;
    }

    setHasSearchedUsers(true);
    setIsSearchingUsers(true);

    try {
      const payload = await apiRequest<{ users?: BookableUser[] }>(`/api/bookings/search-user?query=${encodeURIComponent(query)}`);
      setSearchResults(payload.users ?? []);

      if ((payload.users ?? []).length === 0) {
        showToast('No users found.', 'error');
      }
    } catch (err) { console.error(err);
      setSearchResults([]);
      showToast('User search failed.', 'error');
    } finally {
      setIsSearchingUsers(false);
    }
  }

  async function createQuickCustomer() {
    if (!canQuickCreateCustomers) {
      showToast('Only admin or staff can create customers from this flow.', 'error');
      return;
    }

    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();
    const email = newCustomerEmail.trim().toLowerCase();

    if (name.length < 2) {
      setNewCustomerError('Customer name should be at least 2 characters.');
      return;
    }

    if (phone.replace(/\D/g, '').length < 10) {
      setNewCustomerError('Enter a valid Indian phone number.');
      return;
    }

    if (!newCustomerNoEmailInvite && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewCustomerError('Enter a valid email address or keep phone-only profile selected.');
      return;
    }

    setIsCreatingCustomer(true);
    setNewCustomerError(null);

    try {
      const payload = await apiRequest<QuickCustomerResponse>('/api/bookings/customers/quick-create', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          email: newCustomerNoEmailInvite ? '' : email,
          noEmailInvite: newCustomerNoEmailInvite,
        }),
      });

      const catalogPayload = await loadCatalog(payload.user.id);
      setBookingUserSearch(payload.user.phone ?? payload.user.email ?? payload.user.name ?? '');
      setCustomerEntryMode('search');
      resetNewCustomerForm();
      showToast(
        payload.isNewUser ? 'Customer created and selected.' : 'Existing customer selected for this booking.',
        'success',
      );

      if ((catalogPayload.addresses ?? []).length === 0) {
        prepareAddAddressModal();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create customer.';
      setNewCustomerError(message);
      showToast(message, 'error');
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  async function createQuickPet() {
    if (!selectedBookingUserId) {
      setQuickPetError('Select a customer first.');
      return;
    }

    const name = quickPetName.trim();
    const age = parsePetAgeInput(quickPetAge);

    if (!name) {
      setQuickPetError('Pet name is required.');
      return;
    }

    if (age !== null && !isValidPetAgeValue(age)) {
      setQuickPetError(PET_AGE_VALIDATION_MESSAGE);
      return;
    }

    setIsSavingQuickPet(true);
    setQuickPetError(null);

    try {
      const payload = await apiRequest<QuickPetResponse>(
        `/api/bookings/user-pets?userId=${encodeURIComponent(selectedBookingUserId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            breed: quickPetBreed.trim() || null,
            age,
            gender: quickPetGender || null,
          }),
        },
      );

      resetAddressDependentState();
      setPets((previous) => [payload.pet, ...previous.filter((pet) => pet.id !== payload.pet.id)]);
      setSelectedPetIds((previous) => Array.from(new Set([...previous, payload.pet.id])));
      setPetServiceSelections((previous) => ({
        ...previous,
        [payload.pet.id]: previous[payload.pet.id] ?? { serviceType: null, quantity: 1 },
      }));
      resetQuickPetForm();
      showToast('Pet added for customer.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add pet.';
      setQuickPetError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingQuickPet(false);
    }
  }

  function canMoveToStep(targetStep: (typeof STEPS)[number]['id']) {
    if (targetStep <= step) {
      return true;
    }

    if (step >= 1) {
      if (!selectedBookingUserId || selectedPetIds.length === 0 || !selectedAddressId) {
        showToast('Complete Step 1 before proceeding.', 'error');
        return false;
      }

      if (!pincode) {
        showToast('Selected address must include a valid pincode.', 'error');
        return false;
      }
    }

    if (targetStep >= 3) {
      const hasIncompleteSelection = selectedPetIds.some((selectedPetId) => {
        const selection = petServiceSelections[selectedPetId];
        return !selection?.serviceType || (selection.quantity ?? 0) <= 0;
      });

      if (hasIncompleteSelection || totalSelectedServices === 0 || !serviceType) {
        showToast('Select service and quantity for each pet before choosing slots.', 'error');
        return false;
      }
    }

    if (targetStep >= 4) {
      if (!bookingDate || !slotStartTime || !slotEndTime) {
        showToast('Select booking date, start time, and end time first.', 'error');
        return false;
      }

      if (slotEndTime <= slotStartTime) {
        showToast('End time must be after start time.', 'error');
        return false;
      }
    }

    if (targetStep >= 5 && !providerServiceId) {
      showToast('Select a provider before reviewing summary.', 'error');
      return false;
    }

    return true;
  }

  function goToStep(targetStep: (typeof STEPS)[number]['id']) {
    if (!canMoveToStep(targetStep)) {
      return;
    }

    setStep(targetStep);
  }

  function applyDiscount() {
    if (totalSelectedServices > 1) {
      showToast('Discounts can be applied to single-service bookings only.', 'error');
      return;
    }

    if (!discountCode.trim()) {
      showToast('Enter a discount code.', 'error');
      return;
    }

    if (!providerServiceId) {
      showToast('Select service/date/provider first to validate discount.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
          method: 'POST',
          body: JSON.stringify({
            providerServiceId,
            discountCode: discountCode.trim().toUpperCase(),
            bookingUserId: selectedBookingUserId ?? undefined,
          }),
        });

        if (!payload.preview) {
          setDiscountPreview(null);
          showToast('Discount is not applicable.', 'error');
          return;
        }

        setDiscountPreview(payload.preview);
        setDiscountCode(payload.preview.code);
        showToast('Discount applied.', 'success');
      } catch (error) {
        setDiscountPreview(null);
        const message = error instanceof Error ? error.message : 'Unable to apply discount.';
        showToast(message, 'error');
      }
    });
  }

  function clearDiscount() {
    setDiscountCode('');
    setDiscountPreview(null);
  }

  function submitBooking() {
    if (!selectedBookingUserId || selectedPetIds.length === 0 || !selectedAddress || !providerServiceId || !selectedProvider || !bookingDate || !slotStartTime || !slotEndTime) {
      showToast('Please complete all steps before creating booking.', 'error');
      return;
    }

    if (slotEndTime <= slotStartTime) {
      showToast('End time must be after start time.', 'error');
      return;
    }

    const bookingMode = resolveBookingMode(selectedProvider.serviceMode);

    if (bookingMode === 'home_visit' && (selectedAddress.latitude === null || selectedAddress.longitude === null)) {
      showToast('Selected address must include map coordinates for home visit booking.', 'error');
      return;
    }

    const providerSupportedTypes = new Set(
      catalogServices
        .filter((service) => service.provider_id === selectedProvider.providerId && service.source === 'provider_services')
        .map((service) => service.service_type.toLowerCase()),
    );

    const requiredServiceTypes = new Set(
      selectedPetIds
        .map((selectedPetId) => petServiceSelections[selectedPetId]?.serviceType?.toLowerCase() ?? null)
        .filter((value): value is string => Boolean(value)),
    );

    const hasUnsupportedType = Array.from(requiredServiceTypes).some((type) => !providerSupportedTypes.has(type));
    if (hasUnsupportedType) {
      showToast('Selected provider does not support all chosen grooming services.', 'error');
      return;
    }

    const bundleEntries: Array<{ petId: number; providerServiceId: string; durationMinutes: number; basePrice: number }> = [];

    for (const selectedPetId of selectedPetIds) {
      const selection = petServiceSelections[selectedPetId];

      if (!selection?.serviceType) {
        showToast('Each selected pet needs a service assignment.', 'error');
        return;
      }

      const selectedServiceType = selection.serviceType;

      const providerService = catalogServices.find(
        (service) =>
          service.provider_id === selectedProvider.providerId &&
          service.source === 'provider_services' &&
          service.service_type.toLowerCase() === selectedServiceType.toLowerCase(),
      );

      if (!providerService) {
        showToast(`Provider service mapping missing for ${selectedServiceType}.`, 'error');
        return;
      }

      const quantity = Math.max(1, selection.quantity);
      const duration = providerService.service_duration_minutes ?? 30;

      for (let index = 0; index < quantity; index += 1) {
        bundleEntries.push({
          petId: selectedPetId,
          providerServiceId: providerService.id,
          durationMinutes: duration,
          basePrice: Math.max(0, Number(providerService.base_price ?? 0)),
        });
      }
    }

    if (bundleEntries.length === 0) {
      showToast('Please select at least one service.', 'error');
      return;
    }

    if (paymentChoice === 'subscription_credit' && !creditEligibility?.eligible) {
      showToast(
        subscriptionCreditUnavailableReason ?? 'Subscription credit is not available for this booking.',
        'error',
      );
      return;
    }

    const normalizedAddOns = Object.entries(selectedAddOns)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ id, quantity }));

    const bundleSummary =
      bundleEntries.length > 1
        ? [
            `Bundled services (${bundleEntries.length})`,
            ...bundleEntries.map((entry, index) => `${index + 1}. Pet ${entry.petId} | Service ${entry.providerServiceId}`),
          ].join('\n')
        : null;

    const trimmedProviderNotes = providerNotes.trim();

    startTransition(async () => {
      try {
        const useSubscriptionCredit = paymentChoice === 'subscription_credit';
        const totalBundleAmount = bundleEntries.reduce((sum, entry) => sum + entry.basePrice, 0) + summaryAddOnAmount;
        const firstEntry = bundleEntries[0];

        const result = await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify({
            petId: firstEntry.petId,
            providerId: selectedProvider.providerId,
            providerServiceId: firstEntry.providerServiceId,
            bookingDate,
            startTime: slotStartTime,
            endTime: allowPastSlots ? slotEndTime : undefined,
            bookingMode,
            locationAddress: bookingMode === 'home_visit' ? formatSavedAddress(selectedAddress) : null,
            latitude: bookingMode === 'home_visit' ? selectedAddress.latitude : null,
            longitude: bookingMode === 'home_visit' ? selectedAddress.longitude : null,
            providerNotes: trimmedProviderNotes || null,
            bookingUserId: selectedBookingUserId,
            discountCode: bundleEntries.length === 1 && discountCode.trim() ? discountCode.trim().toUpperCase() : undefined,
            manualDiscountAmountInr: manualDiscountAmount > 0 ? manualDiscountAmount : undefined,
            manualDiscountReason: manualDiscountAmount > 0 && manualDiscountReason.trim()
              ? manualDiscountReason.trim()
              : undefined,
            addOns: normalizedAddOns.length > 0 ? normalizedAddOns : undefined,
            useSubscriptionCredit,
            walletCreditsAppliedInr: !useSubscriptionCredit && walletCreditsToApply > 0 ? walletCreditsToApply : undefined,
            paymentMode: useSubscriptionCredit ? 'platform' : 'direct_to_provider',
            allowPastBooking: allowPastSlots,
            bundleEstimatedTotalInr: bundleEntries.length > 1 ? Math.max(1, Math.round(totalBundleAmount)) : undefined,
            bundleSummary: bundleEntries.length > 1 ? bundleSummary ?? undefined : undefined,
            bundleProviderServiceIds:
              bundleEntries.length > 1
                ? Array.from(new Set(bundleEntries.map((entry) => entry.providerServiceId)))
                : undefined,
          }),
        });

        const createdBookingIds = result.booking?.id ? [result.booking.id] : [];

        // In reschedule mode, cancel the original booking after new one is created
        if (isRescheduleMode) {
          await cancelOriginalBookingAfterReschedule(result.booking?.id);
          showToast(
            `Booking rescheduled successfully. Old booking #${rescheduleBookingId} cancelled.`,
            'success',
          );
        } else {
          showToast(
            bundleEntries.length === 1
              ? 'Booking created successfully.'
              : `Booking created successfully with ${bundleEntries.length} bundled service items.`,
            'success',
          );
        }

        setBookingConfirmation({
          bookingIds: createdBookingIds,
          serviceCount: bundleEntries.length,
          customerName: selectedUser?.name?.trim() || selectedUser?.email || selectedUser?.id || 'Unknown customer',
          providerName: selectedProvider.providerName,
          bookingDate,
          startTime: slotStartTime,
          endTime: slotEndTime,
          address: formatSavedAddress(selectedAddress),
          paymentMode: paymentChoice,
          totalAmount: summaryBaseAmount + summaryAddOnAmount,
          discountAmount: summaryDiscount,
          netAmount: summaryPayableAfterWallet,
          offlineMode: allowPastSlots,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Booking failed.';
        showToast(message, 'error');
      }
    });
  }

  return (
    <AsyncState
      isLoading={isLoading}
      isError={Boolean(apiError)}
      errorMessage={apiError}
      loadingFallback={<div className="rounded-2xl bg-white p-6"><LoadingSkeleton lines={6} /></div>}
    >
      <div className="space-y-5" data-flow-state={isPending ? 'working' : 'ready'}>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 sm:text-xl">
                {isRescheduleMode ? `Reschedule Booking #${rescheduleBookingId}` : 'Admin Booking Orchestrator'}
              </h3>
              <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
                {isRescheduleMode
                  ? 'Pick a new date, time slot, and provider for this booking.'
                  : 'Structured 5-step flow with pincode-aware service, slot, and provider matching.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOrchestratorMinimized((previous) => !previous)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-300"
              aria-expanded={!isOrchestratorMinimized}
            >
              {isOrchestratorMinimized ? 'Expand' : 'Minimize'}
            </button>
          </div>

          {!isOrchestratorMinimized ? (
            <>
              <div className="pb-1">
            <div className="flex flex-wrap items-center gap-2 sm:inline-flex sm:min-w-max sm:gap-2">
              {STEPS.map((item, index) => {
                const isActive = !isFlowCompleted && item.id === step;
                const isCompleted = isFlowCompleted || item.id < step;

                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToStep(item.id)}
                      disabled={isFlowCompleted}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition disabled:cursor-default sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm ${
                        isActive
                          ? 'border-coral bg-orange-50 text-neutral-900'
                          : isCompleted
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-coral/60'
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs ${
                          isActive
                            ? 'bg-coral text-white'
                            : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {item.id}
                      </span>
                      <span className="whitespace-nowrap sm:hidden">{item.title.replace(' & ', ' ').split(' ')[0]}</span>
                      <span className="hidden whitespace-nowrap sm:inline">{item.title}</span>
                    </button>

                    {index < STEPS.length - 1 ? <span className="hidden h-px w-6 bg-neutral-300 sm:block" aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                isFlowCompleted
                  ? 'bg-emerald-500'
                  : 'bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)]'
              }`}
              style={{ width: `${stepProgress}%` }}
            />
          </div>

          {bookingConfirmation ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <h4 className="text-base font-semibold text-emerald-900">Booking Confirmed</h4>
              <p className="mt-1 text-sm text-emerald-800">Your booking has been created successfully.</p>
              <div className="mt-3 grid gap-2 text-xs text-emerald-900 sm:grid-cols-2">
                <p>
                  <span className="font-semibold">{bookingConfirmation.bookingIds.length === 1 ? 'Booking ID' : 'Booking IDs'}:</span>{' '}
                  {bookingConfirmation.bookingIds.join(', ') || '—'}
                </p>
                {bookingConfirmation.serviceCount > 1 ? (
                  <p><span className="font-semibold">Service Items:</span> {bookingConfirmation.serviceCount}</p>
                ) : null}
                <p><span className="font-semibold">Customer:</span> {bookingConfirmation.customerName}</p>
                <p><span className="font-semibold">Provider:</span> {bookingConfirmation.providerName}</p>
                <p><span className="font-semibold">Date:</span> {bookingConfirmation.bookingDate}</p>
                <p><span className="font-semibold">Time:</span> {bookingConfirmation.startTime} - {bookingConfirmation.endTime}</p>
                <p><span className="font-semibold">Payment Mode:</span> {bookingConfirmation.paymentMode === 'subscription_credit' ? 'Subscription Credit' : 'Cash'}</p>
                <p><span className="font-semibold">Service Total:</span> Rs.{bookingConfirmation.totalAmount}</p>
                <p><span className="font-semibold">Discount:</span> Rs.{bookingConfirmation.discountAmount}</p>
                <p className="sm:col-span-2"><span className="font-semibold">Amount Payable:</span> Rs.{bookingConfirmation.netAmount}</p>
                <p className="sm:col-span-2"><span className="font-semibold">Address:</span> {bookingConfirmation.address}</p>
                {bookingConfirmation.offlineMode ? <p className="sm:col-span-2 font-semibold">Offline manual booking mode was used.</p> : null}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setBookingConfirmation(null);
                    startTransition(async () => {
                      await loadCatalog(selectedBookingUserId);
                    });
                  }}
                  className="h-10 rounded-xl bg-coral px-4 text-sm font-semibold text-white"
                >
                  Start New Booking
                </button>
              </div>
            </section>
          ) : null}

          {availabilityDebugEnabled && (step === 2 || step === 3) && availabilityDebug ? (
            <details className="rounded-xl border border-amber-200 bg-amber-50/80 p-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-amber-900">Availability Debug</summary>
              <p className="mt-1 text-xs text-amber-800">
                Use this to verify why services/providers/slots were filtered for the current selection.
              </p>

              <div className="mt-3 grid gap-2 text-xs text-amber-900 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Pincode</p>
                  <p>{availabilityDebug.requested.pincode}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Service Type</p>
                  <p>{availabilityDebug.requested.serviceType ?? 'Any'}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Booking Date</p>
                  <p>{availabilityDebug.requested.bookingDate ?? 'Not selected'}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Selected Start Time</p>
                  <p>{availabilityDebug.requested.startTime ?? 'Not selected'}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Strict Coverage</p>
                  <p>{availabilityDebug.requested.strictCoverage ? 'Yes' : 'No'}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Coverage Fallback</p>
                  <p>{availabilityDebug.requested.allowCoverageFallback ? 'Yes' : 'No'}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="font-semibold">Allow Past Slots</p>
                  <p>{availabilityDebug.requested.allowPastSlots ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-2">
                <p className="text-xs font-semibold text-amber-900">Pipeline Counts</p>
                <div className="mt-2 grid gap-1 text-xs text-amber-900 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(availabilityDebug.counts).map(([key, value]) => (
                    <p key={key}>
                      <span className="font-medium">{key}:</span> {value}
                    </p>
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="text-xs font-semibold text-amber-900">
                    Excluded by Coverage ({availabilityDebug.exclusions.byCoverage.length})
                  </p>
                  {availabilityDebug.exclusions.byCoverage.length > 0 ? (
                    <pre className="mt-2 max-h-28 overflow-auto rounded bg-amber-100/60 p-2 text-[10px] text-amber-950">
                      {JSON.stringify(availabilityDebug.exclusions.byCoverage.slice(0, 6), null, 2)}
                    </pre>
                  ) : null}
                </div>

                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="text-xs font-semibold text-amber-900">
                    Excluded by Service Type ({availabilityDebug.exclusions.byRequestedServiceType.length})
                  </p>
                  {availabilityDebug.exclusions.byRequestedServiceType.length > 0 ? (
                    <pre className="mt-2 max-h-28 overflow-auto rounded bg-amber-100/60 p-2 text-[10px] text-amber-950">
                      {JSON.stringify(availabilityDebug.exclusions.byRequestedServiceType.slice(0, 6), null, 2)}
                    </pre>
                  ) : null}
                </div>

                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="text-xs font-semibold text-amber-900">
                    No Slots On Date ({availabilityDebug.exclusions.byNoSlotsOnDate.length})
                  </p>
                  {availabilityDebug.exclusions.byNoSlotsOnDate.length > 0 ? (
                    <pre className="mt-2 max-h-28 overflow-auto rounded bg-amber-100/60 p-2 text-[10px] text-amber-950">
                      {JSON.stringify(availabilityDebug.exclusions.byNoSlotsOnDate.slice(0, 6), null, 2)}
                    </pre>
                  ) : null}
                </div>

                <div className="rounded-lg border border-amber-200 bg-white/70 p-2">
                  <p className="text-xs font-semibold text-amber-900">
                    Not Matching Selected Time ({availabilityDebug.exclusions.bySelectedStartTime.length})
                  </p>
                  {availabilityDebug.exclusions.bySelectedStartTime.length > 0 ? (
                    <pre className="mt-2 max-h-28 overflow-auto rounded bg-amber-100/60 p-2 text-[10px] text-amber-950">
                      {JSON.stringify(availabilityDebug.exclusions.bySelectedStartTime.slice(0, 6), null, 2)}
                    </pre>
                  ) : null}
                </div>
              </div>
            </details>
          ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              Orchestrator is minimized. Click Expand to continue creating or rescheduling bookings.
            </p>
          )}
        </div>

        {!isOrchestratorMinimized && !isFlowCompleted && step === 1 ? (
          <section className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-900 sm:text-base">Step 1. Select User, Pet, Address</h4>
            <p className="mt-1 text-xs text-neutral-600 sm:text-sm">Search customer, then choose pet and exact service address.</p>

            {canQuickCreateCustomers ? (
              <div className="mt-3 grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerEntryMode('search');
                    setNewCustomerError(null);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                    customerEntryMode === 'search' ? 'border-coral bg-white text-neutral-900' : 'border-transparent text-neutral-600 hover:bg-white'
                  }`}
                >
                  Search existing customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerEntryMode('create');
                    setHasSearchedUsers(false);
                    setSearchResults([]);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                    customerEntryMode === 'create' ? 'border-coral bg-white text-neutral-900' : 'border-transparent text-neutral-600 hover:bg-white'
                  }`}
                >
                  Create new customer
                </button>
              </div>
            ) : null}

            {customerEntryMode === 'create' && canQuickCreateCustomers ? (
              <form
                className="mt-3 rounded-xl border border-coral/30 bg-orange-50/70 p-3 sm:mt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createQuickCustomer();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Customer name
                    <input
                      value={newCustomerName}
                      onChange={(event) => setNewCustomerName(event.target.value)}
                      placeholder="Customer full name"
                      className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Phone
                    <input
                      value={newCustomerPhone}
                      onChange={(event) => setNewCustomerPhone(event.target.value)}
                      placeholder="9876543210 or +919876543210"
                      className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                    />
                  </label>
                </div>

                <label className="mt-3 inline-flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newCustomerNoEmailInvite}
                    onChange={(event) => {
                      setNewCustomerNoEmailInvite(event.target.checked);
                      if (event.target.checked) {
                        setNewCustomerEmail('');
                      }
                    }}
                    className="mt-0.5"
                  />
                  <span>Create phone-only profile without email invite.</span>
                </label>

                {!newCustomerNoEmailInvite ? (
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Email
                    <input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(event) => setNewCustomerEmail(event.target.value)}
                      placeholder="customer@example.com"
                      className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                    />
                  </label>
                ) : null}

                {newCustomerError ? <p className="mt-3 text-xs font-medium text-red-600">{newCustomerError}</p> : null}

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetNewCustomerForm}
                    disabled={isCreatingCustomer}
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 disabled:opacity-60"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCustomer}
                    className="h-10 rounded-xl bg-coral px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isCreatingCustomer ? 'Creating...' : 'Create & select'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <form
                  className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void searchUsers();
                  }}
                >
                  <input
                    value={bookingUserSearch}
                    onChange={(event) => setBookingUserSearch(event.target.value)}
                    placeholder="Search customer by name, phone, or email"
                    className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm sm:h-11"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingUsers}
                    className="h-10 w-full rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:border-coral/60 sm:h-11 sm:w-auto"
                  >
                    {isSearchingUsers ? 'Searching...' : 'Search'}
                  </button>
                </form>

                <div className="mt-2 max-h-44 space-y-2 overflow-auto rounded-xl border border-neutral-200 p-2 sm:mt-3 sm:max-h-48">
                  {isSearchingUsers ? <p className="text-xs text-neutral-500">Searching users...</p> : null}
                  {!isSearchingUsers && !hasSearchedUsers ? <p className="text-xs text-neutral-500">Search for a customer to begin.</p> : null}
                  {!isSearchingUsers && hasSearchedUsers && searchResults.length === 0 ? (
                    <p className="text-xs text-neutral-500">No matching users.</p>
                  ) : null}
                  {searchResults.map((item) => {
                    const selected = selectedBookingUserId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            await loadCatalog(item.id);
                          });
                        }}
                        className={`flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm sm:flex-row sm:items-center sm:justify-between ${
                          selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                        }`}
                      >
                        <span className="font-medium text-neutral-900">{item.name?.trim() || item.email || item.phone || item.id}</span>
                        <span className="flex flex-wrap gap-2 text-xs text-neutral-500">
                          {item.phone ? <span>{item.phone}</span> : null}
                          {item.email ? <span>{item.email}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {selectedUser ? (
              <div className="mt-4 rounded-xl border border-coral/30 bg-orange-50 px-3 py-2 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">Selected customer: {selectedUser.name?.trim() || selectedUser.email || selectedUser.phone || selectedUser.id}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-600">
                  {selectedUser.phone ? <span>{selectedUser.phone}</span> : null}
                  {selectedUser.email ? <span>{selectedUser.email}</span> : null}
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">Pets</label>
                  {canQuickCreateCustomers && selectedUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickPetFormOpen((current) => !current);
                        setQuickPetError(null);
                      }}
                      className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:border-coral/50"
                    >
                      {isQuickPetFormOpen ? 'Close' : 'Quick add pet'}
                    </button>
                  ) : null}
                </div>
                {isQuickPetFormOpen ? (
                  <div className="mb-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Pet name
                        <input
                          value={quickPetName}
                          onChange={(event) => setQuickPetName(event.target.value)}
                          placeholder="Pet name"
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Breed
                        <input
                          value={quickPetBreed}
                          onChange={(event) => setQuickPetBreed(event.target.value)}
                          placeholder="Optional"
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Age
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern={PET_AGE_INPUT_PATTERN}
                          maxLength={PET_AGE_INPUT_MAX_LENGTH}
                          value={quickPetAge}
                          onChange={(event) => setQuickPetAge(sanitizePetAgeInput(event.target.value))}
                          placeholder="Optional"
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Gender
                        <select
                          value={quickPetGender}
                          onChange={(event) => setQuickPetGender(event.target.value as '' | 'male' | 'female')}
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                        >
                          <option value="">Optional</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </label>
                    </div>
                    {quickPetError ? <p className="mt-2 text-xs font-medium text-red-600">{quickPetError}</p> : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={resetQuickPetForm}
                        disabled={isSavingQuickPet}
                        className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void createQuickPet()}
                        disabled={isSavingQuickPet}
                        className="h-9 rounded-xl bg-coral px-3 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {isSavingQuickPet ? 'Adding...' : 'Add pet'}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-neutral-200 p-2">
                  {pets.length === 0 ? <p className="text-xs text-neutral-500">No pets available</p> : null}
                  {pets.map((pet) => {
                    const selected = selectedPetIds.includes(pet.id);
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => handlePetToggle(pet.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                          selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                        }`}
                      >
                        <span className="font-medium text-neutral-900">{pet.name}</span>
                        <span className="text-xs text-neutral-600">{selected ? 'Selected' : 'Select'}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-neutral-600">{selectedPetIds.length} pets selected</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Address</label>
                <select
                  value={selectedAddressId ?? ''}
                  onChange={(event) => {
                    const nextAddressId = event.target.value || null;

                    if (nextAddressId === ADD_ADDRESS_OPTION_VALUE) {
                      openAddAddressModal();
                      return;
                    }

                    setSelectedAddressId(nextAddressId);
                    resetAddressDependentState();
                  }}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                >
                  {addresses.length === 0 ? <option value="">No saved addresses</option> : null}
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label ?? 'Address'} - {address.address_line_1} ({address.pincode || 'No pincode'})
                    </option>
                  ))}
                  <option value={ADD_ADDRESS_OPTION_VALUE}>+ Add new address</option>
                </select>
                <p className="mt-1 text-xs text-neutral-500">Tip: choose + Add new address to create and save a fresh address for this customer.</p>
              </div>
            </div>

            {showAddAddressModal ? (
              <div className="fixed inset-0 z-[120] flex items-end justify-center bg-neutral-900/50 p-4 sm:items-center">
                <div className="w-full max-w-2xl rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl">
                  <div className="border-b border-neutral-200 px-5 py-4">
                    <h5 className="text-base font-semibold text-neutral-900">Add New Address For Customer</h5>
                    <p className="mt-1 text-xs text-neutral-600">Save a complete address so availability can be matched by pincode.</p>
                  </div>

                  <div className="max-h-[70vh] space-y-3 overflow-auto px-5 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Label
                        <select
                          value={newAddressLabel}
                          onChange={(event) => setNewAddressLabel(event.target.value as 'Home' | 'Office' | 'Other')}
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                        >
                          <option value="Home">Home</option>
                          <option value="Office">Office</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Pincode
                        <input
                          value={newAddressPincode}
                          onChange={(event) => setNewAddressPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="560100"
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                        />
                      </label>
                    </div>

                    <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Address line 1
                      <input
                        value={newAddressLine1}
                        onChange={(event) => setNewAddressLine1(event.target.value)}
                        placeholder="House / Street / Area"
                        className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                      />
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Address line 2 (optional)
                      <input
                        value={newAddressLine2}
                        onChange={(event) => setNewAddressLine2(event.target.value)}
                        placeholder="Landmark / Building"
                        className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        City
                        <input
                          value={newAddressCity}
                          onChange={(event) => setNewAddressCity(event.target.value)}
                          placeholder="Bengaluru"
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        State
                        <input
                          value={newAddressState}
                          onChange={(event) => setNewAddressState(event.target.value)}
                          placeholder="Karnataka"
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Country
                        <input
                          value={newAddressCountry}
                          onChange={(event) => setNewAddressCountry(event.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Coordinates</p>
                        <button
                          type="button"
                          onClick={() => void detectCoordinatesFromAddress()}
                          disabled={isDetectingAddress}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-coral/50 disabled:opacity-60"
                        >
                          {isDetectingAddress ? 'Detecting...' : 'Detect from address'}
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Latitude
                          <input
                            value={newAddressLatitude}
                            onChange={(event) => setNewAddressLatitude(event.target.value)}
                            placeholder="12.971599"
                            className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                          />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Longitude
                          <input
                            value={newAddressLongitude}
                            onChange={(event) => setNewAddressLongitude(event.target.value)}
                            placeholder="77.594566"
                            className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                          />
                        </label>
                      </div>

                      <div className="mt-3">
                        <LocationPinMap
                          latitude={newAddressLatitude}
                          longitude={newAddressLongitude}
                          onChange={(lat, lng) => {
                            setNewAddressLatitude(String(lat));
                            setNewAddressLongitude(String(lng));
                          }}
                        />
                      </div>
                    </div>

                    {newAddressError ? <p className="text-xs font-medium text-red-600">{newAddressError}</p> : null}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={closeAddAddressModal}
                      disabled={isSavingAddress}
                      className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveNewAddress()}
                      disabled={isSavingAddress}
                      className="h-10 rounded-xl bg-coral px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSavingAddress ? 'Saving...' : 'Save address'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="h-11 w-full rounded-xl bg-coral px-5 text-sm font-semibold text-white sm:w-auto"
              >
                Continue to Service
              </button>
            </div>
          </section>
        ) : null}

        {!isOrchestratorMinimized && !isFlowCompleted && step === 2 ? (
          <section className="space-y-4">
            <h4 className="text-base font-semibold text-neutral-900">Step 2. Select Service & Apply Discounts</h4>
            <p className="mt-1 text-sm text-neutral-600">Services are filtered by selected address pincode.</p>

            {!pincode ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Select an address with a valid pincode in Step 1.
              </p>
            ) : null}

            <div className="mt-4 rounded-xl bg-neutral-50/80 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Per-Pet Service Plan</p>
                <p className="text-xs font-semibold text-neutral-700">{totalSelectedServices} services selected</p>
              </div>

              {serviceOptions.length === 0 ? (
                <p className="text-sm text-neutral-500">No active services are currently available for pincode {pincode || 'N/A'}.</p>
              ) : selectedPetIds.length === 0 ? (
                <p className="text-sm text-neutral-500">Select at least one pet in Step 1.</p>
              ) : (
                <div className="space-y-3">
                  {primarySelectedServiceType ? (
                    <button
                      type="button"
                      onClick={() => handleApplyServiceToAll(primarySelectedServiceType)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-coral/50"
                    >
                      Apply primary service to all pets
                    </button>
                  ) : null}

                  {selectedPets.map((pet) => {
                    const selection = petServiceSelections[pet.id] ?? { serviceType: null, quantity: 1 };

                    return (
                      <div key={pet.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-neutral-900">{pet.name}</p>
                          <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-2 py-1">
                            <button
                              type="button"
                              onClick={() => handlePetQuantityChange(pet.id, selection.quantity - 1)}
                              className="h-6 w-6 rounded-full border border-neutral-200 text-sm"
                            >
                              -
                            </button>
                            <span className="min-w-5 text-center text-xs font-semibold">{selection.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handlePetQuantityChange(pet.id, selection.quantity + 1)}
                              className="h-6 w-6 rounded-full border border-neutral-200 text-sm"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          {serviceOptions.map((item) => {
                            const selected = selection.serviceType === item.serviceType;
                            return (
                              <button
                                key={`${pet.id}-${item.serviceType}`}
                                type="button"
                                onClick={() => handlePetServiceChange(pet.id, selected ? null : item.serviceType)}
                                className={`rounded-xl border p-3 text-left ${
                                  selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                                }`}
                              >
                                <p className="text-sm font-semibold text-neutral-900">{item.serviceType}</p>
                                <p className="mt-1 text-xs text-neutral-600">Providers: {item.providerCount}</p>
                                <p className="text-xs text-neutral-600">Price range: Rs.{item.minBasePrice} - Rs.{item.maxBasePrice}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add-ons (Optional)</p>
              {totalSelectedServices > 1 ? (
                <p className="mt-2 text-sm text-amber-700">
                  Add-ons are currently available for single-service bookings only in admin flow.
                </p>
              ) : !serviceType ? (
                <p className="mt-2 text-sm text-neutral-500">Select a service to view available add-ons.</p>
              ) : isLoadingAddOns ? (
                <p className="mt-2 text-sm text-neutral-500">Loading add-ons...</p>
              ) : serviceAddOns.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">No add-ons configured for this service.</p>
              ) : (
                <div className="relative mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOnDropdownOpen((previous) => !previous)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-900"
                  >
                    <span>
                      {Object.values(selectedAddOns).filter((quantity) => quantity > 0).length > 0
                        ? `${Object.values(selectedAddOns).filter((quantity) => quantity > 0).length} add-on(s) selected`
                        : 'Select add-ons'}
                    </span>
                    <span className="text-xs text-neutral-500">{isAddOnDropdownOpen ? 'Hide' : 'Show'}</span>
                  </button>

                  {isAddOnDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                      {serviceAddOns.map((addOn) => {
                        const minQty = addOn.isRequired ? Math.max(1, addOn.minQuantity) : Math.max(0, addOn.minQuantity);
                        const maxQty = Math.max(minQty, addOn.maxQuantity);
                        const defaultQty = Math.max(minQty, Math.min(maxQty, addOn.defaultQuantity));
                        const isChecked = (selectedAddOns[addOn.id] ?? 0) > 0;

                        const toggleAddOnSelection = () => {
                          if (addOn.isRequired) {
                            return;
                          }

                          setSelectedAddOns((previous) => {
                            const next = { ...previous };
                            const currentlySelected = (previous[addOn.id] ?? 0) > 0;

                            if (currentlySelected) {
                              delete next[addOn.id];
                            } else {
                              next[addOn.id] = Math.max(defaultQty, 1);
                            }

                            return next;
                          });
                        };

                        return (
                          <button
                            key={addOn.id}
                            type="button"
                            onClick={toggleAddOnSelection}
                            disabled={addOn.isRequired}
                            aria-pressed={isChecked}
                            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              tabIndex={-1}
                              className="pointer-events-none mt-0.5 h-4 w-4 accent-coral"
                            />
                            <span className="text-sm text-neutral-800">
                              {addOn.name} - Rs.{addOn.price}
                              {addOn.isRequired ? ' (required)' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Discount</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={discountCode}
                  onChange={(event) => {
                    setDiscountCode(event.target.value.toUpperCase());
                    setDiscountPreview(null);
                  }}
                  placeholder="Enter discount code"
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={isPending || totalSelectedServices > 1}
                  className="h-11 rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:border-coral/60 disabled:opacity-60"
                >
                  Apply
                </button>
                {discountCode ? (
                  <button
                    type="button"
                    onClick={clearDiscount}
                    className="h-11 rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:border-coral/60"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {suggestedDiscounts.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedDiscounts.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDiscountCode(item.code);
                        setDiscountPreview(null);
                      }}
                      className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-coral/50"
                    >
                      {item.code} - {item.title}
                    </button>
                  ))}
                </div>
              ) : null}

              {canApplyManualDiscount ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Manual discount (Rs.)
                    <input
                      inputMode="numeric"
                      value={manualDiscountAmountInr}
                      onBlur={() => {
                        if (manualDiscountAmountInr && manualDiscountAmount !== enteredManualDiscountAmount) {
                          setManualDiscountAmountInr(manualDiscountAmount > 0 ? String(manualDiscountAmount) : '');
                        }
                      }}
                      onChange={(event) => setManualDiscountAmountInr(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="0"
                      className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Manual discount reason
                    <input
                      value={manualDiscountReason}
                      onChange={(event) => setManualDiscountReason(event.target.value.slice(0, 300))}
                      placeholder="Optional"
                      className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-3 text-xs text-neutral-600">
                {totalSelectedServices > 1 ? <p className="text-amber-700">Discounts are available for single-service plans only.</p> : null}
                <p>Base amount: Rs.{summaryBaseAmount}</p>
                <p>Add-ons: Rs.{summaryAddOnAmount}</p>
                <p>Code discount: Rs.{promoDiscountAmount}</p>
                {canApplyManualDiscount ? <p>Manual discount: Rs.{manualDiscountAmount}</p> : null}
                <p>Total discount: Rs.{summaryDiscount}</p>
                <p className="font-semibold text-neutral-900">Payable estimate: Rs.{summaryTotal}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="h-11 w-full rounded-xl border border-neutral-200 px-5 text-sm font-semibold sm:w-auto"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="h-11 w-full rounded-xl bg-coral px-5 text-sm font-semibold text-white sm:w-auto"
              >
                Continue to Slots
              </button>
            </div>
          </section>
        ) : null}

        {!isOrchestratorMinimized && !isFlowCompleted && step === 3 ? (
          <section className="space-y-4">
            <h4 className="text-base font-semibold text-neutral-900">Step 3. Select Date & Time Window</h4>
            <p className="mt-1 text-sm text-neutral-600">Choose from suggested availability or enter a manual start/end slot.</p>

            {!allowPastSlots ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                Green dates have available slots. Suggested slots are based on current provider availability.
              </p>
            ) : null}

            <div className="mt-4 max-w-md">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Booking Date</label>
              {allowPastSlots ? (
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(event) => {
                    setBookingDate(event.target.value);
                    setSlotStartTime('');
                    setSlotEndTime('');
                  }}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />
              ) : (
                <AvailabilityCalendar
                  value={bookingDate}
                  onChange={(date) => {
                    setBookingDate(date);
                    setSlotStartTime('');
                    setSlotEndTime('');
                  }}
                  minDate={minBookableDate}
                  maxDate={maxBookableDate}
                  availableDates={availableDateOptions}
                  disableUnavailableDates={availableDateOptions.length > 0}
                />
              )}

              {!allowPastSlots && isLoadingAvailableDateOptions ? (
                <p className="mt-2 text-xs text-neutral-600">Checking available dates...</p>
              ) : null}
            </div>

            <label className="mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={allowPastSlots}
                onChange={(event) => {
                  setAllowPastSlots(event.target.checked);
                  setSlotStartTime('');
                  setSlotEndTime('');
                }}
                className="h-4 w-4 rounded border-neutral-300 text-coral focus:ring-coral"
              />
              Offline booking mode (allow past dates/slots for admin records)
            </label>

            {bookingDate ? (
              <div className="mt-4 space-y-3">
                {!allowPastSlots ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Suggested Slots</p>
                    <div className="flex flex-wrap gap-2">
                      {availability.slotOptions.length === 0 ? (
                        <p className="text-sm text-neutral-500">No suggested slots available for this date.</p>
                      ) : (
                        availability.slotOptions.map((slot) => (
                          <button
                            key={`${slot.startTime}-${slot.endTime}`}
                            type="button"
                            onClick={() => {
                              setSlotStartTime(slot.startTime);
                              setSlotEndTime(slot.endTime);
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                              slotStartTime === slot.startTime && slotEndTime === slot.endTime
                                ? 'border-coral bg-orange-50 text-coral'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:border-coral/60'
                            }`}
                          >
                            <span className="block font-semibold">{slot.startTime} - {slot.endTime}</span>
                            <span className="block text-[11px] text-neutral-500">{slot.availableProviderCount} providers</span>
                            {slot.recommended ? <span className="text-[10px] font-semibold text-coral">Recommended</span> : null}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Manual Slot Override</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Start Time
                    <input
                      type="time"
                      value={slotStartTime}
                      onChange={(event) => setSlotStartTime(event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    End Time
                    <input
                      type="time"
                      value={slotEndTime}
                      onChange={(event) => setSlotEndTime(event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="h-11 w-full rounded-xl border border-neutral-200 px-5 text-sm font-semibold sm:w-auto"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="h-11 w-full rounded-xl bg-coral px-5 text-sm font-semibold text-white sm:w-auto"
              >
                Continue to Providers
              </button>
            </div>
          </section>
        ) : null}

        {!isOrchestratorMinimized && !isFlowCompleted && step === 4 ? (
          <section className="space-y-4">
            <h4 className="text-base font-semibold text-neutral-900">Step 4. Provider Selection</h4>
            <p className="mt-1 text-sm text-neutral-600">Auto-assigned best match is preselected. Click any other provider to override.</p>

            {!allowPastSlots && bookingDate && slotStartTime && availability.providers.length > 0 && !hasProviderForSelectedSlot ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No providers are available at the exact selected start time. Showing nearest provider options; adjust slot time for available matches.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableProviderCards.length === 0 ? (
                <p className="text-sm text-neutral-500">No providers match this service/date/slot combination.</p>
              ) : (
                availableProviderCards.map((provider) => {
                  const selected = providerServiceId === provider.providerServiceId;

                  return (
                    <button
                      key={provider.providerServiceId}
                      type="button"
                      onClick={() => setProviderServiceId(provider.providerServiceId)}
                      className={`rounded-xl border p-3 text-left ${
                        selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{provider.providerName}</p>
                          <p className="text-xs text-neutral-600">{provider.providerType ?? 'Provider'}</p>
                        </div>
                        {provider.recommended ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Auto</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-neutral-700">Service: {provider.serviceType}</p>
                      <p className="text-xs text-neutral-700">Price: Rs.{provider.basePrice}</p>
                      <p className="text-xs text-neutral-700">Duration: {provider.serviceDurationMinutes} mins</p>
                      {allowPastSlots ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">Manual offline mode: availability restrictions are bypassed.</p>
                      ) : (
                        <p className={`mt-1 text-xs font-medium ${provider.availableForSelectedSlot ? 'text-emerald-700' : 'text-red-600'}`}>
                          {provider.availableForSelectedSlot ? 'Available for selected slot' : 'Not available for selected slot'}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="h-11 w-full rounded-xl border border-neutral-200 px-5 text-sm font-semibold sm:w-auto"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goToStep(5)}
                className="h-11 w-full rounded-xl bg-coral px-5 text-sm font-semibold text-white sm:w-auto"
              >
                Continue to Summary
              </button>
            </div>
          </section>
        ) : null}

        {!isOrchestratorMinimized && !isFlowCompleted && step === 5 ? (
          <section className="space-y-4">
            <h4 className="text-base font-semibold text-neutral-900">Step 5. Final Booking Summary</h4>
            <p className="mt-1 text-sm text-neutral-600">Review all selections and create booking.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Customer</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedUser?.name?.trim() || selectedUser?.email || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Pets: {selectedPets.map((pet) => pet.name).join(', ') || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Address: {selectedAddressDisplay}</p>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Service Plan</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{serviceType || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Bundle size: {totalSelectedServices} service{totalSelectedServices === 1 ? '' : 's'}</p>
                <p className="mt-1 text-xs text-neutral-700">Date: {bookingDate || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Time: {slotStartTime && slotEndTime ? `${slotStartTime} - ${slotEndTime}` : 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Provider: {selectedProvider?.providerName ?? 'Not selected'}</p>
              </div>
            </div>

            {bookingBundleRows.length > 0 ? (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Per-Pet Bundle</p>
                <div className="mt-2 space-y-1 text-sm text-neutral-700">
                  {bookingBundleRows.map((row) => (
                    <p key={`${row.petId}-${row.serviceType}`}>{row.petName}: {row.serviceType} x{row.quantity}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Pricing</p>
              <div className="mt-2 space-y-1 text-sm text-neutral-700">
                <p>Base amount: Rs.{summaryBaseAmount}</p>
                <p>Add-ons: Rs.{summaryAddOnAmount}</p>
                <p>Code discount: -Rs.{promoDiscountAmount}</p>
                {canApplyManualDiscount ? <p>Manual discount: -Rs.{manualDiscountAmount}</p> : null}
                <p>Total discount: -Rs.{summaryDiscount}</p>
                <p>Wallet/Referral credits: -Rs.{walletCreditsToApply}</p>
                <p className="font-semibold text-neutral-900">Total payable: Rs.{paymentChoice === 'subscription_credit' ? 0 : summaryPayableAfterWallet}</p>
              </div>
            </div>

            {Object.values(selectedAddOns).some((quantity) => quantity > 0) ? (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Selected Add-ons</p>
                <div className="mt-2 space-y-1 text-sm text-neutral-700">
                  {serviceAddOns
                    .filter((addOn) => (selectedAddOns[addOn.id] ?? 0) > 0)
                    .map((addOn) => (
                      <p key={`summary-addon-${addOn.id}`}>
                        {addOn.name} x{selectedAddOns[addOn.id]} (Rs.{addOn.price} each)
                      </p>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Payment</p>

              <div className="mt-2 space-y-2 text-sm text-neutral-700">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="admin-payment-choice"
                    checked={paymentChoice === 'cash'}
                    onChange={() => setPaymentChoice('cash')}
                    className="h-4 w-4 accent-coral"
                  />
                  <span>Cash collection after service</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="admin-payment-choice"
                    checked={paymentChoice === 'subscription_credit'}
                    onChange={() => setPaymentChoice('subscription_credit')}
                    disabled={!creditEligibility?.eligible}
                    className="h-4 w-4 accent-coral"
                  />
                  <span>Use user subscription credits</span>
                </label>

                <p className="text-xs text-neutral-600">
                  {isCheckingCreditEligibility
                    ? 'Checking subscription credit eligibility...'
                    : creditEligibility?.eligible
                      ? `Subscription credit value available: ${formatCreditAmount(creditEligibility.availableCredits)}`
                      : subscriptionCreditUnavailableReason ?? 'Subscription credit is not available.'}
                </p>

                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                    <input
                      type="checkbox"
                      checked={walletCreditsToApply > 0}
                      disabled={paymentChoice === 'subscription_credit' || walletBalanceInr <= 0 || summaryTotal <= 0}
                      onChange={(event) => {
                        if (!event.target.checked) {
                          setWalletCreditsToApply(0);
                          return;
                        }

                        const initialCredits = Math.max(0, Math.min(walletBalanceInr, summaryTotal));
                        setWalletCreditsToApply(initialCredits);
                      }}
                      className="h-4 w-4 accent-coral"
                    />
                    Apply wallet/referral credits
                  </label>

                  <p className="mt-1 text-xs text-neutral-600">
                    {isLoadingWalletBalance
                      ? 'Loading wallet balance...'
                      : `Available wallet/referral credits: Rs.${walletBalanceInr}`}
                  </p>

                  <div className="mt-2 max-w-xs">
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, Math.min(walletBalanceInr, summaryTotal))}
                      value={walletCreditsToApply}
                      onChange={(event) => {
                        const enteredValue = Number(event.target.value);
                        const boundedValue = Math.max(0, Math.min(
                          Number.isFinite(enteredValue) ? Math.floor(enteredValue) : 0,
                          Math.max(0, Math.min(walletBalanceInr, summaryTotal)),
                        ));
                        setWalletCreditsToApply(boundedValue);
                      }}
                      disabled={paymentChoice === 'subscription_credit' || walletBalanceInr <= 0}
                      className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm disabled:bg-neutral-100"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin / Provider Notes (Optional)</label>
              <textarea
                value={providerNotes}
                onChange={(event) => setProviderNotes(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Internal context for assigned provider"
              />
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="h-11 w-full rounded-xl border border-neutral-200 px-5 text-sm font-semibold sm:w-auto"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitBooking}
                disabled={isPending}
                className="h-11 w-full rounded-xl bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                {isPending ? 'Creating Booking...' : 'Create Booking'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </AsyncState>
  );
}
