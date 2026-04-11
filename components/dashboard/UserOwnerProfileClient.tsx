'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ui/ToastProvider';
import Button from '@/components/ui/Button';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';
import { isValidIndianPincode } from '@/lib/utils/india-pincode';
import { usePincodeLookup } from '@/lib/hooks/usePincodeLookup';
import type {
  AccountStatus,
  AddressLabel,
  CommunicationPreference,
  OwnerProfile,
  UserAddress,
  UserEmergencyContact,
  UserPreferences,
} from '@/lib/owner-profile/types';

const LocationPinMap = dynamic(() => import('@/components/forms/LocationPinMap'), { ssr: false });

type Props = {
  userId: string;
  initialProfile: OwnerProfile;
  initialAddresses: UserAddress[];
  initialContacts: UserEmergencyContact[];
  initialPreferences: UserPreferences | null;
};

function normalizeAddressLabel(label: string): AddressLabel | null {
  if (label === 'Home' || label === 'Office' || label === 'Other') {
    return label;
  }

  return null;
}

function normalizeCommunicationPreference(value: string): CommunicationPreference | null {
  if (value === 'call' || value === 'whatsapp' || value === 'app') {
    return value;
  }

  return null;
}

function trustLabel(accountStatus: AccountStatus, riskScore: number, isSuspended: boolean) {
  if (isSuspended || accountStatus === 'banned') {
    return 'Restricted';
  }

  if (accountStatus === 'flagged' || riskScore >= 60) {
    return 'Needs Review';
  }

  if (riskScore >= 30) {
    return 'Moderate';
  }

  return 'Trusted';
}

