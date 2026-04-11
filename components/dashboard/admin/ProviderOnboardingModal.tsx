'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import ImageUploadField from '@/components/ui/ImageUploadField';
import { cn } from '@/lib/design-system';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';
import { INDIAN_STATES, findMatchingState } from '@/lib/utils/india-states';
import { usePincodeLookup } from '@/lib/hooks/usePincodeLookup';

const LocationPinMap = dynamic(() => import('@/components/forms/LocationPinMap'), { ssr: false });

type ProviderType = 'clinic' | 'veterinarian' | 'groomer' | 'other';

type ProviderOnboardingData = {
  // Basic Information
  name: string;
  email: string;
  phone: string;
  profile_photo_url: string;
  provider_type: ProviderType;
  custom_provider_type: string;
  
  // Business Information (for clinics/centers)
  business_name: string;
  business_registration_number: string;
  
  // Address & Location
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  service_radius_km: string;
  
  // Professional Details
  specialization: string;
  years_of_experience: string;
  qualification: string;
  
  // Compensation Settings
  compensation_type: 'salary' | 'commission' | 'both';
  salary_amount: string;
  commission_percentage: string;
  
  // Service Areas (for home visit professionals)
  service_pincodes: string; // Comma-separated
};

type ProviderOnboardingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
};

type ProviderOnboardingApiError = {
  error?: string;
  validationErrors?: Record<string, string>;
};

function normalizeProviderTypeInput(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getFirstValidationErrorMessage(error: ProviderOnboardingApiError) {
  const fieldErrors = error.validationErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const first = Object.values(fieldErrors).find((message) => typeof message === 'string' && message.trim().length > 0);
    if (first) {
      return first;
    }
  }

  if (typeof error.error === 'string' && error.error.trim().length > 0) {
    return error.error;
  }

  return 'Failed to onboard provider';
}

