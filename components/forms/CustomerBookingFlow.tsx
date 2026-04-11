'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import AsyncState from '@/components/ui/AsyncState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import type { PricingBreakdown } from '@/lib/bookings/types';
import type { FlowState } from '@/lib/flows/contracts';
import { apiRequest } from '@/lib/api/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import PremiumBookingConfirmation from './PremiumBookingConfirmation';
import { useOptimisticSelection } from '@/lib/hooks/useOptimisticSelection';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

const LocationPinMap = dynamic(() => import('./LocationPinMap'), { ssr: false });

type Provider = { id: number; name: string; provider_type?: string | null; type?: string | null };
type Service = {
  id: string;
  provider_id: number;
  service_type: string;
  service_duration_minutes: number;
  buffer_minutes: number;
  base_price: number;
  source: 'provider_services' | 'services';
};
type Pet = { id: number; name: string };
type Slot = { start_time: string; end_time: string; is_available: boolean };
type BookableUser = { id: string; name: string | null; email: string | null };
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
  booking: { id: number };
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

type SelectableAddress = SavedAddress & {
  phone?: string;
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
};

type CreditEligibilityResponse = {
  eligible: boolean;
  subscriptionId: string | null;
  serviceType: string;
  availableCredits: number;
  totalCredits: number;
};

const SERVICE_CART_STORAGE_KEY = 'dofurs.booking.serviceCart';
const SERVICE_CART_UPDATED_EVENT = 'dofurs:service-cart-updated';
const BOOKING_SUCCESS_FLAG_KEY = 'dofurs.booking.confirmation-active';
const BOOKING_SUCCESS_EVENT = 'dofurs:booking-confirmation-visibility';

function toMinutes(timeValue: string) {
  const [hour, minute] = timeValue.split(':').map(Number);
  return hour * 60 + minute;
}

