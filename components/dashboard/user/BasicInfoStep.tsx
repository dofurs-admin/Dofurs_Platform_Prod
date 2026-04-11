'use client';

import Image from 'next/image';
import FormField from '@/components/dashboard/FormField';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import { getPetDateOfBirthBounds } from '@/lib/utils/date';
import type { PassportDraft } from './types';
import {
  ENERGY_LEVEL_OPTIONS,
  SIZE_CATEGORY_OPTIONS,
} from './constants';
import {
  normalizePetGenderValue,
  normalizeSizeCategoryValue,
  toTitleCaseLabel,
} from './utils';

type Props = {
  draft: PassportDraft;
  petPhotoPreviewUrl: string | null;
  selectedPhotoFileName: string | null;
  canRemovePhoto: boolean;
  onPetPhotoFileChange: (file: File | null) => void;
  onRemovePhoto: () => void;
  onPetFieldChange: <K extends keyof PassportDraft['pet']>(key: K, value: PassportDraft['pet'][K]) => void;
  getFieldError: (path: string) => string | null;
};

export default function BasicInfoStep({
  draft,
  petPhotoPreviewUrl,
  selectedPhotoFileName,
  canRemovePhoto,
  onPetPhotoFileChange,
  onRemovePhoto,
  onPetFieldChange,
  getFieldError,
}: Props) {
  const { minDate, maxDate } = getPetDateOfBirthBounds();

  return (
    <>
      <div className="space-y-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] p-3 lg:col-span-3">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-white">
            {petPhotoPreviewUrl ? (
              petPhotoPreviewUrl.startsWith('blob:') ? (
                <Image src={petPhotoPreviewUrl} alt="Pet photo preview" fill className="object-cover" unoptimized />
              ) : (
                <StorageBackedImage
                  value={petPhotoPreviewUrl}
                  bucket="pet-photos"
                  alt="Pet photo preview"
                  fill
                  className="object-cover"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-500">No photo</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-[#e1bf9e] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm">
              {selectedPhotoFileName ? `Selected: ${selectedPhotoFileName}` : 'Upload profile photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => onPetPhotoFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            {selectedPhotoFileName ? (
              <button
                type="button"
                onClick={() => onPetPhotoFileChange(null)}
                className="rounded-lg border border-[#e1bf9e] bg-[#fff8f1] px-3 py-2 text-xs font-semibold text-neutral-700"
              >
                Clear
              </button>
            ) : null}
            {canRemovePhoto ? (
              <button
                type="button"
                onClick={onRemovePhoto}
                className="rounded-lg border border-[#e7b8b1] bg-[#fff5f3] px-3 py-2 text-xs font-semibold text-[#9f2f1d]"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <FormField
        label="Pet name"
        value={draft.pet.name}
        onChange={(event) => onPetFieldChange('name', event.target.value)}
        error={getFieldError('pet.name') ?? undefined}
      />
      <FormField label="Breed" value={draft.pet.breed} onChange={(event) => onPetFieldChange('breed', event.target.value)} />
      <FormField
        label="Age"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={draft.pet.age}
        onChange={(event) => onPetFieldChange('age', event.target.value)}
        error={getFieldError('pet.age') ?? undefined}
      />
      <FormField
        label="Weight (kg)"
        type="number"
        min={0}
        step={0.1}
        value={draft.pet.weight}
        onChange={(event) => onPetFieldChange('weight', event.target.value)}
        error={getFieldError('pet.weight') ?? undefined}
      />
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Gender</label>
        <select
          value={normalizePetGenderValue(draft.pet.gender)}
          onChange={(event) => onPetFieldChange('gender', normalizePetGenderValue(event.target.value))}
          className="w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      <FormField
        label="Date of birth"
        type="date"
        min={minDate}
        max={maxDate}
        value={draft.pet.dateOfBirth}
        onChange={(event) => onPetFieldChange('dateOfBirth', event.target.value)}
        error={getFieldError('pet.dateOfBirth') ?? undefined}
      />
      <FormField
        label="Microchip number"
        value={draft.pet.microchipNumber}
        onChange={(event) => onPetFieldChange('microchipNumber', event.target.value)}
      />
      <FormField label="Color" value={draft.pet.color} onChange={(event) => onPetFieldChange('color', event.target.value)} />
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Size category</label>
        <select
          value={normalizeSizeCategoryValue(draft.pet.sizeCategory)}
          onChange={(event) => onPetFieldChange('sizeCategory', normalizeSizeCategoryValue(event.target.value))}
          className="w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Select size</option>
          {SIZE_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>{toTitleCaseLabel(option)}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Energy level</label>
        <select
          value={draft.pet.energyLevel}
          onChange={(event) => onPetFieldChange('energyLevel', event.target.value)}
          className="w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Select level</option>
          {ENERGY_LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option}>{toTitleCaseLabel(option)}</option>
          ))}
        </select>
      </div>
      <FormField
        label="Allergies"
        value={draft.pet.allergies}
        onChange={(event) => onPetFieldChange('allergies', event.target.value)}
        className="lg:col-span-2"
      />
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
        <input
          type="checkbox"
          checked={draft.pet.neuteredSpayed}
          onChange={(event) => onPetFieldChange('neuteredSpayed', event.target.checked)}
        />
        {' '}Neutered/Spayed
      </label>
    </>
  );
}