export default function ProviderOnboardingModal({ isOpen, onClose, onSuccess }: ProviderOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [locationActionError, setLocationActionError] = useState<string | null>(null);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [isAutofillingCoordinates, setIsAutofillingCoordinates] = useState(false);
  const [currentLatitude, setCurrentLatitude] = useState('');
  const [currentLongitude, setCurrentLongitude] = useState('');
  const [customProviderTypes, setCustomProviderTypes] = useState<string[]>([]);

  // Load custom provider types from localStorage
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('customProviderTypes');
        if (saved) {
          setCustomProviderTypes(JSON.parse(saved));
        }
      } catch (err) { console.error(err);
        // Silently fail if localStorage read fails
      }
    }
  }, [isOpen]);

  // Scroll to first interactive element when step changes
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const container = stepContentRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, [role="combobox"]'
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step, isOpen]);
  
  const [formData, setFormData] = useState<ProviderOnboardingData>({
    name: '',
    email: '',
    phone: '',
    profile_photo_url: '',
    provider_type: 'clinic',
    custom_provider_type: '',
    business_name: '',
    business_registration_number: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    service_radius_km: '5',
    specialization: '',
    years_of_experience: '',
    qualification: '',
    compensation_type: 'commission',
    salary_amount: '',
    commission_percentage: '15',
    service_pincodes: '',
  });

  const pincodeLookup = usePincodeLookup(formData.pincode);

  useEffect(() => {
    if (pincodeLookup.isAutoFilled && pincodeLookup.city && pincodeLookup.state) {
      const matchedState = findMatchingState(pincodeLookup.state);
      updateField('city', pincodeLookup.city);
      if (matchedState) updateField('state', matchedState);
    }
  }, [pincodeLookup.city, pincodeLookup.state, pincodeLookup.isAutoFilled]);

  const isClinic = formData.provider_type === 'clinic';
  const isHomeVisit = formData.provider_type === 'veterinarian' || formData.provider_type === 'groomer';
  const isOtherProviderType = formData.provider_type === 'other';
  const invalidServicePincodes = formData.service_pincodes
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => !/^[1-9]\d{5}$/.test(value));

  function updateField<K extends keyof ProviderOnboardingData>(field: K, value: ProviderOnboardingData[K]) {
    const normalizedValue =
      field === 'pincode' && typeof value === 'string'
        ? (value.replace(/\D/g, '').slice(0, 6) as ProviderOnboardingData[K])
        : field === 'service_pincodes' && typeof value === 'string'
          ? (value.replace(/[^\d,\s]/g, '') as ProviderOnboardingData[K])
          : value;

    setFormData((prev) => ({ ...prev, [field]: normalizedValue }));
    setError(null);
    if (field === 'address' || field === 'city' || field === 'state' || field === 'pincode') {
      setLocationActionError(null);
    }
  }

  function handleCoordinateSelection(lat: number, lng: number) {
    setLocationActionError(null);
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }

  function handleUseCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationActionError('Geolocation is not supported in this browser.');
      return;
    }

    setLocationActionError(null);
    setIsResolvingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentLatitude(lat.toFixed(6));
        setCurrentLongitude(lng.toFixed(6));
        handleCoordinateSelection(lat, lng);
        setIsResolvingCurrentLocation(false);
      },
      () => {
        setLocationActionError('Unable to access your location. Check browser permissions and try again.');
        setIsResolvingCurrentLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleAutofillCoordinatesFromAddress() {
    const addressParts = [formData.address, formData.city, formData.state, formData.pincode, 'India']
      .map((part) => part.trim())
      .filter(Boolean);

    if (addressParts.length < 3) {
      setLocationActionError('Add address, city, and pincode first to autofill coordinates.');
      return;
    }

    setLocationActionError(null);
    setIsAutofillingCoordinates(true);

    try {
      const query = encodeURIComponent(addressParts.join(', '));
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);

      if (!response.ok) {
        throw new Error('Failed to fetch map coordinates');
      }

      const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const firstResult = results[0];
      const lat = Number(firstResult?.lat ?? '');
      const lng = Number(firstResult?.lon ?? '');

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationActionError('No map match found for this address. Drop the pin manually on the map.');
        return;
      }

      handleCoordinateSelection(lat, lng);
    } catch {
      setLocationActionError('Unable to auto-locate this address right now. Drop the pin manually on the map.');
    } finally {
      setIsAutofillingCoordinates(false);
    }
  }

  function resetLocationUiState() {
    setLocationActionError(null);
    setIsResolvingCurrentLocation(false);
    setIsAutofillingCoordinates(false);
    setCurrentLatitude('');
    setCurrentLongitude('');
  }

  function validateStep(currentStep: number): boolean {
    setError(null);

    if (currentStep === 1) {
      if (!formData.name.trim()) {
        setError('Provider name is required');
        return false;
      }
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Valid email address is required');
        return false;
      }
      if (!isValidIndianE164(toIndianE164(formData.phone))) {
        setError('Valid 10-digit Indian phone number is required');
        return false;
      }
      if (isOtherProviderType && !formData.custom_provider_type.trim()) {
        setError('Please specify provider type when selecting Others');
        return false;
      }
      if (isClinic && !formData.business_name.trim()) {
        setError('Business name is required for clinics/centers');
        return false;
      }
    }

    if (currentStep === 2) {
      if (!formData.address.trim()) {
        setError('Address is required');
        return false;
      }
      if (!formData.city.trim()) {
        setError('City is required');
        return false;
      }
      if (!formData.state.trim()) {
        setError('State is required');
        return false;
      }
      if (!formData.pincode.trim() || !/^\d{6}$/.test(formData.pincode)) {
        setError('Valid 6-digit pincode is required');
        return false;
      }
      if (isHomeVisit && !formData.service_pincodes.trim()) {
        setError('Service pincodes are required for home visit professionals');
        return false;
      }
      if (isHomeVisit && invalidServicePincodes.length > 0) {
        setError('Service pincodes must be comma-separated valid 6-digit numbers');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!formData.qualification.trim()) {
        setError('Qualification is required');
        return false;
      }
      if (!formData.years_of_experience.trim() || isNaN(Number(formData.years_of_experience))) {
        setError('Valid years of experience is required');
        return false;
      }
      
      // Validate compensation based on type
      if (formData.compensation_type === 'salary' || formData.compensation_type === 'both') {
        const salary = Number(formData.salary_amount);
        if (!formData.salary_amount.trim() || isNaN(salary) || salary <= 0) {
          setError('Valid salary amount is required');
          return false;
        }
      }
      
      if (formData.compensation_type === 'commission' || formData.compensation_type === 'both') {
        const commission = Number(formData.commission_percentage);
        if (!formData.commission_percentage.trim() || isNaN(commission) || commission < 0 || commission > 100) {
          setError('Commission percentage must be between 0 and 100');
          return false;
        }
      }
    }

    return true;
  }

  function handleNext() {
    if (validateStep(step)) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  }

  function handleBack() {
    setStep((prev) => (prev - 1) as 1 | 2 | 3);
    setError(null);
  }

  function handleSubmit() {
    if (!validateStep(3)) return;

    startTransition(async () => {
      try {
        const payload = {
          ...formData,
          phone: toIndianE164(formData.phone),
          custom_provider_type: normalizeProviderTypeInput(formData.custom_provider_type),
        };

        const response = await fetch('/api/admin/providers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => ({}))) as ProviderOnboardingApiError & {
          provider?: { email?: string };
        };

        if (!response.ok) {
          throw new Error(getFirstValidationErrorMessage(data));
        }

        // Save custom provider type if "other" was used
        if (formData.provider_type === 'other' && formData.custom_provider_type.trim()) {
          const normalized = normalizeProviderTypeInput(formData.custom_provider_type);
          setCustomProviderTypes((prev) => {
            const updated = Array.from(new Set([...prev, normalized]));
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('customProviderTypes', JSON.stringify(updated));
              } catch (err) { console.error(err);
                // Silently fail if localStorage write fails
              }
            }
            return updated;
          });
        }

        // Reset form and close modal
        setFormData({
          name: '',
          email: '',
          phone: '',
          profile_photo_url: '',
          provider_type: 'clinic',
          custom_provider_type: '',
          business_name: '',
          business_registration_number: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          latitude: '',
          longitude: '',
          service_radius_km: '5',
          specialization: '',
          years_of_experience: '',
          qualification: '',
          compensation_type: 'commission',
          salary_amount: '',
          commission_percentage: '15',
          service_pincodes: '',
        });
        setStep(1);
        setError(null);
        resetLocationUiState();
        const onboardedEmail =
          (typeof data?.provider?.email === 'string' && data.provider.email.trim()) || formData.email.trim().toLowerCase();

        onSuccess(onboardedEmail);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to onboard provider');
      }
    });
  }

  function handleClose() {
    if (!isPending) {
      setStep(1);
      setError(null);
      resetLocationUiState();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Onboard New Provider">
      <div className="flex max-h-[75dvh] flex-col">
        <div className="space-y-6 overflow-y-auto pr-1">
        {/* Progress Steps */}
        <div className="flex items-center justify-between gap-2 pb-6 border-b border-neutral-200">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                    step === stepNum
                      ? 'bg-green-500 text-white ring-2 ring-green-200'
                      : step > stepNum
                      ? 'bg-green-500 text-white'
                      : 'bg-neutral-200 text-neutral-500'
                  )}
                >
                  {stepNum}
                </div>
                <span className={cn(
                  'text-xs mt-1 font-medium transition-all',
                  step === stepNum ? 'text-green-600' : 'text-neutral-600'
                )}>
                  {stepNum === 1 ? 'Basic Info' : stepNum === 2 ? 'Location' : 'Professional'}
                </span>
              </div>
              {stepNum < 3 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-all',
                    step > stepNum ? 'bg-green-500' : 'bg-neutral-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Basic Information */}
        {step === 1 && (
          <div ref={stepContentRef} className="space-y-4">
            <h3 className="font-semibold text-neutral-900">Basic Information</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Provider Type *</label>
                <select
                  value={formData.provider_type === 'other' && formData.custom_provider_type ? formData.custom_provider_type : formData.provider_type}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (['clinic', 'veterinarian', 'groomer'].includes(value)) {
                      // Selected a predefined type
                      updateField('provider_type', value as ProviderType);
                      updateField('custom_provider_type', '');
                    } else if (value === 'other') {
                      // Selected "Others (specify manually)" - clear custom field for user input
                      updateField('provider_type', 'other');
                      updateField('custom_provider_type', '');
                    } else {
                      // Selected a previously-added custom type
                      updateField('provider_type', 'other');
                      updateField('custom_provider_type', value);
                    }
                  }}
                  disabled={isPending}
                  className="input-field w-full"
                >
                  <option value="">Select a provider type</option>
                  <option value="clinic">Clinic/Grooming Center</option>
                  <option value="veterinarian">Home Visit Veterinarian</option>
                  <option value="groomer">Home Visit Groomer</option>
                  {customProviderTypes.length > 0 && (
                    <optgroup label="Previously Added">
                      {customProviderTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="other">Others (specify manually)</option>
                </select>
              </div>

              {isOtherProviderType && (
                <div>
                  <Input
                    label="Custom Provider Type *"
                    value={formData.custom_provider_type}
                    onChange={(e) => updateField('custom_provider_type', e.target.value)}
                    placeholder="e.g., Online Vet, Pet Trainer, Mobile Groomer"
                    disabled={isPending}
                  />
                  <p className="mt-2 text-xs text-neutral-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    ✨ <strong>Create any provider type you need.</strong> Enter a custom provider type name and it will be added to your system. This appears in your &quot;Previously Added&quot; list for future use.
                  </p>
                </div>
              )}

              <Input
                label="Provider Name *"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Dr. John Smith / Pet Paradise Clinic"
                disabled={isPending}
              />

              <Input
                label="Email Address *"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="provider@example.com"
                disabled={isPending}
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Phone Number *</label>
                <div className="flex overflow-hidden rounded-xl border border-neutral-200 focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-900/10">
                  <span className="inline-flex items-center bg-neutral-50 px-3 text-sm font-semibold text-neutral-700">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => updateField('phone', extractIndianPhoneDigits(e.target.value))}
                    placeholder="9876543210"
                    disabled={isPending}
                    className="w-full bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                  />
                </div>
              </div>

              <ImageUploadField
                label="Provider Photo (Optional)"
                value={formData.profile_photo_url}
                onChange={(url) => updateField('profile_photo_url', url)}
                bucket="user-photos"
                placeholder="Upload provider profile photo"
                disabled={isPending}
              />

              {isClinic && (
                <>
                  <Input
                    label="Business Name *"
                    value={formData.business_name}
                    onChange={(e) => updateField('business_name', e.target.value)}
                    placeholder="Pet Paradise Veterinary Clinic"
                    disabled={isPending}
                  />

                  <Input
                    label="Business Registration Number"
                    value={formData.business_registration_number}
                    onChange={(e) => updateField('business_registration_number', e.target.value)}
                    placeholder="GST/Registration number"
                    disabled={isPending}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Location & Service Area */}
        {step === 2 && (
          <div ref={stepContentRef} className="space-y-4">
            <h3 className="font-semibold text-neutral-900">
              {isClinic ? 'Clinic Location' : 'Base Location & Service Area'}
            </h3>
            
            <div className="space-y-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Full Address *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Street address, building name, floor"
                  rows={2}
                  disabled={isPending}
                  className="input-field w-full"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Pincode *"
                  value={formData.pincode}
                  onChange={(e) => updateField('pincode', e.target.value)}
                  placeholder="560001"
                  disabled={isPending}
                  maxLength={6}
                  inputMode="numeric"
                  hint={pincodeLookup.isLoading ? 'Looking up pincode...' : undefined}
                />

                <Input
                  label="City *"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder={pincodeLookup.isLoading ? 'Detecting city...' : 'Bangalore'}
                  disabled={isPending}
                  hint={pincodeLookup.isAutoFilled && formData.city ? 'Auto-detected from pincode' : undefined}
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    disabled={isPending}
                    className="input-field w-full"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {pincodeLookup.isAutoFilled && formData.state && (
                    <p className="text-xs text-green-600 mt-1">Auto-detected from pincode</p>
                  )}
                </div>

                <Input
                  label={`Service Radius (km) ${isClinic ? '' : '- Optional'}`}
                  type="number"
                  value={formData.service_radius_km}
                  onChange={(e) => updateField('service_radius_km', e.target.value)}
                  placeholder="5"
                  disabled={isPending}
                  min="0"
                  step="0.5"
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Pin Base Location on Map</p>
                    <p className="text-xs text-neutral-600">Click map to drop a pin or drag marker to fine-tune location.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleAutofillCoordinatesFromAddress}
                      disabled={isPending || isAutofillingCoordinates}
                    >
                      {isAutofillingCoordinates ? 'Finding...' : 'Autofill from Address'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleUseCurrentLocation}
                      disabled={isPending || isResolvingCurrentLocation}
                    >
                      {isResolvingCurrentLocation ? 'Locating...' : 'Use Current Location'}
                    </Button>
                  </div>
                </div>

                <LocationPinMap
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  currentLatitude={currentLatitude}
                  currentLongitude={currentLongitude}
                  onChange={handleCoordinateSelection}
                />

                {locationActionError ? (
                  <p className="text-xs text-red-600">{locationActionError}</p>
                ) : null}
              </div>

              {isHomeVisit && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Service Pincodes * (comma-separated)
                  </label>
                  <textarea
                    value={formData.service_pincodes}
                    onChange={(e) => updateField('service_pincodes', e.target.value)}
                    placeholder="560001, 560002, 560003, 560004"
                    rows={2}
                    disabled={isPending}
                    className="input-field w-full"
                  />
                  {invalidServicePincodes.length > 0 ? (
                    <p className="text-xs text-red-600 mt-1">Use comma-separated 6-digit pincodes only.</p>
                  ) : null}
                  <p className="text-xs text-neutral-600 mt-1">
                    Enter all pincodes where {formData.provider_type === 'veterinarian' ? 'veterinary' : 'grooming'} services will be available
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Latitude"
                  value={formData.latitude}
                  onChange={(e) => updateField('latitude', e.target.value)}
                  placeholder="12.9716"
                  disabled
                />

                <Input
                  label="Longitude"
                  value={formData.longitude}
                  onChange={(e) => updateField('longitude', e.target.value)}
                  placeholder="77.5946"
                  disabled
                />
              </div>

              <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg p-2">
                Coordinates are captured using OpenStreetMap and used for accurate service radius calculations.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Professional Details */}
        {step === 3 && (
          <div ref={stepContentRef} className="space-y-4">
            <h3 className="font-semibold text-neutral-900">Professional Details</h3>
            
            <div className="space-y-3">
              <Input
                label="Qualification *"
                value={formData.qualification}
                onChange={(e) => updateField('qualification', e.target.value)}
                placeholder="BVSc, MVSc, Certified Groomer, etc."
                disabled={isPending}
              />

              <Input
                label="Specialization"
                value={formData.specialization}
                onChange={(e) => updateField('specialization', e.target.value)}
                placeholder="Small Animals, Surgery, Grooming, etc."
                disabled={isPending}
              />

              <Input
                label="Years of Experience *"
                type="number"
                value={formData.years_of_experience}
                onChange={(e) => updateField('years_of_experience', e.target.value)}
                placeholder="5"
                disabled={isPending}
                min="0"
                step="0.5"
              />

              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                  Compensation Type *
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => updateField('compensation_type', 'salary')}
                    disabled={isPending}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      formData.compensation_type === 'salary'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    )}
                  >
                    Salary
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('compensation_type', 'commission')}
                    disabled={isPending}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      formData.compensation_type === 'commission'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    )}
                  >
                    Commission
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('compensation_type', 'both')}
                    disabled={isPending}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      formData.compensation_type === 'both'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    )}
                  >
                    Both
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(formData.compensation_type === 'salary' || formData.compensation_type === 'both') && (
                    <Input
                      label="Monthly Salary (₹) *"
                      type="number"
                      value={formData.salary_amount}
                      onChange={(e) => updateField('salary_amount', e.target.value)}
                      placeholder="30000"
                      disabled={isPending}
                      min="0"
                      step="1000"
                    />
                  )}
                  
                  {(formData.compensation_type === 'commission' || formData.compensation_type === 'both') && (
                    <Input
                      label="Commission (%) *"
                      type="number"
                      value={formData.commission_percentage}
                      onChange={(e) => updateField('commission_percentage', e.target.value)}
                      placeholder="15"
                      disabled={isPending}
                      min="0"
                      max="100"
                      step="0.5"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
                <h4 className="font-medium text-blue-900">📋 What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Provider account will be created with email credentials</li>
                  <li>Provider role access will be granted automatically</li>
                  <li>Account status will be set to &apos;Pending Approval&apos;</li>
                  <li>Provider can login and complete their profile</li>
                  <li>You can review and approve from the moderation panel</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-neutral-200">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isPending}
              >
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            
            {step < 3 ? (
              <Button onClick={handleNext} disabled={isPending}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Creating...' : 'Onboard Provider'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
