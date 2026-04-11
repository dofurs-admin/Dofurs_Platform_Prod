'use client';

import Button from '@/components/ui/Button';
import FormField from '@/components/dashboard/FormField';
import VaccinationCard from '@/components/dashboard/VaccinationCard';
import EmptyState from '@/components/dashboard/EmptyState';
import type { PassportDraft, VaccinationDraft } from './types';
import { vaccinationStatus } from './utils';

type Props = {
  vaccinations: PassportDraft['vaccinations'];
  expandedVaccinations: Record<number, boolean>;
  onToggleExpand: (index: number) => void;
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
  getFieldError: (path: string) => string | null;
};

export default function VaccinationsStep({
  vaccinations,
  expandedVaccinations,
  onToggleExpand,
  onAddVaccination,
  onRemoveVaccination,
  onDuplicateVaccination,
  onVaccinationFieldChange,
  onVaccinationCertificateUrlChange,
  getFieldError,
}: Props) {
  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      {vaccinations.length === 0 ? (
        <EmptyState
          icon="💉"
          title="No vaccination records"
          description="Add the first vaccine record to start tracking due dates."
        />
      ) : null}

      {vaccinations.map((row, index) => (
        <VaccinationCard
          key={`${row.id ?? 'new'}-${index}`}
          vaccineName={row.vaccineName || 'Untitled vaccine'}
          brandName={row.brandName}
          administeredDate={row.administeredDate || new Date().toISOString().slice(0, 10)}
          nextDueDate={row.nextDueDate || undefined}
          status={vaccinationStatus(row.nextDueDate)}
          isExpanded={Boolean(expandedVaccinations[index])}
          onToggleExpand={() => onToggleExpand(index)}
          onDelete={() => onRemoveVaccination(index)}
          onEdit={() => onToggleExpand(index)}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="Vaccine name"
              value={row.vaccineName}
              onChange={(event) => onVaccinationFieldChange(index, 'vaccineName', event.target.value, true)}
              error={getFieldError(`vaccinations.${index}.vaccineName`) ?? undefined}
              maxLength={150}
              required
            />
            <FormField
              label="Brand"
              value={row.brandName}
              onChange={(event) => onVaccinationFieldChange(index, 'brandName', event.target.value, true)}
              maxLength={150}
            />
            <FormField
              label="Batch"
              value={row.batchNumber}
              onChange={(event) => onVaccinationFieldChange(index, 'batchNumber', event.target.value, true)}
              maxLength={120}
            />
            <FormField
              label="Dose number"
              type="number"
              min={1}
              value={row.doseNumber}
              onChange={(event) => onVaccinationFieldChange(index, 'doseNumber', event.target.value)}
            />
            <FormField
              label="Administered"
              type="date"
              value={row.administeredDate}
              onChange={(event) => onVaccinationFieldChange(index, 'administeredDate', event.target.value)}
              error={getFieldError(`vaccinations.${index}.administeredDate`) ?? undefined}
              required
            />
            <FormField
              label="Next due"
              type="date"
              value={row.nextDueDate}
              onChange={(event) => onVaccinationFieldChange(index, 'nextDueDate', event.target.value)}
              error={getFieldError(`vaccinations.${index}.nextDueDate`) ?? undefined}
            />
            <FormField
              label="Veterinarian"
              value={row.veterinarianName}
              onChange={(event) => onVaccinationFieldChange(index, 'veterinarianName', event.target.value, true)}
              maxLength={150}
            />
            <FormField
              label="Clinic"
              value={row.clinicName}
              onChange={(event) => onVaccinationFieldChange(index, 'clinicName', event.target.value, true)}
              maxLength={150}
            />
            <FormField
              label="Certificate URL"
              value={row.certificateUrl}
              onChange={(event) => onVaccinationCertificateUrlChange(index, event.target.value)}
              className="lg:col-span-2"
              maxLength={500}
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <input
                type="checkbox"
                checked={row.reminderEnabled}
                onChange={(event) => onVaccinationFieldChange(index, 'reminderEnabled', event.target.checked)}
              />
              {' '}Reminder enabled
            </label>
            <button
              type="button"
              onClick={() => onDuplicateVaccination(index)}
              className="rounded-xl border border-[#e1bf9e] bg-[#fff8f1] px-3 py-2 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            >
              Duplicate
            </button>
          </div>
        </VaccinationCard>
      ))}

      <Button type="button" onClick={onAddVaccination} className="rounded-xl px-4 py-2">
        Add Vaccination
      </Button>
    </div>
  );
}
