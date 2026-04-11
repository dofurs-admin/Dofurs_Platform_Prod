'use client';

import Modal from '@/components/ui/Modal';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import Button from '@/components/ui/Button';
import { calculateAgeFromDOB } from '@/lib/utils/date';
import { ClipboardList, Brain, Users, PhoneCall, Utensils, Scissors, Syringe, Stethoscope } from 'lucide-react';

type VaccinationRecord = {
  id: string;
  vaccine_name: string;
  brand_name: string | null;
  batch_number: string | null;
  dose_number: number | null;
  administered_date: string;
  next_due_date: string | null;
  veterinarian_name: string | null;
  clinic_name: string | null;
  certificate_url: string | null;
  reminder_enabled: boolean;
};

type MedicalRecord = {
  id: string;
  condition_name: string;
  diagnosis_date: string | null;
  ongoing: boolean;
  medications: string | null;
  special_care_instructions: string | null;
  vet_name: string | null;
  document_url: string | null;
};

export type PetPassportData = {
  pet: {
    id: number;
    name: string;
    breed: string | null;
    age: number | null;
    weight: number | null;
    gender: string | null;
    allergies: string | null;
    photo_url: string | null;
    date_of_birth?: string | null;
    microchip_number?: string | null;
    neutered_spayed?: boolean;
    color?: string | null;
    size_category?: string | null;
    energy_level?: string | null;
    aggression_level?: string | null;
    is_bite_history?: boolean;
    bite_incidents_count?: number;
    house_trained?: boolean;
    leash_trained?: boolean;
    crate_trained?: boolean;
    social_with_dogs?: string | null;
    social_with_cats?: string | null;
    social_with_children?: string | null;
    separation_anxiety?: boolean;
  };
  vaccinations: VaccinationRecord[];
  medicalRecords: MedicalRecord[];
  feedingInfo: {
    food_type: string | null;
    brand_name: string | null;
    feeding_schedule: string | null;
    food_allergies: string | null;
    special_diet_notes: string | null;
    treats_allowed: boolean;
  } | null;
  groomingInfo: {
    coat_type: string | null;
    matting_prone: boolean;
    grooming_frequency: string | null;
    last_grooming_date: string | null;
    nail_trim_frequency: string | null;
  } | null;
  emergencyInfo: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    preferred_vet_clinic: string | null;
    preferred_vet_phone: string | null;
  } | null;
};

type PetPassportViewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  data: PetPassportData | null;
  photoUrl: string | null;
  isLoading?: boolean;
  onEdit?: () => void;
};

