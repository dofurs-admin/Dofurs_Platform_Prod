'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiRequest } from '@/lib/api/client';
import { isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';
import { formatSavedAddress } from '@/lib/utils/address';

const LocationPinMap = dynamic(() => import('../LocationPinMap'), { ssr: false });
import AvailabilityCalendar from '@/components/ui/AvailabilityCalendar';

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  availableProviderCount: number;
  recommended: boolean;
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
  selectedProviderId: number | null;
  selectedProviderServiceId: string | null;
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
  selectedProviderId,
  selectedProviderServiceId,
  selectedDate,
  selectedSlot,
  bookingMode,
  locationAddress,
  latitude,
  longitude,
  savedAddresses,
  selectedSavedAddressId,
  providerNotes,
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
  const [isAddressSelectorOpen, setIsAddressSelectorOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isResolvingPincode, setIsResolvingPincode] = useState(false);

  const allAddresses = useMemo<SelectableAddress[]>(() => [...savedAddresses], [savedAddresses]);
  const selectedSavedAddress = useMemo(
    () => allAddresses.find((address) => address.id === selectedSavedAddressId) ?? null,
    [allAddresses, selectedSavedAddressId],
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
      return selectedSlot
        ? 'That time is no longer available. Choose another time.'
        : 'Select a time slot to continue.';
    }

    if (!isPackageBooking && bookingMode === 'home_visit' && (!locationAddress.trim() || !latitude || !longitude)) {
      return 'Set your service address and location to continue.';
    }

    if (!providerSupportsSelectedServices) {
      return 'No available professional supports all selected services for this slot.';
    }

    return 'Complete this step to continue.';
  })();

  useEffect(() => {
    if (!selectedSavedAddressId) {
      setIsAddressSelectorOpen(true);
    }
  }, [selectedSavedAddressId]);

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
          address_line_1: addressLine1,
          address_line_2: addressLine2 || null,
          city,
          state,
          pincode,
          country,
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
      setIsAddressSelectorOpen(false);

      closeAddAddressModal();
      resetNewAddressForm();
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Unable to save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
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
      setIsAddressSelectorOpen(false);
      setLocationError(null);
      return;
    }

    onLatitudeChange('');
    onLongitudeChange('');
    openEditAddressModal(address);
    setLocationError('This saved address has no map pin yet. Use current location or drop a pin on the map.');
  }

  function formatTimeLabel(value: string) {
    const parts = value.split(':');
    if (parts.length < 2) {
      return value;
    }

    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return value;
    }

    const normalized = new Date();
    normalized.setHours(hours, minutes, 0, 0);
    return normalized.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function roundToNearestFiveMinutes(value: string) {
    const parts = value.split(':');
    if (parts.length < 2) {
      return value;
    }

    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return value;
    }

    const normalized = new Date();
    normalized.setHours(hours, minutes, 0, 0);

    const roundedMinutes = Math.round(normalized.getMinutes() / 5) * 5;
    normalized.setMinutes(roundedMinutes, 0, 0);

    const nextHours = String(normalized.getHours()).padStart(2, '0');
    const nextMinutes = String(normalized.getMinutes()).padStart(2, '0');
    return `${nextHours}:${nextMinutes}`;
  }

  function formatSlotLabel(start: string, end: string) {
    return `${formatTimeLabel(start)} - ${formatTimeLabel(roundToNearestFiveMinutes(end))}`;
  }

  return (
    <div className="premium-fade-up space-y-2.5 sm:space-y-7 rounded-2xl sm:rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-2.5 max-[380px]:p-2 sm:p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
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

      {/* Address for home visit — hidden for package bookings (birthday/boarding) */}
      {bookingMode === 'home_visit' && !isPackageBooking && (
        <div>
          <div className="mb-2.5 rounded-xl border border-[#ebdccf] bg-white p-2.5 sm:mb-3 sm:p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8a6445]">Pincode checker</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pincodeCheckerValue}
                  onChange={(event) => onPincodeCheckerValueChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit pincode"
                  className="w-full rounded-lg border border-[#dcbfa8] bg-white px-2.5 py-1.5 text-xs focus:border-coral focus:outline-none sm:py-2 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={onPincodeCheck}
                disabled={isCheckingPincodeCoverage}
                className="rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
              >
                {isCheckingPincodeCoverage ? 'Checking...' : 'Check availability'}
              </button>
            </div>

            {pincodeCoverageError ? (
              <p className="mt-2.5 text-xs font-medium text-amber-700 sm:text-sm">{pincodeCoverageError}</p>
            ) : null}

            {hasCheckedPincodeCoverage && pincodeCoverageServiceCount === 0 && !pincodeCoverageError ? (
              <p className="mt-2.5 text-xs font-medium text-rose-700 sm:text-sm">
                Services are not available on your pincode. We are working to bring services to your area.
              </p>
            ) : null}

            {hasCheckedPincodeCoverage && pincodeCoverageServiceCount > 0 && !pincodeCoverageError ? (
              <p className="mt-2 text-xs font-medium text-emerald-700 sm:text-sm">
                Good news. Services are available for this pincode.
              </p>
            ) : null}
          </div>

          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-neutral-700">Service Address</label>
          {addressError && (
            <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 sm:text-sm">{addressError}</p>
          )}
          {locationAddress ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 sm:px-2.5 sm:py-2">
              <p
                className="text-[11px] font-medium leading-relaxed text-neutral-900 line-clamp-2 sm:text-xs"
                title={selectedSavedAddress ? formatSavedAddress(selectedSavedAddress) : locationAddress}
              >
                {selectedSavedAddress ? formatSavedAddress(selectedSavedAddress) : locationAddress}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddressSelectorOpen((prev) => !prev)}
                  className="text-[10px] font-semibold text-coral hover:underline sm:text-[11px]"
                >
                  {isAddressSelectorOpen ? 'Hide addresses' : 'Change address'}
                </button>
              </div>
            </div>
          ) : null}

          {(isAddressSelectorOpen || !selectedSavedAddressId) ? (
            <div className="mb-2.5 mt-2.5 space-y-1.5">
              <p className="text-[11px] font-medium text-neutral-700">Saved addresses</p>
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
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
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
                            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-700 transition hover:border-coral"
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
                  className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-700 hover:border-coral sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  + Add New Address
                </button>
                {selectedSavedAddressId ? (
                  <button
                    type="button"
                    onClick={() => setIsAddressSelectorOpen(false)}
                    className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-700 hover:border-coral sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!selectedSavedAddressId ? (
            <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 sm:text-sm">
              Select a saved address inside our serviceable area to unlock date selection.
            </p>
          ) : null}

          {selectedSavedAddressId && !selectedAddressPincode ? (
            <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 sm:text-sm">
              Selected address is missing a valid pincode. Edit the address and add a correct 6-digit pincode.
            </p>
          ) : null}

          {selectedSavedAddressId && selectedAddressPincode ? (
            <div className="mt-3">
              {isCheckingSelectedAddressCoverage ? (
                <p className="text-xs font-medium text-[#8a6445] sm:text-sm">Checking serviceability for selected address pincode...</p>
              ) : null}
              {selectedAddressCoverageError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 sm:text-sm">
                  {selectedAddressCoverageError}
                </p>
              ) : null}
              {hasCheckedSelectedAddressCoverage && !isSelectedAddressServiceable && !selectedAddressCoverageError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 sm:text-sm">
                  Services are not available on your pincode. We are working to bring services to your area.
                </p>
              ) : null}
              {hasCheckedSelectedAddressCoverage && isSelectedAddressServiceable && !selectedAddressCoverageError ? (
                <p className="text-xs font-medium text-emerald-700 sm:text-sm">
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
            <p className="text-xs font-medium text-neutral-600">Choose the time that works best for you.</p>
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
                    <span className="block font-semibold">{formatSlotLabel(slot.startTime, slot.endTime)}</span>
                    <span className="text-[10px] text-neutral-500">Available</span>
                    {slot.recommended ? <span className="text-[10px] font-semibold text-coral">Recommended</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional notes — hidden for package bookings */}
      {!isPackageBooking && (
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">Service Notes (Optional)</label>
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
      <div className="hidden pt-4 sm:flex sm:flex-row sm:justify-between sm:gap-3">
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
          Continue to Review
        </button>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#edd9c7] bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden">
        {!canProceed && continueDisabledReason ? (
          <p className="mb-2 text-xs font-medium text-[#8f4a1d]">{continueDisabledReason}</p>
        ) : null}
        <div className="grid grid-cols-[auto,1fr] gap-2">
          <button
            onClick={onPrev}
            className="rounded-full border border-[#e3c7ae] bg-white px-4 py-2 text-sm font-semibold text-[#7c5335]"
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
            className="rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Review
          </button>
        </div>
      </div>
      <div className="h-20 sm:hidden" aria-hidden="true" />
    </div>
  );
}
