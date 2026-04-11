'use client';

import { useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/dashboard/SectionCard';
import PetStepper from '@/components/dashboard/PetStepper';
import type { PassportDraft, VaccinationDraft, MedicalDraft } from './types';
import { STEPS, STEP_DESCRIPTIONS } from './constants';
import BasicInfoStep from './BasicInfoStep';
import BehaviorStep from './BehaviorStep';
import VaccinationsStep from './VaccinationsStep';
import MedicalRecordsStep from './MedicalRecordsStep';
import FeedingStep from './FeedingStep';
import GroomingStep from './GroomingStep';
import EmergencyStep from './EmergencyStep';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  stepIndex: number;
  highlightStepIndex: number | null;
  stepCompletion: readonly boolean[];
  draft: PassportDraft;
  expandedVaccinations: Record<number, boolean>;
  expandedMedicalRecords: Record<number, boolean>;
  fieldErrors: Record<string, string>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'draft-saved' | 'error';
  lastDraftSavedAt: string | null;
  isPending: boolean;
  isLoadingProfile: boolean;
  selectedPetId: number | null;
  canEditSelectedPet: boolean;

  // Step navigation
  onStepClick: (index: number) => void;
  onPreviousStep: () => void;
  onNextOrComplete: () => void;

  // Draft management
  onSaveDraft: () => void;
  onSaveStep: () => void;
  onJumpToFirstError: () => void;

  // Pet field updates
  petPhotoPreviewUrl: string | null;
  selectedPhotoFileName: string | null;
  canRemovePhoto: boolean;
  onPetPhotoFileChange: (file: File | null) => void;
  onRemovePhoto: () => void;
  onPetFieldChange: <K extends keyof PassportDraft['pet']>(key: K, value: PassportDraft['pet'][K]) => void;

  // Vaccination updates
  onToggleVaccinationExpand: (index: number) => void;
  onAddVaccination: () => void;
  onRemoveVaccination: (index: number) => void;
  onDuplicateVaccination: (index: number) => void;
  onVaccinationFieldChange: <K extends keyof VaccinationDraft>(
    index: number,
    key: K,
    value: VaccinationDraft[K],
    capitalize?: boolean,
  ) => void;
  onVaccinationCertificateUrlChange: (index: number, value: string) => void;

  // Medical record updates
  onToggleMedicalExpand: (index: number) => void;
  onAddMedicalRecord: () => void;
  onRemoveMedicalRecord: (index: number) => void;
  onMedicalFieldChange: <K extends keyof MedicalDraft>(
    index: number,
    key: K,
    value: MedicalDraft[K],
    capitalize?: boolean,
  ) => void;
  onMedicalDocumentUrlChange: (index: number, value: string) => void;

  // Feeding updates
  onFeedingFieldChange: <K extends keyof PassportDraft['feedingInfo']>(
    key: K,
    value: PassportDraft['feedingInfo'][K],
    capitalize?: boolean,
  ) => void;
  onTreatsAllowedChange: (value: boolean) => void;

  // Grooming updates
  onGroomingFieldChange: <K extends keyof PassportDraft['groomingInfo']>(
    key: K,
    value: PassportDraft['groomingInfo'][K],
    capitalize?: boolean,
  ) => void;
  onLastGroomingDateChange: (value: string) => void;
  onMattingProneChange: (value: boolean) => void;

  // Emergency updates
  onEmergencyFieldChange: <K extends keyof PassportDraft['emergencyInfo']>(
    key: K,
    value: PassportDraft['emergencyInfo'][K],
    capitalize?: boolean,
  ) => void;
  onEmergencyPhoneChange: (key: 'emergencyContactPhone' | 'preferredVetPhone', value: string) => void;
  onEmergencyPhoneBlur: (key: 'emergencyContactPhone' | 'preferredVetPhone', value: string) => void;

  getFieldError: (path: string) => string | null;
};

