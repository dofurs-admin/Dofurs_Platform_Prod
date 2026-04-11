'use client';

import { useState, useTransition, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import FormField from './FormField';
import { useToast } from '@/components/ui/ToastProvider';
import { PET_GENDERS } from '@/lib/pets/types';
import { MAX_PET_AGE_YEARS, getPetDateOfBirthBounds, isPetDateOfBirthWithinBounds } from '@/lib/utils/date';

type Pet = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
  date_of_birth?: string | null;
};

type PetEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pet: Pet | null;
  onSave: (updatedPet: Pet) => void;
};

function normalizePetGenderValue(value: string | null | undefined) {
  const token = value?.trim().toLowerCase() ?? '';
  return PET_GENDERS.includes(token as (typeof PET_GENDERS)[number]) ? token : '';
}

export default function PetEditModal({ isOpen, onClose, pet, onSave }: PetEditModalProps) {
  const { minDate, maxDate } = getPetDateOfBirthBounds();
  const [petData, setPetData] = useState({
    name: '',
    breed: '',
    dateOfBirth: '',
    weight: '',
    gender: '',
    allergies: '',
  });
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (pet && isOpen) {
      setPetData({
        name: pet.name || '',
        breed: pet.breed || '',
        dateOfBirth: pet.date_of_birth || '',
        weight: pet.weight?.toString() || '',
        gender: normalizePetGenderValue(pet.gender),
        allergies: pet.allergies || '',
      });
    }
  }, [pet, isOpen]);

  async function handleSave() {
    if (!pet) return;

    const name = petData.name.trim();
    if (!name) {
      showToast('Pet name is required.', 'error');
      return;
    }

    if (!isPetDateOfBirthWithinBounds(petData.dateOfBirth)) {
      showToast(`Date of birth cannot be more than ${MAX_PET_AGE_YEARS} years ago.`, 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/user/pets/${pet.id}/passport`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pet: {
              name,
              breed: petData.breed.trim() || null,
              dateOfBirth: petData.dateOfBirth || null,
              weight: petData.weight.trim() ? parseFloat(petData.weight) : null,
              gender: normalizePetGenderValue(petData.gender) || null,
              allergies: petData.allergies.trim() || null,
            },
          }),
        });

        if (!response.ok) {
          showToast('Unable to update pet profile.', 'error');
          return;
        }

        const data = await response.json();
        if (data.profile?.pet) {
          onSave(data.profile.pet);
          showToast('Pet profile updated successfully!', 'success');
          onClose();
        }
      } catch (err) { console.error(err);
        showToast('An error occurred while updating.', 'error');
      }
    });
  }

  if (!pet) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${pet.name}'s Profile`} size="xl">
      <div className="space-y-6">
        {/* Quick Edit Notice */}
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🐾</div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Quick Edit</h4>
              <p className="text-sm text-blue-800">
                Update basic pet information here. For detailed passport sections (vaccinations, medical records, behavior training, feeding & grooming schedules), these can be added after saving the basic details.
              </p>
            </div>
          </div>
        </div>

        {/* Basic Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Pet Name *"
            value={petData.name}
            onChange={(e) => setPetData({ ...petData, name: e.target.value })}
            placeholder="Enter pet name"
          />
          <FormField
            label="Breed"
            value={petData.breed}
            onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
            placeholder="e.g., Golden Retriever"
          />
          <FormField
            label="Date of Birth"
            type="date"
            min={minDate}
            max={maxDate}
            value={petData.dateOfBirth}
            onChange={(e) => setPetData({ ...petData, dateOfBirth: e.target.value })}
          />
          <FormField
            label="Weight (kg)"
            type="number"
            step="0.1"
            value={petData.weight}
            onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
            placeholder="e.g., 12.5"
          />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-900">Gender</label>
            <select
              value={normalizePetGenderValue(petData.gender)}
              onChange={(e) => setPetData({ ...petData, gender: normalizePetGenderValue(e.target.value) })}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <FormField
            label="Allergies"
            value={petData.allergies}
            onChange={(e) => setPetData({ ...petData, allergies: e.target.value })}
            placeholder="List any allergies"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-neutral-200/70 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !petData.name.trim()}
            className="rounded-xl bg-[#1f1f1f] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#353535] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1f]/25 focus-visible:ring-offset-1 disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
