'use client';

import Button from '@/components/ui/Button';
import { STEPS } from './constants';

type Props = {
  stepCompletion: readonly boolean[];
  missingSteps: Array<{ label: string; index: number }>;
  canEditSelectedPet: boolean;
  canShareSelectedPet: boolean;
  selectedPetId: number;
  onSaveDraft: () => void;
  onSharePet: () => void;
  onEditPassport: () => void;
  onJumpToStep: (index: number) => void;
  onShowToastNoEdit: () => void;
};

export default function PassportSnapshot({
  stepCompletion,
  missingSteps,
  canEditSelectedPet,
  canShareSelectedPet,
  onSaveDraft,
  onSharePet,
  onEditPassport,
  onJumpToStep,
  onShowToastNoEdit,
}: Props) {
  return (
    <section className="rounded-2xl border border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-6 shadow-[0_16px_30px_rgba(147,101,63,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Passport Snapshot</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onSaveDraft}>
            Save Draft
          </Button>
          {canShareSelectedPet ? (
            <Button type="button" variant="secondary" size="sm" onClick={onSharePet}>
              Share Pet
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onEditPassport} disabled={!canEditSelectedPet}>
            Edit Passport
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Review your pet passport details first. Editing is available via the guided step-by-step modal.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {STEPS.map((step, index) => (
          <button
            key={step}
            type="button"
            onClick={() => {
              if (!canEditSelectedPet) {
                onShowToastNoEdit();
                return;
              }
              onJumpToStep(index);
            }}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 ${stepCompletion[index] ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800' : 'border-[#ead3bf] bg-[#fffaf4] text-neutral-700'}`}
          >
            <span>{step}</span>
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${stepCompletion[index] ? 'bg-emerald-500 text-white' : 'bg-[#f1dfcf] text-[#7d5a3b]'}`}
            >
              {stepCompletion[index] ? '✓' : '•'}
            </span>
          </button>
        ))}
      </div>
      {missingSteps.length > 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          Missing: {missingSteps.map((item) => item.label).join(', ')}
        </p>
      ) : (
        <p className="mt-3 text-xs font-medium text-emerald-700">All passport sections are completed.</p>
      )}
    </section>
  );
}
