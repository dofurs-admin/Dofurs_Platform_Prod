'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import AsyncState from '@/components/ui/AsyncState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import type { PricingBreakdown } from '@/lib/bookings/types';
import { apiRequest } from '@/lib/api/client';
import { bookingCreateSchema } from '@/lib/flows/validation';
import PremiumBookingConfirmation from './PremiumBookingConfirmation';
import PetAndServiceStep from './steps/PetAndServiceStep';
import DateTimeSlotStep from './steps/DateTimeSlotStep';
import ReviewConfirmStep from './steps/ReviewConfirmStep';

import BookingProgressBar from './BookingProgressBar';

type Provider = { id: number; name: string; provider_type?: string | null; type?: string | null };
type Service = {
  id: string;
  provider_id: number;
  service_type: string;
  service_mode?: string | null;
  service_duration_minutes: number;
  buffer_minutes: number;
  base_price: number;
  source: 'provider_services' | 'services';
};
type Pet = { id: number; name: string; breed?: string | null; photo_url?: string | null };
type PetServiceSelection = Array<{ serviceType: string; quantity: number }>;
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
  averageRating?: number | null;
  totalBookings?: number | null;
  backgroundVerified?: boolean;
  isVerified?: boolean;
};
type AvailabilitySlotOption = {
  startTime: string;
  endTime: string;
  availableProviderCount: number;
  recommended: boolean;
};
type AvailabilityResponse = {
  services: Array<{
    serviceType: string;
    minBasePrice: number;
    maxBasePrice: number;
    providerCount: number;
  }>;
  providers: AvailabilityProvider[];
  slotOptions: AvailabilitySlotOption[];
  recommendedSlotStartTime: string | null;
  recommendedProviderServiceId: string | null;
};
type AreaCoverageResponse = {
  services: Array<{
    serviceType: string;
    minBasePrice: number;
    maxBasePrice: number;
    providerCount: number;
  }>;
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
type ServiceAddon = {
  id: string;
  name: string;
  price: number;
};
type BookingCreateResponse = {
  success: boolean;
  booking: { id: number; start_time?: string | null; end_time?: string | null };
  creditReservation?: {
    reserved: boolean;
    linkId: string;
    linkStatus: string;
    serviceType: string;
    availableCredits: number;
    consumedCredits: number;
    totalCredits: number;
  } | null;
};
type UserBookingRecord = {
  id: number;
  pet_id: number;
  provider_id: number;
  provider_service_id: string | null;
  service_type: string | null;
  booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | string;
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
  phone?: string | null;
  is_default: boolean;
};
type BookingCreatePayload = {
  petId: number;
  providerId: number;
  bookingDate: string;
  startTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  providerNotes: string | null;
  bookingUserId?: string;
  discountCode?: string;
  providerServiceId?: string | null;
  addOns?: Array<{ id: string; quantity: number }>;
  useSubscriptionCredit?: boolean;
  walletCreditsAppliedInr?: number;
  pincode?: string;
  boardingEndDate?: string;
};

type AreaCoverageCheckResult = {
  services: AreaCoverageResponse['services'];
  error: string | null;
};

type CreditEligibilityResponse = {
  eligible: boolean;
  subscriptionId: string | null;
  serviceType: string;
  matchedCreditServiceType?: string | null;
  availableCredits: number;
  totalCredits: number;
  reason?: string | null;
};

type BookingPaymentOrderResponse = {
  razorpay: {
    keyId: string;
    amount: number;
    currency: string;
    orderId: string;
    name: string;
    description: string;
    prefill?: { email?: string };
    notes?: Record<string, string>;
  };
};

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayPaymentFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { email?: string };
  notes?: Record<string, string>;
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: RazorpayCheckoutResponse) => Promise<void>;
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayPaymentFailureResponse) => void) => void;
};

type BookingStep = 'pet-service' | 'datetime' | 'review';

/** Returns true for service types that represent special packages (birthday, boarding). */
function isPackageServiceType(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false;
  const n = serviceType.toLowerCase();
  return n.includes('birthday') || n.includes('boarding');
}

/** Returns true specifically for boarding-type services that need date ranges. */
function isBoardingServiceType(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false;
  return serviceType.toLowerCase().includes('boarding');
}

function normalizeServiceType(serviceType: string | null | undefined): string {
  return (serviceType ?? '').trim().toLowerCase();
}

