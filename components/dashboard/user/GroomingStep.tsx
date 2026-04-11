'use client';

import FormField from '@/components/dashboard/FormField';
import type { PassportDraft } from './types';
import { normalizeGroomingFrequencyValue, normalizePositiveIntegerValue } from './utils';

type Props = {
  groomingInfo: PassportDraft['groomingInfo'];
  onGroomingFieldChange: <K extends keyof PassportDraft['groomingInfo']>(
    key: K,
    value: PassportDraft['groomingInfo'][K],
    capitalize?: boolean,
  ) => void;
  onLastGroomingDateChange: (value: string) => void;
  onMattingProneChange: (value: boolean) => void;
};

export default function GroomingStep({
  groomingInfo,
  onGroomingFieldChange,
  onLastGroomingDateChange,
  onMattingProneChange,
}: Props) {
  return (
    <>
      <FormField
        label="Coat type"
        value={groomingInfo.coatType}
        onChange={(event) => onGroomingFieldChange('coatType', event.target.value, true)}
        placeholder="Ex: Double coat"
        helperText="Describe coat texture/type for better grooming planning."
      />
      <FormField
        label="Grooming frequency (days)"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={normalizeGroomingFrequencyValue(groomingInfo.groomingFrequency)}
        onChange={(event) => onGroomingFieldChange('groomingFrequency', normalizeGroomingFrequencyValue(event.target.value))}
        placeholder="Ex: 21"
        helperText="Set how many days should pass between full grooming sessions."
      />
      <FormField
        label="Last grooming"
        type="date"
        value={groomingInfo.lastGroomingDate}
        onChange={(event) => onLastGroomingDateChange(event.target.value)}
      />
      <FormField
        label="Nail trim frequency (days)"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={normalizePositiveIntegerValue(groomingInfo.nailTrimFrequency)}
        onChange={(event) => onGroomingFieldChange('nailTrimFrequency', normalizePositiveIntegerValue(event.target.value))}
        placeholder="Ex: 14"
        helperText="How many days between nail trims?"
      />
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
        <input
          type="checkbox"
          checked={groomingInfo.mattingProne}
          onChange={(event) => onMattingProneChange(event.target.checked)}
        />
        {' '}Matting prone
      </label>
    </>
  );
}