function InfoRow({ label, value, highlight = false }: { label: string; value: string | number | boolean | null | undefined; highlight?: boolean }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);

  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-[#d5cab7]/60 py-2 last:border-0 ${
        highlight ? 'rounded bg-[#fff4dd]/60 px-2' : ''
      }`}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a7568] sm:text-[11px]">{label}</span>
      <span className="text-right text-[13px] font-semibold text-[#1f1e1b] sm:text-sm">{displayValue}</span>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 border-b border-[#c9baa4]/70 pb-2.5">
      {icon && <span className="flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center text-[#8b6e4e]">{icon}</span>}
      <h3 className="flex-1 font-['Cormorant_Garamond','Times_New_Roman',serif] text-lg font-bold tracking-[0.04em] text-[#151a28] sm:text-xl">{children}</h3>
      <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6b6a66] sm:inline">Verified</span>
    </div>
  );
}

function PassportSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[#cdbda6]/80 bg-[linear-gradient(180deg,#fdf8ef_0%,#f5efdf_100%)] p-4 shadow-[0_8px_20px_rgba(62,54,39,0.08)] sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toTitleCase(str: string | null) {
  if (!str) return null;
  return str
    .replaceAll('_', ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getVaccinationStatus(nextDueDate: string | null) {
  if (!nextDueDate) return { label: 'Complete', color: 'text-emerald-700', bgColor: 'bg-emerald-100/80' };

  const today = new Date();
  const dueDate = new Date(nextDueDate);
  const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) return { label: 'Overdue', color: 'text-rose-700', bgColor: 'bg-rose-100/85' };
  if (diffInDays <= 14) return { label: 'Due Soon', color: 'text-amber-700', bgColor: 'bg-amber-100/85' };
  return { label: 'Up to Date', color: 'text-emerald-700', bgColor: 'bg-emerald-100/80' };
}

function toPassportCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
}

function buildPassportNumber(petId: number) {
  return `IN-DPF-${String(petId).padStart(6, '0')}`;
}

function buildMrzLines(data: PetPassportData) {
  const nameCode = toPassportCode(data.pet.name || 'PET');
  const breedCode = toPassportCode(toTitleCase(data.pet.breed) || 'DOMESTIC');
  const chipCode = toPassportCode(data.pet.microchip_number || buildPassportNumber(data.pet.id));
  const dobCode = toPassportCode(formatDate(data.pet.date_of_birth ?? null) || 'UNKNOWN');

  return [
    `P<INDDOFURS<<${nameCode}<${breedCode}`,
    `${chipCode}<${dobCode}<${String(data.pet.id).padStart(6, '0')}IND`,
  ];
}

function getStampRotation(index: number) {
  const rotations = ['rotate-[-18deg]', 'rotate-[-11deg]', 'rotate-[-7deg]', 'rotate-[9deg]', 'rotate-[13deg]'];
  return rotations[index % rotations.length];
}

function getVisaRotation(index: number) {
  const rotations = ['rotate-[-9deg]', 'rotate-[7deg]', 'rotate-[-5deg]', 'rotate-[11deg]'];
  return rotations[index % rotations.length];
}

export default function PetPassportViewModal({ isOpen, onClose, data, photoUrl, isLoading, onEdit }: PetPassportViewModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pet Passport" size="xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-coral border-t-transparent"></div>
            <p className="mt-4 text-sm text-neutral-600">Loading passport...</p>
          </div>
        </div>
      ) : !data || !data.pet ? (
        <div className="text-center py-12">
          <p className="text-neutral-600">No data available</p>
        </div>
      ) : (
        (() => {
          const passportNumber = buildPassportNumber(data.pet.id);
          const issuedOn = formatDate(data.pet.date_of_birth ?? null) || formatDate(new Date().toISOString());
          const mrzLines = buildMrzLines(data);
          const resolvedAge = typeof data.pet.age === 'number' && Number.isFinite(data.pet.age)
            ? data.pet.age
            : calculateAgeFromDOB(data.pet.date_of_birth ?? null);

          return (
        <div className="passport-document max-h-[80vh] space-y-4 overflow-y-auto custom-scrollbar sm:space-y-6">

          {/* — Main Passport Card — */}
          <article className="relative overflow-hidden rounded-[20px] border border-[#ab9a80]/80 bg-[radial-gradient(circle_at_8%_0%,#fff9ef_0%,#f2e8d6_46%,#ebdfcc_100%)] shadow-[0_16px_36px_rgba(43,37,28,0.18)] sm:rounded-[24px]">

            {/* Dofurs brand header */}
            <div className="relative border-b border-[#b87444] bg-[linear-gradient(100deg,#ba6630_0%,#e39a5d_45%,#c5763f_100%)] px-4 py-3 text-[#fff4e8] sm:px-7 sm:py-4">
              <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#ffe3c8] sm:text-[10px] sm:tracking-[0.28em]">Republic Of Pets</p>
              <div className="mt-1 flex items-end justify-between gap-2 sm:gap-3">
                <h2 className="whitespace-nowrap font-['Cormorant_Garamond','Times_New_Roman',serif] text-xl font-semibold tracking-[0.06em] text-[#fff8ef] sm:text-3xl">
                  Pet Passport
                </h2>
                <p className="shrink-0 whitespace-nowrap rounded border border-[#f0bb8b]/70 bg-[#9f5223]/70 px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-[#fff3e6] sm:px-2.5 sm:py-1 sm:text-xs">{passportNumber}</p>
              </div>
            </div>

            {/* Photo + Name row — always side-by-side */}
            <div className="relative p-4 sm:p-6 md:p-7">
              <div className="flex gap-4 sm:gap-5">
                {/* Photo — compact on mobile */}
                <div className="shrink-0">
                  <div className="relative overflow-hidden rounded-xl border border-[#8f7b5d] bg-[#f4ebd8] p-1.5 shadow-[0_8px_18px_rgba(76,61,38,0.12)] sm:p-2">
                    <div className="h-[100px] w-[80px] overflow-hidden rounded-lg border border-[#bba88e] bg-[#efe5d2] sm:h-[160px] sm:w-[130px]">
                      {photoUrl ? (
                        <StorageBackedImage
                          value={photoUrl}
                          bucket="pet-photos"
                          alt={`${data.pet.name} photo`}
                          width={160}
                          height={160}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#efe3cc,#e8d9be)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c654f] sm:text-sm">
                          Photo<br/>Pending
                        </div>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 sm:mt-2 sm:gap-2">
                      <div className="relative h-4 w-5 sm:h-5 sm:w-6" aria-hidden="true">
                        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-[#524f44] sm:top-2.5 sm:h-2.5 sm:w-2.5" />
                        <span className="absolute left-0 top-0.5 h-1 w-1 rounded-full bg-[#524f44] sm:top-1 sm:h-1.5 sm:w-1.5" />
                        <span className="absolute left-1.5 top-0 h-1 w-1 rounded-full bg-[#524f44] sm:h-1.5 sm:w-1.5" />
                        <span className="absolute left-3 top-0 h-1 w-1 rounded-full bg-[#524f44] sm:h-1.5 sm:w-1.5" />
                        <span className="absolute left-4 top-0.5 h-1 w-1 rounded-full bg-[#524f44] sm:left-4.5 sm:top-1 sm:h-1.5 sm:w-1.5" />
                      </div>
                      <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#635e4f] sm:text-[10px] sm:tracking-[0.12em]">Signature</span>
                    </div>
                  </div>
                </div>

                {/* Name + key details */}
                <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
                  <div className="border-b border-[#ccbca2]/70 pb-2 sm:pb-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5f5d58] sm:text-[10px]">Given Name</p>
                    <h3 className="font-['Cormorant_Garamond','Times_New_Roman',serif] text-2xl font-semibold leading-tight text-[#111827] sm:text-4xl">
                      {data.pet.name}
                    </h3>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[#4f5b73] sm:text-xs">{toTitleCase(data.pet.breed) || 'Domestic Companion'}</p>
                  </div>

                  {/* Quick stats — mobile visible */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:text-xs">
                    {formatDate(data.pet.date_of_birth ?? null) && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#7a7568] sm:text-[10px]">DOB</span>
                        <p className="font-semibold text-[#1f1e1b]">{formatDate(data.pet.date_of_birth ?? null)}</p>
                      </div>
                    )}
                    {data.pet.gender && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#7a7568] sm:text-[10px]">Sex</span>
                        <p className="font-semibold text-[#1f1e1b]">{toTitleCase(data.pet.gender)}</p>
                      </div>
                    )}
                    {data.pet.weight !== null && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#7a7568] sm:text-[10px]">Weight</span>
                        <p className="font-semibold text-[#1f1e1b]">{data.pet.weight} kg</p>
                      </div>
                    )}
                    {data.pet.microchip_number && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#7a7568] sm:text-[10px]">Microchip</span>
                        <p className="truncate font-semibold text-[#1f1e1b]">{data.pet.microchip_number}</p>
                      </div>
                    )}
                  </div>

                  {/* Issuing authority — hidden on smallest screens */}
                  <div className="hidden rounded-full border-2 border-[#9e2f2f]/60 px-3 py-1.5 text-center text-[#9e2f2f] sm:block sm:w-fit">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em]">Issuing Authority</p>
                    <p className="text-[10px] font-semibold">Dofurs Pet Registry • Bangalore</p>
                  </div>
                </div>
              </div>

              {/* Extended info grid — visible on scroll */}
              <div className="mt-4 grid gap-x-4 sm:mt-5 sm:grid-cols-2 sm:gap-x-6">
                <InfoRow label="Breed" value={toTitleCase(data.pet.breed)} />
                <InfoRow label="Color" value={toTitleCase(data.pet.color ?? null)} />
                <InfoRow label="Issue Date" value={issuedOn} />
                <InfoRow label="Animal ID" value={String(data.pet.id).padStart(6, '0')} />
              </div>

              {/* MRZ zone */}
              <div className="mt-4 rounded-lg border border-[#a58b6c]/70 bg-[#efe4ce]/80 p-2.5 sm:mt-5 sm:p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5e5a53] sm:text-[10px]">Machine Readable Zone</p>
                <p className="mt-1 overflow-hidden text-ellipsis font-mono text-[10px] leading-snug tracking-[0.04em] text-[#1b1f2a] sm:text-xs sm:tracking-[0.08em]">{mrzLines[0]}</p>
                <p className="overflow-hidden text-ellipsis font-mono text-[10px] leading-snug tracking-[0.04em] text-[#1b1f2a] sm:text-xs sm:tracking-[0.08em]">{mrzLines[1]}</p>
              </div>
            </div>
          </article>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <PassportSection>
              <SectionTitle icon={<ClipboardList className="h-full w-full" strokeWidth={1.6} />}>Basic Information</SectionTitle>
              <div>
                <InfoRow label="Date of Birth" value={formatDate(data.pet.date_of_birth ?? null)} />
                <InfoRow label="Age" value={resolvedAge !== null ? `${resolvedAge} years` : null} />
                <InfoRow label="Color" value={toTitleCase(data.pet.color ?? null)} />
                <InfoRow label="Size Category" value={toTitleCase(data.pet.size_category ?? null)} />
                <InfoRow label="Energy Level" value={toTitleCase(data.pet.energy_level ?? null)} />
                <InfoRow label="Neutered/Spayed" value={data.pet.neutered_spayed ?? false} />
                <InfoRow label="Allergies" value={data.pet.allergies} highlight={!!data.pet.allergies} />
              </div>
            </PassportSection>

            <PassportSection>
              <SectionTitle icon={<Brain className="h-full w-full" strokeWidth={1.6} />}>Behavior & Temperament</SectionTitle>
              <div>
                <InfoRow label="Aggression Level" value={toTitleCase(data.pet.aggression_level ?? null)} />
                <InfoRow label="Bite History" value={data.pet.is_bite_history ?? false} highlight={data.pet.is_bite_history} />
                {data.pet.is_bite_history && (
                  <InfoRow label="Bite Incidents" value={data.pet.bite_incidents_count ?? 0} highlight />
                )}
                <InfoRow label="House Trained" value={data.pet.house_trained ?? false} />
                <InfoRow label="Leash Trained" value={data.pet.leash_trained ?? false} />
                <InfoRow label="Crate Trained" value={data.pet.crate_trained ?? false} />
                <InfoRow label="Separation Anxiety" value={data.pet.separation_anxiety ?? false} highlight={data.pet.separation_anxiety} />
              </div>
            </PassportSection>

            <PassportSection>
              <SectionTitle icon={<Users className="h-full w-full" strokeWidth={1.6} />}>Social Compatibility</SectionTitle>
              <div>
                <InfoRow label="Social with Dogs" value={toTitleCase(data.pet.social_with_dogs ?? null)} />
                <InfoRow label="Social with Cats" value={toTitleCase(data.pet.social_with_cats ?? null)} />
                <InfoRow label="Social with Children" value={toTitleCase(data.pet.social_with_children ?? null)} />
              </div>
            </PassportSection>

            {data.emergencyInfo && (
              <PassportSection>
                <SectionTitle icon={<PhoneCall className="h-full w-full" strokeWidth={1.6} />}>Emergency Contacts</SectionTitle>
                <div>
                  <InfoRow label="Emergency Contact" value={data.emergencyInfo.emergency_contact_name} />
                  <InfoRow label="Emergency Phone" value={data.emergencyInfo.emergency_contact_phone} />
                  <InfoRow label="Preferred Vet Clinic" value={data.emergencyInfo.preferred_vet_clinic} />
                  <InfoRow label="Vet Phone" value={data.emergencyInfo.preferred_vet_phone} />
                </div>
              </PassportSection>
            )}
          </div>

          {data.feedingInfo && (
            <PassportSection>
              <SectionTitle icon={<Utensils className="h-full w-full" strokeWidth={1.6} />}>Feeding Information</SectionTitle>
              <div className="grid gap-x-4 sm:gap-x-6 md:grid-cols-2">
                <InfoRow label="Food Type" value={toTitleCase(data.feedingInfo.food_type)} />
                <InfoRow label="Brand Name" value={data.feedingInfo.brand_name} />
                <InfoRow label="Feeding Schedule" value={data.feedingInfo.feeding_schedule} />
                <InfoRow label="Treats Allowed" value={data.feedingInfo.treats_allowed} />
                <InfoRow label="Food Allergies" value={data.feedingInfo.food_allergies} highlight={!!data.feedingInfo.food_allergies} />
                <InfoRow label="Special Diet Notes" value={data.feedingInfo.special_diet_notes} />
              </div>
            </PassportSection>
          )}

          {data.groomingInfo && (
            <PassportSection>
              <SectionTitle icon={<Scissors className="h-full w-full" strokeWidth={1.6} />}>Grooming Information</SectionTitle>
              <div className="grid gap-x-4 sm:gap-x-6 md:grid-cols-2">
                <InfoRow label="Coat Type" value={toTitleCase(data.groomingInfo.coat_type)} />
                <InfoRow label="Matting Prone" value={data.groomingInfo.matting_prone} />
                <InfoRow label="Grooming Frequency" value={data.groomingInfo.grooming_frequency} />
                <InfoRow label="Nail Trim Frequency" value={data.groomingInfo.nail_trim_frequency} />
                <InfoRow label="Last Grooming Date" value={formatDate(data.groomingInfo.last_grooming_date)} />
              </div>
            </PassportSection>
          )}

          {data.vaccinations.length > 0 && (
            <PassportSection>
              <SectionTitle icon={<Syringe className="h-full w-full" strokeWidth={1.6} />}>Vaccination Ledger</SectionTitle>
              <div className="space-y-3">
                {data.vaccinations.map((vac, index) => {
                  const status = getVaccinationStatus(vac.next_due_date);
                  const stampRotation = getStampRotation(index);

                  return (
                    <div
                      key={vac.id}
                      className="relative overflow-hidden rounded-lg border border-[#d2c0a8] bg-[#fffaf0]/95 p-4 shadow-[0_8px_18px_rgba(77,63,41,0.09)]"
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 22% 24%, rgba(131,30,40,0.35) 0, rgba(131,30,40,0) 42%), radial-gradient(circle at 76% 68%, rgba(131,30,40,0.28) 0, rgba(131,30,40,0) 38%)',
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="pointer-events-none absolute -left-3 top-1/2 h-[2px] w-[calc(100%+24px)] -translate-y-1/2 bg-[#922838]/20"
                        aria-hidden="true"
                      />

                      <div
                        className={`pointer-events-none absolute right-2 top-2 flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 border-dashed border-[#8e2431] bg-[#fff4f4]/80 text-center sm:right-3 sm:top-3 sm:h-[74px] sm:w-[74px] ${stampRotation}`}
                        aria-hidden="true"
                      >
                        <div>
                          <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#8e2431] sm:text-[9px] sm:tracking-[0.1em]">Immigration</p>
                          <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#8e2431] sm:text-[9px] sm:tracking-[0.1em]">Vaccinated</p>
                        </div>
                      </div>

                      <div className="mb-2 flex items-start justify-between gap-2 pr-14 sm:gap-3 sm:pr-20">
                        <div className="flex-1">
                          <h4 className="font-semibold uppercase tracking-[0.06em] text-[#121826]">{vac.vaccine_name}</h4>
                          {vac.brand_name && <p className="mt-0.5 text-xs text-neutral-600">{vac.brand_name}</p>}
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${status.color} ${status.bgColor}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        {vac.administered_date && (
                          <div>
                            <span className="text-neutral-600">Administered: </span>
                            <span className="font-semibold text-neutral-900">{formatDate(vac.administered_date)}</span>
                          </div>
                        )}
                        {vac.next_due_date && (
                          <div>
                            <span className="text-neutral-600">Next Due: </span>
                            <span className="font-semibold text-neutral-900">{formatDate(vac.next_due_date)}</span>
                          </div>
                        )}
                        {vac.dose_number && (
                          <div>
                            <span className="text-neutral-600">Dose: </span>
                            <span className="font-semibold text-neutral-900">#{vac.dose_number}</span>
                          </div>
                        )}
                        {vac.veterinarian_name && (
                          <div>
                            <span className="text-neutral-600">Vet: </span>
                            <span className="font-semibold text-neutral-900">{vac.veterinarian_name}</span>
                          </div>
                        )}
                        {vac.clinic_name && (
                          <div className="col-span-2">
                            <span className="text-neutral-600">Clinic: </span>
                            <span className="font-semibold text-neutral-900">{vac.clinic_name}</span>
                          </div>
                        )}
                      </div>

                      {vac.certificate_url ? (
                        <a
                          href={vac.certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-3 inline-flex items-center rounded-sm border-2 border-[#1e4a8f] bg-[#edf4ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1e4a8f] ${getVisaRotation(index)}`}
                        >
                          Visa Note: Certificate Attached
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </PassportSection>
          )}

          {data.medicalRecords.length > 0 && (
            <PassportSection>
              <SectionTitle icon={<Stethoscope className="h-full w-full" strokeWidth={1.6} />}>Medical Records</SectionTitle>
              <div className="space-y-3">
                {data.medicalRecords.map((record, index) => (
                  <div
                    key={record.id}
                    className="relative overflow-hidden rounded-lg border border-[#d2c0a8] bg-[#fffaf0]/95 p-4 shadow-[0_8px_18px_rgba(77,63,41,0.09)]"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.12]"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle at 78% 23%, rgba(90,47,146,0.34) 0, rgba(90,47,146,0) 41%), radial-gradient(circle at 15% 72%, rgba(90,47,146,0.26) 0, rgba(90,47,146,0) 40%)',
                      }}
                      aria-hidden="true"
                    />
                    <div
                      className="pointer-events-none absolute -left-2 top-7 h-[2px] w-[calc(100%+16px)] bg-[#5a2f92]/22"
                      aria-hidden="true"
                    />

                    <div
                      className={`pointer-events-none absolute right-3 top-3 rounded-sm border-2 border-[#5a2f92] bg-[#f3ecff]/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#5a2f92] ${getVisaRotation(index)}`}
                      aria-hidden="true"
                    >
                      Visa Entry
                    </div>

                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="font-semibold uppercase tracking-[0.06em] text-[#121826]">{record.condition_name}</h4>
                      {record.ongoing && (
                        <span className="inline-flex items-center rounded-full bg-amber-100/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
                          Ongoing
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {record.diagnosis_date && (
                        <div>
                          <span className="text-neutral-600">Diagnosed: </span>
                          <span className="font-semibold text-neutral-900">{formatDate(record.diagnosis_date)}</span>
                        </div>
                      )}
                      {record.medications && (
                        <div>
                          <span className="text-neutral-600">Medications: </span>
                          <span className="font-semibold text-neutral-900">{record.medications}</span>
                        </div>
                      )}
                      {record.special_care_instructions && (
                        <div>
                          <span className="text-neutral-600">Special Care: </span>
                          <span className="font-semibold text-neutral-900">{record.special_care_instructions}</span>
                        </div>
                      )}
                      {record.vet_name && (
                        <div>
                          <span className="text-neutral-600">Vet: </span>
                          <span className="font-semibold text-neutral-900">{record.vet_name}</span>
                        </div>
                      )}
                    </div>

                    {(record.document_url || record.medications || record.special_care_instructions) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {record.document_url ? (
                          <a
                            href={record.document_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center rounded-sm border-2 border-[#0f5f4d] bg-[#e7f8f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0f5f4d] ${getStampRotation(index + 1)}`}
                          >
                            Visa Stamp: Document Uploaded
                          </a>
                        ) : null}
                        {record.medications ? (
                          <span className={`inline-flex items-center rounded-sm border-2 border-[#8f3c15] bg-[#fff1e8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8f3c15] ${getStampRotation(index + 2)}`}>
                            Prescription Filed
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </PassportSection>
          )}

          {onEdit && (
            <div className="border-t border-[#d5cab7]/50 pt-3 sm:pt-4">
              <Button type="button" size="sm" onClick={onEdit} className="w-full">
                Edit Passport
              </Button>
            </div>
          )}
        </div>
          );
        })()
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1a382;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cf8448;
        }
      `}</style>
    </Modal>
  );
}