export default function PassportEditorModal({
  isOpen,
  onClose,
  stepIndex,
  highlightStepIndex,
  stepCompletion,
  draft,
  expandedVaccinations,
  expandedMedicalRecords,
  fieldErrors,
  saveStatus,
  lastDraftSavedAt,
  isPending,
  isLoadingProfile,
  selectedPetId,
  canEditSelectedPet,
  onStepClick,
  onPreviousStep,
  onNextOrComplete,
  onSaveDraft,
  onSaveStep,
  onJumpToFirstError,
  petPhotoPreviewUrl,
  selectedPhotoFileName,
  canRemovePhoto,
  onPetPhotoFileChange,
  onRemovePhoto,
  onPetFieldChange,
  onToggleVaccinationExpand,
  onAddVaccination,
  onRemoveVaccination,
  onDuplicateVaccination,
  onVaccinationFieldChange,
  onVaccinationCertificateUrlChange,
  onToggleMedicalExpand,
  onAddMedicalRecord,
  onRemoveMedicalRecord,
  onMedicalFieldChange,
  onMedicalDocumentUrlChange,
  onFeedingFieldChange,
  onTreatsAllowedChange,
  onGroomingFieldChange,
  onLastGroomingDateChange,
  onMattingProneChange,
  onEmergencyFieldChange,
  onEmergencyPhoneChange,
  onEmergencyPhoneBlur,
  getFieldError,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Pet Passport" size="xl">
      <SectionCard
        title="Pet Passport Editor"
        description={STEP_DESCRIPTIONS[stepIndex]}
        highlight={highlightStepIndex === stepIndex}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600" role="status" aria-live="polite">
            {saveStatus === 'saving' ? 'Saving to cloud\u2026' : null}
            {saveStatus === 'saved' ? 'Saved successfully.' : null}
            {saveStatus === 'draft-saved' && lastDraftSavedAt
              ? `Draft auto-saved at ${new Date(lastDraftSavedAt).toLocaleTimeString()}`
              : null}
            {saveStatus === 'error' ? 'Last save failed. Please retry.' : null}
            {saveStatus === 'idle' ? 'Use Save Step to persist each section.' : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!canEditSelectedPet}
              className="rounded-full border border-[#e1bf9e] bg-[#fff8f1] px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            >
              Save Draft
            </button>
            <Button
              type="button"
              size="sm"
              onClick={onSaveStep}
              disabled={!selectedPetId || isPending || !canEditSelectedPet}
              className="rounded-xl px-3 py-1.5"
            >
              {isPending ? 'Saving...' : 'Save Step'}
            </Button>
            {Object.keys(fieldErrors).length > 0 ? (
              <button
                type="button"
                onClick={onJumpToFirstError}
                className="rounded-xl border border-[#e1bf9e] bg-[#fff8f1] px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
              >
                Jump to Error
              </button>
            ) : null}
          </div>
        </div>

        <PetStepper
          steps={[...STEPS]}
          currentStep={stepIndex}
          completedSteps={[...stepCompletion]}
          onStepClick={onStepClick}
        />

        {isLoadingProfile ? <p className="text-sm text-neutral-600">Loading profile...</p> : null}
        {!selectedPetId ? <p className="text-sm text-neutral-600">Select a pet to start.</p> : null}

        {selectedPetId && !isLoadingProfile ? (
          <div
            key={`editor-step-${stepIndex}`}
            ref={editorRef}
            className="grid gap-4 rounded-2xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff7ef_100%)] p-4 opacity-100 shadow-[0_12px_24px_rgba(147,101,63,0.08)] transition-all duration-150 ease-out sm:grid-cols-2 lg:grid-cols-3"
          >
            {stepIndex === 0 ? (
              <BasicInfoStep
                draft={draft}
                petPhotoPreviewUrl={petPhotoPreviewUrl}
                selectedPhotoFileName={selectedPhotoFileName}
                canRemovePhoto={canRemovePhoto}
                onPetPhotoFileChange={onPetPhotoFileChange}
                onRemovePhoto={onRemovePhoto}
                onPetFieldChange={onPetFieldChange}
                getFieldError={getFieldError}
              />
            ) : null}

            {stepIndex === 1 ? (
              <BehaviorStep
                draft={draft}
                onPetFieldChange={onPetFieldChange}
                getFieldError={getFieldError}
              />
            ) : null}

            {stepIndex === 2 ? (
              <VaccinationsStep
                vaccinations={draft.vaccinations}
                expandedVaccinations={expandedVaccinations}
                onToggleExpand={onToggleVaccinationExpand}
                onAddVaccination={onAddVaccination}
                onRemoveVaccination={onRemoveVaccination}
                onDuplicateVaccination={onDuplicateVaccination}
                onVaccinationFieldChange={onVaccinationFieldChange}
                onVaccinationCertificateUrlChange={onVaccinationCertificateUrlChange}
                getFieldError={getFieldError}
              />
            ) : null}

            {stepIndex === 3 ? (
              <MedicalRecordsStep
                medicalRecords={draft.medicalRecords}
                expandedMedicalRecords={expandedMedicalRecords}
                onToggleExpand={onToggleMedicalExpand}
                onAddMedicalRecord={onAddMedicalRecord}
                onRemoveMedicalRecord={onRemoveMedicalRecord}
                onMedicalFieldChange={onMedicalFieldChange}
                onMedicalDocumentUrlChange={onMedicalDocumentUrlChange}
                getFieldError={getFieldError}
              />
            ) : null}

            {stepIndex === 4 ? (
              <FeedingStep
                feedingInfo={draft.feedingInfo}
                onFeedingFieldChange={onFeedingFieldChange}
                onTreatsAllowedChange={onTreatsAllowedChange}
              />
            ) : null}

            {stepIndex === 5 ? (
              <GroomingStep
                groomingInfo={draft.groomingInfo}
                onGroomingFieldChange={onGroomingFieldChange}
                onLastGroomingDateChange={onLastGroomingDateChange}
                onMattingProneChange={onMattingProneChange}
              />
            ) : null}

            {stepIndex === 6 ? (
              <EmergencyStep
                emergencyInfo={draft.emergencyInfo}
                onEmergencyFieldChange={onEmergencyFieldChange}
                onEmergencyPhoneChange={onEmergencyPhoneChange}
                onEmergencyPhoneBlur={onEmergencyPhoneBlur}
                getFieldError={getFieldError}
              />
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-4">
        <div className="text-xs text-neutral-600">
          Step {stepIndex + 1} of {STEPS.length}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onPreviousStep}
            disabled={stepIndex === 0 || isPending}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onNextOrComplete}
            disabled={isPending || !canEditSelectedPet}
          >
            {stepIndex === STEPS.length - 1 ? 'Complete' : 'Next'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
