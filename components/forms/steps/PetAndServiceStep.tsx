'use client';

import { useState } from 'react';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import Modal from '@/components/ui/Modal';
import { MAX_PET_AGE_YEARS } from '@/lib/utils/date';

type Pet = { id: number; name: string; breed?: string | null; photo_url?: string | null };
type Service = {
  id: string;
  provider_id: number;
  service_type: string;
  service_duration_minutes: number;
  buffer_minutes: number;
  base_price: number;
  source: 'provider_services' | 'services';
};
type PetServiceSelection = Array<{ serviceType: string; quantity: number }>;

interface PetAndServiceStepProps {
  // Pet selection
  pets: Pet[];
  selectedPetIds: number[];
  onPetToggle: (petId: number) => void;
  onPetCreated: (pet: Pet) => void;
  // Service selection
  services: Service[];
  petServiceSelections: Record<number, PetServiceSelection>;
  totalSelectedServices: number;
  searchResultSummary?: string | null;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  isPackageBooking?: boolean;
  serviceSelectionRuleNote?: string | null;
  isServiceSelectionBlocked?: (petId: number, serviceType: string) => boolean;
  isPincodeValid?: boolean;
  onBookingModeChange: (mode: 'home_visit' | 'clinic_visit') => void;
  onPetServiceChange: (petId: number, serviceType: string) => void;
  onPetQuantityChange: (petId: number, serviceType: string, quantity: number) => void;
  onApplyServiceToAll: (serviceType: string) => void;
  // Navigation
  onNext: () => void;
  onPrev?: () => void;
}

const EMPTY_PET_FORM = { name: '', type: 'Dog', age: '', gender: '' };
const MAX_SERVICE_SELECTIONS = 2;

