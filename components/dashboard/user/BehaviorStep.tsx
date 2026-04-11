'use client';

import FormField from '@/components/dashboard/FormField';
import type { PassportDraft } from './types';
import { AGGRESSION_OPTIONS, SOCIAL_COMPATIBILITY_OPTIONS } from './constants';
import { normalizeSocialCompatibilityValue } from './utils';

type Props = {
  draft: PassportDraft;
  onPetFieldChange: <K extends keyof PassportDraft['pet']>(key: K, value: PassportDraft['pet'][K]) => void;
  getFieldError: (path: string) => string | null;
};

export default function BehaviorStep({ draft, onPetFieldChange, getFieldError }: Props) {
  const selectClass =
    'w-full rounded-xl border border-[#e8cfb7] bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30';
  const checkboxClass =
    'flex cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md';

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Aggression level</label>
        <select
          value={draft.pet.aggressionLevel}
          onChange={(event) => onPetFieldChange('aggressionLevel', event.target.value)}
          className={selectClass}
        >
          <option value="">Select level</option>
          {AGGRESSION_OPTIONS.map((option) => (
            <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </div>
      <FormField
        label="Bite incidents count"
        type="number"
        min={0}
        value={draft.pet.biteIncidentsCount}
        onChange={(event) => onPetFieldChange('biteIncidentsCount', event.target.value)}
        error={getFieldError('pet.biteIncidentsCount') ?? undefined}
      />
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Social with dogs</label>
        <select
          value={normalizeSocialCompatibilityValue(draft.pet.socialWithDogs)}
          onChange={(event) => onPetFieldChange('socialWithDogs', normalizeSocialCompatibilityValue(event.target.value))}
          className={selectClass}
        >
          <option value="">Select response</option>
          {SOCIAL_COMPATIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Social with cats</label>
        <select
          value={normalizeSocialCompatibilityValue(draft.pet.socialWithCats)}
          onChange={(event) => onPetFieldChange('socialWithCats', normalizeSocialCompatibilityValue(event.target.value))}
          className={selectClass}
        >
          <option value="">Select response</option>
          {SOCIAL_COMPATIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-900">Social with children</label>
        <select
          value={normalizeSocialCompatibilityValue(draft.pet.socialWithChildren)}
          onChange={(event) => onPetFieldChange('socialWithChildren', normalizeSocialCompatibilityValue(event.target.value))}
          className={selectClass}
        >
          <option value="">Select response</option>
          {SOCIAL_COMPATIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <label className={checkboxClass}>
        <input
          type="checkbox"
          checked={draft.pet.isBiteHistory}
          onChange={(event) => onPetFieldChange('isBiteHistory', event.target.checked)}
        />
        {' '}Bite history
      </label>
      <label className={checkboxClass}>
        <input
          type="checkbox"
          checked={draft.pet.houseTrained}
          onChange={(event) => onPetFieldChange('houseTrained', event.target.checked)}
        />
        {' '}House trained
      </label>
      <label className={checkboxClass}>
        <input
          type="checkbox"
          checked={draft.pet.leashTrained}
          onChange={(event) => onPetFieldChange('leashTrained', event.target.checked)}
        />
        {' '}Leash trained
      </label>
      <label className={checkboxClass}>
        <input
          type="checkbox"
          checked={draft.pet.crateTrained}
          onChange={(event) => onPetFieldChange('crateTrained', event.target.checked)}
        />
        {' '}Crate trained
      </label>
      <label className={checkboxClass}>
        <input
          type="checkbox"
          checked={draft.pet.separationAnxiety}
          onChange={(event) => onPetFieldChange('separationAnxiety', event.target.checked)}
        />
        {' '}Separation anxiety
      </label>
      <label className={checkboxClass}>
        <input
          type="checkbox"
          checked={draft.pet.hasDisability}
          onChange={(event) => {
            onPetFieldChange('hasDisability', event.target.checked);
            if (!event.target.checked) {
              onPetFieldChange('disabilityDetails', '');
            }
          }}
        />
        {' '}Pet has disability
      </label>
      {draft.pet.hasDisability ? (
        <FormField
          label="Disability details"
          value={draft.pet.disabilityDetails}
          onChange={(event) => onPetFieldChange('disabilityDetails', event.target.value)}
          placeholder="Mention disability and care instructions"
          className="lg:col-span-3"
        />
      ) : null}
    </>
  );
}
