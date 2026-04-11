'use client';

import { useState } from 'react';
import StorageBackedImage from '@/components/ui/StorageBackedImage';

type Pet = { id: number; name: string; breed?: string | null; photo_url?: string | null };

interface PetSelectionStepProps {
  pets: Pet[];
  selectedPetIds: number[];
  onPetToggle: (petId: number) => void;
  onNext: () => void;
  onPrev?: () => void;
}

export default function PetSelectionStep({
  pets,
  selectedPetIds = [],
  onPetToggle,
  onNext,
  onPrev,
}: PetSelectionStepProps) {
  const showBack = typeof onPrev === 'function';
  const [imageLoadErrorIds, setImageLoadErrorIds] = useState<Set<number>>(new Set());

  return (
    <div className="premium-fade-up space-y-7 rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
      {/* Step indicator */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">Step 1 of 3</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-950">Select Pet Profile</h2>
        <p className="mt-2 text-sm text-[#6e4d35]">Start by choosing the pet for this booking journey.</p>
      </div>

      {/* Pet selection cards */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">Your Pets</label>
        {pets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddc9b6] bg-white p-6 text-center">
            <p className="text-sm text-neutral-600">No pets found. Please add a pet to your profile first.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pets.map((pet) => {
              const isSelected = selectedPetIds.includes(pet.id);

              return (
                <button
                  key={pet.id}
                  onClick={() => onPetToggle(pet.id)}
                  className={`premium-lift relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                      : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                  }`}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e3c7ae] bg-[#fff8ef]">
                    {pet.photo_url && !imageLoadErrorIds.has(pet.id) ? (
                      <span className="relative block h-full w-full">
                        <StorageBackedImage
                          value={pet.photo_url}
                          bucket="pet-photos"
                          alt={`${pet.name} profile`}
                          fill
                          sizes="48px"
                          className="object-cover"
                          onError={() => {
                            setImageLoadErrorIds((prev) => new Set(prev).add(pet.id));
                          }}
                        />
                      </span>
                    ) : (
                      <span className="text-base font-semibold text-[#c7773b]">{pet.name.trim().charAt(0).toUpperCase() || 'P'}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-950">{pet.name}</h3>
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

      {/* Navigation buttons */}
      <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
        {showBack ? (
          <button
            onClick={onPrev}
            className="w-full rounded-full border border-[#e3c7ae] bg-white px-6 py-2.5 text-sm font-semibold text-[#7c5335] transition-all hover:border-[#c7773b] sm:w-auto"
          >
            Back
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <button
          onClick={onNext}
          disabled={selectedPetIds.length === 0}
          className="premium-lift w-full rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-7 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Continue To Services ({selectedPetIds.length})
        </button>
      </div>
    </div>
  );
}
