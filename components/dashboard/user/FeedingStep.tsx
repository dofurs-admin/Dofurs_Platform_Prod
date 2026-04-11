'use client';

import FormField from '@/components/dashboard/FormField';
import type { PassportDraft } from './types';
import { normalizePositiveIntegerValue } from './utils';

type Props = {
  feedingInfo: PassportDraft['feedingInfo'];
  onFeedingFieldChange: <K extends keyof PassportDraft['feedingInfo']>(
    key: K,
    value: PassportDraft['feedingInfo'][K],
    capitalize?: boolean,
  ) => void;
  onTreatsAllowedChange: (value: boolean) => void;
};

export default function FeedingStep({ feedingInfo, onFeedingFieldChange, onTreatsAllowedChange }: Props) {
  return (
    <>
      <FormField
        label="Food type"
        value={feedingInfo.foodType}
        onChange={(event) => onFeedingFieldChange('foodType', event.target.value, true)}
      />
      <FormField
        label="Brand name"
        value={feedingInfo.brandName}
        onChange={(event) => onFeedingFieldChange('brandName', event.target.value, true)}
      />
      <FormField
        label="Feeding schedule (times/day)"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={normalizePositiveIntegerValue(feedingInfo.feedingSchedule)}
        onChange={(event) => onFeedingFieldChange('feedingSchedule', normalizePositiveIntegerValue(event.target.value))}
        placeholder="Ex: 2"
        helperText="How many times per day do you feed your pet?"
        className="lg:col-span-2"
      />
      <FormField
        label="Food allergies"
        value={feedingInfo.foodAllergies}
        onChange={(event) => onFeedingFieldChange('foodAllergies', event.target.value, true)}
      />
      <FormField
        label="Special diet notes"
        value={feedingInfo.specialDietNotes}
        onChange={(event) => onFeedingFieldChange('specialDietNotes', event.target.value, true)}
        className="lg:col-span-2"
      />
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
        <input
          type="checkbox"
          checked={feedingInfo.treatsAllowed}
          onChange={(event) => onTreatsAllowedChange(event.target.checked)}
        />
        {' '}Treats allowed
      </label>
    </>
  );
}
