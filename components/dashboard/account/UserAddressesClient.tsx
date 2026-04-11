'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { apiRequest } from '@/lib/api/client';
import { useToast } from '@/components/ui/ToastProvider';
import { usePincodeLookup } from '@/lib/hooks/usePincodeLookup';
import { isValidIndianPincode } from '@/lib/utils/india-pincode';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

const LocationPinMap = dynamic(() => import('@/components/forms/LocationPinMap'), { ssr: false });

type UserAddress = {
  id: string;
  label: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
};

type NewAddressDraft = {
  label: 'Home' | 'Office' | 'Other';
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: string;
  longitude: string;
  phone: string;
};

const DEFAULT_ADDRESS: NewAddressDraft = {
  label: 'Home',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  latitude: '',
  longitude: '',
  phone: '',
};

export default function UserAddressesClient() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [draft, setDraft] = useState<NewAddressDraft>(DEFAULT_ADDRESS);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [currentLatitude, setCurrentLatitude] = useState('');
  const [currentLongitude, setCurrentLongitude] = useState('');
  const { showToast } = useToast();
  const pincodeLookup = usePincodeLookup(draft.pincode);

  useEffect(() => {
    if (pincodeLookup.isAutoFilled && pincodeLookup.city && pincodeLookup.state) {
      setDraft((current) => ({
        ...current,
        city: pincodeLookup.city!,
        state: pincodeLookup.state!,
        country: pincodeLookup.country || 'India',
      }));
    }
  }, [pincodeLookup.city, pincodeLookup.state, pincodeLookup.country, pincodeLookup.isAutoFilled]);

  const loadAddresses = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await apiRequest<{ addresses: UserAddress[] }>('/api/user/owner-profile/addresses');
      setAddresses(payload.addresses ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load addresses.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  function saveAddress() {
    if (!draft.address_line_1.trim() || !draft.city.trim() || !draft.state.trim() || !draft.pincode.trim()) {
      showToast('Address line 1, city, state and pincode are required.', 'error');
      return;
    }

    if (!isValidIndianPincode(draft.pincode.trim())) {
      showToast('Enter a valid 6-digit Indian pincode.', 'error');
      return;
    }

    const normalizedPhone = toIndianE164(draft.phone);
    if (!isValidIndianE164(normalizedPhone)) {
      showToast('Enter a valid 10-digit Indian phone number.', 'error');
      return;
    }

    const lat = draft.latitude.trim() ? Number(draft.latitude) : null;
    const lng = draft.longitude.trim() ? Number(draft.longitude) : null;

    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
      showToast('Invalid location coordinates. Please use the location button.', 'error');
      return;
    }

    if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) {
      showToast('Location coordinates are out of range. Please pin location again.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          editingAddressId
            ? `/api/user/owner-profile/addresses/${encodeURIComponent(editingAddressId)}`
            : '/api/user/owner-profile/addresses',
          {
          method: editingAddressId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            label: draft.label,
            address_line_1: draft.address_line_1.trim(),
            address_line_2: draft.address_line_2.trim() || null,
            city: draft.city.trim(),
            state: draft.state.trim(),
            pincode: draft.pincode.trim(),
            country: draft.country.trim() || 'India',
            phone: normalizedPhone,
            ...(!editingAddressId ? { is_default: addresses.length === 0 } : {}),
            ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
          }),
        },
        );

        setDraft(DEFAULT_ADDRESS);
        setEditingAddressId(null);
        await loadAddresses();
        showToast(editingAddressId ? 'Address updated.' : 'Address added.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to save address.', 'error');
      }
    });
  }

  function startEditAddress(address: UserAddress) {
    setEditingAddressId(address.id);
    setDraft({
      label: address.label ?? 'Other',
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || 'India',
      latitude: address.latitude !== null ? String(address.latitude) : '',
      longitude: address.longitude !== null ? String(address.longitude) : '',
      phone: extractIndianPhoneDigits(address.phone ?? ''),
    });
  }

  function cancelEditAddress() {
    setEditingAddressId(null);
    setDraft(DEFAULT_ADDRESS);
  }

  async function detectCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not supported on this device/browser.', 'error');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      showToast('Location requires HTTPS (or localhost). Please open this page in a secure context.', 'error');
      return;
    }

    try {
      if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          showToast(
            'Location access is blocked in your browser. Allow location for this site in browser settings, then try again.',
            'error',
          );
          return;
        }
      }
    } catch {
      // Ignore permissions API failures and continue to geolocation request.
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = String(position.coords.latitude);
        const lng = String(position.coords.longitude);
        setDraft((current) => ({
          ...current,
          latitude: lat,
          longitude: lng,
        }));
        setCurrentLatitude(lat);
        setCurrentLongitude(lng);
        setIsDetectingLocation(false);
        showToast('Location detected successfully.', 'success');
      },
      (error) => {
        setIsDetectingLocation(false);
        const msg =
          error.code === error.PERMISSION_DENIED
            ? 'Location access denied. Please allow location permission and try again.'
            : error.code === error.TIMEOUT
              ? 'Location detection timed out. Please try again.'
              : error.code === error.POSITION_UNAVAILABLE
                ? 'Location service temporarily unavailable.'
                : 'Unable to detect location. Please try again.';
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function removeAddress(addressId: string) {
    startTransition(async () => {
      try {
        await apiRequest(`/api/user/owner-profile/addresses/${encodeURIComponent(addressId)}`, {
          method: 'DELETE',
        });
        await loadAddresses();
        showToast('Address removed.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to remove address.', 'error');
      }
    });
  }

  function makeDefault(addressId: string) {
    startTransition(async () => {
      try {
        await apiRequest(`/api/user/owner-profile/addresses/${encodeURIComponent(addressId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_default: true }),
        });
        await loadAddresses();
        showToast('Default address updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update default address.', 'error');
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h1 className="text-xl font-semibold text-ink">Manage Addresses</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">Keep service locations updated for faster booking checkout.</p>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-base font-semibold text-ink">Add New Address</h2>
        {editingAddressId ? <p className="mt-1 text-xs font-medium text-[#9a6a44]">Editing selected address</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={draft.label}
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value as NewAddressDraft['label'] }))}
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
          >
            <option value="Home">Home</option>
            <option value="Office">Office</option>
            <option value="Other">Other</option>
          </select>
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="House / Flat / Building and Street"
            value={draft.address_line_1}
            onChange={(event) => setDraft((current) => ({ ...current, address_line_1: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Area / Locality (optional)"
            value={draft.address_line_2}
            onChange={(event) => setDraft((current) => ({ ...current, address_line_2: event.target.value }))}
          />
          <div>
            <input
              className="w-full rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
              placeholder="Pincode"
              value={draft.pincode}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  pincode: event.target.value.replace(/\D/g, '').slice(0, 6),
                }))
              }
              maxLength={6}
              inputMode="numeric"
            />
            {draft.pincode.length > 0 && !isValidIndianPincode(draft.pincode) && !pincodeLookup.isLoading && (
              <p className="mt-1 text-xs text-[#b5483e]">Enter a valid 6-digit pincode.</p>
            )}
            {pincodeLookup.isLoading && (
              <p className="mt-1 text-xs text-[#9a6a44]">Looking up pincode...</p>
            )}
          </div>
          <div>
            <input
              className="w-full rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
              placeholder={pincodeLookup.isLoading ? 'Detecting city...' : 'City'}
              value={draft.city}
              onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
            />
            {pincodeLookup.isAutoFilled && draft.city && (
              <p className="mt-1 text-xs text-green-600">Auto-detected from pincode</p>
            )}
          </div>
          <div>
            <input
              className="w-full rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
              placeholder={pincodeLookup.isLoading ? 'Detecting state...' : 'State'}
              value={draft.state}
              onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))}
            />
            {pincodeLookup.isAutoFilled && draft.state && (
              <p className="mt-1 text-xs text-green-600">Auto-detected from pincode</p>
            )}
          </div>
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm sm:col-span-2"
            placeholder="Country"
            value={draft.country}
            onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}
          />
          <div className="sm:col-span-2">
            <div className="flex overflow-hidden rounded-xl border border-[#e8ccb3] focus-within:border-[#d89a68]">
              <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
              <input
                className="w-full px-4 py-2.5 text-sm outline-none"
                placeholder="Phone number"
                inputMode="numeric"
                maxLength={10}
                value={draft.phone}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, phone: extractIndianPhoneDigits(event.target.value) }))
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isDetectingLocation}
            onClick={detectCurrentLocation}
            className="flex items-center gap-1.5 rounded-full border border-[#e8ccb3] bg-white px-4 py-2 text-xs font-semibold text-[#9a6a44] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
            </svg>
            {isDetectingLocation ? 'Detecting...' : 'Use Current Location'}
          </button>

          {draft.latitude && draft.longitude ? (
            <span className="text-xs text-green-700">
              Location captured ({Number(draft.latitude).toFixed(4)}, {Number(draft.longitude).toFixed(4)})
            </span>
          ) : (
            <span className="text-xs text-[#9a6a44]">Location helps ensure accurate service delivery</span>
          )}
        </div>

        <div className="mt-4">
          <LocationPinMap
            latitude={draft.latitude}
            longitude={draft.longitude}
            currentLatitude={currentLatitude}
            currentLongitude={currentLongitude}
            onChange={(nextLat, nextLng) => {
              setDraft((current) => ({
                ...current,
                latitude: String(nextLat),
                longitude: String(nextLng),
              }));
            }}
          />
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={saveAddress}
          className="mt-4 rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-5 py-2.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Saving...' : editingAddressId ? 'Update Address' : 'Add Address'}
        </button>
        {editingAddressId ? (
          <button
            type="button"
            onClick={cancelEditAddress}
            className="ml-2 mt-4 rounded-full border border-[#e8ccb3] bg-white px-5 py-2.5 text-xs font-semibold text-ink"
          >
            Cancel
          </button>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-base font-semibold text-ink">Saved Addresses</h2>

        {isLoading ? <p className="mt-3 text-sm text-[#6b6b6b]">Loading addresses...</p> : null}

        {!isLoading && addresses.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b6b6b]">No addresses added yet.</p>
        ) : null}

        <div className="mt-4 grid gap-3">
          {addresses.map((address) => (
            <article key={address.id} className="rounded-2xl border border-[#e8ccb3] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {address.label ?? 'Address'} {address.is_default ? '• Default' : ''}
                </p>
                <div className="flex items-center gap-2">
                  {!address.is_default ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => makeDefault(address.id)}
                      className="rounded-full border border-[#e8ccb3] px-3 py-1 text-xs font-semibold text-ink"
                    >
                      Make default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startEditAddress(address)}
                    className="rounded-full border border-[#e8ccb3] px-3 py-1 text-xs font-semibold text-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => removeAddress(address.id)}
                    className="rounded-full border border-[#efc6c6] px-3 py-1 text-xs font-semibold text-[#8e3030]"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-[#5f5f5f]">
                {address.address_line_1}
                {address.address_line_2 ? `, ${address.address_line_2}` : ''}, {address.city}, {address.state} - {address.pincode}, {address.country}
              </p>
              {address.phone ? <p className="mt-1 text-xs text-[#5f5f5f]">Phone: {address.phone}</p> : null}
              {address.latitude && address.longitude ? (
                <p className="mt-1 text-xs text-green-700">Location saved</p>
              ) : (
                <p className="mt-1 text-xs text-[#c58d50]">No location captured</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
