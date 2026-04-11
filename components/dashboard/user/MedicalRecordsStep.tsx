'use client';

import Button from '@/components/ui/Button';
import FormField from '@/components/dashboard/FormField';
import MedicalRecordCard from '@/components/dashboard/MedicalRecordCard';
import EmptyState from '@/components/dashboard/EmptyState';
import type { PassportDraft, MedicalDraft } from './types';

type Props = {
  medicalRecords: PassportDraft['medicalRecords'];
  expandedMedicalRecords: Record<number, boolean>;
  onToggleExpand: (index: number) => void;
  onAddMedicalRecord: () => void;
  onRemoveMedicalRecord: (index: number) => void;
  onMedicalFieldChange: <K extends keyof MedicalDraft>(
    index: number,
    key: K,
    value: MedicalDraft[K],
    capitalize?: boolean,
  ) => void;
  onMedicalDocumentUrlChange: (index: number, value: string) => void;
  getFieldError: (path: string) => string | null;
};

export default function MedicalRecordsStep({
  medicalRecords,
  expandedMedicalRecords,
  onToggleExpand,
  onAddMedicalRecord,
  onRemoveMedicalRecord,
  onMedicalFieldChange,
  onMedicalDocumentUrlChange,
  getFieldError,
}: Props) {
  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      {medicalRecords.length === 0 ? (
        <EmptyState
          icon="🩺"
          title="No medical records"
          description="Add a condition record to keep treatment history complete."
        />
      ) : null}

      {medicalRecords.map((row, index) => (
        <MedicalRecordCard
          key={`${row.id ?? 'new'}-${index}`}
          conditionName={row.conditionName || 'Untitled condition'}
          ongoing={row.ongoing}
          diagnosisDate={row.diagnosisDate || undefined}
          medications={row.medications || undefined}
          vetName={row.vetName || undefined}
          isExpanded={Boolean(expandedMedicalRecords[index])}
          onToggleExpand={() => onToggleExpand(index)}
          onDelete={() => onRemoveMedicalRecord(index)}
          onEdit={() => onToggleExpand(index)}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="Condition name"
              value={row.conditionName}
              onChange={(event) => onMedicalFieldChange(index, 'conditionName', event.target.value, true)}
              error={getFieldError(`medicalRecords.${index}.conditionName`) ?? undefined}
            />
            <FormField
              label="Diagnosis date"
              type="date"
              value={row.diagnosisDate}
              onChange={(event) => onMedicalFieldChange(index, 'diagnosisDate', event.target.value)}
            />
            <FormField
              label="Medications"
              value={row.medications}
              onChange={(event) => onMedicalFieldChange(index, 'medications', event.target.value, true)}
            />
            <FormField
              label="Vet name"
              value={row.vetName}
              onChange={(event) => onMedicalFieldChange(index, 'vetName', event.target.value, true)}
            />
            <FormField
              label="Special care"
              value={row.specialCareInstructions}
              onChange={(event) => onMedicalFieldChange(index, 'specialCareInstructions', event.target.value, true)}
              className="lg:col-span-2"
            />
            <FormField
              label="Document URL"
              value={row.documentUrl}
              onChange={(event) => onMedicalDocumentUrlChange(index, event.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <input
                type="checkbox"
                checked={row.ongoing}
                onChange={(event) => onMedicalFieldChange(index, 'ongoing', event.target.checked)}
              />
              {' '}Ongoing condition
            </label>
          </div>
        </MedicalRecordCard>
      ))}

      <Button type="button" onClick={onAddMedicalRecord} className="rounded-xl px-4 py-2">
        Add Medical Record
      </Button>
    </div>
  );
}
