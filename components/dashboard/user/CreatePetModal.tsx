'use client';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FormField from '@/components/dashboard/FormField';
import SegmentedControl from '@/components/dashboard/SegmentedControl';
import type { PetCreateForm } from './types';
import { normalizePetGenderValue } from './utils';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  newPet: PetCreateForm;
  newPetPhotoFile: File | null;
  isPending: boolean;
  onNewPetFieldChange: <K extends keyof PetCreateForm>(key: K, value: PetCreateForm[K], capitalize?: boolean) => void;
  onPhotoFileChange: (file: File | null) => void;
  onBreedChange: (value: string) => void;
  onCreatePet: () => void;
};

export default function CreatePetModal({
  isOpen,
  onClose,
  newPet,
  newPetPhotoFile,
  isPending,
  onNewPetFieldChange,
  onPhotoFileChange,
  onBreedChange,
  onCreatePet,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a New Pet"
      description="Start with the essentials. You can enrich passport details once the profile is created."
      size="lg"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Pet name"
          value={newPet.name}
          onChange={(event) => onNewPetFieldChange('name', event.target.value, true)}
          placeholder="Pet name *"
        />
        <SegmentedControl
          label="Pet type"
          options={[
            { label: 'Dog', value: 'Dog', icon: '🐶' },
            { label: 'Cat', value: 'Cat', icon: '🐱' },
          ]}
          value={newPet.breed}
          onChange={onBreedChange}
        />
        <FormField
          label="Age"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={newPet.age}
          onChange={(event) => onNewPetFieldChange('age', event.target.value)}
          placeholder="Age"
        />
        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-900">Gender</label>
          <select
            value={newPet.gender}
            onChange={(event) => onNewPetFieldChange('gender', normalizePetGenderValue(event.target.value))}
            className="w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="cursor-pointer rounded-full border border-[#e1bf9e] bg-[#fff8f1] px-4 py-2 text-sm font-medium text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm">
          {newPetPhotoFile ? `Photo selected: ${newPetPhotoFile.name}` : 'Upload pet photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onPhotoFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onCreatePet} disabled={isPending} className="px-5 py-2.5">
            {isPending ? 'Creating...' : 'Create Pet'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
