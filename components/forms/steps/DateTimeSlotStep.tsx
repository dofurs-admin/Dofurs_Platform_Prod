'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiRequest } from '@/lib/api/client';
import { isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

const LocationPinMap = dynamic(() => import('../LocationPinMap'), { ssr: false });
import AvailabilityCalendar from '@/components/ui/AvailabilityCalendar';

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  availableProviderCount: number;
  recommended: boolean;
};
type AvailabilityProvider = {
  providerId: number;
  providerName: string;
  providerType: string | null;
  providerServiceId: string;
  availableForSelectedSlot: boolean;
  availableSlotCount: number;
  recommended: boolean;
  basePrice: number;
  serviceDurationMinutes: number;
  averageRating?: number | null;
  totalBookings?: number | null;
  backgroundVerified?: boolean;
  isVerified?: boolean;
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

type SelectableAddress = SavedAddress & {
  phone?: string | null;
};

type PincodeLookupResponse = {
  city: string | null;
  state: string | null;
  country: string | null;
};

type PetSummary = {
  id: number;
  name: string;
  breed?: string | null;
  serviceType?: string | null;
  hasVaccinationsDue?: boolean;
};

interface DateTimeSlotStepProps {
  slotOptions: AvailabilitySlot[];
  providers: AvailabilityProvider[];
  selectedProviderId: number | null;
  selectedProviderServiceId: string | null;
  selectedAutoProvider: boolean;
  selectedDate: string;
  selectedSlot: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress: string;
  latitude: string;
  longitude: string;
  savedAddresses: SavedAddress[];
  selectedSavedAddressId: string | null;
  providerNotes: string;
  selectedPets?: PetSummary[];
  isPackageBooking?: boolean;
  isBoardingBooking?: boolean;
  bookingEndDate?: string;
  onBookingEndDateChange?: (date: string) => void;
  totalSelectedServices?: number;
  totalDurationMinutes?: number;
  providerSupportsSelectedServices?: boolean;
  availableDates?: string[];
  isLoadingAvailableDates?: boolean;
  maxSelectableDate?: string;
  pincodeCheckerValue: string;
  onPincodeCheckerValueChange: (value: string) => void;
  onPincodeCheck: () => void;
  isCheckingPincodeCoverage: boolean;
  hasCheckedPincodeCoverage: boolean;
  pincodeCoverageServiceCount: number;
  pincodeCoverageError: string | null;
  selectedAddressPincode: string;
  hasCheckedSelectedAddressCoverage: boolean;
  isCheckingSelectedAddressCoverage: boolean;
  isSelectedAddressServiceable: boolean;
  selectedAddressCoverageError: string | null;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string) => void;
  onProviderSelect: (providerServiceId: string, providerId: number) => void;
  onAutoProviderSelect: (auto: boolean) => void;
  onLocationChange: (address: string) => void;
  onLatitudeChange: (lat: string) => void;
  onLongitudeChange: (lng: string) => void;
  onSelectSavedAddress: (addressId: string | null) => void;
  onUpsertSavedAddress: (address: SavedAddress) => void;
  onNotesChange: (notes: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function DateTimeSlotStep({
  slotOptions,
  providers,
  selectedProviderId,
  selectedProviderServiceId,
  selectedAutoProvider,
  selectedDate,
  selectedSlot,
  bookingMode,
  locationAddress,
  latitude,
  longitude,
  savedAddresses,
  selectedSavedAddressId,
  providerNotes,
  selectedPets = [],
  isPackageBooking = false,
  isBoardingBooking = false,
  bookingEndDate = '',
  onBookingEndDateChange,
  totalSelectedServices = 1,
  totalDurationMinutes = 0,
  providerSupportsSelectedServices = true,
  availableDates = [],
  isLoadingAvailableDates = false,
  maxSelectableDate,
  pincodeCheckerValue,
  onPincodeCheckerValueChange,
  onPincodeCheck,
  isCheckingPincodeCoverage,
  hasCheckedPincodeCoverage,
  pincodeCoverageServiceCount,
  pincodeCoverageError,
  selectedAddressPincode,
  hasCheckedSelectedAddressCoverage,
  isCheckingSelectedAddressCoverage,
  isSelectedAddressServiceable,
  selectedAddressCoverageError,
  onDateChange,
  onSlotChange,
  onProviderSelect,
  onAutoProviderSelect,
  onLocationChange,
  onLatitudeChange,
  onLongitudeChange,
  onSelectSavedAddress,
  onUpsertSavedAddress,
  onNotesChange,
  onNext,
  onPrev,
}: DateTimeSlotStepProps) {
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressLine1, setNewAddressLine1] = useState('');
  const [newAddressLine2, setNewAddressLine2] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newCountry, setNewCountry] = useState('India');
  const [newPhone, setNewPhone] = useState('');
  const [newLatitude, setNewLatitude] = useState('');
  const [newLongitude, setNewLongitude] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [currentLatitude, setCurrentLatitude] = useState('');
  const [currentLongitude, setCurrentLongitude] = useState('');
  const [locationSource, setLocationSource] = useState<'none' | 'current' | 'pinned'>('none');
  const [isDetectingCurrentLocation, setIsDetectingCurrentLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isResolvingPincode, setIsResolvingPincode] = useState(false);

  const allAddresses = useMemo<SelectableAddress[]>(() => [...savedAddresses], [savedAddresses]);

  const availableProvidersForSlot = useMemo(
    () => providers.filter((provider) => provider.availableForSelectedSlot),
    [providers],
  );

  const canProceed = isPackageBooking
    ? selectedDate && (!isBoardingBooking || bookingEndDate) && providerSupportsSelectedServices
    : selectedDate &&
      selectedSlot &&
      selectedProviderId &&
      selectedProviderServiceId &&
      (bookingMode !== 'home_visit' || (locationAddress.trim() && latitude && longitude)) &&
      providerSupportsSelectedServices;

  const mustSelectServiceableAddress = bookingMode === 'home_visit' && !isPackageBooking;
  const canSelectDate = mustSelectServiceableAddress ? isSelectedAddressServiceable : true;

  const continueDisabledReason = (() => {
    if (canProceed) {
      return null;
    }

    if (!selectedDate) {
      return 'Select a date to continue.';
    }

    if (isBoardingBooking && !bookingEndDate) {
      return 'Select an end date for boarding to continue.';
    }

    if (!isPackageBooking && !selectedSlot) {
      return 'Select a time slot to continue.';
    }

    if (!isPackageBooking && (!selectedProviderId || !selectedProviderServiceId)) {
      return 'Select a provider to continue.';
    }

    if (!isPackageBooking && bookingMode === 'home_visit' && (!locationAddress.trim() || !latitude || !longitude)) {
      return 'Set your service address and location to continue.';
    }

    if (!providerSupportsSelectedServices) {
      return 'Select a provider that supports all selected services.';
    }

    return 'Complete this step to continue.';
  })();

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

  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showAddAddressModal) {
        closeAddAddressModal();
      }
    },
    [showAddAddressModal],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [handleEscapeKey]);

  function resetNewAddressForm() {
    setNewAddressLine1('');
    setNewAddressLine2('');
    setNewCity('');
    setNewState('');
    setNewPincode('');
    setNewCountry('India');
    setNewPhone('');
    setNewLatitude('');
    setNewLongitude('');
    setEditingAddressId(null);
    setCurrentLatitude('');
    setCurrentLongitude('');
    setLocationSource('none');
    setLocationError(null);
  }

  function openAddAddressModal() {
    onSelectSavedAddress(null);
    resetNewAddressForm();
    setShowAddAddressModal(true);
    setLocationError(null);
  }

  function openEditAddressModal(address: SavedAddress) {
    const formattedAddress = formatSavedAddress(address);
    onSelectSavedAddress(address.id);
    onLocationChange(formattedAddress);
    setEditingAddressId(address.id);
    setNewAddressLine1(address.address_line_1 ?? '');
    setNewAddressLine2(address.address_line_2 ?? '');
    setNewCity(address.city ?? '');
    setNewState(address.state ?? '');
    setNewPincode(address.pincode ?? '');
    setNewCountry(address.country ?? 'India');
    setNewPhone(address.phone ? address.phone.replace(/^\+91/, '') : '');
    setNewLatitude(address.latitude !== null ? String(address.latitude) : '');
    setNewLongitude(address.longitude !== null ? String(address.longitude) : '');
    setLocationSource(address.latitude !== null && address.longitude !== null ? 'pinned' : 'none');
    setShowAddAddressModal(true);
    setLocationError(null);
  }

  async function resolvePincodeDetails(pincode: string) {
    const normalizedPincode = pincode.replace(/\D/g, '').slice(0, 6);
    if (!/^[1-9]\d{5}$/.test(normalizedPincode)) {
      return;
    }

    setIsResolvingPincode(true);
    try {
      const response = await fetch(`/api/pincode/${encodeURIComponent(normalizedPincode)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        setLocationError('Unable to verify pincode details. Please check city and state manually.');
        return;
      }

      const payload = (await response.json().catch(() => null)) as PincodeLookupResponse | null;

      if (!payload?.city || !payload?.state) {
        setLocationError('Pincode not found. Please enter a valid pincode.');
        return;
      }

      setNewCity(payload.city);
      setNewState(payload.state);
      setNewCountry(payload.country || 'India');
      setLocationError(null);
    } catch {
      setLocationError('Unable to verify pincode details. Please try again.');
    } finally {
      setIsResolvingPincode(false);
    }
  }

  function closeAddAddressModal() {
    setShowAddAddressModal(false);
    setEditingAddressId(null);
    setLocationError(null);
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

  async function handleSaveNewAddress() {
    const addressLine1 = newAddressLine1.trim();
    const addressLine2 = newAddressLine2.trim();
    const city = newCity.trim();
    const state = newState.trim();
    const pincode = newPincode.trim();
    const country = (newCountry.trim() || 'India');

    if (addressLine1.length < 5) {
      setLocationError('Enter house/building and street details (minimum 5 characters).');
      return;
    }

    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setLocationError('Enter a valid 6-digit Indian pincode.');
      return;
    }

    if (city.length < 2) {
      setLocationError('Enter a valid city name.');
      return;
    }

    if (state.length < 2) {
      setLocationError('Enter a valid state name.');
      return;
    }

    if (!newPhone.trim()) {
      setLocationError('Enter a valid 10-digit Indian phone number.');
      return;
    }

    const normalizedPhone = toIndianE164(newPhone);
    if (!isValidIndianE164(normalizedPhone)) {
      setLocationError('Enter a valid 10-digit Indian phone number.');
      return;
    }

    const effectiveLatitude = locationSource === 'pinned' ? newLatitude : newLatitude || currentLatitude;
    const effectiveLongitude = locationSource === 'pinned' ? newLongitude : newLongitude || currentLongitude;

    if (!effectiveLatitude || !effectiveLongitude) {
      setLocationError('Set your location using current location or by dropping a pin on the map.');
      return;
    }

    const parsedLatitude = Number(effectiveLatitude);
    const parsedLongitude = Number(effectiveLongitude);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      setLocationError('Invalid location coordinates. Please set location again.');
      return;
    }

    if (editingAddressId && !editingAddressId.startsWith('local-')) {
      try {
        const payload = await apiRequest<{ address?: SavedAddress }>(
          `/api/user/owner-profile/addresses/${encodeURIComponent(editingAddressId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              address_line_1: addressLine1,
              address_line_2: addressLine2 || null,
              city,
              state,
              pincode,
              country,
              latitude: parsedLatitude,
              longitude: parsedLongitude,
              phone: normalizedPhone,
            }),
          },
        );

        if (payload.address) {
          onUpsertSavedAddress(payload.address);
          onSelectSavedAddress(payload.address.id);
        }

        onLocationChange(formatSavedAddress(payload.address ?? {
          id: editingAddressId,
          label: 'Other',
          address_line_1: addressLine1,
          address_line_2: addressLine2 || null,
          city,
          state,
          pincode,
          country,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          is_default: false,
        }));
        onLatitudeChange(String(parsedLatitude));
        onLongitudeChange(String(parsedLongitude));
        setAddressError(null);

        closeAddAddressModal();
        resetNewAddressForm();
        return;
      } catch (error) {
        setLocationError(error instanceof Error ? error.message : 'Unable to update address. Please try again.');
        return;
      }
    }

    // Persist new address to the API so it appears in Manage Address
    setIsSavingAddress(true);
    try {
      const payload = await apiRequest<{ success: boolean; address: SavedAddress }>(
        '/api/bookings/user-addresses',
        {
          method: 'POST',
          body: JSON.stringify({
            label: 'Other',
            addressLine1: addressLine1,
            addressLine2: addressLine2 || undefined,
            city,
            state,
            pincode,
            country,
            latitude: parsedLatitude,
            longitude: parsedLongitude,
            phone: normalizedPhone,
          }),
        },
      );

      onUpsertSavedAddress(payload.address);
      onSelectSavedAddress(payload.address.id);
      onLocationChange(formatSavedAddress(payload.address));
      onLatitudeChange(String(parsedLatitude));
      onLongitudeChange(String(parsedLongitude));
      setAddressError(null);

      closeAddAddressModal();
      resetNewAddressForm();
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Unable to save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
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

  function handleSelectSavedAddress(address: SavedAddress) {
    const formattedAddress = formatSavedAddress(address);
    onSelectSavedAddress(address.id);
    onLocationChange(formattedAddress);
    setAddressError(null);

    if (address.latitude !== null && address.longitude !== null) {
      onLatitudeChange(String(address.latitude));
      onLongitudeChange(String(address.longitude));
      setShowAddAddressModal(false);
      setLocationError(null);
      return;
    }

    onLatitudeChange('');
    onLongitudeChange('');
    openEditAddressModal(address);
    setLocationError('This saved address has no map pin yet. Use current location or drop a pin on the map.');
  }

  return (
    <div className="premium-fade-up space-y-2.5 sm:space-y-7 rounded-2xl sm:rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-2.5 max-[380px]:p-2 sm:p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
      {/* Top navigation */}
      <div className="hidden sm:flex sm:flex-row sm:justify-between sm:gap-3">
        <button
          onClick={onPrev}
          className="inline-flex w-full items-center justify-center rounded-full border border-[#e3c7ae] bg-white px-6 py-2.5 text-center text-sm font-semibold leading-5 text-[#7c5335] transition-all hover:border-[#c7773b] sm:w-auto"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (!isPackageBooking && bookingMode === 'home_visit' && !locationAddress.trim()) {
              setAddressError('Please select your address.');
            } else {
              setAddressError(null);
            }
            onNext();
          }}
          disabled={!canProceed}
          className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-7 py-2.5 text-center text-sm font-semibold leading-5 text-white whitespace-nowrap shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all sm:hover:-translate-y-0.5 sm:hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Continue To Review
        </button>
      </div>
      {!canProceed && continueDisabledReason ? (
        <p className="hidden sm:block text-right text-xs font-medium text-[#8f4a1d]">{continueDisabledReason}</p>
      ) : null}

      {/* Step indicator — hidden on mobile since BookingProgressBar shows step info */}
      <div className="hidden sm:block">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">Step 2 of 3</p>
        <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-950">
          {isPackageBooking
            ? isBoardingBooking ? 'Select Boarding Dates' : 'Select Date'
            : 'Schedule Date, Slot & Location'}
        </h2>
        <p className="mt-2 text-sm text-[#6e4d35]">
          {isPackageBooking
            ? isBoardingBooking ? 'Choose check-in and check-out dates for boarding.' : 'Pick the best date for the experience.'
            : 'Pick the exact time and location details for a smooth service experience.'}
        </p>
        {totalSelectedServices > 1 && !isPackageBooking && (
          <p className="mt-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2 text-xs font-medium text-[#8f4a1d]">
            {totalSelectedServices} services selected{totalDurationMinutes > 0 ? ` (${totalDurationMinutes} mins total)` : ''}. Select one start time — services will be scheduled back-to-back.
          </p>
        )}
      </div>

      {/* Pet passport summary — shows selected pets with their service and any health flags */}
      {selectedPets.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9a6a44] sm:mb-2 sm:text-xs">Booking For</p>
          <div className="flex flex-wrap gap-2">
            {selectedPets.map((pet) => (
              <div
                key={pet.id}
                className="flex items-center gap-2 rounded-xl border border-[#e8d0b8] bg-[#fff8f0] px-2.5 py-1.5 sm:px-3 sm:py-2"
              >
                <span className="text-base">🐾</span>
                <div>
                  <p className="text-[13px] font-semibold text-neutral-950 sm:text-sm">{pet.name}</p>
                  <p className="text-[11px] text-[#6e4d35]">
                    {pet.serviceType ?? pet.breed ?? 'Pet'}
                    {pet.hasVaccinationsDue && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        💉 Vaccination due
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Address for home visit — hidden for package bookings (birthday/boarding) */}
      {bookingMode === 'home_visit' && !isPackageBooking && (
        <div>
          <div className="mb-3 rounded-2xl border border-[#ebdccf] bg-[#fff9f4] p-3 sm:mb-4 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a6445]">Pincode checker</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pincodeCheckerValue}
                  onChange={(event) => onPincodeCheckerValueChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit pincode"
                  className="w-full rounded-lg border border-[#dcbfa8] bg-white px-3 py-1.5 text-[13px] focus:border-coral focus:outline-none sm:py-2 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={onPincodeCheck}
                disabled={isCheckingPincodeCoverage}
                className="rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-4 py-1.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:py-2 sm:text-sm"
              >
                {isCheckingPincodeCoverage ? 'Checking...' : 'Check availability'}
              </button>
            </div>

            {pincodeCoverageError ? (
              <p className="mt-3 text-sm font-medium text-amber-700">{pincodeCoverageError}</p>
            ) : null}

            {hasCheckedPincodeCoverage && pincodeCoverageServiceCount === 0 && !pincodeCoverageError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                Services are not available on your pincode. We are working to bring services to your area.
              </p>
            ) : null}

            {hasCheckedPincodeCoverage && pincodeCoverageServiceCount > 0 && !pincodeCoverageError ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                Good news. Services are available for this pincode.
              </p>
            ) : null}
          </div>

          <label className="block text-sm font-semibold text-neutral-950 mb-3">Service Address</label>
          {addressError && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{addressError}</p>
          )}
          <div className="mb-3 space-y-2">
            <p className="text-xs font-medium text-neutral-700">Saved addresses</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {allAddresses.length > 0 ? (
                allAddresses.map((address) => {
                  const isSelected = selectedSavedAddressId === address.id;
                  const chipLabel = address.label ? `${address.label} · ${address.address_line_1}` : address.address_line_1;
                  const isLocalAddress = address.id.startsWith('local-');

                  return (
                    <div key={address.id} className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectSavedAddress(address)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-coral bg-orange-50 text-coral'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-coral'
                        }`}
                      >
                        {chipLabel}
                      </button>
                      {!isLocalAddress ? (
                        <button
                          type="button"
                          onClick={() => openEditAddressModal(address)}
                          className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-coral"
                          aria-label={`Edit saved address ${chipLabel}`}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-neutral-500">No saved addresses yet.</p>
              )}
              <button
                type="button"
                onClick={openAddAddressModal}
                className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-coral sm:px-3 sm:py-1.5 sm:text-xs"
              >
                + Add New Address
              </button>
            </div>
          </div>

          {locationAddress && latitude && longitude ? (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-2.5 sm:p-3">
              <p className="text-[13px] font-medium text-neutral-950 sm:text-sm">{locationAddress}</p>
              <p className="text-xs text-neutral-600 mt-1">
                📍 {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
              </p>
              <button
                type="button"
                onClick={openAddAddressModal}
                className="mt-2 text-xs font-semibold text-coral hover:underline"
              >
                Change address
              </button>
            </div>
          ) : null}

          {!selectedSavedAddressId ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              Select a saved address inside our serviceable area to unlock date selection.
            </p>
          ) : null}

          {selectedSavedAddressId && !selectedAddressPincode ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              Selected address is missing a valid pincode. Edit the address and add a correct 6-digit pincode.
            </p>
          ) : null}

          {selectedSavedAddressId && selectedAddressPincode ? (
            <div className="mt-3">
              {isCheckingSelectedAddressCoverage ? (
                <p className="text-sm font-medium text-[#8a6445]">Checking serviceability for selected address pincode...</p>
              ) : null}
              {selectedAddressCoverageError ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                  {selectedAddressCoverageError}
                </p>
              ) : null}
              {hasCheckedSelectedAddressCoverage && !isSelectedAddressServiceable && !selectedAddressCoverageError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  Services are not available on your pincode. We are working to bring services to your area.
                </p>
              ) : null}
              {hasCheckedSelectedAddressCoverage && isSelectedAddressServiceable && !selectedAddressCoverageError ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  Selected address pincode is serviceable. You can continue scheduling.
                </p>
              ) : null}
            </div>
          ) : null}

          {showAddAddressModal ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-2 sm:p-4">
              <div className="mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col bg-white sm:min-h-0 sm:h-auto sm:rounded-2xl sm:shadow-2xl">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                  <h3 className="text-base font-semibold text-neutral-950">{editingAddressId ? 'Edit Address' : 'Add New Address'}</h3>
                  <button
                    type="button"
                    onClick={closeAddAddressModal}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:border-coral"
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:max-h-[75vh] sm:flex-none">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">House / Flat / Building and Street</label>
                    <textarea
                      value={newAddressLine1}
                      onChange={(event) => {
                        setNewAddressLine1(event.target.value);
                        setLocationError(null);
                      }}
                      rows={3}
                      maxLength={250}
                      placeholder="Flat no, building name, street, landmark"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">Area / Locality <span className="font-normal text-neutral-400">(optional)</span></label>
                    <input
                      type="text"
                      value={newAddressLine2}
                      onChange={(event) => {
                        setNewAddressLine2(event.target.value);
                        setLocationError(null);
                      }}
                      maxLength={250}
                      placeholder="Area, locality"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">Pincode</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newPincode}
                        onChange={(event) => {
                          setNewPincode(event.target.value.replace(/\D/g, '').slice(0, 6));
                          setLocationError(null);
                        }}
                        maxLength={6}
                        placeholder="560001"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void resolvePincodeDetails(newPincode)}
                      disabled={isResolvingPincode || !/^[1-9]\d{5}$/.test(newPincode.trim())}
                      className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-coral disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
                    >
                      {isResolvingPincode ? 'Checking...' : 'Autofill city/state'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">City</label>
                      <input
                        type="text"
                        value={newCity}
                        onChange={(event) => {
                          setNewCity(event.target.value);
                          setLocationError(null);
                        }}
                        maxLength={120}
                        placeholder="Bengaluru"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">State</label>
                      <input
                        type="text"
                        value={newState}
                        onChange={(event) => {
                          setNewState(event.target.value);
                          setLocationError(null);
                        }}
                        maxLength={120}
                        placeholder="Karnataka"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">Country</label>
                    <input
                      type="text"
                      value={newCountry}
                      onChange={(event) => {
                        setNewCountry(event.target.value);
                        setLocationError(null);
                      }}
                      maxLength={120}
                      placeholder="India"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">Phone Number</label>
                    <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200 focus-within:border-coral">
                      <span className="select-none border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={newPhone}
                        onChange={(event) => {
                          setNewPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                          setLocationError(null);
                        }}
                        placeholder="9876543210"
                        maxLength={10}
                        className="flex-1 bg-white px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => void detectCurrentLocation()}
                      disabled={isDetectingCurrentLocation}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-70"
                    >
                      {isDetectingCurrentLocation ? 'Locating…' : 'Use Current Location'}
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

                  {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeAddAddressModal}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-coral"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNewAddress}
                    disabled={isSavingAddress}
                    className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-[#cf8448] disabled:opacity-60"
                  >
                    {isSavingAddress ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Date selection */}
      <div>
        <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">
          {isBoardingBooking ? 'Select Start Date' : 'Select Date'}
        </label>
        {canSelectDate ? (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Green dates have available slots. You can book only within the next 30 days.
          </p>
        ) : null}
        <div className={canSelectDate ? '' : 'pointer-events-none opacity-60'}>
          <AvailabilityCalendar
            value={selectedDate}
            onChange={(date) => {
              if (!canSelectDate) {
                return;
              }

              onDateChange(date);
              onSlotChange(''); // Reset slot when date changes
              // Reset end date if start date changes and end date is on or before new start
              if (isBoardingBooking && bookingEndDate && date >= bookingEndDate) {
                onBookingEndDateChange?.('');
              }
            }}
            minDate={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
            maxDate={maxSelectableDate}
            availableDates={availableDates}
            disableUnavailableDates={availableDates.length > 0}
          />
        </div>
        {isLoadingAvailableDates && canSelectDate ? (
          <p className="mt-3 text-sm font-medium text-[#8a6445]">Checking the earliest available dates and slots...</p>
        ) : null}
        {!canSelectDate ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
            Date selection is locked until you choose an address in a serviceable pincode.
          </p>
        ) : null}
      </div>

      {/* Boarding end date selection */}
      {isBoardingBooking && selectedDate && (
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">Select End Date</label>
          <AvailabilityCalendar
            value={bookingEndDate}
            onChange={(date) => onBookingEndDateChange?.(date)}
            minDate={(() => {
              // End date must be at least 1 day after start date
              const start = new Date(`${selectedDate}T00:00:00`);
              start.setDate(start.getDate() + 1);
              return start.toISOString().split('T')[0];
            })()}
            maxDate={maxSelectableDate}
          />
          {selectedDate && bookingEndDate && (
            <p className="mt-2 text-sm font-medium text-[#6e4d35]">
              Boarding: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} — {new Date(`${bookingEndDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ({Math.round((new Date(`${bookingEndDate}T00:00:00`).getTime() - new Date(`${selectedDate}T00:00:00`).getTime()) / 86400000)} nights)
            </p>
          )}
        </div>
      )}

      {/* Time slot selection — hidden for package services (birthday/boarding) */}
      {!isPackageBooking && selectedDate && (
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">Available Times</label>

          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-600">Suggested slots (based on provider availability)</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {slotOptions.length === 0 ? (
                <p className="text-sm text-neutral-500">No slots available for this date</p>
              ) : (
                slotOptions.map((slot) => (
                  <button
                    key={`${slot.startTime}-${slot.endTime}`}
                    onClick={() => onSlotChange(slot.startTime)}
                    className={`rounded-lg border-2 px-2.5 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:py-2 sm:text-xs ${
                      selectedSlot === slot.startTime
                        ? 'border-coral bg-white text-coral'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-coral'
                    }`}
                  >
                    <span className="block font-semibold">{slot.startTime} - {slot.endTime}</span>
                    <span className="text-[10px] text-neutral-500">{slot.availableProviderCount} providers available</span>
                    {slot.recommended ? <span className="text-[10px] font-semibold text-coral">Recommended</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provider selection — shown for regular bookings and boarding (hidden for birthday packages) */}
      {(!isPackageBooking || isBoardingBooking) && selectedDate ? (
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">
            Select {bookingMode === 'clinic_visit' ? 'Clinic or Center' : 'Provider'}
          </label>

          {!isBoardingBooking && !selectedSlot ? (
            <div className="rounded-2xl border border-dashed border-[#ddc9b6] bg-white p-4 text-center">
              <p className="text-sm text-neutral-500">Select a time slot first to see available providers.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                <button
                  onClick={() => onAutoProviderSelect(true)}
                  className={`premium-lift relative rounded-xl sm:rounded-2xl border p-3 sm:p-4 text-left transition-all ${
                    selectedAutoProvider
                      ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                      : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                  }`}
                >
                  <h3 className="font-semibold text-neutral-950">Auto-Select</h3>
                  <p className="mt-1 text-xs text-[#6e4d35]">Best available provider is selected automatically{isBoardingBooking ? '.' : ' for this slot.'}</p>
                </button>

                {(isBoardingBooking ? providers : availableProvidersForSlot).map((provider) => (
                  <button
                    key={provider.providerServiceId}
                    onClick={() => {
                      onAutoProviderSelect(false);
                      onProviderSelect(provider.providerServiceId, provider.providerId);
                    }}
                    className={`premium-lift relative rounded-xl sm:rounded-2xl border p-3 sm:p-4 text-left transition-all ${
                      !selectedAutoProvider && selectedProviderServiceId === provider.providerServiceId
                        ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                        : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-neutral-950">{provider.providerName}</h3>
                      {provider.isVerified && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#6e4d35]">{provider.providerType || 'Provider'}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
                      <span>₹{provider.basePrice}{isBoardingBooking ? '/night' : ''} • {provider.serviceDurationMinutes} mins</span>
                      {typeof provider.averageRating === 'number' && provider.averageRating > 0 && (
                        <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                          ★ {provider.averageRating.toFixed(1)}
                          {typeof provider.totalBookings === 'number' && provider.totalBookings > 0 && (
                            <span className="font-normal text-neutral-500">({provider.totalBookings} bookings)</span>
                          )}
                        </span>
                      )}
                      {provider.backgroundVerified && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          🛡 BG Checked
                        </span>
                      )}
                    </div>
                    {provider.recommended ? <p className="mt-1.5 text-[11px] font-semibold text-coral">Auto Recommended</p> : null}
                  </button>
                ))}
              </div>

              {(isBoardingBooking ? providers : availableProvidersForSlot).length === 0 ? (
                <div className="mt-3 rounded-2xl border border-[#efc6c6] bg-[#fff4f4] p-4 text-center">
                  <p className="text-sm text-[#9f2f2f]">{isBoardingBooking ? 'No providers available for boarding. Please try another service or date.' : 'No providers are available for this slot. Please choose another service or slot.'}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Additional notes — hidden for package bookings */}
      {!isPackageBooking && (
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">Notes for Provider (Optional)</label>
          <textarea
            value={providerNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="E.g., special instructions for your pet, access details, etc."
            className="w-full rounded-lg border-2 border-neutral-200 px-3 py-2 text-[13px] focus:border-coral focus:outline-none sm:px-4 sm:py-2.5 sm:text-sm"
            rows={3}
            maxLength={2000}
          />
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
        <button
          onClick={onPrev}
          className="w-full rounded-full border border-[#e3c7ae] bg-white px-6 py-2.5 text-sm font-semibold text-[#7c5335] transition-all hover:border-[#c7773b] sm:w-auto"
        >
          Back
        </button>
        <button
          onClick={() => {
            // Show inline address error for home_visit without address
            if (!isPackageBooking && bookingMode === 'home_visit' && !locationAddress.trim()) {
              setAddressError('Please select your address.');
            } else {
              setAddressError(null);
            }
            onNext();
          }}
          disabled={!canProceed}
          className="w-full rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-7 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Continue To Review
        </button>
      </div>
      {!canProceed && continueDisabledReason ? (
        <p className="sm:hidden text-xs font-medium text-[#8f4a1d]">{continueDisabledReason}</p>
      ) : null}
    </div>
  );
}