function timeStringToMinutes(timeValue: string) {
  const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function getSlotDurationMinutes(startTime: string, endTime: string) {
  return Math.max(0, timeStringToMinutes(endTime) - timeStringToMinutes(startTime));
}

function getIstDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

type MultiDayAvailabilityResponse = {
  availability: Array<{
    date: string;
    is_blocked?: boolean;
    slots: Array<{ is_available: boolean }>;
  }>;
};

const SERVICE_CART_STORAGE_KEY = 'dofurs.booking.serviceCart';
const SERVICE_CART_UPDATED_EVENT = 'dofurs:service-cart-updated';
const BOOKING_DRAFT_STORAGE_KEY = 'dofurs.booking.draft.v1';
const BOOKING_SUCCESS_FLAG_KEY = 'dofurs.booking.confirmation-active';
const BOOKING_SUCCESS_EVENT = 'dofurs:booking-confirmation-visibility';
const MAX_SERVICE_SELECTIONS = 2;

type BookingDraftSnapshot = {
  currentStep: BookingStep;
  selectedPetIds: number[];
  petServiceSelections: Record<number, PetServiceSelection>;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  bookingDate: string;
  slotStartTime: string;
  locationAddress: string;
  latitude: string;
  longitude: string;
  selectedSavedAddressId: string | null;
  providerNotes: string;
  manualPincode: string;
  selectedAutoProvider: boolean;
  providerId: number | null;
  serviceId: string | null;
  selectedAddOns: Record<string, number>;
  discountCode: string;
  paymentChoice: 'online' | 'cash' | 'subscription_credit';
  bookingEndDate: string;
  updatedAt: number;
};

export default function PremiumUserBookingFlow() {
  const stepContainerRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);
  const hasHydratedDraftRef = useRef(false);
  const hasHydratedRescheduleRef = useRef(false);
  const loggedServiceFallbackKeysRef = useRef<Set<string>>(new Set());
  const searchParams = useSearchParams();

  const searchQueryRaw = (searchParams.get('search') ?? '').trim();
  const serviceTypeQueryRaw = (searchParams.get('serviceType') ?? '').trim();
  const providerNameQueryRaw = (searchParams.get('providerName') ?? '').trim();
  const searchQuery = searchQueryRaw.toLowerCase();
  const serviceTypeQuery = serviceTypeQueryRaw.toLowerCase();
  const providerNameQuery = providerNameQueryRaw.toLowerCase();
  const modeQuery = searchParams.get('mode');
  const requestedMode = modeQuery === 'clinic_visit' || modeQuery === 'home_visit' ? modeQuery : null;
  const rescheduleQuery = searchParams.get('reschedule');
  const rescheduleBookingId = useMemo(() => {
    if (!rescheduleQuery) {
      return null;
    }

    const parsed = Number.parseInt(rescheduleQuery, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [rescheduleQuery]);
  const isRescheduleMode = rescheduleBookingId !== null;
  const filterTokens = [searchQuery, serviceTypeQuery, providerNameQuery].filter((value) => value.length > 0);
  const filterTerms = [searchQueryRaw, serviceTypeQueryRaw, providerNameQueryRaw].filter((value) => value.length > 0);

  // Catalog data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [, setDiscounts] = useState<CatalogDiscount[]>([]);

  // Booking selections
  const [currentStep, setCurrentStep] = useState<BookingStep>('pet-service');
  const [providerId, setProviderId] = useState<number | null>(null);
  const [selectedAutoProvider, setSelectedAutoProvider] = useState(true);
  const [serviceTypeSelection, setServiceTypeSelection] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const providerIdRef = useRef(providerId);
  providerIdRef.current = providerId;
  const serviceIdRef = useRef(serviceId);
  serviceIdRef.current = serviceId;
  const [petId, setPetId] = useState<number | null>(null);
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [petServiceSelections, setPetServiceSelections] = useState<Record<number, PetServiceSelection>>({});
  const [bookingDate, setBookingDate] = useState('');
  const [bookingEndDate, setBookingEndDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [bookingMode, setBookingMode] = useState<'home_visit' | 'clinic_visit' | 'teleconsult' | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [providerNotes, setProviderNotes] = useState('');
  const [manualPincode, setManualPincode] = useState('');
  const [isDetectingPincode, setIsDetectingPincode] = useState(false);
  const [isCheckingAreaCoverage, setIsCheckingAreaCoverage] = useState(false);
  const [hasCheckedAreaCoverage, setHasCheckedAreaCoverage] = useState(false);
  const [areaCoverageServices, setAreaCoverageServices] = useState<AreaCoverageResponse['services']>([]);
  const [areaCoverageError, setAreaCoverageError] = useState<string | null>(null);
  const [isCheckingSelectedAddressCoverage, setIsCheckingSelectedAddressCoverage] = useState(false);
  const [hasCheckedSelectedAddressCoverage, setHasCheckedSelectedAddressCoverage] = useState(false);
  const [selectedAddressCoverageServices, setSelectedAddressCoverageServices] = useState<AreaCoverageResponse['services']>([]);
  const [selectedAddressCoverageError, setSelectedAddressCoverageError] = useState<string | null>(null);
  const [availableDateOptions, setAvailableDateOptions] = useState<string[]>([]);
  const [isLoadingAvailableDateOptions, setIsLoadingAvailableDateOptions] = useState(false);

  // Slots and pricing
  const [availability, setAvailability] = useState<AvailabilityResponse>({
    services: [],
    providers: [],
    slotOptions: [],
    recommendedSlotStartTime: null,
    recommendedProviderServiceId: null,
  });
  const [priceCalculation, setPriceCalculation] = useState<PricingBreakdown | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [serviceAddOns, setServiceAddOns] = useState<ServiceAddon[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [paymentChoice, setPaymentChoice] = useState<'online' | 'cash' | 'subscription_credit'>('cash');
  const [creditEligibility, setCreditEligibility] = useState<CreditEligibilityResponse | null>(null);
  const [subscriptionCreditUnavailableReason, setSubscriptionCreditUnavailableReason] = useState<string | null>(null);
  const [isCheckingCreditEligibility, setIsCheckingCreditEligibility] = useState(false);
  const [walletCreditsToApply, setWalletCreditsToApply] = useState(0);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [pendingVerifyParams, setPendingVerifyParams] = useState<{
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  } | null>(null);
  const [flowState, setFlowState] = useState<'collecting' | 'submitting' | 'success' | 'error'>('collecting');
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastBookingSummary, setLastBookingSummary] = useState<{
    bookingDate: string;
    slotStartTime: string;
    bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
    providerName?: string;
    petName?: string;
    totalAmount: number;
    amountStatus: 'payable' | 'paid';
  } | null>(null);

  const { showToast } = useToast();

  const toCoverageErrorMessage = useCallback((error: unknown) => {
    const fallback = 'Unable to check service availability for this pincode. Please try again.';

    if (!(error instanceof Error)) {
      return fallback;
    }

    const message = error.message.trim();
    if (!message) {
      return fallback;
    }

    const normalized = message.toLowerCase();

    // Hide technical/db details from user-facing surfaces.
    if (
      normalized.includes('invalid input syntax') ||
      normalized.includes('bigint') ||
      normalized.includes('sql') ||
      normalized.includes('database')
    ) {
      return fallback;
    }

    return message;
  }, []);

  // Load initial catalog on mount
  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      setApiError(null);

      try {
        const payload = await apiRequest<{
          providers: Provider[];
          services: Service[];
          pets: Pet[];
          addresses?: SavedAddress[];
          discounts?: CatalogDiscount[];
        }>('/api/bookings/catalog');

        if (!isMounted) return;

        setProviders(payload.providers);
        setServices(payload.services);
        setPets(payload.pets);
        setSavedAddresses(payload.addresses ?? []);
        setDiscounts(payload.discounts ?? []);
        setProviderId(null);
        setServiceTypeSelection(null);
        setServiceId(null);
        setPetId(null);
        setSelectedPetIds([]);
        setPetServiceSelections({});

        // Preserve deep-linked booking mode when supplied from landing page links.
        setBookingMode(requestedMode ?? null);

        const defaultAddress = (payload.addresses ?? []).find((item) => item.is_default) ?? (payload.addresses ?? [])[0];
        if (defaultAddress) {
          const formattedAddress = [
            defaultAddress.address_line_1,
            defaultAddress.address_line_2,
            defaultAddress.city,
            defaultAddress.state,
            defaultAddress.pincode,
            defaultAddress.country,
          ]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .join(', ');
          setLocationAddress(formattedAddress);
          setSelectedSavedAddressId(defaultAddress.id);
          if (defaultAddress.latitude !== null && defaultAddress.longitude !== null) {
            setLatitude(String(defaultAddress.latitude));
            setLongitude(String(defaultAddress.longitude));
          }
        } else {
          const lastAddress = globalThis.localStorage?.getItem('booking.lastUsedAddress');
          if (lastAddress) {
            setLocationAddress(lastAddress);
          }
        }
      } catch (err) { console.error(err);
        if (isMounted) {
          const isAuthError =
            (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401);
          const message = isAuthError
            ? 'Sign in to access booking flow.'
            : (err instanceof Error ? err.message : 'Unable to load booking catalog. Please try again.');
          setApiError(message);
          showToast(message, 'error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [requestedMode, showToast]);

  // Auto-select service from query param or service card "Book Now" click
  useEffect(() => {
    if (isLoading || services.length === 0 || pets.length === 0) return;

    const applyServiceSelection = (serviceTitle: string) => {
      if (!serviceTitle) return;
      const normalTitle = serviceTitle.toLowerCase();
      const matchingService = services.find(
        (s) => s.service_type.toLowerCase() === normalTitle || s.service_type.toLowerCase().includes(normalTitle) || normalTitle.includes(s.service_type.toLowerCase()),
      );
      if (!matchingService) return;

      // Auto-select first pet if none selected
      const currentPetIds = selectedPetIds.length > 0 ? selectedPetIds : pets.length > 0 ? [pets[0].id] : [];
      if (currentPetIds.length === 0) return;

      if (selectedPetIds.length === 0) {
        setSelectedPetIds(currentPetIds);
        setPetId(currentPetIds[0]);
      }

      // Set the matched service for all selected pets
      setPetServiceSelections((prev) => {
        const next = { ...prev };
        let runningTotal = currentPetIds.reduce((sum, pId) => {
          const selections = prev[pId] ?? [];
          return sum + selections.reduce((innerSum, entry) => innerSum + Math.max(1, entry.quantity), 0);
        }, 0);
        let didHitSelectionLimit = false;

        for (const pId of currentPetIds) {
          const current = prev[pId] ?? [];
          if (!current.some((s) => s.serviceType === matchingService.service_type) && runningTotal < MAX_SERVICE_SELECTIONS) {
            next[pId] = [...current, { serviceType: matchingService.service_type, quantity: 1 }];
            runningTotal += 1;
          } else if (!current.some((s) => s.serviceType === matchingService.service_type) && runningTotal >= MAX_SERVICE_SELECTIONS) {
            didHitSelectionLimit = true;
          }
        }

        if (didHitSelectionLimit) {
          showToast('You can select a maximum of 2 services in one booking.', 'error');
        }

        return next;
      });

      // Auto-detect package bookings and set mode
      if (isPackageServiceType(matchingService.service_type)) {
        setBookingMode('home_visit');
      }
    };

    // Check query param first
    if (serviceTypeQueryRaw) {
      applyServiceSelection(serviceTypeQueryRaw);
    }

    // Check localStorage for service card clicks
    const storedService = globalThis.localStorage?.getItem('dofurs.booking.selectedServiceType');
    if (storedService) {
      applyServiceSelection(storedService);
      globalThis.localStorage?.removeItem('dofurs.booking.selectedServiceType');
    }

    // Listen for service card clicks while on the page
    const handleServiceTypeSelected = () => {
      const title = globalThis.localStorage?.getItem('dofurs.booking.selectedServiceType');
      if (title) {
        applyServiceSelection(title);
        globalThis.localStorage?.removeItem('dofurs.booking.selectedServiceType');
      }
    };
    window.addEventListener('dofurs:service-type-selected', handleServiceTypeSelected);
    return () => window.removeEventListener('dofurs:service-type-selected', handleServiceTypeSelected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, services, pets, showToast]);

  useEffect(() => {
    if (!requestedMode) {
      return;
    }

    setBookingMode(requestedMode);
  }, [requestedMode]);

  const matchesBookingMode = (serviceMode: string | null | undefined, mode: 'home_visit' | 'clinic_visit' | 'teleconsult') => {
    const normalized = (serviceMode ?? '').trim().toLowerCase();

    if (mode === 'home_visit') {
      return (
        normalized === '' ||
        normalized === 'home_visit' ||
        normalized === 'home' ||
        normalized === 'doorstep' ||
        normalized === 'both' ||
        normalized === 'hybrid'
      );
    }

    if (mode === 'clinic_visit') {
      return (
        normalized === 'clinic_visit' ||
        normalized === 'clinic' ||
        normalized === 'center' ||
        normalized === 'both' ||
        normalized === 'hybrid'
      );
    }

    return normalized === 'teleconsult' || normalized === 'tele_consult' || normalized === 'tele';
  };

  const modeFilteredProviders = useMemo(() => {
    return providers;
  }, [providers]);

  const filteredProviders = useMemo(() => {
    if (filterTokens.length === 0) {
      return modeFilteredProviders;
    }

    return modeFilteredProviders.filter((provider) => {
      const providerLabel = `${provider.name} ${provider.provider_type ?? provider.type ?? ''}`.toLowerCase();
      const providerServices = services.filter((service) => service.provider_id === provider.id && service.source === 'provider_services');

      return filterTokens.some((token) => {
        if (providerLabel.includes(token)) {
          return true;
        }

        return providerServices.some((service) => service.service_type.toLowerCase().includes(token));
      });
    });
  }, [filterTokens, modeFilteredProviders, services]);

  const searchResultSummary = useMemo(() => {
    if (filterTerms.length === 0) {
      return null;
    }

    const queryLabel = filterTerms.join(' · ');
    const matchedServiceCount = services.filter((service) => {
      if (service.source !== 'provider_services' || !filteredProviders.some((provider) => provider.id === service.provider_id)) {
        return false;
      }

      if (bookingMode && !matchesBookingMode(service.service_mode, bookingMode)) {
        return false;
      }

      const serviceLabel = service.service_type.toLowerCase();
      return filterTokens.some((token) => serviceLabel.includes(token));
    }).length;

    if (filteredProviders.length === 0) {
      return `No premium matches for \"${queryLabel}\" yet. Try a broader term.`;
    }

    return `${filteredProviders.length} provider${filteredProviders.length === 1 ? '' : 's'} and ${matchedServiceCount} service${matchedServiceCount === 1 ? '' : 's'} curated for \"${queryLabel}\".`;
  }, [bookingMode, filterTerms, filterTokens, filteredProviders, services]);

  const modeProviderServices = useMemo(
    () =>
      services.filter((service) => {
        if (service.source !== 'provider_services') {
          return false;
        }

        if (!filteredProviders.some((provider) => provider.id === service.provider_id)) {
          return false;
        }

        if (bookingMode && !matchesBookingMode(service.service_mode, bookingMode)) {
          return false;
        }

        if (filterTokens.length === 0) {
          return true;
        }

        const serviceLabel = service.service_type.toLowerCase();
        return filterTokens.some((token) => serviceLabel.includes(token));
      }),
    [bookingMode, filterTokens, filteredProviders, services],
  );

  const serviceOptions = useMemo(() => {
    const lowestPriceByType = new Map<string, Service>();

    modeProviderServices.forEach((service) => {
      const existing = lowestPriceByType.get(service.service_type);
      if (!existing || service.base_price < existing.base_price) {
        lowestPriceByType.set(service.service_type, service);
      }
    });

    return Array.from(lowestPriceByType.values()).sort((a, b) => a.base_price - b.base_price);
  }, [modeProviderServices]);

  const selectedPets = useMemo(
    () => pets.filter((pet) => selectedPetIds.includes(pet.id)),
    [pets, selectedPetIds],
  );

  const totalSelectedServices = useMemo(
    () =>
      selectedPetIds.reduce((sum, selectedPetId) => {
        const selections = petServiceSelections[selectedPetId] ?? [];
        return sum + selections.reduce((s, entry) => s + Math.max(1, entry.quantity), 0);
      }, 0),
    [petServiceSelections, selectedPetIds],
  );

  /** All selected service type strings for the current pet selection. */
  const selectedServiceTypesList = useMemo(
    () =>
      selectedPetIds.flatMap((id) =>
        (petServiceSelections[id] ?? []).map((s) => s.serviceType),
      ),
    [petServiceSelections, selectedPetIds],
  );

  const uniqueSelectedServiceTypes = useMemo(
    () =>
      Array.from(
        new Set(
          selectedServiceTypesList
            .map((serviceType) => serviceType.trim())
            .filter((serviceType) => serviceType.length > 0),
        ),
      ),
    [selectedServiceTypesList],
  );

  const selectedExclusivePackageServiceTypes = useMemo(
    () => uniqueSelectedServiceTypes.filter((serviceType) => isPackageServiceType(serviceType)),
    [uniqueSelectedServiceTypes],
  );

  const hasMixedExclusivePackageSelection = useMemo(() => {
    if (selectedExclusivePackageServiceTypes.length === 0) {
      return false;
    }

    const lockedPackageType = normalizeServiceType(selectedExclusivePackageServiceTypes[0]);
    return uniqueSelectedServiceTypes.some((serviceType) => normalizeServiceType(serviceType) !== lockedPackageType);
  }, [selectedExclusivePackageServiceTypes, uniqueSelectedServiceTypes]);

  const selectedServiceTypesParam = useMemo(
    () =>
      Array.from(
        new Set(
          selectedServiceTypesList
            .map((serviceType) => serviceType.trim().toLowerCase())
            .filter((serviceType) => serviceType.length > 0),
        ),
      ).join(','),
    [selectedServiceTypesList],
  );

  /** True when every selected service is a package (birthday / boarding). */
  const isPackageBooking = selectedServiceTypesList.length > 0 && selectedServiceTypesList.every(isPackageServiceType);

  /** True when any selected service is a boarding-type package. */
  const isBoardingBooking = selectedServiceTypesList.some(isBoardingServiceType);

  const isServiceSelectionBlocked = useCallback(
    (selectedPetId: number, candidateServiceType: string) => {
      const normalizedCandidate = normalizeServiceType(candidateServiceType);
      if (!normalizedCandidate) {
        return false;
      }

      const currentSelections = petServiceSelections[selectedPetId] ?? [];
      const isAlreadySelected = currentSelections.some(
        (entry) => normalizeServiceType(entry.serviceType) === normalizedCandidate,
      );

      // Always allow toggling already-selected options (deselect / quantity edits).
      if (isAlreadySelected) {
        return false;
      }

      const normalizedSelectedTypes = Array.from(
        new Set(
          selectedPetIds
            .flatMap((id) => (petServiceSelections[id] ?? []).map((entry) => normalizeServiceType(entry.serviceType)))
            .filter((value) => value.length > 0),
        ),
      );

      const normalizedSelectedExclusiveTypes = normalizedSelectedTypes.filter((serviceType) =>
        isPackageServiceType(serviceType),
      );

      // If an exclusive package is already selected, only that exact package type can be selected.
      if (normalizedSelectedExclusiveTypes.length > 0) {
        return normalizedCandidate !== normalizedSelectedExclusiveTypes[0];
      }

      // If regular services are selected, birthday/boarding cannot be added into the same booking.
      if (normalizedSelectedTypes.length > 0 && isPackageServiceType(normalizedCandidate)) {
        return true;
      }

      return false;
    },
    [petServiceSelections, selectedPetIds],
  );

  const bookingBundleRows = useMemo(
    () =>
      selectedPets.flatMap((pet) => {
        const selections = petServiceSelections[pet.id] ?? [];
        return selections.map((entry) => {
          const quantity = Math.max(1, entry.quantity);
          const providerService = providerId
            ? services.find(
                (service) =>
                  service.provider_id === providerId &&
                  service.source === 'provider_services' &&
                  service.service_type.toLowerCase() === entry.serviceType.toLowerCase(),
              )
            : services.find(
                (service) =>
                  service.source === 'provider_services' &&
                  service.service_type.toLowerCase() === entry.serviceType.toLowerCase(),
              );

          return {
            petId: pet.id,
            petName: pet.name,
            serviceType: entry.serviceType,
            quantity,
            unitBasePrice: providerService?.base_price ?? 0,
            unitDurationMinutes: providerService?.service_duration_minutes ?? 30,
          };
        });
      }),
    [petServiceSelections, providerId, selectedPets, services],
  );

  /**
   * Aggregated base price across all bundle rows.
   * Uses provider-specific prices when a provider is selected,
   * otherwise falls back to the lowest available base_price per service type.
   */
  const bundlePriceTotal = useMemo(() => {
    return bookingBundleRows.reduce((sum, row) => sum + row.unitBasePrice * row.quantity, 0);
  }, [bookingBundleRows]);

  /** Total duration in minutes for all bundle entries (used for multi-service time display). */
  const totalDurationMinutes = useMemo(() => {
    return bookingBundleRows.reduce((sum, row) => sum + row.unitDurationMinutes * row.quantity, 0);
  }, [bookingBundleRows]);

  const selectedServiceResolution = useMemo(() => {
    const normalizeId = (value: string | null | undefined) => (value ?? '').trim();
    const targetServiceId = normalizeId(serviceId);

    if (targetServiceId) {
      const fromCatalog = services.find((service) => normalizeId(service.id) === targetServiceId);
      if (fromCatalog) {
        return { service: fromCatalog, source: 'catalog' as const };
      }

      const fromAvailability = availability.providers.find(
        (provider) => normalizeId(provider.providerServiceId) === targetServiceId,
      );

      if (fromAvailability) {
        return {
          service: {
            id: fromAvailability.providerServiceId,
            provider_id: fromAvailability.providerId,
            service_type: fromAvailability.serviceType,
            service_mode: fromAvailability.serviceMode,
            service_duration_minutes: fromAvailability.serviceDurationMinutes,
            buffer_minutes: 0,
            base_price: fromAvailability.basePrice,
            source: 'provider_services' as const,
          },
          source: 'availability' as const,
        };
      }
    }

    const primaryPetId = selectedPetIds[0] ?? null;
    const primaryServiceType = primaryPetId ? petServiceSelections[primaryPetId]?.[0]?.serviceType ?? null : null;

    if (primaryServiceType) {
      const fromServiceType =
        services.find((service) => service.service_type.toLowerCase() === primaryServiceType.toLowerCase()) ?? null;

      if (fromServiceType) {
        return { service: fromServiceType, source: 'service_type' as const };
      }
    }

    return { service: null, source: 'none' as const };
  }, [availability.providers, petServiceSelections, selectedPetIds, serviceId, services]);

  const selectedService = selectedServiceResolution.service;

  useEffect(() => {
    const source = selectedServiceResolution.source;

    if (source !== 'availability' && source !== 'service_type') {
      return;
    }

    const fallbackKey = [
      source,
      serviceId ?? 'none',
      providerId ?? 'none',
      selectedService?.service_type ?? 'none',
      selectedPetIds.length,
      totalSelectedServices,
    ].join('|');

    if (loggedServiceFallbackKeysRef.current.has(fallbackKey)) {
      return;
    }

    loggedServiceFallbackKeysRef.current.add(fallbackKey);

    void apiRequest<{ success: boolean }>('/api/bookings/client-fallback-log', {
      method: 'POST',
      body: JSON.stringify({
        flow: 'premium-booking',
        fallbackSource: source,
        providerServiceId: serviceId ?? undefined,
        providerId: providerId ?? undefined,
        selectedServiceType: selectedService?.service_type ?? undefined,
        selectedPetCount: selectedPetIds.length,
        totalSelectedServices,
      }),
    }).catch(() => {
      // Telemetry should never block booking UX.
    });
  }, [providerId, selectedPetIds.length, selectedService?.service_type, selectedServiceResolution.source, serviceId, totalSelectedServices]);

  useEffect(() => {
    if (selectedPetIds.length === 0) {
      setServiceTypeSelection(null);
      return;
    }

    const primaryPetId = selectedPetIds[0];
    const primarySelections = petServiceSelections[primaryPetId] ?? [];
    setServiceTypeSelection(primarySelections[0]?.serviceType ?? null);
  }, [petServiceSelections, selectedPetIds]);

  // Auto-set booking mode to home_visit for package services (birthday/boarding).
  useEffect(() => {
    if (isPackageBooking && !bookingMode) {
      setBookingMode('home_visit');
    }
  }, [isPackageBooking, bookingMode]);

  const selectedAddress = useMemo(
    () => savedAddresses.find((address) => address.id === selectedSavedAddressId) ?? null,
    [savedAddresses, selectedSavedAddressId],
  );

  const availabilityPincode = useMemo(() => {
    const fromManualInput = manualPincode.trim();
    if (/^[1-9]\d{5}$/.test(fromManualInput)) {
      return fromManualInput;
    }

    const fromSavedAddress = selectedAddress?.pincode?.trim() ?? '';
    if (/^[1-9]\d{5}$/.test(fromSavedAddress)) {
      return fromSavedAddress;
    }

    const fromFreeText = locationAddress.match(/\b([1-9]\d{5})\b/);
    return fromFreeText?.[1] ?? '';
  }, [locationAddress, manualPincode, selectedAddress]);

  const providerSupportsSelectedServices = useMemo(() => {
    if (!providerId) {
      return false;
    }

    const selectedServiceTypes = new Set(
      selectedPetIds
        .flatMap((selectedPetId) => (petServiceSelections[selectedPetId] ?? []).map((s) => s.serviceType))
        .filter((value): value is string => Boolean(value)),
    );

    const providerSupportedTypes = new Set(
      services
        .filter((service) => service.provider_id === providerId)
        .map((service) => service.service_type),
    );

    return !Array.from(selectedServiceTypes).some((type) => !providerSupportedTypes.has(type));
  }, [petServiceSelections, providerId, selectedPetIds, services]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedPincode = window.localStorage.getItem('dofurs.header.pincode')?.trim() ?? '';
    if (/^[1-9]\d{5}$/.test(savedPincode)) {
      setManualPincode(savedPincode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePincodeUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ pincode: string }>).detail;
      const value = detail?.pincode?.trim() ?? '';
      if (/^[1-9]\d{5}$/.test(value)) {
        setManualPincode(value);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'dofurs.header.pincode') {
        const value = event.newValue?.trim() ?? '';
        if (/^[1-9]\d{5}$/.test(value)) {
          setManualPincode(value);
        }
      }
    };

    window.addEventListener('dofurs:pincode-updated', handlePincodeUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('dofurs:pincode-updated', handlePincodeUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    if (!window.isSecureContext) {
      return;
    }

    const hasSavedPincode = /^[1-9]\d{5}$/.test(window.localStorage.getItem('dofurs.header.pincode')?.trim() ?? '');

    // Respect previously selected pincode and avoid replacing it with device location.
    if (hasSavedPincode) {
      return;
    }

    let isCancelled = false;

    const detectPincodeFromDevice = async () => {
      setIsDetectingPincode(true);

      try {
        if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          if (permissionStatus.state !== 'granted') {
            return;
          }
        } else {
          return;
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 300000,
          });
        });

        if (isCancelled) {
          return;
        }

        const { latitude: lat, longitude: lon } = position.coords;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          },
        );

        if (!response.ok || isCancelled) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as {
          address?: { postcode?: string };
        } | null;

        const postcodeRaw = payload?.address?.postcode ?? '';
        const normalized = postcodeRaw.replace(/\D/g, '').slice(0, 6);

        if (/^[1-9]\d{5}$/.test(normalized)) {
          const userSelectedPincode = window.localStorage.getItem('dofurs.header.pincode')?.trim() ?? '';

          // Guard against races where user changes pincode while geolocation is in flight.
          if (/^[1-9]\d{5}$/.test(userSelectedPincode)) {
            return;
          }

          setManualPincode(normalized);
          window.localStorage.setItem('dofurs.header.pincode', normalized);
        }
      } catch (err) { console.error(err);
        // Silent fallback to saved address or cached header pincode.
      } finally {
        if (!isCancelled) {
          setIsDetectingPincode(false);
        }
      }
    };

    void detectPincodeFromDevice();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (manualPincode.trim()) {
      return;
    }

    const fallbackPincode = selectedAddress?.pincode?.trim() ?? '';
    if (/^[1-9]\d{5}$/.test(fallbackPincode)) {
      setManualPincode(fallbackPincode);
    }
  }, [manualPincode, selectedAddress]);

  const checkAreaCoverage = useCallback(
    async (targetPincode: string) => {
      const normalizedPincode = targetPincode.trim();

      if (!/^[1-9]\d{5}$/.test(normalizedPincode)) {
        setHasCheckedAreaCoverage(false);
        setAreaCoverageServices([]);
        setAreaCoverageError('Unable to detect your service area. Please enable location permission and refresh.');
        return;
      }

      setIsCheckingAreaCoverage(true);
      setAreaCoverageError(null);

      try {
        const payload = await apiRequest<AreaCoverageResponse>(
          `/api/bookings/admin-flow-availability?pincode=${normalizedPincode}&strictCoverage=true`,
        );
        setAreaCoverageServices(payload.services ?? []);
        setHasCheckedAreaCoverage(true);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('dofurs.header.pincode', normalizedPincode);
        }
      } catch (error) {
        const message = toCoverageErrorMessage(error);
        setAreaCoverageServices([]);
        setHasCheckedAreaCoverage(false);
        setAreaCoverageError(message);
      } finally {
        setIsCheckingAreaCoverage(false);
      }
    },
    [toCoverageErrorMessage],
  );

  const fetchAreaCoverageByPincode = useCallback(
    async (targetPincode: string): Promise<AreaCoverageCheckResult> => {
      const normalizedPincode = targetPincode.trim();

      if (!/^[1-9]\d{5}$/.test(normalizedPincode)) {
        return {
          services: [],
          error: 'Please enter a valid 6-digit pincode.',
        };
      }

      try {
        const payload = await apiRequest<AreaCoverageResponse>(
          `/api/bookings/admin-flow-availability?pincode=${normalizedPincode}&strictCoverage=true`,
        );

        return {
          services: payload.services ?? [],
          error: null,
        };
      } catch (error) {
        return {
          services: [],
          error: toCoverageErrorMessage(error),
        };
      }
    },
    [toCoverageErrorMessage],
  );

  const checkSelectedAddressCoverage = useCallback(
    async (targetPincode: string) => {
      setIsCheckingSelectedAddressCoverage(true);
      const result = await fetchAreaCoverageByPincode(targetPincode);
      setSelectedAddressCoverageServices(result.services);
      setSelectedAddressCoverageError(result.error);
      setHasCheckedSelectedAddressCoverage(result.error === null);
      setIsCheckingSelectedAddressCoverage(false);
    },
    [fetchAreaCoverageByPincode],
  );

  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(availabilityPincode)) {
      setHasCheckedAreaCoverage(false);
      setAreaCoverageServices([]);
      setAreaCoverageError(null);
      return;
    }

    void checkAreaCoverage(availabilityPincode);
  }, [availabilityPincode, checkAreaCoverage]);

  const selectedAddressPincode = useMemo(() => {
    const direct = selectedAddress?.pincode?.trim() ?? '';
    if (/^[1-9]\d{5}$/.test(direct)) {
      return direct;
    }

    const fromAddressLine = selectedAddress?.address_line_1?.match(/\b([1-9]\d{5})\b/)?.[1] ?? '';
    if (/^[1-9]\d{5}$/.test(fromAddressLine)) {
      return fromAddressLine;
    }

    const fromAddressLine2 = selectedAddress?.address_line_2?.match(/\b([1-9]\d{5})\b/)?.[1] ?? '';
    if (/^[1-9]\d{5}$/.test(fromAddressLine2)) {
      return fromAddressLine2;
    }

    return '';
  }, [selectedAddress]);

  const isSelectedAddressServiceable =
    hasCheckedSelectedAddressCoverage &&
    selectedAddressCoverageError === null &&
    selectedAddressCoverageServices.length > 0;

  const minBookableDate = useMemo(() => getIstDateString(0), []);
  const maxBookableDate = useMemo(() => getIstDateString(29), []);

  useEffect(() => {
    if (bookingMode !== 'home_visit') {
      setIsCheckingSelectedAddressCoverage(false);
      setHasCheckedSelectedAddressCoverage(false);
      setSelectedAddressCoverageServices([]);
      setSelectedAddressCoverageError(null);
      return;
    }

    if (!selectedSavedAddressId || !selectedAddressPincode) {
      setIsCheckingSelectedAddressCoverage(false);
      setHasCheckedSelectedAddressCoverage(false);
      setSelectedAddressCoverageServices([]);
      setSelectedAddressCoverageError(null);
      return;
    }

    void checkSelectedAddressCoverage(selectedAddressPincode);
  }, [bookingMode, checkSelectedAddressCoverage, selectedAddressPincode, selectedSavedAddressId]);

  const handleManualPincodeCheck = useCallback(async () => {
    const normalized = manualPincode.trim();

    if (!/^[1-9]\d{5}$/.test(normalized)) {
      setHasCheckedAreaCoverage(false);
      setAreaCoverageServices([]);
      setAreaCoverageError('Please enter a valid 6-digit pincode to check availability.');
      return;
    }

    await checkAreaCoverage(normalized);
  }, [checkAreaCoverage, manualPincode]);

  const refreshAvailability = useCallback(
    async ({
      targetDate,
      targetStartTime,
      keepSelection,
    }: {
      targetDate?: string;
      targetStartTime?: string;
      keepSelection?: boolean;
    }) => {
      if (!availabilityPincode || !serviceTypeSelection) {
        setAvailability({
          services: [],
          providers: [],
          slotOptions: [],
          recommendedSlotStartTime: null,
          recommendedProviderServiceId: null,
        });
        setProviderId(null);
        setServiceId(null);
        return null;
      }

      const params = new URLSearchParams({
        pincode: availabilityPincode,
        serviceType: serviceTypeSelection,
      });

      if (bookingMode) {
        params.set('bookingMode', bookingMode);
      }

      if (selectedServiceTypesParam) {
        params.set('serviceTypes', selectedServiceTypesParam);
      }

      if (totalDurationMinutes > 0) {
        params.set('serviceDurationMinutes', String(totalDurationMinutes));
      }

      params.set('strictCoverage', 'true');

      if (targetDate) {
        params.set('bookingDate', targetDate);
      }

      if (targetStartTime) {
        params.set('startTime', targetStartTime);
      }

      const payload = await apiRequest<AvailabilityResponse>(`/api/bookings/admin-flow-availability?${params.toString()}`);
      setAvailability(payload);

      const providersForSelectedSlot = payload.providers.filter((provider) => provider.availableForSelectedSlot);

      const currentProviderId = providerIdRef.current;
      const currentServiceId = serviceIdRef.current;

      const shouldKeepSelection = Boolean(
        keepSelection &&
          currentProviderId &&
          currentServiceId &&
          providersForSelectedSlot.some(
            (provider) => provider.providerId === currentProviderId && provider.providerServiceId === currentServiceId,
          ),
      );

      if (shouldKeepSelection) {
        return payload;
      }

      if (!targetStartTime) {
        // For boarding services, auto-select best provider even without a time slot
        if (isBoardingServiceType(serviceTypeSelection)) {
          const allProviders = payload.providers;
          const recommended = allProviders.find((p) => p.recommended) ?? allProviders[0];
          if (recommended) {
            setProviderId(recommended.providerId);
            setServiceId(recommended.providerServiceId);
          } else {
            setProviderId(null);
            setServiceId(null);
          }
        } else {
          setProviderId(null);
          setServiceId(null);
        }
        return payload;
      }

      const recommendedProvider = providersForSelectedSlot.find((provider) => provider.recommended);
      const fallbackProvider = providersForSelectedSlot[0] ?? null;
      const selectedProvider = selectedAutoProvider
        ? recommendedProvider ?? fallbackProvider
        : providersForSelectedSlot.find((provider) => provider.providerId === currentProviderId) ?? null;

      if (!selectedProvider) {
        setProviderId(null);
        setServiceId(null);
        return payload;
      }

      setProviderId(selectedProvider.providerId);
      setServiceId(selectedProvider.providerServiceId);
      return payload;
    },
    [availabilityPincode, bookingMode, selectedAutoProvider, selectedServiceTypesParam, serviceTypeSelection, totalDurationMinutes],
  );

  useEffect(() => {
    if (!serviceTypeSelection || !bookingDate) {
      if (!serviceTypeSelection) {
        setAvailability({
          services: [],
          providers: [],
          slotOptions: [],
          recommendedSlotStartTime: null,
          recommendedProviderServiceId: null,
        });
      }
      setProviderId(null);
      setServiceId(null);
      return;
    }

    let isMounted = true;

    async function loadAvailability() {
      try {
        const payload = await refreshAvailability({
          targetDate: bookingDate,
          targetStartTime: slotStartTime || undefined,
          keepSelection: !selectedAutoProvider,
        });

        if (!isMounted) {
          return;
        }

        if (!slotStartTime && payload && payload.slotOptions.length > 0) {
          const recommended = payload.slotOptions.find((slot) => slot.recommended) ?? payload.slotOptions[0];
          if (recommended) {
            setSlotStartTime(recommended.startTime);
          }
        }
      } catch (err) { console.error(err);
        if (isMounted) {
          setAvailability({
            services: [],
            providers: [],
            slotOptions: [],
            recommendedSlotStartTime: null,
            recommendedProviderServiceId: null,
          });
          setProviderId(null);
          setServiceId(null);
        }
      }
    }

    void loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [bookingDate, refreshAvailability, selectedAutoProvider, serviceTypeSelection, slotStartTime]);

  const loadAvailableDateOptions = useCallback(async () => {
    if (!availabilityPincode || !serviceTypeSelection) {
      setAvailableDateOptions([]);
      return;
    }

    if (bookingMode === 'home_visit' && !isPackageBooking && !isSelectedAddressServiceable) {
      setAvailableDateOptions([]);
      return;
    }

    setIsLoadingAvailableDateOptions(true);

    try {
      const providerParams = new URLSearchParams({
        pincode: availabilityPincode,
        serviceType: serviceTypeSelection,
        strictCoverage: 'true',
      });

      if (bookingMode) {
        providerParams.set('bookingMode', bookingMode);
      }

      if (selectedServiceTypesParam) {
        providerParams.set('serviceTypes', selectedServiceTypesParam);
      }

      if (totalDurationMinutes > 0) {
        providerParams.set('serviceDurationMinutes', String(totalDurationMinutes));
      }

      const providerSnapshot = await apiRequest<AvailabilityResponse>(
        `/api/bookings/admin-flow-availability?${providerParams.toString()}`,
      );

      const uniqueProviderIds = Array.from(
        new Set(providerSnapshot.providers.map((provider) => provider.providerId)),
      ).slice(0, 10);

      if (uniqueProviderIds.length === 0) {
        setAvailableDateOptions([]);
        return;
      }

      const dateAvailabilityResponses = await Promise.all(
        uniqueProviderIds.map(async (providerId) => {
          const params = new URLSearchParams({
            providerId: String(providerId),
            fromDate: minBookableDate,
            toDate: maxBookableDate,
          });

          if (totalDurationMinutes > 0) {
            params.set('serviceDurationMinutes', String(totalDurationMinutes));
          }

          try {
            return await apiRequest<MultiDayAvailabilityResponse>(
              `/api/bookings/availability-calendar?${params.toString()}`,
            );
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
        setBookingDate('');
        setSlotStartTime('');
        return;
      }

      if (!bookingDate || !sortedAvailableDates.includes(bookingDate)) {
        setBookingDate(sortedAvailableDates[0]);
        setSlotStartTime('');
      }
    } finally {
      setIsLoadingAvailableDateOptions(false);
    }
  }, [
    availabilityPincode,
    bookingMode,
    isPackageBooking,
    isSelectedAddressServiceable,
    maxBookableDate,
    minBookableDate,
    bookingDate,
    selectedServiceTypesParam,
    serviceTypeSelection,
    totalDurationMinutes,
  ]);

  useEffect(() => {
    if (currentStep !== 'datetime') {
      return;
    }

    void loadAvailableDateOptions();
  }, [currentStep, loadAvailableDateOptions]);

  useEffect(() => {
    if (isPackageBooking || !slotStartTime) {
      return;
    }

    const selectedSlot = availability.slotOptions.find((slot) => slot.startTime === slotStartTime) ?? null;

    if (!selectedSlot) {
      setSlotStartTime('');
      setProviderId(null);
      setServiceId(null);
      showToast('Your previous slot no longer fits the selected services. Please choose a new slot.', 'error');
      return;
    }

    const selectedSlotDuration = getSlotDurationMinutes(selectedSlot.startTime, selectedSlot.endTime);

    if (selectedSlotDuration < totalDurationMinutes) {
      setSlotStartTime('');
      setProviderId(null);
      setServiceId(null);
      showToast('Selected services need a longer slot. Please choose a new slot.', 'error');
    }
  }, [availability.slotOptions, isPackageBooking, showToast, slotStartTime, totalDurationMinutes]);

  // Load add-ons when service changes
  useEffect(() => {
    if (!serviceId) {
      setServiceAddOns([]);
      setSelectedAddOns({});
      return;
    }

    let isMounted = true;

    async function loadAddOns() {
      try {
        const payload = await apiRequest<{ success: boolean; data: ServiceAddon[] }>(`/api/services/addons/${serviceId}`);
        if (!isMounted) return;
        setServiceAddOns(payload.data ?? []);
        setSelectedAddOns({});
      } catch (err) { console.error(err);
        if (isMounted) {
          setServiceAddOns([]);
        }
      }
    }

    void loadAddOns();

    return () => {
      isMounted = false;
    };
  }, [serviceId]);

  // Calculate pricing
  useEffect(() => {
    if (!providerId) {
      setPriceCalculation(null);
      return;
    }

    if (!serviceId) {
      setPriceCalculation(null);
      return;
    }

    let isMounted = true;

    async function calculatePrice() {
      const resolvedProviderId = providerId;
      if (!resolvedProviderId) {
        return;
      }

      try {
        const payload = await apiRequest<{ success: boolean; data: PricingBreakdown }>('/api/services/calculate-price', {
          method: 'POST',
          body: JSON.stringify({
            bookingType: 'service',
            serviceId,
            providerId: resolvedProviderId.toString(),
            addOns: Object.entries(selectedAddOns)
              .filter(([, qty]) => qty > 0)
              .map(([id, quantity]) => ({ id, quantity })),
          }),
        });

        if (!isMounted) return;
        setPriceCalculation(payload.data ?? null);
      } catch (err) { console.error(err);
        if (isMounted) {
          setPriceCalculation(null);
        }
      }
    }

    calculatePrice();

    return () => {
      isMounted = false;
    };
  }, [providerId, serviceId, selectedAddOns]);

  // Clear discount when service changes
  useEffect(() => {
    setDiscountCode('');
    setDiscountPreview(null);
  }, [serviceId]);

  useEffect(() => {
    setPaymentChoice('cash');
  }, [serviceId]);

  useEffect(() => {
    if (uniqueSelectedServiceTypes.length === 0) {
      setCreditEligibility(null);
      setSubscriptionCreditUnavailableReason(null);
      return;
    }

    if (uniqueSelectedServiceTypes.some((serviceType) => isPackageServiceType(serviceType))) {
      setCreditEligibility({
        eligible: false,
        subscriptionId: null,
        serviceType: uniqueSelectedServiceTypes[0] ?? '',
        matchedCreditServiceType: null,
        availableCredits: 0,
        totalCredits: 0,
        reason: 'Subscription credits are not available for birthday or boarding services.',
      });
      setSubscriptionCreditUnavailableReason('Subscription credits are not available for birthday or boarding services.');
      return;
    }

    let isMounted = true;

    async function loadCreditEligibility() {
      setIsCheckingCreditEligibility(true);

      try {
        const responses = await Promise.all(
          uniqueSelectedServiceTypes.map(async (serviceType) => {
            const params = new URLSearchParams({ serviceType });
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
            ineligible.reason ?? 'Subscription credit is not available for one or more selected services.',
          );
          return;
        }

        const primary = responses[0];

        const availableCreditsByBucket = new Map<string, number>();
        for (const response of responses) {
          const bucketKey = (response.matchedCreditServiceType ?? response.serviceType).trim().toLowerCase();
          const current = availableCreditsByBucket.get(bucketKey) ?? 0;
          availableCreditsByBucket.set(bucketKey, Math.max(current, Number(response.availableCredits ?? 0)));
        }
        const totalAvailableCredits = Array.from(availableCreditsByBucket.values()).reduce((sum, value) => sum + value, 0);

        const singleServiceAmount = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
        const requiredCredits =
          totalSelectedServices > 1
            ? (bundlePriceTotal > 0 ? bundlePriceTotal : singleServiceAmount * totalSelectedServices)
            : singleServiceAmount;
        const hasEnoughCredits = totalAvailableCredits >= requiredCredits;

        setCreditEligibility({
          ...primary,
          availableCredits: totalAvailableCredits,
          eligible: hasEnoughCredits,
        });

        setSubscriptionCreditUnavailableReason(
          hasEnoughCredits
            ? null
            : `You need ${Math.ceil(requiredCredits)} credits, but only ${Math.floor(totalAvailableCredits)} are available.`,
        );
      } catch (err) { console.error(err);
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
  }, [
    bundlePriceTotal,
    discountPreview?.finalAmount,
    isPackageBooking,
    priceCalculation?.final_total,
    totalSelectedServices,
    uniqueSelectedServiceTypes,
  ]);

  useEffect(() => {
    if (paymentChoice === 'subscription_credit' && !creditEligibility?.eligible) {
      setPaymentChoice('cash');
    }
  }, [creditEligibility?.eligible, paymentChoice]);

  useEffect(() => {
    const razorpayOnWindow =
      typeof window !== 'undefined' &&
      Boolean((window as Window & { Razorpay?: unknown }).Razorpay);

    if (typeof window === 'undefined' || razorpayOnWindow) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const normalizedAddOns = Object.entries(selectedAddOns)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ id, quantity }));

    const hasCartSelection = totalSelectedServices > 0 || normalizedAddOns.length > 0;

    if (!hasCartSelection) {
      window.localStorage.removeItem(SERVICE_CART_STORAGE_KEY);
      window.dispatchEvent(new Event(SERVICE_CART_UPDATED_EVENT));
      return;
    }

    window.localStorage.setItem(
      SERVICE_CART_STORAGE_KEY,
      JSON.stringify({
        serviceId,
        serviceCount: totalSelectedServices,
        addOns: normalizedAddOns,
        updatedAt: Date.now(),
      }),
    );
    window.dispatchEvent(new Event(SERVICE_CART_UPDATED_EVENT));
  }, [selectedAddOns, serviceId, totalSelectedServices]);

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || hasHydratedDraftRef.current) {
      return;
    }

    hasHydratedDraftRef.current = true;

    if (isRescheduleMode) {
      window.localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
      return;
    }

    const rawDraft = window.localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      return;
    }

    try {
      const parsedDraft = JSON.parse(rawDraft) as Partial<BookingDraftSnapshot>;

      const validPetIds = new Set(pets.map((pet) => pet.id));
      const restoredPetIds = Array.isArray(parsedDraft.selectedPetIds)
        ? parsedDraft.selectedPetIds.filter((id) => Number.isInteger(id) && validPetIds.has(id))
        : [];

      const restoredSelections: Record<number, PetServiceSelection> = {};
      if (parsedDraft.petServiceSelections && typeof parsedDraft.petServiceSelections === 'object') {
        for (const [key, value] of Object.entries(parsedDraft.petServiceSelections)) {
          const petIdValue = Number.parseInt(key, 10);
          if (!Number.isInteger(petIdValue) || !restoredPetIds.includes(petIdValue)) {
            continue;
          }

          if (!value || typeof value !== 'object') {
            continue;
          }

          // Handle new array format
          if (Array.isArray(value)) {
            restoredSelections[petIdValue] = value
              .filter((entry: unknown): entry is { serviceType: string; quantity: number } =>
                !!entry && typeof entry === 'object' && 'serviceType' in entry && typeof (entry as Record<string, unknown>).serviceType === 'string',
              )
              .map((entry) => ({
                serviceType: entry.serviceType,
                quantity: Number.isFinite(Number(entry.quantity)) ? Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Number(entry.quantity))) : 1,
              }));
            continue;
          }

          // Handle legacy single-service format { serviceType, quantity }
          const legacy = value as { serviceType?: unknown; quantity?: unknown };
          const serviceType = typeof legacy.serviceType === 'string' ? legacy.serviceType : null;
          const quantity = Number.isFinite(Number(legacy.quantity)) ? Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, Number(legacy.quantity))) : 1;

          restoredSelections[petIdValue] = serviceType ? [{ serviceType, quantity }] : [];
        }
      }

      if (restoredPetIds.length > 0) {
        setSelectedPetIds(restoredPetIds);
        setPetId(restoredPetIds[0]);
        setPetServiceSelections(restoredSelections);
      }

      // Remap legacy step names from 4-step flow to 3-step flow
      const remapStep = (s: string): BookingStep => {
        if (s === 'pet' || s === 'service' || s === 'pet-service') return 'pet-service';
        if (s === 'datetime') return 'datetime';
        if (s === 'review') return 'review';
        return 'pet-service';
      };
      if (parsedDraft.currentStep) {
        setCurrentStep(remapStep(parsedDraft.currentStep));
      }

      if (parsedDraft.bookingMode === 'home_visit' || parsedDraft.bookingMode === 'clinic_visit' || parsedDraft.bookingMode === 'teleconsult') {
        setBookingMode(parsedDraft.bookingMode);
      }

      if (typeof parsedDraft.bookingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsedDraft.bookingDate)) {
        setBookingDate(parsedDraft.bookingDate);
      }

      if (typeof parsedDraft.bookingEndDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsedDraft.bookingEndDate)) {
        setBookingEndDate(parsedDraft.bookingEndDate);
      }

      if (typeof parsedDraft.slotStartTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(parsedDraft.slotStartTime)) {
        setSlotStartTime(parsedDraft.slotStartTime);
      }

      if (typeof parsedDraft.locationAddress === 'string') {
        setLocationAddress(parsedDraft.locationAddress);
      }

      if (typeof parsedDraft.latitude === 'string') {
        setLatitude(parsedDraft.latitude);
      }

      if (typeof parsedDraft.longitude === 'string') {
        setLongitude(parsedDraft.longitude);
      }

      if (typeof parsedDraft.selectedSavedAddressId === 'string') {
        const foundAddress = savedAddresses.some((address) => address.id === parsedDraft.selectedSavedAddressId);
        setSelectedSavedAddressId(foundAddress ? parsedDraft.selectedSavedAddressId : null);
      } else if (parsedDraft.selectedSavedAddressId === null) {
        setSelectedSavedAddressId(null);
      }

      if (typeof parsedDraft.providerNotes === 'string') {
        setProviderNotes(parsedDraft.providerNotes);
      }

      if (typeof parsedDraft.manualPincode === 'string') {
        setManualPincode(parsedDraft.manualPincode);
      }

      if (typeof parsedDraft.selectedAutoProvider === 'boolean') {
        setSelectedAutoProvider(parsedDraft.selectedAutoProvider);
      }

      if (typeof parsedDraft.providerId === 'number' && Number.isFinite(parsedDraft.providerId) && parsedDraft.providerId > 0) {
        setProviderId(parsedDraft.providerId);
      }

      if (typeof parsedDraft.serviceId === 'string' && parsedDraft.serviceId.trim()) {
        setServiceId(parsedDraft.serviceId);
      }

      if (parsedDraft.selectedAddOns && typeof parsedDraft.selectedAddOns === 'object') {
        const normalizedAddOns: Record<string, number> = {};

        for (const [addOnId, quantity] of Object.entries(parsedDraft.selectedAddOns)) {
          const normalizedQuantity = Number.isFinite(Number(quantity)) ? Math.max(0, Math.min(20, Number(quantity))) : 0;
          if (normalizedQuantity > 0) {
            normalizedAddOns[addOnId] = normalizedQuantity;
          }
        }

        setSelectedAddOns(normalizedAddOns);
      }

      if (typeof parsedDraft.discountCode === 'string') {
        setDiscountCode(parsedDraft.discountCode);
      }

      if (
        parsedDraft.paymentChoice === 'online' ||
        parsedDraft.paymentChoice === 'cash' ||
        parsedDraft.paymentChoice === 'subscription_credit'
      ) {
        setPaymentChoice(parsedDraft.paymentChoice);
      }
    } catch (err) { console.error(err);
      window.localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    }
  }, [isLoading, isRescheduleMode, pets, savedAddresses]);

  useEffect(() => {
    if (isLoading || !rescheduleBookingId || hasHydratedRescheduleRef.current) {
      return;
    }

    hasHydratedRescheduleRef.current = true;

    let isMounted = true;

    async function hydrateRescheduleBooking() {
      try {
        const payload = await apiRequest<{ bookings: UserBookingRecord[] }>('/api/user/bookings');
        if (!isMounted) {
          return;
        }

        const sourceBooking = payload.bookings.find((booking) => booking.id === rescheduleBookingId);
        if (!sourceBooking) {
          showToast('Unable to load the booking to reschedule. Please try again from your dashboard.', 'error');
          return;
        }

        if (sourceBooking.booking_status !== 'pending' && sourceBooking.booking_status !== 'confirmed') {
          showToast('Only pending or confirmed bookings can be rescheduled.', 'error');
          return;
        }

        if (!pets.some((pet) => pet.id === sourceBooking.pet_id)) {
          showToast('This booking references a pet that is no longer available in your profile.', 'error');
          return;
        }

        const serviceType = sourceBooking.service_type?.trim() ?? '';
        if (!serviceType) {
          showToast('Unable to identify the original service for this booking.', 'error');
          return;
        }

        const matchingServices = services.filter(
          (service) =>
            service.source === 'provider_services' &&
            service.provider_id === sourceBooking.provider_id &&
            service.service_type.toLowerCase() === serviceType.toLowerCase(),
        );

        const resolvedService =
          matchingServices.find((service) => service.id === sourceBooking.provider_service_id) ?? matchingServices[0] ?? null;

        if (!resolvedService) {
          showToast('The original provider/service is no longer available. Please select a new service to continue.', 'error');
          return;
        }

        const resolvedMode =
          sourceBooking.booking_mode === 'home_visit' ||
          sourceBooking.booking_mode === 'clinic_visit' ||
          sourceBooking.booking_mode === 'teleconsult'
            ? sourceBooking.booking_mode
            : 'home_visit';

        setSelectedPetIds([sourceBooking.pet_id]);
        setPetId(sourceBooking.pet_id);
        setPetServiceSelections({
          [sourceBooking.pet_id]: [{
            serviceType,
            quantity: 1,
          }],
        });
        setBookingMode(resolvedMode);
        setSelectedAutoProvider(false);
        setProviderId(sourceBooking.provider_id);
        setServiceId(resolvedService.id);
        setBookingDate('');
        setSlotStartTime('');
        setProviderNotes('');
        setDiscountCode('');
        setDiscountPreview(null);
        setSelectedAddOns({});
        setPaymentChoice('cash');

        if (resolvedMode === 'home_visit') {
          setLocationAddress(sourceBooking.location_address ?? '');
          setLatitude(sourceBooking.latitude !== null ? String(sourceBooking.latitude) : '');
          setLongitude(sourceBooking.longitude !== null ? String(sourceBooking.longitude) : '');
        }

        setCurrentStep('datetime');
        setFlowState('collecting');
        showToast(`Rescheduling booking #${rescheduleBookingId}. Select a new date and time.`, 'success');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to start reschedule flow. Please try again.';
        showToast(message, 'error');
      }
    }

    void hydrateRescheduleBooking();

    return () => {
      isMounted = false;
    };
  }, [isLoading, pets, rescheduleBookingId, services, showToast]);

  const cancelOriginalBookingAfterReschedule = useCallback(
    async (newBookingId?: number) => {
      if (!rescheduleBookingId) {
        return;
      }

      try {
        await apiRequest(`/api/bookings/${rescheduleBookingId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            cancellationReason: newBookingId
              ? `Rescheduled to booking #${newBookingId}`
              : 'Rescheduled by customer from booking flow',
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
              cancellationReason: `Automatic rollback: failed to cancel original booking #${rescheduleBookingId} during reschedule`,
            }),
          });

          throw new Error(
            `Reschedule could not complete because original booking #${rescheduleBookingId} could not be cancelled. New booking #${newBookingId} was automatically cancelled.`,
          );
        } catch {
          throw new Error(
            `Reschedule failed after creating booking #${newBookingId}. Original booking #${rescheduleBookingId} is still active and automatic rollback failed. Please contact support immediately.`,
          );
        }
      }
    },
    [rescheduleBookingId],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || flowState === 'success') {
      return;
    }

    const draft: BookingDraftSnapshot = {
      currentStep,
      selectedPetIds,
      petServiceSelections,
      bookingMode,
      bookingDate,
      slotStartTime,
      locationAddress,
      latitude,
      longitude,
      selectedSavedAddressId,
      providerNotes,
      manualPincode,
      selectedAutoProvider,
      providerId,
      serviceId,
      selectedAddOns,
      discountCode,
      paymentChoice,
      bookingEndDate,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    bookingDate,
    bookingEndDate,
    bookingMode,
    currentStep,
    discountCode,
    flowState,
    isLoading,
    latitude,
    locationAddress,
    longitude,
    manualPincode,
    paymentChoice,
    petServiceSelections,
    providerId,
    providerNotes,
    selectedAddOns,
    selectedAutoProvider,
    selectedPetIds,
    selectedSavedAddressId,
    serviceId,
    slotStartTime,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (flowState === 'success') {
      window.localStorage.setItem(BOOKING_SUCCESS_FLAG_KEY, '1');
    } else {
      window.localStorage.removeItem(BOOKING_SUCCESS_FLAG_KEY);
    }

    window.dispatchEvent(new Event(BOOKING_SUCCESS_EVENT));
  }, [flowState]);

  const handlePetToggle = useCallback((nextPetId: number) => {
    setSelectedPetIds((prev) => {
      const exists = prev.includes(nextPetId);
      const next = exists ? prev.filter((id) => id !== nextPetId) : [...prev, nextPetId];
      setPetId(next[0] ?? null);
      return next;
    });

    setPetServiceSelections((prev) => {
      if (prev[nextPetId] && prev[nextPetId].length > 0) {
        return prev;
      }

      return {
        ...prev,
        [nextPetId]: [],
      };
    });

    setSelectedAutoProvider(true);
    setBookingDate('');
    setSlotStartTime('');
    setProviderId(null);
    setServiceId(null);
  }, []);

  const handlePetServiceChange = useCallback((selectedPetId: number, selectedServiceType: string) => {
    if (isServiceSelectionBlocked(selectedPetId, selectedServiceType)) {
      showToast('Pet Birthday Package and Pet Boarding must be booked individually. Remove other selected services to continue.', 'error');
      return;
    }

    setPetServiceSelections((prev) => {
      const current = prev[selectedPetId] ?? [];
      const existingIndex = current.findIndex((s) => s.serviceType === selectedServiceType);
      let next: PetServiceSelection;
      if (existingIndex >= 0) {
        // Deselect: remove from array
        next = current.filter((_, i) => i !== existingIndex);
      } else {
        const currentTotal = selectedPetIds.reduce((sum, petIdValue) => {
          const selections = prev[petIdValue] ?? [];
          return sum + selections.reduce((innerSum, entry) => innerSum + Math.max(1, entry.quantity), 0);
        }, 0);

        if (currentTotal >= MAX_SERVICE_SELECTIONS) {
          showToast('You can select a maximum of 2 services in one booking.', 'error');
          return prev;
        }

        // Select: add to array
        next = [...current, { serviceType: selectedServiceType, quantity: 1 }];
      }
      return { ...prev, [selectedPetId]: next };
    });

    setSelectedAutoProvider(true);
    setBookingDate('');
    setSlotStartTime('');
    setProviderId(null);
    setServiceId(null);
  }, [isServiceSelectionBlocked, selectedPetIds, showToast]);

  const handlePetQuantityChange = useCallback((selectedPetId: number, serviceType: string, quantity: number) => {
    setPetServiceSelections((prev) => {
      const current = prev[selectedPetId] ?? [];
      const existingEntry = current.find((entry) => entry.serviceType === serviceType);
      const currentQuantity = existingEntry ? Math.max(1, existingEntry.quantity) : 0;

      if (quantity <= 0) {
        // Remove the service entry when quantity reaches 0
        return { ...prev, [selectedPetId]: current.filter((s) => s.serviceType !== serviceType) };
      }

      const nextQuantity = Math.max(1, Math.min(MAX_SERVICE_SELECTIONS, quantity));
      const quantityDelta = nextQuantity - currentQuantity;

      if (quantityDelta > 0) {
        const currentTotal = selectedPetIds.reduce((sum, petIdValue) => {
          const selections = prev[petIdValue] ?? [];
          return sum + selections.reduce((innerSum, entry) => innerSum + Math.max(1, entry.quantity), 0);
        }, 0);

        if (currentTotal + quantityDelta > MAX_SERVICE_SELECTIONS) {
          showToast('You can select a maximum of 2 services in one booking.', 'error');
          return prev;
        }
      }

      return {
        ...prev,
        [selectedPetId]: current.map((s) =>
          s.serviceType === serviceType ? { ...s, quantity: nextQuantity } : s,
        ),
      };
    });

    setSelectedAutoProvider(true);
    setBookingDate('');
    setSlotStartTime('');
    setProviderId(null);
    setServiceId(null);
  }, [selectedPetIds, showToast]);

  const handleApplyServiceToAll = useCallback(
    (serviceType: string) => {
      if (selectedPetIds.some((selectedPetId) => isServiceSelectionBlocked(selectedPetId, serviceType))) {
        showToast('Pet Birthday Package and Pet Boarding must be booked individually. Remove other selected services to continue.', 'error');
        return;
      }

      let didHitSelectionLimit = false;

      setPetServiceSelections((prev) => {
        const next = { ...prev };
        let runningTotal = selectedPetIds.reduce((sum, selectedPetId) => {
          const selections = prev[selectedPetId] ?? [];
          return sum + selections.reduce((innerSum, entry) => innerSum + Math.max(1, entry.quantity), 0);
        }, 0);

        for (const selectedPetId of selectedPetIds) {
          const current = prev[selectedPetId] ?? [];
          if (!current.some((s) => s.serviceType === serviceType) && runningTotal < MAX_SERVICE_SELECTIONS) {
            next[selectedPetId] = [...current, { serviceType, quantity: 1 }];
            runningTotal += 1;
          } else if (!current.some((s) => s.serviceType === serviceType) && runningTotal >= MAX_SERVICE_SELECTIONS) {
            didHitSelectionLimit = true;
          }
        }
        return next;
      });

      if (didHitSelectionLimit) {
        showToast('You can select a maximum of 2 services in one booking.', 'error');
      }

      setSelectedAutoProvider(true);
      setBookingDate('');
      setSlotStartTime('');
      setProviderId(null);
      setServiceId(null);
    },
    [isServiceSelectionBlocked, selectedPetIds, showToast],
  );

  const handleNextStep = () => {
    // Validate current step
    if (currentStep === 'pet-service') {
      if (selectedPetIds.length === 0) {
        showToast('Please select at least one pet to continue', 'error');
        return;
      }
      if (!bookingMode) {
        if (isPackageBooking) {
          // Auto-set for package services
          setBookingMode('home_visit');
        } else {
          showToast('Please select a service mode (home visit or clinic visit)', 'error');
          return;
        }
      }
      const hasIncompleteSelection = selectedPetIds.some((selectedPetId) => {
        const selections = petServiceSelections[selectedPetId] ?? [];
        return selections.length === 0;
      });
      if (hasIncompleteSelection || totalSelectedServices === 0) {
        showToast('Select a service and quantity for each selected pet', 'error');
        return;
      }
      if (hasMixedExclusivePackageSelection) {
        showToast('Pet Birthday Package and Pet Boarding must be booked individually. Remove mixed services to continue.', 'error');
        return;
      }
      if (!isPackageBooking && !/^[1-9]\d{5}$/.test(availabilityPincode)) {
        showToast('Please set a valid 6-digit pincode to continue to scheduling', 'error');
        return;
      }
    }
    if (currentStep === 'datetime') {
      const selectedAddressPincodeValue = selectedAddress?.pincode?.trim() ?? '';

      if (!isPackageBooking && bookingMode === 'home_visit' && !selectedSavedAddressId) {
        showToast('Please select a saved service address to continue.', 'error');
        return;
      }
      if (!isPackageBooking && bookingMode === 'home_visit' && !/^[1-9]\d{5}$/.test(selectedAddressPincodeValue)) {
        showToast('Selected address is missing a valid pincode. Please update or select another address.', 'error');
        return;
      }
      if (!isPackageBooking && bookingMode === 'home_visit' && !isSelectedAddressServiceable) {
        showToast('Services are not available on your pincode yet. Please select a serviceable address.', 'error');
        return;
      }

      if (!bookingDate) {
        showToast('Please select a date', 'error');
        return;
      }
      if (isBoardingBooking && !bookingEndDate) {
        showToast('Please select an end date for boarding', 'error');
        return;
      }
      if (!isPackageBooking && !slotStartTime) {
        showToast('Please select a time slot', 'error');
        return;
      }
      if (!isPackageBooking) {
        const selectedSlot = availability.slotOptions.find((slot) => slot.startTime === slotStartTime) ?? null;
        if (!selectedSlot) {
          showToast('Selected slot is outdated. Please choose a slot again.', 'error');
          return;
        }

        const selectedSlotDuration = getSlotDurationMinutes(selectedSlot.startTime, selectedSlot.endTime);
        if (selectedSlotDuration < totalDurationMinutes) {
          showToast('Selected services require a longer slot. Please select a new slot.', 'error');
          return;
        }
      }
      // Address validation for home_visit (non-package services)
      if (!isPackageBooking && bookingMode === 'home_visit' && !locationAddress.trim()) {
        showToast('Please select your address.', 'error');
        return;
      }
      if (!isPackageBooking && bookingMode === 'home_visit' && (!latitude || !longitude)) {
        showToast('Please set your location using current location or by dropping a pin on the map.', 'error');
        return;
      }
      // Provider validation (skip for package services — auto-selected)
      if (!isPackageBooking) {
        if (!providerId || !serviceId) {
          showToast(`Please select a ${bookingMode === 'clinic_visit' ? 'clinic' : 'provider'} for the selected slot`, 'error');
          return;
        }
      }

      const selectedServiceTypes = new Set(
        selectedPetIds
          .flatMap((selectedPetId) => (petServiceSelections[selectedPetId] ?? []).map((s) => s.serviceType))
          .filter((value): value is string => Boolean(value)),
      );

      const providerSupportedTypes = new Set(
        services
          .filter((service) => service.provider_id === providerId)
          .map((service) => service.service_type),
      );

      const hasUnsupportedType = Array.from(selectedServiceTypes).some((type) => !providerSupportedTypes.has(type));
      if (hasUnsupportedType) {
        showToast('Selected provider does not support every service in your bundle', 'error');
        return;
      }
    }

    const steps: BookingStep[] = ['pet-service', 'datetime', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePreviousStep = () => {
    const steps: BookingStep[] = ['pet-service', 'datetime', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      // Reset wallet credits so they don't carry stale state if the user changes
      // their selection and comes back to the review step
      if (currentStep === 'review') {
        setWalletCreditsToApply(0);
      }
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleChangeSelectedService = useCallback(() => {
    setWalletCreditsToApply(0);
    setCurrentStep('pet-service');
  }, []);

  const handleChangeDateTime = useCallback(() => {
    setWalletCreditsToApply(0);
    setCurrentStep('datetime');
  }, []);

  const handleChangePet = useCallback(() => {
    setWalletCreditsToApply(0);
    setCurrentStep('pet-service');
  }, []);

  const handleChangeProvider = useCallback(() => {
    setWalletCreditsToApply(0);
    setCurrentStep('datetime');
  }, []);

  const handleChangeAddress = useCallback(() => {
    setWalletCreditsToApply(0);
    setCurrentStep('datetime');
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const target = stepContainerRef.current;
    if (!target) {
      return;
    }

    const targetTop = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth',
    });
  }, [currentStep]);

  const applyDiscount = async (code: string) => {
    if (totalSelectedServices > 1) {
      showToast('Discounts can be applied to single-service bookings only right now', 'error');
      return false;
    }

    if (!serviceId) {
      showToast('Select a service before applying discount', 'error');
      return false;
    }

    try {
      const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
        method: 'POST',
        body: JSON.stringify({
          providerServiceId: serviceId,
          discountCode: code.trim().toUpperCase(),
        }),
      });

      if (payload?.preview) {
        setDiscountCode(payload.preview.code);
        setDiscountPreview(payload.preview);
        return true;
      } else {
        setDiscountPreview(null);
        showToast('Discount code not valid', 'error');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply discount';
      showToast(message, 'error');
      return false;
    }
  };

  const persistBookingSuccess = (payload: {
    bookingDateValue: string;
    slotStartTimeValue: string;
    bookingModeValue: 'home_visit' | 'clinic_visit' | 'teleconsult';
    providerIdValue: number;
    petIdValue: number;
    serviceIdValue: string | null;
    locationAddressValue: string;
    totalAmountValue: number;
    amountStatus: 'payable' | 'paid';
  }) => {
    globalThis.localStorage?.setItem('booking.preferredProviderId', String(payload.providerIdValue));
    if (payload.serviceIdValue) {
      globalThis.localStorage?.setItem('booking.preferredServiceId', payload.serviceIdValue);
      const usageRaw = globalThis.localStorage?.getItem('booking.serviceUsage');
      const usage = usageRaw ? (JSON.parse(usageRaw) as Record<string, number>) : {};
      usage[payload.serviceIdValue] = (usage[payload.serviceIdValue] ?? 0) + 1;
      globalThis.localStorage?.setItem('booking.serviceUsage', JSON.stringify(usage));
    }
    if (payload.bookingModeValue === 'home_visit' && payload.locationAddressValue.trim()) {
      globalThis.localStorage?.setItem('booking.lastUsedAddress', payload.locationAddressValue.trim());
    }

    globalThis.localStorage?.removeItem(SERVICE_CART_STORAGE_KEY);
    globalThis.localStorage?.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    globalThis.window?.dispatchEvent(new Event(SERVICE_CART_UPDATED_EVENT));

    const providerName = providers.find((p) => p.id === payload.providerIdValue)?.name;
    const petName = pets.find((p) => p.id === payload.petIdValue)?.name;

    setLastBookingSummary({
      bookingDate: payload.bookingDateValue,
      slotStartTime: payload.slotStartTimeValue,
      bookingMode: payload.bookingModeValue,
      providerName,
      petName,
      totalAmount: payload.totalAmountValue,
      amountStatus: payload.amountStatus,
    });
  };

  const addMinutesToTime = (time: string, minutesToAdd: number) => {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    const base = new Date();
    base.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    base.setMinutes(base.getMinutes() + minutesToAdd);
    return `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
  };

  const submitBooking = async () => {
    // For package services, ensure a default slot time is set
    const effectiveSlotStartTime = slotStartTime || (isPackageBooking ? '09:00' : '');

    // Final validation
    if (!bookingDate || selectedPetIds.length === 0) {
      showToast('Please complete all steps', 'error');
      return;
    }

    if (!isPackageBooking && (!providerId || !effectiveSlotStartTime)) {
      showToast('Please complete all steps', 'error');
      return;
    }

    if (!isPackageBooking) {
      const selectedSlot = availability.slotOptions.find((slot) => slot.startTime === effectiveSlotStartTime) ?? null;
      if (!selectedSlot) {
        showToast('Selected slot is outdated. Please select the slot again.', 'error');
        return;
      }

      const selectedSlotDuration = getSlotDurationMinutes(selectedSlot.startTime, selectedSlot.endTime);
      if (selectedSlotDuration < totalDurationMinutes) {
        showToast('Selected services require a longer slot. Please select a larger slot.', 'error');
        return;
      }
    }

    if (!bookingMode) {
      if (isPackageBooking) {
        setBookingMode('home_visit');
      } else {
        showToast('Please select a booking mode', 'error');
        return;
      }
    }

    if (!isPackageBooking && bookingMode === 'home_visit' && (!locationAddress.trim() || !latitude || !longitude)) {
      showToast('For home visit, add your address and use location detection.', 'error');
      return;
    }

    if (paymentChoice === 'subscription_credit' && !creditEligibility?.eligible) {
      showToast(subscriptionCreditUnavailableReason ?? 'Subscription credit is not available for this booking.', 'error');
      return;
    }

    setFlowState('submitting');
    setIsPending(true);

    const selectedBookingMode = bookingMode ?? 'home_visit';
    const resolvedProviderId =
      providerId ??
      availability.providers.find((provider) => provider.recommended && provider.availableForSelectedSlot)?.providerId ??
      availability.providers.find((provider) => provider.availableForSelectedSlot)?.providerId ??
      availability.providers[0]?.providerId ??
      null;

    if (!resolvedProviderId) {
      setFlowState('error');
      setIsPending(false);
      showToast('No provider available for selected services. Please try again later.', 'error');
      return;
    }

    if (!providerId) {
      setProviderId(resolvedProviderId);
    }

    const bundleEntries: Array<{
      petId: number;
      providerServiceId: string;
      serviceType: string;
      durationMinutes: number;
    }> = [];

    for (const selectedPetId of selectedPetIds) {
      const selections = petServiceSelections[selectedPetId] ?? [];

      if (selections.length === 0) {
        setFlowState('error');
        setIsPending(false);
        showToast('Each selected pet must have a service selected', 'error');
        return;
      }

      for (const selection of selections) {
        const selectedServiceType = selection.serviceType;

        const modeMatches = (serviceMode: string | null | undefined) => {
          if (!selectedBookingMode) {
            return true;
          }

          return matchesBookingMode(serviceMode, selectedBookingMode);
        };

        const providerServiceCandidates = services
          .filter(
            (service) =>
              service.source === 'provider_services' &&
              service.provider_id === resolvedProviderId &&
              service.service_type.toLowerCase() === selectedServiceType.toLowerCase() &&
              modeMatches(service.service_mode),
          )
          .sort((left, right) => left.base_price - right.base_price);

        const providerService = providerServiceCandidates[0] ?? null;

        if (!providerService) {
          setFlowState('error');
          setIsPending(false);
          showToast(`No provider found for ${selectedServiceType}. Please contact support.`, 'error');
          return;
        }

        const quantity = Math.max(1, selection.quantity);
        for (let index = 0; index < quantity; index += 1) {
          bundleEntries.push({
            petId: selectedPetId,
            providerServiceId: providerService.id,
            serviceType: selectedServiceType,
            durationMinutes: providerService.service_duration_minutes || 30,
          });
        }
      }
    }

    if (bundleEntries.length === 0) {
      setFlowState('error');
      setIsPending(false);
      showToast('Please add at least one service to continue', 'error');
      return;
    }

    // Keep chained bundle starts slot-friendly by booking slot-aligned/longer services first.
    // This reduces intermediate start times that fail provider slot validation (e.g., xx:58).
    const scheduledBundleEntries = [...bundleEntries].sort((left, right) => {
      const leftRemainder = left.durationMinutes % 30;
      const rightRemainder = right.durationMinutes % 30;

      if ((leftRemainder === 0) !== (rightRemainder === 0)) {
        return leftRemainder === 0 ? -1 : 1;
      }

      if (left.durationMinutes !== right.durationMinutes) {
        return right.durationMinutes - left.durationMinutes;
      }

      return left.serviceType.localeCompare(right.serviceType);
    });

    const effectiveProviderId = resolvedProviderId;

    if (!effectiveProviderId) {
      setFlowState('error');
      setIsPending(false);
      showToast('No provider available for selected services. Please try again later.', 'error');
      return;
    }

    // Build boarding notes if applicable
    const boardingNotes = isBoardingBooking && bookingEndDate
      ? `[Boarding: ${bookingDate} to ${bookingEndDate}]`
      : '';
    const combinedNotes = [boardingNotes, providerNotes.trim()].filter(Boolean).join(' — ');

    // For package bookings (birthday/boarding), use clinic_visit when no location is set
    // to avoid validation errors — packages don't require user location.
    const effectiveBookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' = (() => {
      if (!isPackageBooking) return selectedBookingMode;
      if (locationAddress.trim() && latitude && longitude) return 'home_visit';
      return 'clinic_visit';
    })();

    const buildPayload = (
      entry: { petId: number; providerServiceId: string },
      startTimeValue: string,
      walletCreditsOverride?: number,
    ): BookingCreatePayload => ({
      petId: entry.petId,
      providerId: effectiveProviderId,
      bookingDate,
      startTime: startTimeValue,
      bookingMode: effectiveBookingMode,
      locationAddress: effectiveBookingMode === 'home_visit' ? locationAddress.trim() : null,
      latitude: effectiveBookingMode === 'home_visit' && latitude ? Number(latitude) : null,
      longitude: effectiveBookingMode === 'home_visit' && longitude ? Number(longitude) : null,
      providerNotes: combinedNotes || null,
      discountCode: discountCode.trim() ? discountCode.trim().toUpperCase() : undefined,
      addOns:
        bundleEntries.length === 1
          ? Object.entries(selectedAddOns)
              .filter(([, quantity]) => quantity > 0)
              .map(([id, quantity]) => ({ id, quantity }))
          : [],
      useSubscriptionCredit: paymentChoice === 'subscription_credit',
      walletCreditsAppliedInr:
        (walletCreditsOverride ?? walletCreditsToApply) > 0
          ? (walletCreditsOverride ?? walletCreditsToApply)
          : undefined,
      providerServiceId: entry.providerServiceId,
      pincode: /^[1-9]\d{5}$/.test(availabilityPincode) ? availabilityPincode : undefined,
      boardingEndDate: isBoardingBooking && bookingEndDate ? bookingEndDate : undefined,
    });

    // For boarding, multiply per-night price by number of boarding nights
    const boardingNightsMultiplier =
      isBoardingBooking && bookingEndDate && bookingDate
        ? Math.max(
            1,
            Math.round(
              (new Date(`${bookingEndDate}T00:00:00`).getTime() -
                new Date(`${bookingDate}T00:00:00`).getTime()) /
                86400000,
            ),
          )
        : 1;

    if (bundleEntries.length > 1) {
      // Pre-validate all bundle entries before creating any bookings
      for (const entry of scheduledBundleEntries) {
        const validationPayload = {
          ...buildPayload(entry, effectiveSlotStartTime),
          bookingType: 'service' as const,
        };
        const validation = bookingCreateSchema.safeParse(validationPayload);
        if (!validation.success) {
          setFlowState('error');
          setIsPending(false);
          showToast('Please review booking details for all pets', 'error');
          return;
        }
      }

      const createdBookingIds: number[] = [];

      try {
        let nextStartTime = effectiveSlotStartTime;
        let createdBookingId: number | undefined;

        for (const [entryIndex, entry] of scheduledBundleEntries.entries()) {
          const payload = buildPayload(entry, nextStartTime, entryIndex === 0 ? walletCreditsToApply : 0);

          const created = await apiRequest<BookingCreateResponse>('/api/bookings/create', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          createdBookingId = created.booking.id;
          createdBookingIds.push(created.booking.id);

          const backendEndTime = (created.booking.end_time ?? '').trim();
          if (backendEndTime.length >= 5) {
            nextStartTime = backendEndTime.slice(0, 5);
          } else {
            nextStartTime = addMinutesToTime(nextStartTime, entry.durationMinutes);
          }
        }

        if (isRescheduleMode) {
          await cancelOriginalBookingAfterReschedule(createdBookingId);
        }

        const grossBundleAmount =
          (bundlePriceTotal > 0
            ? bundlePriceTotal
            : (priceCalculation?.final_total ?? 0) * scheduledBundleEntries.length) * boardingNightsMultiplier;
        const payableBundleAmount = Math.max(0, grossBundleAmount - walletCreditsToApply);

        persistBookingSuccess({
          bookingDateValue: bookingDate,
          slotStartTimeValue: slotStartTime,
          bookingModeValue: bookingMode!,
          providerIdValue: providerId!,
          petIdValue: selectedPetIds[0],
          serviceIdValue: scheduledBundleEntries[0]?.providerServiceId ?? null,
          locationAddressValue: locationAddress,
          totalAmountValue: payableBundleAmount,
          amountStatus: paymentChoice === 'cash' ? 'payable' : 'paid',
        });

        setFlowState('success');
        showToast(
          isRescheduleMode
            ? `Reschedule completed with ${scheduledBundleEntries.length} bundled services`
            : `${scheduledBundleEntries.length} bundled services scheduled successfully`,
          'success',
        );
        setIsPending(false);
        return;
      } catch (error) {
        // Rollback: cancel any bookings already created in the bundle
        if (createdBookingIds.length > 0) {
          for (const bId of createdBookingIds) {
            apiRequest(`/api/bookings/${bId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'cancelled', cancellationReason: 'Bundle booking failed — automatic rollback' }),
            }).catch(() => {});
          }
        }

        const message = error instanceof Error ? error.message : 'Bundled booking failed. Please try again.';
        setFlowState('error');
        showToast(message, 'error');
        setIsPending(false);
        return;
      }
    }

    const basePayload = buildPayload(bundleEntries[0], effectiveSlotStartTime);

    const validationPayload = {
      ...basePayload,
      bookingType: 'service' as const,
      providerServiceId: basePayload.providerServiceId,
    };

    const clientValidation = bookingCreateSchema.safeParse(validationPayload);

    if (!clientValidation.success) {
      setFlowState('error');
      setIsPending(false);
      showToast('Please review booking details', 'error');
      return;
    }

    try {
      const singlePrice = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
      const effectivePrice = bundlePriceTotal > 0 && totalSelectedServices > 1 ? bundlePriceTotal : singlePrice;
      const grossTotalAmount = effectivePrice * boardingNightsMultiplier;
      const totalAmount = Math.max(0, grossTotalAmount - walletCreditsToApply);

      if (paymentChoice === 'subscription_credit') {
        const created = await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify(basePayload),
        });

        if (!created.creditReservation?.reserved) {
          throw new Error('Subscription credit was not reserved. Please try again.');
        }

        globalThis.window?.dispatchEvent(
          new CustomEvent('dofurs:subscription-credits-updated', { detail: created.creditReservation }),
        );

        if (isRescheduleMode) {
          await cancelOriginalBookingAfterReschedule(created.booking.id);
        }

        persistBookingSuccess({
          bookingDateValue: bookingDate,
          slotStartTimeValue: slotStartTime,
          bookingModeValue: bookingMode!,
          providerIdValue: providerId!,
          petIdValue: bundleEntries[0].petId,
          serviceIdValue: serviceId,
          locationAddressValue: locationAddress,
          totalAmountValue: totalAmount,
          amountStatus: 'paid',
        });

        setFlowState('success');
        showToast(isRescheduleMode ? 'Booking rescheduled successfully' : 'Booking created successfully', 'success');
        setIsPending(false);
        return;
      }

      if (paymentChoice === 'cash') {
        const created = await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify(basePayload),
        });

        if (isRescheduleMode) {
          await cancelOriginalBookingAfterReschedule(created.booking.id);
        }

        persistBookingSuccess({
          bookingDateValue: bookingDate,
          slotStartTimeValue: slotStartTime,
          bookingModeValue: bookingMode!,
          providerIdValue: providerId!,
          petIdValue: bundleEntries[0].petId,
          serviceIdValue: serviceId,
          locationAddressValue: locationAddress,
          totalAmountValue: totalAmount,
          amountStatus: 'payable',
        });

        setFlowState('success');
        showToast(
          isRescheduleMode
            ? 'Booking rescheduled. Please pay in cash after service.'
            : 'Booking created. Please pay in cash after service.',
          'success',
        );
        setIsPending(false);
        return;
      }

      const paymentOrder = await apiRequest<BookingPaymentOrderResponse>('/api/payments/bookings/order', {
        method: 'POST',
        body: JSON.stringify(basePayload),
      });

      const razorpayConstructor = (
        window as Window & {
          Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
        }
      ).Razorpay;

      if (!razorpayConstructor) {
        throw new Error('Razorpay checkout SDK did not load. Please refresh and try again.');
      }

      const razorpay = new razorpayConstructor({
        key: paymentOrder.razorpay.keyId,
        amount: paymentOrder.razorpay.amount,
        currency: paymentOrder.razorpay.currency,
        name: paymentOrder.razorpay.name,
        description: paymentOrder.razorpay.description,
        order_id: paymentOrder.razorpay.orderId,
        prefill: paymentOrder.razorpay.prefill,
        notes: paymentOrder.razorpay.notes,
        modal: {
          ondismiss: () => {
            setIsPending(false);
            setFlowState('collecting');
          },
        },
        handler: async (response) => {
          const verifyParams = {
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            providerSignature: response.razorpay_signature,
          };
          setPendingVerifyParams(verifyParams);

          try {
            const verification = await apiRequest<{ booking?: { id: number } }>('/api/payments/bookings/verify', {
              method: 'POST',
              body: JSON.stringify({
                providerOrderId: response.razorpay_order_id,
                providerPaymentId: response.razorpay_payment_id,
                providerSignature: response.razorpay_signature,
              }),
            });

            setPendingVerifyParams(null);

            if (isRescheduleMode) {
              await cancelOriginalBookingAfterReschedule(verification.booking?.id);
            }

            persistBookingSuccess({
              bookingDateValue: bookingDate,
              slotStartTimeValue: slotStartTime,
              bookingModeValue: bookingMode!,
              providerIdValue: providerId!,
              petIdValue: bundleEntries[0].petId,
              serviceIdValue: serviceId,
              locationAddressValue: locationAddress,
              totalAmountValue: totalAmount,
              amountStatus: 'paid',
            });

            setFlowState('success');
            showToast(
              isRescheduleMode ? 'Payment verified and booking rescheduled' : 'Payment verified and booking scheduled',
              'success',
            );
          } catch (verifyError) {
            const message =
              verifyError instanceof Error
                ? verifyError.message
                : 'Payment was completed but verification failed. Please contact support with your payment reference.';
            setFlowState('error');
            showToast(message, 'error');
          } finally {
            setIsPending(false);
          }
        },
      });

      razorpay.on('payment.failed', (failureResponse) => {
        const paymentError = failureResponse.error;
        const detail = paymentError?.description ?? paymentError?.reason ?? paymentError?.code;
        const message = detail
          ? `Payment failed: ${detail}.`
          : 'Payment could not be completed in Razorpay. Please try another card/method.';

        setIsPending(false);
        setFlowState('collecting');
        showToast(message, 'error');
      });

      razorpay.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Booking failed. Please try again.';
      setFlowState('error');
      showToast(message, 'error');
      setIsPending(false);
    }
  };

  return (
    <AsyncState
      isLoading={isLoading}
      isError={Boolean(apiError)}
      errorMessage={apiError}
      loadingFallback={<div className="rounded-3xl border border-[#f2dfcf] bg-white p-6"><LoadingSkeleton lines={5} /></div>}
    >
      <div className="space-y-2 sm:space-y-6">
        {isRescheduleMode && rescheduleBookingId ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Reschedule mode active</p>
            <p className="mt-1 text-amber-800">
              Updating booking #{rescheduleBookingId}. Choose a new date/time and confirm to complete the reschedule.
            </p>
          </div>
        ) : null}

        {/* Sticky progress bar — only shown when booking is in progress */}
        {flowState !== 'success' && (
          <BookingProgressBar
            steps={[
              { id: 'pet-service', label: 'Pets & Service' },
              { id: 'datetime', label: 'Schedule' },
              { id: 'review', label: 'Review' },
            ]}
            currentStepId={currentStep}
          />
        )}

        <div ref={stepContainerRef} className="px-0.5 pt-2.5 max-[380px]:px-0 max-[380px]:pt-2 sm:px-1 sm:pt-1">
          {isDetectingPincode && !hasCheckedAreaCoverage ? (
            <p className="text-[13px] font-medium text-[#8a6445] sm:text-sm">Detecting your location and checking serviceability...</p>
          ) : null}

          {currentStep === 'pet-service' && !/^[1-9]\d{5}$/.test(availabilityPincode) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
              <p className="font-semibold">Set your pincode to continue</p>
              <p className="mt-1 text-amber-800">
                Select a valid 6-digit Bangalore pincode from the location icon in the header to unlock provider availability and scheduling.
              </p>
            </div>
          ) : null}

        </div>

        <div className="space-y-3 sm:space-y-6">
        {/* Main booking flow */}
        <div className="space-y-3 sm:space-y-6">
          {currentStep === 'pet-service' && (
            <PetAndServiceStep
              pets={pets}
              selectedPetIds={selectedPetIds}
              onPetToggle={handlePetToggle}
              onPetCreated={(pet) => {
                setPets((prev) => [pet, ...prev]);
                handlePetToggle(pet.id);
              }}
              services={serviceOptions}
              petServiceSelections={petServiceSelections}
              totalSelectedServices={totalSelectedServices}
              searchResultSummary={searchResultSummary}
              bookingMode={bookingMode}
              isPackageBooking={isPackageBooking}
              serviceSelectionRuleNote="You can add up to 2 total services per booking in any combination. Pet Birthday Package and Pet Boarding must be booked separately and cannot be combined with any other service in the same booking."
              isServiceSelectionBlocked={isServiceSelectionBlocked}
              isPincodeValid={isPackageBooking || /^[1-9]\d{5}$/.test(availabilityPincode)}
              onBookingModeChange={(mode) => {
                setBookingMode(mode);
                setSelectedAutoProvider(true);
                setBookingDate('');
                setSlotStartTime('');
                setProviderId(null);
                setServiceId(null);
              }}
              onPetServiceChange={handlePetServiceChange}
              onPetQuantityChange={handlePetQuantityChange}
              onApplyServiceToAll={handleApplyServiceToAll}
              onNext={handleNextStep}
            />
          )}

          {currentStep === 'datetime' && (
            <DateTimeSlotStep
              slotOptions={availability.slotOptions}
              providers={availability.providers}
              selectedProviderId={providerId}
              selectedProviderServiceId={serviceId}
              selectedAutoProvider={selectedAutoProvider}
              selectedDate={bookingDate}
              selectedSlot={slotStartTime}
              bookingMode={bookingMode ?? 'home_visit'}
              locationAddress={locationAddress}
              latitude={latitude}
              longitude={longitude}
              savedAddresses={savedAddresses}
              selectedSavedAddressId={selectedSavedAddressId}
              providerNotes={providerNotes}
              isPackageBooking={isPackageBooking}
              isBoardingBooking={isBoardingBooking}
              bookingEndDate={bookingEndDate}
              onBookingEndDateChange={setBookingEndDate}
              totalSelectedServices={totalSelectedServices}
              totalDurationMinutes={totalDurationMinutes}
              providerSupportsSelectedServices={providerSupportsSelectedServices}
              availableDates={availableDateOptions}
              isLoadingAvailableDates={isLoadingAvailableDateOptions}
              maxSelectableDate={maxBookableDate}
              pincodeCheckerValue={manualPincode}
              onPincodeCheckerValueChange={setManualPincode}
              onPincodeCheck={handleManualPincodeCheck}
              isCheckingPincodeCoverage={isCheckingAreaCoverage}
              hasCheckedPincodeCoverage={hasCheckedAreaCoverage}
              pincodeCoverageServiceCount={areaCoverageServices.length}
              pincodeCoverageError={areaCoverageError}
              selectedAddressPincode={selectedAddressPincode}
              hasCheckedSelectedAddressCoverage={hasCheckedSelectedAddressCoverage}
              isCheckingSelectedAddressCoverage={isCheckingSelectedAddressCoverage}
              isSelectedAddressServiceable={isSelectedAddressServiceable}
              selectedAddressCoverageError={selectedAddressCoverageError}
              onDateChange={setBookingDate}
              onSlotChange={setSlotStartTime}
              onProviderSelect={(providerServiceId, nextProviderId) => {
                setServiceId(providerServiceId);
                setProviderId(nextProviderId);
              }}
              onAutoProviderSelect={(auto) => {
                setSelectedAutoProvider(auto);

                if (auto) {
                  const autoProvider = availability.providers.find((provider) => provider.recommended && provider.availableForSelectedSlot)
                    ?? availability.providers.find((provider) => provider.availableForSelectedSlot)
                    ?? null;

                  setProviderId(autoProvider?.providerId ?? null);
                  setServiceId(autoProvider?.providerServiceId ?? null);
                }
              }}
              onLocationChange={setLocationAddress}
              onLatitudeChange={setLatitude}
              onLongitudeChange={setLongitude}
              onSelectSavedAddress={setSelectedSavedAddressId}
              onUpsertSavedAddress={(nextAddress) => {
                setSavedAddresses((current) => {
                  const existingIndex = current.findIndex((address) => address.id === nextAddress.id);

                  if (existingIndex >= 0) {
                    const updated = [...current];
                    updated[existingIndex] = nextAddress;
                    return updated;
                  }

                  return [nextAddress, ...current];
                });
              }}
              onNotesChange={setProviderNotes}
              selectedPets={selectedPets.map((pet) => ({
                id: pet.id,
                name: pet.name,
                breed: pet.breed,
                serviceType: petServiceSelections[pet.id]?.[0]?.serviceType ?? null,
              }))}
              onNext={handleNextStep}
              onPrev={handlePreviousStep}
            />
          )}

          {currentStep === 'review' && flowState !== 'success' && (
            <ReviewConfirmStep
              selectedService={selectedService ?? undefined}
              selectedPet={pets.find((p) => p.id === petId)}
              selectedPets={selectedPets.map((pet) => ({
                id: pet.id,
                name: pet.name,
                breed: pet.breed,
              }))}
              selectedProvider={providers.find((p) => p.id === providerId)}
              bookingDate={bookingDate}
              slotStartTime={slotStartTime || (isPackageBooking ? '09:00' : '')}
              bookingMode={bookingMode ?? 'home_visit'}
              locationAddress={locationAddress}
              providerNotes={providerNotes}
              priceCalculation={priceCalculation}
              discountPreview={discountPreview}
              discountCode={discountCode}
              onDiscountCodeChange={setDiscountCode}
              onApplyDiscount={applyDiscount}
              addOns={serviceAddOns}
              selectedAddOns={selectedAddOns}
              bookingBundleRows={bookingBundleRows}
              totalSelectedServices={totalSelectedServices}
              paymentChoice={paymentChoice}
              creditEligibility={creditEligibility}
              subscriptionCreditUnavailableReason={subscriptionCreditUnavailableReason}
              isCheckingCreditEligibility={isCheckingCreditEligibility}
              onPaymentChoiceChange={setPaymentChoice}
              walletCreditsToApply={walletCreditsToApply}
              onWalletCreditsToApplyChange={setWalletCreditsToApply}
              isPackageBooking={isPackageBooking}
              isBoardingBooking={isBoardingBooking}
              bookingEndDate={bookingEndDate}
              onBundleRowQuantityChange={handlePetQuantityChange}
              onBundleRowRemove={(removePetId, removeServiceType) => {
                setPetServiceSelections((prev) => {
                  const current = prev[removePetId] ?? [];
                  return { ...prev, [removePetId]: current.filter((s) => s.serviceType !== removeServiceType) };
                });
                setSelectedAutoProvider(true);
                setBookingDate('');
                setSlotStartTime('');
                setProviderId(null);
                setServiceId(null);
              }}
              bundlePriceTotal={bundlePriceTotal}
              totalDurationMinutes={totalDurationMinutes}
              onPrev={handlePreviousStep}
              onChangeSelectedService={handleChangeSelectedService}
              onChangePet={handleChangePet}
              onChangeProvider={handleChangeProvider}
              onChangeAddress={handleChangeAddress}
              onChangeDateTime={handleChangeDateTime}
              onConfirm={submitBooking}
              isPending={isPending}
            />
          )}

          {/* Payment verify retry panel — shown when Razorpay captured but /verify network-failed */}
          {flowState === 'error' && pendingVerifyParams && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm">
              <p className="font-semibold text-amber-900">Payment captured — verification pending</p>
              <p className="mt-1 text-amber-800">
                Your payment was received by Razorpay but the booking confirmation did not complete. Tap below to retry — no additional charge will occur.
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={async () => {
                  if (!pendingVerifyParams) return;
                  setIsPending(true);
                  try {
                    const verification = await apiRequest<{ booking?: { id: number } }>('/api/payments/bookings/verify', {
                      method: 'POST',
                      body: JSON.stringify(pendingVerifyParams),
                    });
                    setPendingVerifyParams(null);
                    if (isRescheduleMode) {
                      await cancelOriginalBookingAfterReschedule(verification.booking?.id);
                    }
                    const totalAmount = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
                    persistBookingSuccess({
                      bookingDateValue: bookingDate,
                      slotStartTimeValue: slotStartTime,
                      bookingModeValue: bookingMode!,
                      providerIdValue: providerId!,
                      petIdValue: selectedPetIds[0],
                      serviceIdValue: serviceId,
                      locationAddressValue: locationAddress,
                      totalAmountValue: totalAmount,
                      amountStatus: 'paid',
                    });
                    setFlowState('success');
                    showToast('Payment verified and booking confirmed.', 'success');
                  } catch (retryError) {
                    const msg = retryError instanceof Error ? retryError.message : 'Verification still failing. Please contact support.';
                    showToast(msg, 'error');
                  } finally {
                    setIsPending(false);
                  }
                }}
                className="mt-3 inline-flex items-center rounded-full bg-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
              >
                {isPending ? 'Verifying…' : 'Retry Booking Confirmation'}
              </button>
            </div>
          )}

          {flowState === 'success' && lastBookingSummary && (
            <PremiumBookingConfirmation
              bookingDate={lastBookingSummary.bookingDate}
              slotStartTime={lastBookingSummary.slotStartTime}
              bookingMode={lastBookingSummary.bookingMode}
              providerName={lastBookingSummary.providerName}
              petName={lastBookingSummary.petName}
              totalAmount={lastBookingSummary.totalAmount}
              amountStatus={lastBookingSummary.amountStatus}
            />
          )}
        </div>

          </div>
      </div>
    </AsyncState>
  );
}