export default function PetAndServiceStep({
  pets,
  selectedPetIds,
  onPetToggle,
  onPetCreated,
  services,
  petServiceSelections,
  totalSelectedServices,
  searchResultSummary,
  bookingMode,
  isPackageBooking = false,
  serviceSelectionRuleNote = null,
  isServiceSelectionBlocked,
  isPincodeValid = true,
  onBookingModeChange,
  onPetServiceChange,
  onPetQuantityChange,
  onApplyServiceToAll,
  onNext,
  onPrev,
}: PetAndServiceStepProps) {
  const [imageLoadErrorIds, setImageLoadErrorIds] = useState<Set<number>>(new Set());

  // Add-pet modal state
  const [isAddPetOpen, setIsAddPetOpen] = useState(false);
  const [petForm, setPetForm] = useState(EMPTY_PET_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedPets = pets.filter((p) => selectedPetIds.includes(p.id));

  const canContinue =
    selectedPetIds.length > 0 &&
    (isPackageBooking || Boolean(bookingMode)) &&
    (isPackageBooking || isPincodeValid) &&
    selectedPets.every((pet) => {
      const selections = petServiceSelections[pet.id] ?? [];
      return selections.length > 0;
    });

  const continueDisabledReason = (() => {
    if (canContinue) {
      return null;
    }

    if (selectedPetIds.length === 0) {
      return 'Select at least one pet to continue.';
    }

    if (!isPackageBooking && !bookingMode) {
      return 'Select a booking mode to continue.';
    }

    const hasIncompleteSelection = selectedPets.some((pet) => {
      const selections = petServiceSelections[pet.id] ?? [];
      return selections.length === 0;
    });

    if (hasIncompleteSelection || totalSelectedServices === 0) {
      return 'Select a service for each selected pet to continue.';
    }

    if (!isPackageBooking && !isPincodeValid) {
      return 'Set a valid 6-digit pincode to continue.';
    }

    return 'Complete this step to continue.';
  })();

  const firstSelectedServiceType =
    selectedPets.length > 0 ? (petServiceSelections[selectedPets[0].id] ?? [])[0]?.serviceType ?? null : null;

  function openAddPet() {
    setPetForm(EMPTY_PET_FORM);
    setCreateError(null);
    setIsAddPetOpen(true);
  }

  async function handleCreatePet() {
    const name = petForm.name.trim();
    if (!name) {
      setCreateError('Pet name is required.');
      return;
    }

    const parsedAge = petForm.age.trim() ? Number.parseInt(petForm.age, 10) : null;
    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > MAX_PET_AGE_YEARS)) {
      setCreateError(`Pet age must be between 0 and ${MAX_PET_AGE_YEARS}.`);
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/user/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          breed: petForm.type || null,
          age: parsedAge,
          gender: petForm.gender || null,
        }),
      });

      if (!response.ok) {
        setCreateError('Unable to create pet. Please try again.');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { pet?: Pet } | null;
      if (!payload?.pet) {
        setCreateError('Unexpected error. Please try again.');
        return;
      }

      onPetCreated(payload.pet);
      setIsAddPetOpen(false);
    } catch {
      setCreateError('Unable to create pet. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <div className="premium-fade-up space-y-2.5 sm:space-y-7 rounded-2xl sm:rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-2.5 max-[380px]:p-2 sm:p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
        {/* Top navigation */}
        <div className="hidden sm:flex sm:flex-row sm:justify-between sm:gap-3">
          {typeof onPrev === 'function' ? (
            <button
              type="button"
              onClick={onPrev}
              className="w-full rounded-full border border-[#e3c7ae] bg-white px-6 py-2.5 text-sm font-semibold text-[#7c5335] transition-all hover:border-[#c7773b] sm:w-auto"
            >
              Back
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className="premium-lift inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-7 py-2.5 text-sm font-semibold leading-6 text-white whitespace-nowrap shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Continue to Schedule
          </button>
        </div>
        {!canContinue && continueDisabledReason ? (
          <p className="hidden sm:block text-right text-xs font-medium text-[#8f4a1d]">{continueDisabledReason}</p>
        ) : null}

        {/* Step header — hidden on mobile since BookingProgressBar shows step info */}
        <div className="hidden sm:block">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">Step 1 of 3</p>
          <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-950">Select Pets &amp; Service</h2>
          <p className="mt-2 text-sm text-[#6e4d35]">Choose which pet(s) to book for and what service they need.</p>
          {searchResultSummary && (
            <p className="mt-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2 text-xs font-medium text-[#8f4a1d]">
              {searchResultSummary}
            </p>
          )}
        </div>

        {/* ===== PET SELECTION ===== */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="block text-[13px] font-semibold text-neutral-950 sm:text-sm">Your Pets</label>
            {pets.length > 0 && (
              <button
                type="button"
                onClick={openAddPet}
                className="flex items-center gap-1.5 rounded-full border border-[#e3c7ae] bg-white px-3 py-1.5 text-xs font-semibold text-[#c7773b] transition-all hover:border-[#c7773b] hover:bg-[#fff8f1]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Pet
              </button>
            )}
          </div>

          {pets.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#ddc9b6] bg-white px-5 py-8 text-center sm:gap-5 sm:px-6 sm:py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff3e6]">
                <svg className="h-8 w-8 text-[#c7773b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">No pets on your profile yet</p>
                <p className="mt-1 text-xs text-[#8a6549]">Add your pet to get started with booking.</p>
              </div>
              <button
                type="button"
                onClick={openAddPet}
                className="premium-lift flex items-center gap-2 rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(199,119,59,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(199,119,59,0.32)]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Pet
              </button>
            </div>
          ) : (
            <div className="grid gap-1.5 sm:gap-3 sm:grid-cols-2">
              {pets.map((pet) => {
                const isSelected = selectedPetIds.includes(pet.id);
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => onPetToggle(pet.id)}
                      className={`premium-lift relative flex items-center gap-2 rounded-xl sm:rounded-2xl border p-2.5 max-[380px]:p-2 sm:p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                        : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                    }`}
                  >
                    <div className="flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e3c7ae] bg-[#fff8ef]">
                      {pet.photo_url && !imageLoadErrorIds.has(pet.id) ? (
                        <span className="relative block h-full w-full">
                          <StorageBackedImage
                            value={pet.photo_url}
                            bucket="pet-photos"
                            alt={`${pet.name} profile`}
                            fill
                            sizes="48px"
                            className="object-cover"
                            onError={() => setImageLoadErrorIds((prev) => new Set(prev).add(pet.id))}
                          />
                        </span>
                      ) : (
                        <span className="text-base font-semibold text-[#c7773b]">
                          {pet.name.trim().charAt(0).toUpperCase() || 'P'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[15px] font-semibold text-neutral-950 sm:text-base">{pet.name}</h3>
                      <p className="text-xs text-[#6e4d35]">{pet.breed?.trim() || 'Pet profile ready for booking'}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#c7773b]">
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== BOOKING MODE + SERVICE SELECTION ===== */}
        {selectedPetIds.length > 0 && (
          <>
            {/* Hide booking mode for package services (birthday/boarding) */}
            {!isPackageBooking && (
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-neutral-950 sm:mb-3 sm:text-sm">Booking Mode</label>
                <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                  {(['home_visit', 'clinic_visit'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onBookingModeChange(mode)}
                      className={`premium-lift relative rounded-xl sm:rounded-2xl border p-3 sm:p-4 text-left transition-all ${
                        bookingMode === mode
                          ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                          : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                      }`}
                    >
                      <h3 className="font-semibold text-neutral-950">
                        {mode === 'home_visit' ? 'Home Visit' : 'Clinic Visit'}
                      </h3>
                      <p className="mt-1 text-xs text-[#6e4d35]">
                        {mode === 'home_visit'
                          ? 'Comfort-first care at your doorstep.'
                          : 'Structured in-clinic care at partner centers.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(bookingMode || isPackageBooking) && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="block text-[13px] font-semibold text-neutral-950 sm:text-sm">Service Per Pet</label>
                  <p className="text-xs font-semibold text-[#8f4a1d]">{totalSelectedServices}/{MAX_SERVICE_SELECTIONS} selected</p>
                </div>

                <p className="mb-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2 text-xs font-medium text-[#8f4a1d]">
                  You can add up to 2 services per booking in any combination.
                </p>

                {serviceSelectionRuleNote ? (
                  <p className="mb-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2 text-xs font-medium text-[#8f4a1d]">
                    {serviceSelectionRuleNote}
                  </p>
                ) : null}

                {bookingMode && firstSelectedServiceType && selectedPets.length > 1 && (
                  <div className="mb-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onApplyServiceToAll(firstSelectedServiceType)}
                      className="text-xs font-semibold text-[#8f4a1d] underline underline-offset-4"
                    >
                      Apply &quot;{firstSelectedServiceType}&quot; to all pets
                    </button>
                  </div>
                )}

                {services.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#ddc9b6] bg-white p-4 text-center">
                    <p className="text-sm text-neutral-500">No services available for this mode.</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {selectedPets.map((pet) => {
                      const selections = petServiceSelections[pet.id] ?? [];
                      return (
                        <div key={pet.id} className="rounded-xl sm:rounded-2xl border border-[#ebdfd3] bg-white p-3 sm:p-4">
                          <div className="mb-3">
                            <h3 className="font-semibold text-neutral-950">{pet.name}</h3>
                            <p className="text-xs text-[#6e4d35]">{pet.breed?.trim() || 'Pet'}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {services.map((service) => {
                              const isSelected = selections.some((s) => s.serviceType === service.service_type);
                              const entry = selections.find((s) => s.serviceType === service.service_type);
                              const blockedByPackageRule = Boolean(isServiceSelectionBlocked?.(pet.id, service.service_type));
                              const blockedByCartLimit = totalSelectedServices >= MAX_SERVICE_SELECTIONS;
                              const isBlocked = !isSelected && (blockedByPackageRule || blockedByCartLimit);
                              return (
                                <div key={`${pet.id}-${service.service_type}`}>
                                  <button
                                    type="button"
                                    onClick={() => onPetServiceChange(pet.id, service.service_type)}
                                    aria-disabled={isBlocked}
                                    className={`premium-lift relative w-full rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 text-left transition-all ${
                                      isSelected
                                        ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                                        : isBlocked
                                          ? 'cursor-not-allowed border-[#eadfd4] bg-[#faf7f3] opacity-65'
                                          : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#c7773b]">
                                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                    <h4 className="text-sm font-semibold text-neutral-950">{service.service_type}</h4>
                                    <p className="mt-1 text-[11px] text-[#6e4d35]">
                                      {service.service_duration_minutes} mins • From ₹{service.base_price}
                                    </p>
                                    {isBlocked ? (
                                      <p className="mt-1 text-[10px] font-semibold text-[#8f4a1d]">
                                        {blockedByCartLimit ? 'Maximum 2 services reached' : 'Book this service separately'}
                                      </p>
                                    ) : null}
                                  </button>
                                  {isSelected && entry && (
                                    <div className="mt-1.5 flex items-center justify-center gap-2 rounded-xl border border-[#e3c7ae] px-2 py-1">
                                      <button
                                        type="button"
                                        onClick={() => onPetQuantityChange(pet.id, service.service_type, entry.quantity - 1)}
                                        className="h-7 w-7 rounded-full bg-[#fff3e6] text-sm font-semibold text-[#8f4a1d]"
                                      >
                                        -
                                      </button>
                                      <span className="min-w-5 text-center text-xs font-semibold text-neutral-900">x{entry.quantity}</span>
                                      <button
                                        type="button"
                                        onClick={() => onPetQuantityChange(pet.id, service.service_type, Math.min(5, entry.quantity + 1))}
                                        disabled={totalSelectedServices >= MAX_SERVICE_SELECTIONS}
                                        className="h-7 w-7 rounded-full bg-[#fff3e6] text-sm font-semibold text-[#8f4a1d] disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
          {typeof onPrev === 'function' ? (
            <button
              type="button"
              onClick={onPrev}
              className="w-full rounded-full border border-[#e3c7ae] bg-white px-6 py-2.5 text-sm font-semibold text-[#7c5335] transition-all hover:border-[#c7773b] sm:w-auto"
            >
              Back
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className="premium-lift inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-7 py-2.5 text-sm font-semibold leading-6 text-white whitespace-nowrap shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Continue to Schedule
          </button>
        </div>
      </div>

      {!canContinue && continueDisabledReason ? (
        <p className="sm:hidden text-xs font-medium text-[#8f4a1d]">{continueDisabledReason}</p>
      ) : null}

      {/* Add Pet Modal */}
      <Modal
        isOpen={isAddPetOpen}
        onClose={() => setIsAddPetOpen(false)}
        title="Add a Pet"
        description="Start with the basics — you can add more details from your dashboard later."
        size="md"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-neutral-900">
                Pet name <span className="text-[#c7773b]">*</span>
              </label>
              <input
                type="text"
                value={petForm.name}
                onChange={(e) => setPetForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bruno, Luna"
                className="w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all focus:border-[#c7773b] focus:outline-none focus:ring-2 focus:ring-[#c7773b]/20"
                autoFocus
              />
            </div>

            {/* Pet type */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-neutral-900">Pet type</label>
              <div className="flex gap-2">
                {['Dog', 'Cat'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPetForm((f) => ({ ...f, type }))}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                      petForm.type === type
                        ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef,#fff0e3)] text-[#8f4a1d] shadow-[0_4px_12px_rgba(208,133,72,0.18)]'
                        : 'border-[#ebdfd3] bg-white text-neutral-600 hover:border-[#d9b89a]'
                    }`}
                  >
                    <span>{type === 'Dog' ? '🐶' : '🐱'}</span>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-neutral-900">Age (years)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={petForm.age}
                onChange={(e) => setPetForm((f) => ({ ...f, age: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                placeholder="e.g. 3"
                className="w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all focus:border-[#c7773b] focus:outline-none focus:ring-2 focus:ring-[#c7773b]/20"
              />
            </div>

            {/* Gender */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-neutral-900">Gender</label>
              <div className="flex gap-2">
                {[
                  { label: 'Male', value: 'male' },
                  { label: 'Female', value: 'female' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPetForm((f) => ({ ...f, gender: f.gender === opt.value ? '' : opt.value }))}
                    className={`flex flex-1 items-center justify-center rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                      petForm.gender === opt.value
                        ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef,#fff0e3)] text-[#8f4a1d] shadow-[0_4px_12px_rgba(208,133,72,0.18)]'
                        : 'border-[#ebdfd3] bg-white text-neutral-600 hover:border-[#d9b89a]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {createError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsAddPetOpen(false)}
              className="rounded-full border border-[#e3c7ae] bg-white px-5 py-2.5 text-sm font-semibold text-[#7c5335] transition-all hover:border-[#c7773b]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreatePet}
              disabled={isCreating || !petForm.name.trim()}
              className="premium-lift rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Adding...' : 'Add Pet'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