export default function UserOwnerProfileClient({
  userId,
  initialProfile,
  initialAddresses,
  initialContacts,
  initialPreferences,
}: Props) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDetectingAddressLocation, setIsDetectingAddressLocation] = useState(false);
  const [currentAddressLatitude, setCurrentAddressLatitude] = useState('');
  const [currentAddressLongitude, setCurrentAddressLongitude] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [profile, setProfile] = useState<OwnerProfile>(initialProfile);
  const [addresses, setAddresses] = useState<UserAddress[]>(initialAddresses);
  const [contacts, setContacts] = useState<UserEmergencyContact[]>(initialContacts);
  const [preferences, setPreferences] = useState<UserPreferences | null>(initialPreferences);

  const [basicForm, setBasicForm] = useState({
    full_name: initialProfile.full_name,
    phone_number: extractIndianPhoneDigits(initialProfile.phone_number),
    date_of_birth: initialProfile.date_of_birth ?? '',
    gender: initialProfile.gender ?? '',
  });

  const [householdForm, setHouseholdForm] = useState({
    total_pets: initialProfile.total_pets,
    first_pet_owner: initialProfile.first_pet_owner,
    years_of_pet_experience: initialProfile.years_of_pet_experience ?? '',
    lives_in: initialProfile.lives_in ?? '',
    has_other_pets: initialProfile.has_other_pets,
    number_of_people_in_house: initialProfile.number_of_people_in_house ?? '',
    has_children: initialProfile.has_children,
  });

  const [reputationForm] = useState({
    cancellation_rate: initialProfile.cancellation_rate,
    late_cancellation_count: initialProfile.late_cancellation_count,
    no_show_count: initialProfile.no_show_count,
    average_rating: initialProfile.average_rating,
    total_bookings: initialProfile.total_bookings,
    flagged_count: initialProfile.flagged_count,
    is_suspended: initialProfile.is_suspended,
    account_status: initialProfile.account_status,
    risk_score: initialProfile.risk_score,
  });

  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    phone: '',
    latitude: '',
    longitude: '',
    is_default: false,
  });

  const addressPincodeLookup = usePincodeLookup(newAddress.pincode);

  useEffect(() => {
    if (addressPincodeLookup.isAutoFilled && addressPincodeLookup.city && addressPincodeLookup.state) {
      setNewAddress((current) => ({
        ...current,
        city: addressPincodeLookup.city!,
        state: addressPincodeLookup.state!,
        country: addressPincodeLookup.country || 'India',
      }));
    }
  }, [addressPincodeLookup.city, addressPincodeLookup.state, addressPincodeLookup.country, addressPincodeLookup.isAutoFilled]);

  const [newContact, setNewContact] = useState({
    contact_name: '',
    relationship: '',
    phone_number: '',
    is_primary: false,
  });

  const [preferencesForm, setPreferencesForm] = useState({
    preferred_service_time: initialPreferences?.preferred_service_time ?? '',
    preferred_groomer_gender: initialPreferences?.preferred_groomer_gender ?? '',
    communication_preference: initialPreferences?.communication_preference ?? '',
    special_instructions: initialPreferences?.special_instructions ?? '',
  });

  const trustIndicator = useMemo(
    () => trustLabel(profile.account_status, profile.risk_score, profile.is_suspended),
    [profile.account_status, profile.is_suspended, profile.risk_score],
  );

  async function ownerApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Request failed');
    }

    return payload as T;
  }

  async function fetchAddresses() {
    const response = await ownerApiRequest<{ addresses: UserAddress[] }>('/api/user/owner-profile/addresses');
    return response.addresses;
  }

  async function fetchContacts() {
    const response = await ownerApiRequest<{ contacts: UserEmergencyContact[] }>(
      '/api/user/owner-profile/emergency-contacts',
    );
    return response.contacts;
  }

  function saveBasicInfo() {
    const payload = {
      full_name: basicForm.full_name.trim(),
      phone_number: toIndianE164(basicForm.phone_number),
      date_of_birth: basicForm.date_of_birth || null,
      gender: basicForm.gender.trim() || null,
    };

    if (payload.full_name.length < 2) {
      showToast('Full name must be at least 2 characters.', 'error');
      return;
    }

    if (!isValidIndianE164(payload.phone_number)) {
      showToast('Enter a valid 10-digit Indian phone number.', 'error');
      return;
    }

    const previous = profile;
    setProfile((current) => ({ ...current, ...payload }));

    startTransition(async () => {
      try {
        const response = await ownerApiRequest<{ success: true; profile: OwnerProfile }>('/api/user/owner-profile', {
          method: 'PATCH',
          body: JSON.stringify({ basic: payload }),
        });
        setProfile(response.profile);
        showToast('Basic information updated.', 'success');
      } catch (error) {
        setProfile(previous);
        showToast(error instanceof Error ? error.message : 'Failed to update basic information.', 'error');
      }
    });
  }

  function saveHouseholdInfo() {
    const totalPets = Number(householdForm.total_pets);
    const years = householdForm.years_of_pet_experience === '' ? null : Number(householdForm.years_of_pet_experience);
    const people =
      householdForm.number_of_people_in_house === '' ? null : Number(householdForm.number_of_people_in_house);

    if (!Number.isInteger(totalPets) || totalPets < 0) {
      showToast('Total pets must be a valid number greater than or equal to 0.', 'error');
      return;
    }

    if (years !== null && (!Number.isInteger(years) || years < 0)) {
      showToast('Years of pet experience must be a valid number greater than or equal to 0.', 'error');
      return;
    }

    if (people !== null && (!Number.isInteger(people) || people < 1)) {
      showToast('People in house must be at least 1.', 'error');
      return;
    }

    const payload = {
      total_pets: totalPets,
      first_pet_owner: householdForm.first_pet_owner,
      years_of_pet_experience: years,
      lives_in: householdForm.lives_in.trim() || null,
      has_other_pets: householdForm.has_other_pets,
      number_of_people_in_house: people,
      has_children: householdForm.has_children,
    };

    const previous = profile;
    setProfile((current) => ({ ...current, ...payload }));

    startTransition(async () => {
      try {
        const response = await ownerApiRequest<{ success: true; profile: OwnerProfile }>('/api/user/owner-profile', {
          method: 'PATCH',
          body: JSON.stringify({ household: payload }),
        });
        setProfile(response.profile);
        showToast('Household information updated.', 'success');
      } catch (error) {
        setProfile(previous);
        showToast(error instanceof Error ? error.message : 'Failed to update household information.', 'error');
      }
    });
  }

  function resetAddressForm() {
    setNewAddress({
      label: 'Home',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      phone: '',
      latitude: '',
      longitude: '',
      is_default: false,
    });
    setCurrentAddressLatitude('');
    setCurrentAddressLongitude('');
    setEditingAddressId(null);
  }

  function startEditAddress(address: UserAddress) {
    setEditingAddressId(address.id);
    setNewAddress({
      label: (address.label ?? 'Other') as 'Home' | 'Office' | 'Other',
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || 'India',
      phone: extractIndianPhoneDigits(address.phone ?? ''),
      latitude: address.latitude !== null ? String(address.latitude) : '',
      longitude: address.longitude !== null ? String(address.longitude) : '',
      is_default: address.is_default,
    });
    setCurrentAddressLatitude(address.latitude !== null ? String(address.latitude) : '');
    setCurrentAddressLongitude(address.longitude !== null ? String(address.longitude) : '');
  }

  function saveAddress() {
    if (!newAddress.address_line_1.trim() || !newAddress.city.trim() || !newAddress.state.trim() || !newAddress.pincode.trim()) {
      showToast('Address line 1, city, state and pincode are required.', 'error');
      return;
    }

    if (!isValidIndianPincode(newAddress.pincode.trim())) {
      showToast('Enter a valid 6-digit Indian pincode.', 'error');
      return;
    }

    const normalizedAddressPhone = toIndianE164(newAddress.phone);
    if (!isValidIndianE164(normalizedAddressPhone)) {
      showToast('Enter a valid 10-digit Indian phone number for this address.', 'error');
      return;
    }

    const latitudeValue = newAddress.latitude ? Number(newAddress.latitude) : null;
    const longitudeValue = newAddress.longitude ? Number(newAddress.longitude) : null;

    if ((latitudeValue !== null && !Number.isFinite(latitudeValue)) || (longitudeValue !== null && !Number.isFinite(longitudeValue))) {
      showToast('Location coordinates are invalid. Please pin location again.', 'error');
      return;
    }

    if ((latitudeValue !== null && (latitudeValue < -90 || latitudeValue > 90)) || (longitudeValue !== null && (longitudeValue < -180 || longitudeValue > 180))) {
      showToast('Location coordinates are out of range. Please pin location again.', 'error');
      return;
    }

    const previous = addresses;
    if (editingAddressId) {
      setAddresses((current) =>
        current.map((item) =>
          item.id === editingAddressId
            ? {
                ...item,
                label: normalizeAddressLabel(newAddress.label),
                address_line_1: newAddress.address_line_1.trim(),
                address_line_2: newAddress.address_line_2.trim() || null,
                city: newAddress.city.trim(),
                state: newAddress.state.trim(),
                pincode: newAddress.pincode.trim(),
                country: newAddress.country.trim() || 'India',
                phone: normalizedAddressPhone,
                latitude: latitudeValue,
                longitude: longitudeValue,
                is_default: newAddress.is_default,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
    } else {
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticAddress: UserAddress = {
        id: optimisticId,
        user_id: userId,
        label: normalizeAddressLabel(newAddress.label),
        address_line_1: newAddress.address_line_1.trim(),
        address_line_2: newAddress.address_line_2.trim() || null,
        city: newAddress.city.trim(),
        state: newAddress.state.trim(),
        pincode: newAddress.pincode.trim(),
        country: newAddress.country.trim() || 'India',
        phone: normalizedAddressPhone,
        latitude: latitudeValue,
        longitude: longitudeValue,
        is_default: newAddress.is_default,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setAddresses((current) => [optimisticAddress, ...current]);
    }

    startTransition(async () => {
      try {
        await ownerApiRequest<{ success: true; address: UserAddress }>(
          editingAddressId
            ? `/api/user/owner-profile/addresses/${encodeURIComponent(editingAddressId)}`
            : '/api/user/owner-profile/addresses',
          {
          method: editingAddressId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            label: normalizeAddressLabel(newAddress.label),
            address_line_1: newAddress.address_line_1.trim(),
            address_line_2: newAddress.address_line_2.trim() || null,
            city: newAddress.city.trim(),
            state: newAddress.state.trim(),
            pincode: newAddress.pincode.trim(),
            country: newAddress.country.trim() || 'India',
            phone: normalizedAddressPhone,
            latitude: latitudeValue,
            longitude: longitudeValue,
            ...(editingAddressId ? {} : { is_default: newAddress.is_default }),
          }),
        },
        );

        const refreshed = await fetchAddresses();
        setAddresses(refreshed);
        resetAddressForm();
        showToast(editingAddressId ? 'Address updated.' : 'Address added.', 'success');
      } catch (error) {
        setAddresses(previous);
        showToast(error instanceof Error ? error.message : 'Failed to save address.', 'error');
      }
    });
  }

  async function detectAddressCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not supported on this device/browser.', 'error');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      showToast('Location requires HTTPS (or localhost). Please open this page in a secure context.', 'error');
      return;
    }

    setIsDetectingAddressLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = String(position.coords.latitude);
        const longitude = String(position.coords.longitude);

        setCurrentAddressLatitude(latitude);
        setCurrentAddressLongitude(longitude);
        setNewAddress((current) => ({
          ...current,
          latitude,
          longitude,
        }));
        setIsDetectingAddressLocation(false);
        showToast('Location detected successfully.', 'success');
      },
      (error) => {
        setIsDetectingAddressLocation(false);
        const msg =
          error.code === error.PERMISSION_DENIED
            ? 'Location access denied. Please allow location permission and try again.'
            : 'Unable to detect location. Please try again.';
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function removeAddress(addressId: string) {
    const previous = addresses;
    setAddresses((current) => current.filter((item) => item.id !== addressId));

    startTransition(async () => {
      try {
        await ownerApiRequest<{ success: true }>(`/api/user/owner-profile/addresses/${encodeURIComponent(addressId)}`, {
          method: 'DELETE',
        });
        const refreshed = await fetchAddresses();
        setAddresses(refreshed);
        showToast('Address removed.', 'success');
      } catch (error) {
        setAddresses(previous);
        showToast(error instanceof Error ? error.message : 'Failed to remove address.', 'error');
      }
    });
  }

  function makeDefaultAddress(address: UserAddress) {
    const previous = addresses;
    setAddresses((current) =>
      current.map((item) => ({
        ...item,
        is_default: item.id === address.id,
      })),
    );

    startTransition(async () => {
      try {
        await ownerApiRequest<{ success: true; address: UserAddress }>(
          `/api/user/owner-profile/addresses/${encodeURIComponent(address.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ is_default: true }),
          },
        );
        const refreshed = await fetchAddresses();
        setAddresses(refreshed);
        showToast('Default address updated.', 'success');
      } catch (error) {
        setAddresses(previous);
        showToast(error instanceof Error ? error.message : 'Failed to update default address.', 'error');
      }
    });
  }

  function addNewContact() {
    const payload = {
      contact_name: newContact.contact_name.trim(),
      relationship: newContact.relationship.trim() || null,
      phone_number: toIndianE164(newContact.phone_number),
      is_primary: newContact.is_primary,
    };

    if (payload.contact_name.length < 2) {
      showToast('Contact name must be at least 2 characters.', 'error');
      return;
    }

    if (!isValidIndianE164(payload.phone_number)) {
      showToast('Emergency contact phone must be a valid 10-digit Indian number.', 'error');
      return;
    }

    const previous = contacts;
    const optimisticId = `optimistic-${Date.now()}`;

    setContacts((current) => [
      {
        id: optimisticId,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload,
      },
      ...current,
    ]);

    startTransition(async () => {
      try {
        const response = await ownerApiRequest<{ success: true; contact: UserEmergencyContact }>(
          '/api/user/owner-profile/emergency-contacts',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );
        setContacts((current) => current.map((item) => (item.id === optimisticId ? response.contact : item)));
        setNewContact({
          contact_name: '',
          relationship: '',
          phone_number: '',
          is_primary: false,
        });
        showToast('Emergency contact added.', 'success');
      } catch (error) {
        setContacts(previous);
        showToast(error instanceof Error ? error.message : 'Failed to add emergency contact.', 'error');
      }
    });
  }

  function removeContact(contactId: string) {
    const previous = contacts;
    setContacts((current) => current.filter((item) => item.id !== contactId));

    startTransition(async () => {
      try {
        await ownerApiRequest<{ success: true }>(
          `/api/user/owner-profile/emergency-contacts/${encodeURIComponent(contactId)}`,
          { method: 'DELETE' },
        );
        const refreshed = await fetchContacts();
        setContacts(refreshed);
        showToast('Emergency contact removed.', 'success');
      } catch (error) {
        setContacts(previous);
        showToast(error instanceof Error ? error.message : 'Failed to remove emergency contact.', 'error');
      }
    });
  }

  function makePrimaryContact(contact: UserEmergencyContact) {
    const previous = contacts;
    setContacts((current) => current.map((item) => ({ ...item, is_primary: item.id === contact.id })));

    startTransition(async () => {
      try {
        await ownerApiRequest<{ success: true; contact: UserEmergencyContact }>(
          `/api/user/owner-profile/emergency-contacts/${encodeURIComponent(contact.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ is_primary: true }),
          },
        );
        const refreshed = await fetchContacts();
        setContacts(refreshed);
        showToast('Primary emergency contact updated.', 'success');
      } catch (error) {
        setContacts(previous);
        showToast(error instanceof Error ? error.message : 'Failed to update primary emergency contact.', 'error');
      }
    });
  }

  function savePreferences() {
    const payload = {
      preferred_service_time: preferencesForm.preferred_service_time.trim() || null,
      preferred_groomer_gender: preferencesForm.preferred_groomer_gender.trim() || null,
      communication_preference: normalizeCommunicationPreference(preferencesForm.communication_preference),
      special_instructions: preferencesForm.special_instructions.trim() || null,
    };

    const previous = preferences;
    setPreferences((current) =>
      current
        ? { ...current, ...payload }
        : {
            id: `optimistic-${Date.now()}`,
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          },
    );

    startTransition(async () => {
      try {
        const response = await ownerApiRequest<{ success: true; preferences: UserPreferences }>(
          '/api/user/owner-profile/preferences',
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );
        setPreferences(response.preferences);
        showToast('Preferences updated.', 'success');
      } catch (error) {
        setPreferences(previous);
        showToast(error instanceof Error ? error.message : 'Failed to update preferences.', 'error');
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h1 className="text-xl font-semibold text-ink">Pet Owner Profile</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">Complete trust profile for booking confidence and safer pet care.</p>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">1. Basic Information</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Full name"
            value={basicForm.full_name}
            onChange={(event) => setBasicForm((current) => ({ ...current, full_name: event.target.value }))}
          />
          <div className="flex overflow-hidden rounded-xl border border-[#e8ccb3] focus-within:border-[#d89a68]">
            <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
            <input
              className="w-full px-4 py-2.5 text-sm outline-none"
              placeholder="9876543210"
              inputMode="numeric"
              maxLength={10}
              value={basicForm.phone_number}
              onChange={(event) =>
                setBasicForm((current) => ({ ...current, phone_number: extractIndianPhoneDigits(event.target.value) }))
              }
            />
          </div>
          <input
            type="date"
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            value={basicForm.date_of_birth}
            onChange={(event) => setBasicForm((current) => ({ ...current, date_of_birth: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Gender"
            value={basicForm.gender}
            onChange={(event) => setBasicForm((current) => ({ ...current, gender: event.target.value }))}
          />
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={saveBasicInfo} className="mt-4">
          Save Basic Information
        </Button>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">2. Verification Status</h2>
        <p className="mt-1 text-sm text-neutral-500">Your verification is managed by our Trust & Safety team.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[#e8ccb3] px-3 py-1">
            Phone: {profile.is_phone_verified ? '✅ Verified' : '⚪ Pending'}
          </span>
          <span className="rounded-full border border-[#e8ccb3] px-3 py-1">
            Email: {profile.is_email_verified ? '✅ Verified' : '⚪ Pending'}
          </span>
          <span className="rounded-full border border-[#e8ccb3] px-3 py-1">KYC: {profile.kyc_status.replace('_', ' ')}</span>
        </div>
        {profile.kyc_status === 'not_submitted' && (
          <p className="mt-3 text-sm text-amber-700">
            Complete KYC to unlock full features. Contact support for assistance.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">3. Addresses</h2>
        {editingAddressId ? (
          <p className="mt-1 text-xs font-medium text-[#9a6a44]">Editing selected address. Existing values are pre-filled.</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={newAddress.label}
            onChange={(event) => setNewAddress((current) => ({ ...current, label: event.target.value }))}
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
          >
            <option value="Home">Home</option>
            <option value="Office">Office</option>
            <option value="Other">Other</option>
          </select>
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="House / Flat / Building and Street"
            value={newAddress.address_line_1}
            onChange={(event) => setNewAddress((current) => ({ ...current, address_line_1: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Area / Locality (optional)"
            value={newAddress.address_line_2}
            onChange={(event) => setNewAddress((current) => ({ ...current, address_line_2: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder={addressPincodeLookup.isLoading ? 'Detecting city...' : 'City'}
            value={newAddress.city}
            onChange={(event) => setNewAddress((current) => ({ ...current, city: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder={addressPincodeLookup.isLoading ? 'Detecting state...' : 'State'}
            value={newAddress.state}
            onChange={(event) => setNewAddress((current) => ({ ...current, state: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Pincode"
            value={newAddress.pincode}
            onChange={(event) =>
              setNewAddress((current) => ({
                ...current,
                pincode: event.target.value.replace(/\D/g, '').slice(0, 6),
              }))
            }
            maxLength={6}
            inputMode="numeric"
          />
          {newAddress.pincode.length > 0 && !isValidIndianPincode(newAddress.pincode) ? (
            <p className="text-xs text-[#b5483e]">Enter a valid 6-digit pincode.</p>
          ) : null}
          {addressPincodeLookup.isLoading ? <p className="text-xs text-[#9a6a44]">Looking up pincode...</p> : null}
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Country"
            value={newAddress.country}
            onChange={(event) => setNewAddress((current) => ({ ...current, country: event.target.value }))}
          />
          <div className="sm:col-span-2 flex overflow-hidden rounded-xl border border-[#e8ccb3] focus-within:border-[#d89a68]">
            <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
            <input
              className="w-full px-4 py-2.5 text-sm outline-none"
              placeholder="Address phone number"
              inputMode="numeric"
              maxLength={10}
              value={newAddress.phone}
              onChange={(event) =>
                setNewAddress((current) => ({ ...current, phone: extractIndianPhoneDigits(event.target.value) }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={newAddress.is_default}
              onChange={(event) => setNewAddress((current) => ({ ...current, is_default: event.target.checked }))}
            />
            Set as default
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isDetectingAddressLocation}
            onClick={() => void detectAddressCurrentLocation()}
            className="rounded-full border border-[#e8ccb3] bg-white px-4 py-2 text-xs font-semibold text-[#9a6a44] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDetectingAddressLocation ? 'Detecting...' : 'Use Current Location'}
          </button>
          {newAddress.latitude && newAddress.longitude ? (
            <span className="text-xs text-green-700">
              Location captured ({Number(newAddress.latitude).toFixed(4)}, {Number(newAddress.longitude).toFixed(4)})
            </span>
          ) : (
            <span className="text-xs text-[#9a6a44]">Drop a pin on map for precise service location</span>
          )}
        </div>

        <div className="mt-4">
          <LocationPinMap
            latitude={newAddress.latitude}
            longitude={newAddress.longitude}
            currentLatitude={currentAddressLatitude}
            currentLongitude={currentAddressLongitude}
            onChange={(nextLat, nextLng) => {
              setNewAddress((current) => ({
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
          className="mt-4 rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          {editingAddressId ? 'Save Address Changes' : 'Add Address'}
        </button>
        {editingAddressId ? (
          <button
            type="button"
            disabled={isPending}
            onClick={resetAddressForm}
            className="ml-2 mt-4 rounded-full border border-[#e8ccb3] bg-white px-5 py-2.5 text-xs font-semibold text-ink"
          >
            Cancel
          </button>
        ) : null}

        <div className="mt-4 grid gap-3">
          {addresses.length === 0 ? (
            <p className="text-sm text-[#6b6b6b]">No addresses added yet.</p>
          ) : (
            addresses.map((address) => (
              <article key={address.id} className="rounded-2xl border border-[#e8ccb3] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {address.label ?? 'Address'} {address.is_default ? '• Default' : ''}
                  </p>
                  <div className="flex gap-2">
                    {!address.is_default ? (
                      <button
                        type="button"
                        onClick={() => makeDefaultAddress(address)}
                        className="rounded-full border border-[#e8ccb3] px-3 py-1 text-xs"
                      >
                        Make default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEditAddress(address)}
                      className="rounded-full border border-[#e8ccb3] px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAddress(address.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-[#6b6b6b]">
                  {address.address_line_1}
                  {address.address_line_2 ? `, ${address.address_line_2}` : ''}, {address.city}, {address.state} -{' '}
                  {address.pincode}, {address.country}
                </p>
                {address.phone ? <p className="mt-1 text-xs text-[#6b6b6b]">Phone: {address.phone}</p> : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">4. Emergency Contacts</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Contact name"
            value={newContact.contact_name}
            onChange={(event) => setNewContact((current) => ({ ...current, contact_name: event.target.value }))}
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Relationship"
            value={newContact.relationship}
            onChange={(event) => setNewContact((current) => ({ ...current, relationship: event.target.value }))}
          />
          <div className="flex overflow-hidden rounded-xl border border-[#e8ccb3] focus-within:border-[#d89a68]">
            <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
            <input
              className="w-full px-4 py-2.5 text-sm outline-none"
              placeholder="9876543210"
              inputMode="numeric"
              maxLength={10}
              value={newContact.phone_number}
              onChange={(event) =>
                setNewContact((current) => ({ ...current, phone_number: extractIndianPhoneDigits(event.target.value) }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={newContact.is_primary}
              onChange={(event) => setNewContact((current) => ({ ...current, is_primary: event.target.checked }))}
            />
            Set as primary
          </label>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={addNewContact}
          className="mt-4 rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          Add Emergency Contact
        </button>

        <div className="mt-4 grid gap-3">
          {contacts.length === 0 ? (
            <p className="text-sm text-[#6b6b6b]">No emergency contacts added yet.</p>
          ) : (
            contacts.map((contact) => (
              <article key={contact.id} className="rounded-2xl border border-[#e8ccb3] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {contact.contact_name} {contact.is_primary ? '• Primary' : ''}
                  </p>
                  <div className="flex gap-2">
                    {!contact.is_primary ? (
                      <button
                        type="button"
                        onClick={() => makePrimaryContact(contact)}
                        className="rounded-full border border-[#e8ccb3] px-3 py-1 text-xs"
                      >
                        Make primary
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeContact(contact.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-[#6b6b6b]">
                  {contact.relationship ? `${contact.relationship} • ` : ''}
                  {contact.phone_number}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">5. Preferences</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Preferred service time"
            value={preferencesForm.preferred_service_time}
            onChange={(event) =>
              setPreferencesForm((current) => ({ ...current, preferred_service_time: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Preferred groomer gender"
            value={preferencesForm.preferred_groomer_gender}
            onChange={(event) =>
              setPreferencesForm((current) => ({ ...current, preferred_groomer_gender: event.target.value }))
            }
          />
          <select
            value={preferencesForm.communication_preference}
            onChange={(event) =>
              setPreferencesForm((current) => ({ ...current, communication_preference: event.target.value }))
            }
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
          >
            <option value="">Communication preference</option>
            <option value="call">Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="app">App</option>
          </select>
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm sm:col-span-2"
            placeholder="Special instructions"
            value={preferencesForm.special_instructions}
            onChange={(event) =>
              setPreferencesForm((current) => ({ ...current, special_instructions: event.target.value }))
            }
          />
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={savePreferences} className="mt-4">
          Save Preferences
        </Button>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">6. Household Information</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="number"
            min={0}
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Total pets"
            value={householdForm.total_pets}
            onChange={(event) => setHouseholdForm((current) => ({ ...current, total_pets: Number(event.target.value) }))}
          />
          <input
            type="number"
            min={0}
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Years of pet experience"
            value={householdForm.years_of_pet_experience}
            onChange={(event) =>
              setHouseholdForm((current) => ({
                ...current,
                years_of_pet_experience: event.target.value ? Number(event.target.value) : '',
              }))
            }
          />
          <input
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="Lives in (Apartment/Villa/etc.)"
            value={householdForm.lives_in}
            onChange={(event) => setHouseholdForm((current) => ({ ...current, lives_in: event.target.value }))}
          />
          <input
            type="number"
            min={1}
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
            placeholder="People in house"
            value={householdForm.number_of_people_in_house}
            onChange={(event) =>
              setHouseholdForm((current) => ({
                ...current,
                number_of_people_in_house: event.target.value ? Number(event.target.value) : '',
              }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={householdForm.first_pet_owner}
              onChange={(event) => setHouseholdForm((current) => ({ ...current, first_pet_owner: event.target.checked }))}
            />
            First-time pet owner
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={householdForm.has_other_pets}
              onChange={(event) => setHouseholdForm((current) => ({ ...current, has_other_pets: event.target.checked }))}
            />
            Has other pets
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={householdForm.has_children}
              onChange={(event) => setHouseholdForm((current) => ({ ...current, has_children: event.target.checked }))}
            />
            Has children at home
          </label>
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={saveHouseholdInfo} className="mt-4">
          Save Household Information
        </Button>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">7. Your Reputation</h2>
          <span className="rounded-full border border-[#e8ccb3] px-3 py-1 text-xs">Trust: {trustIndicator}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-2.5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Rating</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{reputationForm.average_rating > 0 ? `${reputationForm.average_rating.toFixed(1)} ⭐` : '—'}</p>
          </div>
          <div className="rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-2.5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Bookings</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{reputationForm.total_bookings}</p>
          </div>
          <div className="rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-2.5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">No Shows</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{reputationForm.no_show_count}</p>
          </div>
          <div className="rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-2.5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Status</p>
            <p className="mt-1 text-lg font-bold text-neutral-900 capitalize">{reputationForm.account_status}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">Reputation metrics are maintained by our Trust & Safety team and updated automatically.</p>
      </section>
    </div>
  );
}