export default function CustomerBookingFlow({ allowBookForUsers = false }: { allowBookForUsers?: boolean }) {
  const searchParams = useSearchParams();
  const searchQueryRaw = (searchParams.get('search') ?? '').trim();
  const serviceTypeQueryRaw = (searchParams.get('serviceType') ?? '').trim();
  const providerNameQueryRaw = (searchParams.get('providerName') ?? '').trim();
  const modeParam = searchParams.get('mode');
  const requestedMode =
    modeParam === 'home_visit' || modeParam === 'clinic_visit' || modeParam === 'teleconsult' ? modeParam : null;
  const filterTerms = [searchQueryRaw, serviceTypeQueryRaw, providerNameQueryRaw].filter((value) => value.length > 0);
  const filterTokens = [searchQueryRaw, serviceTypeQueryRaw, providerNameQueryRaw]
    .map((value) => value.toLowerCase())
    .filter((value) => value.length > 0);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookableUsers, setBookableUsers] = useState<BookableUser[]>([]);
  const [selectedBookingUserId, setSelectedBookingUserId] = useState<string | null>(null);
  const [bookingUserSearch, setBookingUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<BookableUser[]>([]);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [canBookForUsers, setCanBookForUsers] = useState(false);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [bookingMode, setBookingMode] = useState<'home_visit' | 'clinic_visit' | 'teleconsult'>('home_visit');
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [localAddresses, setLocalAddresses] = useState<SelectableAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLatitude, setNewLatitude] = useState('');
  const [newLongitude, setNewLongitude] = useState('');
  const [currentLatitude, setCurrentLatitude] = useState('');
  const [currentLongitude, setCurrentLongitude] = useState('');
  const [locationSource, setLocationSource] = useState<'none' | 'detected' | 'current' | 'pinned'>('none');
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [confirmDeleteAddressId, setConfirmDeleteAddressId] = useState<string | null>(null);
  const [isDetectingCurrentLocation, setIsDetectingCurrentLocation] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [providerNotes, setProviderNotes] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [discounts, setDiscounts] = useState<CatalogDiscount[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [autoDiscountContextKey, setAutoDiscountContextKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [flowState, setFlowState] = useState<FlowState>('collecting');
  const { showToast } = useToast();
  const showBookForUsers = allowBookForUsers || canBookForUsers;

  const [priceCalculation, setPriceCalculation] = useState<PricingBreakdown | null>(null);
  const [, setIsCalculatingPrice] = useState(false);
  const [serviceAddOns, setServiceAddOns] = useState<ServiceAddon[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<'direct' | 'subscription_credit'>('direct');
  const [creditEligibility, setCreditEligibility] = useState<CreditEligibilityResponse | null>(null);
  const [isCheckingCreditEligibility, setIsCheckingCreditEligibility] = useState(false);
  const [lastBookingSummary, setLastBookingSummary] = useState<{
    bookingDate: string;
    slotStartTime: string;
    bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
    providerName?: string;
    petName?: string;
    totalAmount: number;
    amountStatus: 'payable' | 'paid';
  } | null>(null);
  const optimisticSlot = useOptimisticSelection('');

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

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      setApiError(null);
      const searchParams = new URLSearchParams();

      if (selectedBookingUserId) {
        searchParams.set('userId', selectedBookingUserId);
      }

      try {
        const payload = await apiRequest<{
          providers: Provider[];
          services: Service[];
          pets: Pet[];
          addresses?: SavedAddress[];
          discounts?: CatalogDiscount[];
          canBookForUsers?: boolean;
          bookableUsers?: BookableUser[];
          selectedUserId?: string;
        }>(`/api/bookings/catalog${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);

        if (!isMounted) {
          return;
        }

        setCanBookForUsers(Boolean(payload.canBookForUsers));
        setBookableUsers(payload.bookableUsers ?? []);
        setSelectedBookingUserId(payload.selectedUserId ?? null);
        setProviders(payload.providers);
        setServices(payload.services);
        setPets(payload.pets);
        setSavedAddresses(payload.addresses ?? []);
        setDiscounts(payload.discounts ?? []);

        setBookingMode(requestedMode ?? 'home_visit');

        const preferredProvider = Number(globalThis.localStorage?.getItem('booking.preferredProviderId') ?? 0);
        const providerCandidate = payload.providers.find((provider) => provider.id === preferredProvider)?.id ?? payload.providers[0]?.id ?? null;

        const preferredService = globalThis.localStorage?.getItem('booking.preferredServiceId');
        const usageRaw = globalThis.localStorage?.getItem('booking.serviceUsage');
        const usage = usageRaw ? (JSON.parse(usageRaw) as Record<string, number>) : {};
        const mostUsedServiceId = Object.entries(usage).sort((left, right) => right[1] - left[1])[0]?.[0];
        const serviceCandidate =
          payload.services.find((service) => service.id === preferredService)?.id ??
          payload.services.find((service) => service.id === mostUsedServiceId)?.id ??
          null;

        setProviderId(providerCandidate);
        if (serviceCandidate) {
          setServiceId(serviceCandidate);
        }

        setPetId(payload.pets[0]?.id ?? null);

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
          } else {
            setLatitude('');
            setLongitude('');
          }
        } else {
          setSelectedSavedAddressId(null);
        }
      } catch (err) { console.error(err);
        if (isMounted) {
          setApiError('Sign in to access booking flow.');
          showToast('Sign in to access booking flow.', 'error');
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
  }, [requestedMode, selectedBookingUserId, showToast]);

  useEffect(() => {
    if (!requestedMode) {
      return;
    }

    setBookingMode(requestedMode);
  }, [requestedMode]);

  const modeFilteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const providerType = (provider.provider_type || provider.type || '').toLowerCase();
      if (bookingMode === 'clinic_visit') {
        return providerType.includes('clinic') || providerType.includes('center') || providerType.includes('grooming');
      }

      if (bookingMode === 'home_visit') {
        return !providerType.includes('clinic') && !providerType.includes('center') && !providerType.includes('grooming');
      }

      return true;
    });
  }, [providers, bookingMode]);

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

  const providerServices = useMemo(
    () =>
      services.filter((service) => {
        if (service.provider_id !== providerId || service.source !== 'provider_services') {
          return false;
        }

        if (filterTokens.length === 0) {
          return true;
        }

        const serviceLabel = service.service_type.toLowerCase();
        return filterTokens.some((token) => serviceLabel.includes(token));
      }),
    [filterTokens, services, providerId],
  );

  const searchResultSummary = useMemo(() => {
    if (filterTerms.length === 0) {
      return null;
    }

    const queryLabel = filterTerms.join(' · ');
    const matchedServiceCount = services.filter((service) => {
      if (service.source !== 'provider_services' || !filteredProviders.some((provider) => provider.id === service.provider_id)) {
        return false;
      }

      const serviceLabel = service.service_type.toLowerCase();
      return filterTokens.some((token) => serviceLabel.includes(token));
    }).length;

    if (filteredProviders.length === 0) {
      return `No premium matches for \"${queryLabel}\" yet. Try a broader term.`;
    }

    return `${filteredProviders.length} provider${filteredProviders.length === 1 ? '' : 's'} and ${matchedServiceCount} service${matchedServiceCount === 1 ? '' : 's'} curated for \"${queryLabel}\".`;
  }, [filterTerms, filterTokens, filteredProviders, services]);

  useEffect(() => {
    if (filteredProviders.length === 0) {
      setProviderId(null);
      return;
    }

    setProviderId((currentProviderId) => {
      if (currentProviderId && filteredProviders.some((provider) => provider.id === currentProviderId)) {
        return currentProviderId;
      }

      return filteredProviders[0]?.id ?? null;
    });
  }, [filteredProviders]);

  const selectedBookingUser = useMemo(
    () => bookableUsers.find((item) => item.id === selectedBookingUserId) ?? null,
    [bookableUsers, selectedBookingUserId],
  );

  const allAddresses = useMemo<SelectableAddress[]>(() => [...localAddresses, ...savedAddresses], [localAddresses, savedAddresses]);
  const selectedProviderService = useMemo(
    () => providerServices.find((service) => service.id === serviceId) ?? null,
    [providerServices, serviceId],
  );
  const requiresBookingUserSelection = showBookForUsers && !selectedBookingUserId;

  const recommendationSlots = useMemo(() => {
    if (slots.length === 0) {
      return [] as Array<{ key: string; label: string; reason: string; slot: Slot }>;
    }

    const sorted = [...slots].sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time));
    const fastest = sorted[0];

    const midTime = 13 * 60;
    const mostFlexible = [...sorted].sort((left, right) => {
      const leftDiff = Math.abs(toMinutes(left.start_time) - midTime);
      const rightDiff = Math.abs(toMinutes(right.start_time) - midTime);
      return leftDiff - rightDiff;
    })[0];

    const now = new Date();
    const targetDate = bookingDate ? new Date(`${bookingDate}T00:00:00`) : null;

    const best =
      targetDate && now.toDateString() === targetDate.toDateString()
        ? [...sorted].find((slot) => toMinutes(slot.start_time) >= now.getHours() * 60 + now.getMinutes() + 90) ?? fastest
        : mostFlexible;

    const unique = new Map<string, { key: string; label: string; reason: string; slot: Slot }>();

    unique.set(best.start_time, {
      key: `best-${best.start_time}`,
      label: 'Best',
      reason: 'Balanced timing for convenience',
      slot: best,
    });
    unique.set(fastest.start_time, {
      key: `fastest-${fastest.start_time}`,
      label: 'Fastest',
      reason: 'Earliest available start',
      slot: fastest,
    });
    unique.set(mostFlexible.start_time, {
      key: `flex-${mostFlexible.start_time}`,
      label: 'Most flexible',
      reason: 'Mid-day slot with easier adjustments',
      slot: mostFlexible,
    });

    return Array.from(unique.values());
  }, [slots, bookingDate]);

  const controlClassName =
    'h-11 sm:h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm transition focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20';
  const summaryServiceName = providerServices.find((service) => service.id === serviceId)?.service_type || 'Not selected';
  const summaryDate = bookingDate || 'Not selected';
  const summaryTime = slotStartTime || 'Not selected';
  const summaryAddress = locationAddress.trim() || 'Not selected';
  const summaryBaseAmount = discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0;
  const summaryDiscountAmount = discountPreview?.discountAmount ?? 0;
  const summaryTotalAmount = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;

  useEffect(() => {
    setServiceId(providerServices[0]?.id ?? null);
  }, [providerServices]);

  useEffect(() => {
    setDiscountPreview(null);
  }, [serviceId]);

  useEffect(() => {
    setPaymentChoice('direct');
    const serviceType = selectedProviderService?.service_type ?? '';
    if (!serviceType) {
      setCreditEligibility(null);
      return;
    }

    let isMounted = true;

    async function loadCreditEligibility() {
      setIsCheckingCreditEligibility(true);
      try {
        const params = new URLSearchParams({ serviceType });
        const payload = await apiRequest<CreditEligibilityResponse>(`/api/credits/eligibility?${params.toString()}`);

        if (!isMounted) {
          return;
        }

        setCreditEligibility(payload);
      } catch (err) { console.error(err);
        if (isMounted) {
          setCreditEligibility(null);
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
  }, [selectedProviderService?.service_type]);

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

        if (!isMounted) {
          return;
        }

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const normalizedAddOns = Object.entries(selectedAddOns)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ id, quantity }));

    const hasCartSelection = Boolean(serviceId) || normalizedAddOns.length > 0;

    if (!hasCartSelection) {
      window.localStorage.removeItem(SERVICE_CART_STORAGE_KEY);
      window.dispatchEvent(new Event(SERVICE_CART_UPDATED_EVENT));
      return;
    }

    window.localStorage.setItem(
      SERVICE_CART_STORAGE_KEY,
      JSON.stringify({
        serviceId,
        addOns: normalizedAddOns,
        updatedAt: Date.now(),
      }),
    );
    window.dispatchEvent(new Event(SERVICE_CART_UPDATED_EVENT));
  }, [selectedAddOns, serviceId]);

  const discountSuggestions = useMemo(() => {
    const selectedService = services.find((service) => service.id === serviceId);
    const baseAmount = priceCalculation?.base_total ?? 0;

    return discounts.filter((discount) => {
      if (discount.min_booking_amount !== null && baseAmount < discount.min_booking_amount) {
        return false;
      }

      if (!selectedService) {
        return true;
      }

      if (!discount.applies_to_service_type) {
        return true;
      }

      return discount.applies_to_service_type.trim().toLowerCase() === selectedService.service_type.trim().toLowerCase();
    });
  }, [discounts, serviceId, services, priceCalculation?.base_total]);

  const rankedDiscountSuggestions = useMemo(() => {
    return [...discountSuggestions].sort((left, right) => left.code.localeCompare(right.code));
  }, [discountSuggestions]);

  useEffect(() => {
    if (!showBookForUsers || !selectedBookingUser) {
      return;
    }

    setSearchResults((current) => {
      if (current.some((item) => item.id === selectedBookingUser.id)) {
        return current;
      }

      return [selectedBookingUser, ...current].slice(0, 25);
    });
  }, [selectedBookingUser, showBookForUsers]);

  useEffect(() => {
    if (!showBookForUsers) {
      return;
    }

    setLocalAddresses([]);
    setShowAddAddressModal(false);
  }, [selectedBookingUserId, showBookForUsers]);

  async function searchUsers() {
    if (!showBookForUsers) {
      return;
    }

    const query = bookingUserSearch.trim();

    if (query.length < 2) {
      showToast('Enter at least 2 characters to search users.', 'error');
      return;
    }

    setHasSearchedUsers(true);
    setIsSearchingUsers(true);

    try {
      const payload = await apiRequest<{ users?: BookableUser[] }>(`/api/bookings/search-user?query=${encodeURIComponent(query)}`);
      const users = payload?.users ?? [];

      setSearchResults(users);

      if (users.length === 0) {
        showToast('No users found for this search.', 'error');
        return;
      }

      showToast(`${users.length} user${users.length === 1 ? '' : 's'} found.`, 'success');
    } catch (err) { console.error(err);
      setSearchResults([]);
      showToast('User search failed.', 'error');
    } finally {
      setIsSearchingUsers(false);
    }
  }

  const calculatePrice = useCallback(async () => {
    if (!providerId) {
      setPriceCalculation(null);
      return;
    }

    if (!serviceId) {
      setPriceCalculation(null);
      return;
    }

    setIsCalculatingPrice(true);

    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => ({ id, quantity }));

      const result = await apiRequest<{ success: boolean; data: PricingBreakdown }>('/api/services/calculate-price', {
        method: 'POST',
        body: JSON.stringify({
          bookingType: 'service',
          serviceId,
          providerId: providerId.toString(),
          addOns,
        }),
      });

      setPriceCalculation(result.data);
    } catch (err) { console.error(err);
      showToast('Failed to calculate price', 'error');
      setPriceCalculation(null);
    } finally {
      setIsCalculatingPrice(false);
    }
  }, [providerId, selectedAddOns, serviceId, showToast]);

  // Recalculate pricing when service selection changes
  useEffect(() => {
    void calculatePrice();
  }, [calculatePrice]);

  useEffect(() => {
    if (!providerId || !bookingDate) {
      setSlots([]);
      setSlotStartTime('');
      return;
    }

    let isMounted = true;

    async function loadSlots() {
      const selectedService = services.find((service) => service.id === serviceId);

      const search = new URLSearchParams({
        providerId: String(providerId),
        date: bookingDate,
      });

      if (serviceId && selectedService?.source === 'provider_services') {
        search.set('providerServiceId', serviceId);
      }

      if (selectedService?.service_duration_minutes) {
        search.set('serviceDurationMinutes', String(selectedService.service_duration_minutes));
      }

      try {
        const payload = await apiRequest<{ slots: Slot[] }>(`/api/bookings/available-slots?${search.toString()}`);
        if (isMounted) {
          const normalizedSlots = payload.slots ?? [];
          setSlots(normalizedSlots);
          const first = normalizedSlots[0]?.start_time ?? '';
          setSlotStartTime(first);
        }
      } catch (err) { console.error(err);
        if (isMounted) {
          setSlots([]);
          setSlotStartTime('');
          showToast('Unable to fetch slots.', 'error');
        }
      }
    }

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [providerId, bookingDate, serviceId, services, showToast, slotsRefreshKey]);

  useEffect(() => {
    if (bookingMode !== 'home_visit') {
      return;
    }

    if (locationAddress.trim()) {
      return;
    }

    const lastAddress = globalThis.localStorage?.getItem('booking.lastUsedAddress');

    if (lastAddress) {
      setLocationAddress(lastAddress);
    }
  }, [bookingMode, locationAddress]);

  useEffect(() => {
    if (!providerId || !bookingDate) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`slots-live:${providerId}:${bookingDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          setSlotsRefreshKey((current) => current + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_availability',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          setSlotsRefreshKey((current) => current + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_blocked_dates',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          setSlotsRefreshKey((current) => current + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingDate, providerId]);

  function submitBooking() {
    setFlowState('validating');
    // Validation
    if (!providerId || !petId || !slotStartTime) {
      setFlowState('collecting');
      showToast('Complete all booking fields.', 'error');
      return;
    }

    const selectedService = services.find((service) => service.id === serviceId);

    if (!serviceId || !selectedService) {
      setFlowState('collecting');
      showToast('Select a service.', 'error');
      return;
    }

    if (selectedService.source !== 'provider_services') {
      setFlowState('error');
      showToast('This service is not yet available for the upgraded booking flow.', 'error');
      return;
    }

    if (bookingMode === 'home_visit') {
      if (!locationAddress.trim() || !latitude || !longitude) {
        setFlowState('collecting');
        showToast('For home visit, add your address and use location detection.', 'error');
        return;
      }
    }

    setFlowState('submitting');
    startTransition(async () => {
      const basePayload: BookingCreatePayload = {
        petId,
        providerId,
        bookingDate,
        startTime: slotStartTime,
        bookingMode,
        locationAddress: bookingMode === 'home_visit' ? locationAddress.trim() : null,
        latitude: bookingMode === 'home_visit' ? Number(latitude) : null,
        longitude: bookingMode === 'home_visit' ? Number(longitude) : null,
        providerNotes: providerNotes.trim() || null,
        bookingUserId: showBookForUsers ? selectedBookingUserId ?? undefined : undefined,
        discountCode: discountCode.trim() ? discountCode.trim().toUpperCase() : undefined,
        addOns: Object.entries(selectedAddOns)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => ({ id, quantity })),
        useSubscriptionCredit: paymentChoice === 'subscription_credit',
      };

      basePayload.providerServiceId = serviceId;

      const validationPayload = {
        ...basePayload,
        bookingType: 'service' as const,
        providerServiceId: basePayload.providerServiceId,
      };

      const clientValidation = bookingCreateSchema.safeParse(validationPayload);

      if (!clientValidation.success) {
        setFlowState('error');
        showToast('Please review booking details before submitting.', 'error');
        return;
      }

      try {
        const created = await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify(basePayload),
        });

        if (paymentChoice === 'subscription_credit' && !created.creditReservation?.reserved) {
          throw new Error('Subscription credit was not reserved. Please try again.');
        }

        if (paymentChoice === 'subscription_credit' && created.creditReservation) {
          globalThis.window?.dispatchEvent(
            new CustomEvent('dofurs:subscription-credits-updated', { detail: created.creditReservation }),
          );
        }

        globalThis.localStorage?.setItem('booking.preferredProviderId', String(providerId));
        if (serviceId) {
          globalThis.localStorage?.setItem('booking.preferredServiceId', serviceId);
          const usageRaw = globalThis.localStorage?.getItem('booking.serviceUsage');
          const usage = usageRaw ? (JSON.parse(usageRaw) as Record<string, number>) : {};
          usage[serviceId] = (usage[serviceId] ?? 0) + 1;
          globalThis.localStorage?.setItem('booking.serviceUsage', JSON.stringify(usage));
        }
        if (bookingMode === 'home_visit' && locationAddress.trim()) {
          globalThis.localStorage?.setItem('booking.lastUsedAddress', locationAddress.trim());
        }

        globalThis.localStorage?.removeItem(SERVICE_CART_STORAGE_KEY);
        globalThis.window?.dispatchEvent(new Event(SERVICE_CART_UPDATED_EVENT));

        const providerName = providers.find((provider) => provider.id === providerId)?.name;
        const petName = pets.find((pet) => pet.id === petId)?.name;

        setLastBookingSummary({
          bookingDate,
          slotStartTime,
          bookingMode,
          providerName,
          petName,
          totalAmount: discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0,
          amountStatus: paymentChoice === 'direct' ? 'payable' : 'paid',
        });

        setFlowState('success');
        showToast('Booking created successfully.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Booking failed. Please try again.';
        setFlowState('error');
        showToast(message, 'error');
      }
    });
  }

  function clearDiscount() {
    setDiscountCode('');
    setDiscountPreview(null);
  }

  function formatSavedAddress(address: SavedAddress) {
    return [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.pincode,
      address.country,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(', ');
  }

  useEffect(() => {
    if (!showAddAddressModal) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let cancelled = false;

    const hydrateCurrentLocation = async () => {
      try {
        if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          if (permissionStatus.state !== 'granted') {
            return;
          }
        }
      } catch {
        // Ignore permissions API failures and fall back to geolocation attempt.
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) {
            return;
          }
          setCurrentLatitude(String(position.coords.latitude));
          setCurrentLongitude(String(position.coords.longitude));
        },
        () => {
          if (cancelled) {
            return;
          }
          setCurrentLatitude('');
          setCurrentLongitude('');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    };

    void hydrateCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [showAddAddressModal]);

  function openAddAddressModal() {
    if (requiresBookingUserSelection) {
      setLocationError('Select a customer first to manage addresses.');
      showToast('Select a customer first to manage addresses.', 'error');
      return;
    }

    setSelectedSavedAddressId(null);
    setNewAddress('');
    setNewPhone('');
    setNewLatitude('');
    setNewLongitude('');
    setLocationSource('none');
    setLocationError(null);
    setShowAddAddressModal(true);
  }

  function closeAddAddressModal() {
    setShowAddAddressModal(false);
    setLocationError(null);
  }

  function removeLocalAddress(addressId: string) {
    setLocalAddresses((previous) => previous.filter((address) => address.id !== addressId));

    if (selectedSavedAddressId === addressId) {
      setSelectedSavedAddressId(null);
      setLocationAddress('');
      setLatitude('');
      setLongitude('');
    }
  }

  async function deleteAddress(address: SelectableAddress) {
    const isLocalAddress = address.id.startsWith('local-');

    if (isLocalAddress) {
      removeLocalAddress(address.id);
      setConfirmDeleteAddressId(null);
      return;
    }

    if (showBookForUsers && !selectedBookingUserId) {
      showToast('Select a customer first to delete addresses.', 'error');
      return;
    }

    setDeletingAddressId(address.id);

    try {
      const query = showBookForUsers && selectedBookingUserId ? `?userId=${encodeURIComponent(selectedBookingUserId)}` : '';

      await apiRequest<{ success: boolean }>(`/api/bookings/user-addresses/${address.id}${query}`, {
        method: 'DELETE',
      });

      setSavedAddresses((previous) => previous.filter((item) => item.id !== address.id));
      setConfirmDeleteAddressId(null);

      if (selectedSavedAddressId === address.id) {
        setSelectedSavedAddressId(null);
        setLocationAddress('');
        setLatitude('');
        setLongitude('');
      }

      showToast('Address deleted.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete address.';
      showToast(message, 'error');
    } finally {
      setDeletingAddressId(null);
    }
  }

  function requestDeleteAddress(addressId: string) {
    setConfirmDeleteAddressId(addressId);
  }

  function cancelDeleteAddress() {
    setConfirmDeleteAddressId(null);
  }

  function selectSavedAddress(address: SelectableAddress) {
    setSelectedSavedAddressId(address.id);
    setLocationAddress(formatSavedAddress(address));

    if (address.latitude !== null && address.longitude !== null) {
      setLatitude(String(address.latitude));
      setLongitude(String(address.longitude));
      setShowAddAddressModal(false);
      setLocationError(null);
      return;
    }

    setLatitude('');
    setLongitude('');
    setNewAddress(formatSavedAddress(address));
    setNewLatitude('');
    setNewLongitude('');
    setLocationSource('none');
    setShowAddAddressModal(true);
    setLocationError('This saved address has no map pin yet. Use current location or drop a pin.');
  }

  async function detectCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Location is not supported on this device/browser.');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setLocationError('Location requires HTTPS (or localhost). Please open this page in a secure context.');
      return;
    }

    setLocationError(null);
    setIsDetectingCurrentLocation(true);

    try {
      if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setLocationError(
            'Location access is blocked in your browser. Allow location for this site in browser settings, then try again.',
          );
          setIsDetectingCurrentLocation(false);
          return;
        }
      }
    } catch {
      // Ignore permissions API failures and continue to geolocation request.
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = String(position.coords.latitude);
        const lng = String(position.coords.longitude);
        setCurrentLatitude(lat);
        setCurrentLongitude(lng);
        setNewLatitude(lat);
        setNewLongitude(lng);
        setLocationSource('current');

        setIsDetectingCurrentLocation(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location access denied. Please allow location permission and try again.'
            : 'Unable to fetch your current location.';
        setLocationError(message);
        setIsDetectingCurrentLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  async function saveNewAddress() {
    if (isSavingAddress) {
      return;
    }

    if (requiresBookingUserSelection) {
      setLocationError('Select a customer first to save address.');
      showToast('Select a customer first to save address.', 'error');
      return;
    }

    const fullAddress = newAddress.trim();
    const normalizedPhone = toIndianE164(newPhone);

    if (!fullAddress) {
      setLocationError('Please enter full address.');
      return;
    }

    if (!isValidIndianE164(normalizedPhone)) {
      setLocationError('Enter a valid 10-digit Indian phone number.');
      return;
    }

    const effectiveLatitude = locationSource === 'pinned' ? newLatitude : newLatitude || currentLatitude;
    const effectiveLongitude = locationSource === 'pinned' ? newLongitude : newLongitude || currentLongitude;

    if (!effectiveLatitude || !effectiveLongitude) {
      setLocationError('Set location using current location or by dropping a pin.');
      return;
    }

    setIsSavingAddress(true);

    try {
      const query = showBookForUsers && selectedBookingUserId ? `?userId=${encodeURIComponent(selectedBookingUserId)}` : '';
      const payload = await apiRequest<{ success: boolean; address: SavedAddress }>(`/api/bookings/user-addresses${query}`, {
        method: 'POST',
        body: JSON.stringify({
          label: 'Other',
          addressLine1: fullAddress,
          latitude: Number(effectiveLatitude),
          longitude: Number(effectiveLongitude),
          phone: normalizedPhone,
        }),
      });

      setSavedAddresses((previous) => [payload.address, ...previous]);
      setSelectedSavedAddressId(payload.address.id);
      setLocationAddress(formatSavedAddress(payload.address));
      setLatitude(String(payload.address.latitude ?? effectiveLatitude));
      setLongitude(String(payload.address.longitude ?? effectiveLongitude));
      setShowAddAddressModal(false);
      setLocationError(null);
      setNewAddress('');
      setNewPhone('');
      setNewLatitude('');
      setNewLongitude('');
      setCurrentLatitude('');
      setCurrentLongitude('');
      setLocationSource('none');
      showToast('Address saved successfully.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save address.';
      setLocationError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingAddress(false);
    }
  }

  const applyDiscountCandidates = useCallback(async (codes: string[], silent: boolean) => {
    if (!serviceId) {
      if (!silent) {
        showToast('Select a service before applying discount.', 'error');
      }
      return;
    }

    const normalizedCodes = Array.from(new Set(codes.map((item) => item.trim().toUpperCase()).filter(Boolean)));

    if (normalizedCodes.length === 0) {
      if (!silent) {
        showToast('Enter a discount code.', 'error');
      }
      return;
    }

    let fallbackMessage = 'Discount cannot be applied.';

    for (const code of normalizedCodes) {
      try {
        const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
          method: 'POST',
          body: JSON.stringify({
            providerServiceId: serviceId,
            discountCode: code,
            bookingUserId: showBookForUsers ? selectedBookingUserId ?? undefined : undefined,
          }),
        });

        if (!payload?.preview) {
          continue;
        }

        setDiscountCode(payload.preview.code);
        setDiscountPreview(payload.preview);

        if (!silent) {
          showToast('Discount applied successfully.', 'success');
        }

        return;
      } catch (error) {
        fallbackMessage = error instanceof Error ? error.message : fallbackMessage;
        continue;
      }
    }

    setDiscountPreview(null);

    if (!silent) {
      showToast(fallbackMessage, 'error');
    }
  }, [selectedBookingUserId, serviceId, showBookForUsers, showToast]);

  function applyDiscount() {
    startTransition(async () => {
      await applyDiscountCandidates([discountCode], false);
    });
  }

  useEffect(() => {
    if (!serviceId) {
      return;
    }

    if (discountCode.trim() || discountPreview) {
      return;
    }

    if (rankedDiscountSuggestions.length === 0) {
      return;
    }

    const contextKey = `${serviceId}:${selectedBookingUserId ?? 'self'}:${rankedDiscountSuggestions.map((item) => item.code).join('|')}`;

    if (autoDiscountContextKey === contextKey) {
      return;
    }

    setAutoDiscountContextKey(contextKey);
    void applyDiscountCandidates(
      rankedDiscountSuggestions.slice(0, 3).map((item) => item.code),
      true,
    );
  }, [
    applyDiscountCandidates,
    autoDiscountContextKey,
    discountCode,
    discountPreview,
    rankedDiscountSuggestions,
    selectedBookingUserId,
    serviceId,
  ]);

  return (
    <AsyncState
      isLoading={isLoading}
      isError={Boolean(apiError)}
      errorMessage={apiError}
      loadingFallback={<div className="rounded-3xl border border-[#f2dfcf] bg-white p-6"><LoadingSkeleton lines={5} /></div>}
    >
      <div className="space-y-4 sm:space-y-5" data-flow-state={flowState}>
      {flowState === 'success' && lastBookingSummary ? (
        <PremiumBookingConfirmation
          bookingDate={lastBookingSummary.bookingDate}
          slotStartTime={lastBookingSummary.slotStartTime}
          bookingMode={lastBookingSummary.bookingMode}
          providerName={lastBookingSummary.providerName}
          petName={lastBookingSummary.petName}
          totalAmount={lastBookingSummary.totalAmount}
          amountStatus={lastBookingSummary.amountStatus}
        />
      ) : (
      <>
      <h3 className="text-lg sm:text-xl font-semibold text-ink">Smart Booking Engine</h3>
      <p className="mt-1 text-xs sm:text-sm text-neutral-600">Choose user, service, slot, provider, discount, and address.</p>

      <div className="mt-4 sm:mt-5 grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        {searchResultSummary ? (
          <div className="sm:col-span-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-[#8f4a1d]">
            {searchResultSummary}
          </div>
        ) : null}

        {showBookForUsers ? (
          <div className="sm:col-span-2 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 shadow-sm">
            <p className="mb-2 text-[13px] sm:text-sm font-semibold text-ink">Book for user</p>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void searchUsers();
              }}
            >
              <input
                value={bookingUserSearch}
                onChange={(event) => setBookingUserSearch(event.target.value)}
                placeholder="Search user by email"
                className={controlClassName}
              />
              <button
                type="submit"
                disabled={isSearchingUsers}
                className="inline-flex h-11 sm:h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-ink transition hover:border-coral/60"
              >
                {isSearchingUsers ? 'Searching...' : 'Search'}
              </button>
            </form>
            <div className="mt-2 max-h-44 space-y-1.5 overflow-auto">
              {isSearchingUsers ? (
                <p className="text-xs text-[#6b6b6b]">Searching users...</p>
              ) : !hasSearchedUsers ? (
                <p className="text-xs text-[#6b6b6b]">Search by email and click Search.</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-[#6b6b6b]">Your first booking starts here.</p>
              ) : (
                searchResults.map((bookableUser) => {
                  const label = bookableUser.name?.trim() || bookableUser.email || bookableUser.id;
                  const isSelected = selectedBookingUserId === bookableUser.id;

                  return (
                    <button
                      key={bookableUser.id}
                      type="button"
                      onClick={() => setSelectedBookingUserId(bookableUser.id)}
                      className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                        isSelected
                          ? 'border-coral/50 bg-orange-50 text-ink shadow-sm'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-coral/40'
                      }`}
                    >
                      <span className="font-medium text-ink">{label}</span>
                      {bookableUser.email ? <span className="ml-3 text-[11px] text-neutral-500">{bookableUser.email}</span> : null}
                    </button>
                  );
                })
              )}
            </div>

            {selectedBookingUser ? (
              <div className="mt-3 rounded-xl border border-coral/20 bg-orange-50 px-3.5 sm:px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-coral">Selected user</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selectedBookingUser.name?.trim() || selectedBookingUser.email || selectedBookingUser.id}</p>
                {selectedBookingUser.email ? <p className="text-xs text-neutral-600">{selectedBookingUser.email}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <select
          value={providerId ?? ''}
          onChange={(event) => setProviderId(Number(event.target.value))}
          className={controlClassName}
        >
          {filteredProviders.length === 0 ? <option value="">No providers available</option> : null}
          {filteredProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ({provider.provider_type ?? provider.type ?? 'provider'})
            </option>
          ))}
        </select>

        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 shadow-sm sm:col-span-2">
          <select
            value={serviceId ?? ''}
            onChange={(event) => setServiceId(event.target.value)}
            className={controlClassName}
          >
            {providerServices.length === 0 ? <option value="">No active services</option> : null}
            {providerServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.service_type} - Rs.{service.base_price}
              </option>
            ))}
          </select>

          {serviceAddOns.length > 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 sm:p-3">
              <p className="text-xs font-semibold text-ink">Add-ons</p>
              <div className="mt-2 space-y-2">
                {serviceAddOns.map((addOn) => (
                  <label key={addOn.id} className="flex items-center justify-between gap-3 text-xs text-[#6b6b6b]">
                    <span className="text-ink">{addOn.name} · Rs.{addOn.price}</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={selectedAddOns[addOn.id] ?? 0}
                      onChange={(event) => {
                        const quantity = Number(event.target.value || 0);
                        setSelectedAddOns((current) => ({
                          ...current,
                          [addOn.id]: quantity,
                        }));
                      }}
                      className="h-10 w-20 rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <select value={petId ?? ''} onChange={(event) => setPetId(Number(event.target.value))} className={controlClassName}>
          {pets.length === 0 ? <option value="">No pets found for selected user</option> : null}
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={bookingDate}
          onChange={(event) => setBookingDate(event.target.value)}
          className={controlClassName}
        />

        <select
          value={slotStartTime}
          onChange={(event) => {
            optimisticSlot.update(event.target.value);
            setSlotStartTime(event.target.value);
          }}
          className={`${controlClassName} sm:col-span-2`}
        >
          {slots.length === 0 ? <option value="">Your first booking starts here.</option> : null}
          {slots.map((slotOption) => (
            <option key={`${slotOption.start_time}-${slotOption.end_time}`} value={slotOption.start_time}>
              {slotOption.start_time} - {slotOption.end_time}
            </option>
          ))}
        </select>

        <div className="sm:col-span-2 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recommended Slots</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recommendationSlots.length === 0 ? (
              <p className="text-xs text-[#6b6b6b]">Recommendations appear after loading slots.</p>
            ) : (
              recommendationSlots.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    optimisticSlot.update(item.slot.start_time);
                    setSlotStartTime(item.slot.start_time);
                  }}
                  className={`rounded-xl border p-3 text-left text-xs transition-all hover:-translate-y-0.5 ${
                    slotStartTime === item.slot.start_time
                      ? 'border-coral/50 bg-orange-50 text-ink shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-coral/40 hover:shadow-sm'
                  }`}
                >
                  <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-sm" aria-hidden="true">
                    {item.label === 'Best' ? '⭐' : item.label === 'Fastest' ? '⚡' : '🧩'}
                  </div>
                  <p className="font-semibold text-ink">{item.label}: {item.slot.start_time}-{item.slot.end_time}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{item.reason}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <select
          value={bookingMode}
          onChange={(event) => setBookingMode(event.target.value as 'home_visit' | 'clinic_visit' | 'teleconsult')}
          className={controlClassName}
        >
          <option value="home_visit">Home Visit</option>
          <option value="clinic_visit">Clinic Visit</option>
          <option value="teleconsult">Teleconsult</option>
        </select>

        <input
          type="number"
          value={discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0}
          readOnly
          className={controlClassName}
          min={0}
        />

        <div className="sm:col-span-2 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 shadow-sm">
          <p className="text-[13px] sm:text-sm font-semibold text-ink">Discount</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={discountCode}
              onChange={(event) => {
                setDiscountCode(event.target.value.toUpperCase());
                setDiscountPreview(null);
              }}
              className={`${controlClassName} w-full sm:min-w-[220px] sm:flex-1`}
              placeholder="Enter discount code"
            />
            <button
              type="button"
              onClick={applyDiscount}
              disabled={isPending}
              className="inline-flex h-11 sm:h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-ink transition hover:border-coral/60"
            >
              Apply
            </button>
            {discountCode.trim() ? (
              <button
                type="button"
                onClick={clearDiscount}
                disabled={isPending}
                className="inline-flex h-11 sm:h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-ink transition hover:border-coral/60"
              >
                Clear
              </button>
            ) : null}
          </div>
          {rankedDiscountSuggestions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {rankedDiscountSuggestions.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDiscountCode(item.code);
                    startTransition(async () => {
                      await applyDiscountCandidates([item.code], false);
                    });
                  }}
                  className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-ink transition hover:border-coral/50"
                >
                  {item.code} · {item.title}
                  {item.first_booking_only ? ' · New user' : ''}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid gap-1 text-xs text-[#6b6b6b]">
            <p>Base amount: Rs.{discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0}</p>
            <p>Discount applied to service bill: Rs.{discountPreview?.discountAmount ?? 0}</p>
            <p className="font-semibold text-ink">Estimated payable to provider after service: Rs.{discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0}</p>
          </div>
        </div>

        {bookingMode === 'home_visit' ? (
          <>
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-ink">Saved addresses</p>
              {requiresBookingUserSelection ? (
                <p className="text-xs text-[#6b6b6b]">Select a customer first to view or manage addresses.</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {allAddresses.length > 0 ? (
                  allAddresses.map((address) => {
                    const isSelected = selectedSavedAddressId === address.id;
                    const chipLabel = address.label ? `${address.label} · ${address.address_line_1}` : address.address_line_1;
                    return (
                      <div
                        key={address.id}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-all ${
                          isSelected
                            ? 'border-coral bg-orange-50 text-coral'
                            : 'border-[#f2dfcf] bg-white text-ink hover:border-coral'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectSavedAddress(address)}
                          disabled={requiresBookingUserSelection}
                          className="rounded-full"
                        >
                          {chipLabel}
                        </button>
                        {confirmDeleteAddressId === address.id ? (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void deleteAddress(address)}
                              disabled={deletingAddressId === address.id}
                              className="font-semibold text-red-600 disabled:opacity-50"
                              aria-label="Confirm delete address"
                            >
                              {deletingAddressId === address.id ? '...' : '✓'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelDeleteAddress}
                              disabled={deletingAddressId === address.id}
                              className="font-semibold text-[#7a7a7a] disabled:opacity-50"
                              aria-label="Cancel delete address"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => requestDeleteAddress(address.id)}
                            disabled={deletingAddressId === address.id}
                            className="ml-2 font-semibold text-[#7a7a7a] hover:text-red-600 disabled:opacity-50"
                            aria-label="Delete saved address"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#6b6b6b]">No saved addresses yet.</p>
                )}
                <button
                  type="button"
                  onClick={openAddAddressModal}
                  disabled={requiresBookingUserSelection}
                  className="rounded-full border border-[#f2dfcf] bg-white px-2.5 py-1 text-xs text-ink hover:border-coral"
                >
                  + Add New Address
                </button>
              </div>
            </div>

            {locationAddress && latitude && longitude ? (
              <div className="sm:col-span-2 rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-xs text-[#6b6b6b]">
                <p className="text-sm font-medium text-ink">{locationAddress}</p>
                <p>📍 {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</p>
                <button
                  type="button"
                  onClick={openAddAddressModal}
                  className="mt-1 text-xs font-semibold text-coral hover:underline"
                >
                  Change address
                </button>
              </div>
            ) : null}

            {locationError && !showAddAddressModal ? <p className="sm:col-span-2 text-xs text-red-600">{locationError}</p> : null}

            {showAddAddressModal ? (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-2 sm:p-4">
                <div className="mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col bg-white sm:min-h-0 sm:h-auto sm:rounded-2xl sm:shadow-2xl">
                  <div className="flex items-center justify-between border-b border-[#f2dfcf] px-5 py-4">
                    <h3 className="text-base font-semibold text-ink">Add New Address</h3>
                    <button
                      type="button"
                      onClick={closeAddAddressModal}
                      className="rounded-full border border-[#f2dfcf] px-3 py-1 text-xs font-medium text-ink hover:border-coral"
                    >
                      Close
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:max-h-[75vh] sm:flex-none">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink">Full Address</label>
                      <textarea
                        value={newAddress}
                        onChange={(event) => {
                          setNewAddress(event.target.value);
                          setLocationError(null);
                        }}
                        rows={3}
                        maxLength={500}
                        placeholder="Enter full address with landmark"
                        className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => void detectCurrentLocation()}
                        disabled={isDetectingCurrentLocation}
                        className="w-full rounded-xl border border-[#f2dfcf] bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-[#fff7f0] disabled:opacity-70"
                      >
                        {isDetectingCurrentLocation ? 'Locating...' : 'Use Current Location'}
                      </button>
                    </div>

                    <LocationPinMap
                      latitude={newLatitude}
                      longitude={newLongitude}
                      currentLatitude={currentLatitude}
                      currentLongitude={currentLongitude}
                      onChange={(nextLat, nextLng) => {
                        setNewLatitude(String(nextLat));
                        setNewLongitude(String(nextLng));
                        setLocationSource('pinned');
                        setLocationError(null);
                      }}
                    />

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink">Phone Number</label>
                      <div className="flex overflow-hidden rounded-xl border border-[#f2dfcf]">
                        <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={newPhone}
                          onChange={(event) => {
                            setNewPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                            setLocationError(null);
                          }}
                          placeholder="9876543210"
                          className="w-full px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-[#f2dfcf] px-5 py-4">
                    <button
                      type="button"
                      onClick={closeAddAddressModal}
                      disabled={isSavingAddress}
                      className="rounded-xl border border-[#f2dfcf] px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveNewAddress}
                      disabled={isSavingAddress}
                      className="rounded-xl bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingAddress ? 'Saving...' : 'Save Address'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <input
          value={providerNotes}
          onChange={(event) => setProviderNotes(event.target.value)}
          className={`${controlClassName} sm:col-span-2`}
          placeholder="Booking notes (optional)"
        />
      </div>

      <aside className="xl:sticky xl:top-6 xl:h-fit">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm">
          <h4 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-neutral-500">Live Booking Summary</h4>
          <div className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Service</p>
              <p className="mt-1 font-semibold text-ink">{summaryServiceName}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Date</p>
                <p className="mt-1 text-xs sm:text-sm font-medium text-ink">{summaryDate}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Time</p>
                <p className="mt-1 text-xs sm:text-sm font-medium text-ink">{summaryTime}</p>
              </div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Address</p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-ink">{summaryAddress}</p>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Price Breakdown</p>
            <div className="mt-2 space-y-1 text-xs sm:text-sm text-neutral-700">
              <div className="flex items-center justify-between">
                <span>Base amount</span>
                <span>₹{summaryBaseAmount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span>- ₹{summaryDiscountAmount}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3">
              <span className="text-xs sm:text-sm font-semibold text-ink">Total</span>
              <span className="text-xl sm:text-2xl font-bold text-ink">₹{summaryTotalAmount}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payment Option</p>
            <label className="mt-2 flex items-start gap-2 text-xs text-neutral-700">
              <input
                type="radio"
                name="payment-choice"
                checked={paymentChoice === 'direct'}
                onChange={() => setPaymentChoice('direct')}
                className="mt-0.5"
              />
              <span>Pay after service to provider (Cash/UPI)</span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-xs text-neutral-700">
              <input
                type="radio"
                name="payment-choice"
                checked={paymentChoice === 'subscription_credit'}
                onChange={() => setPaymentChoice('subscription_credit')}
                disabled={!creditEligibility?.eligible || isCheckingCreditEligibility}
                className="mt-0.5"
              />
              <span>
                Use subscription credit
                {creditEligibility?.eligible
                  ? ` (${creditEligibility.availableCredits} credits available)`
                  : isCheckingCreditEligibility
                    ? ' (checking availability...)'
                    : ' (not available for this service)'}
              </span>
            </label>
            <p className="mt-2 text-[11px] text-neutral-500">
              Subscription credits are deducted only when booking is completed and restored if booking is cancelled.
            </p>
          </div>

          <button
            type="button"
            onClick={submitBooking}
            disabled={isPending}
            className="mt-4 inline-flex h-11 sm:h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 text-sm font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Booking...' : 'Create Booking'}
          </button>
        </div>
      </aside>
      </div>
      </>
      )}
      </div>
    </AsyncState>
  );
}
