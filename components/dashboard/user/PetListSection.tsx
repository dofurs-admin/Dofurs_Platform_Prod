'use client';

import Image from 'next/image';
import SectionCard from '@/components/dashboard/SectionCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/dashboard/EmptyState';
import { calculateLightweightPetCompletion } from '@/lib/utils/pet-completion';
import type { Pet } from './types';

type Props = {
  pets: Pet[];
  selectedPetId: number | null;
  photoUrls: Record<number, string>;
  completionPercent: number;
  isPending: boolean;
  onCreatePetClick: () => void;
  onSelectPet: (petId: number) => void;
  onSharePet: (petId: number) => void;
  onDeletePet: (petId: number, petName: string) => void;
};

export default function PetListSection({
  pets,
  selectedPetId,
  photoUrls,
  completionPercent,
  isPending,
  onCreatePetClick,
  onSelectPet,
  onSharePet,
  onDeletePet,
}: Props) {
  return (
    <>
      <SectionCard title="Pet Profiles" description="Manage pets with a cleaner workflow. Create new profiles from a guided modal.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-relaxed text-neutral-600">
            Select a pet below to view the passport. Editing opens in a focused step-by-step modal.
          </p>
          <Button type="button" onClick={onCreatePetClick} className="px-5 py-2.5">
            Create New Pet
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Select Pet" description="Choose which pet profile to continue editing.">
        {pets.length === 0 ? (
          <EmptyState
            icon="🐾"
            title="No pets yet"
            description="Create your first pet profile to unlock the passport experience."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pets.map((pet) => {
              const completion =
                pet.id === selectedPetId
                  ? completionPercent
                  : typeof pet.completion_percent === 'number'
                  ? Math.max(0, Math.min(100, Math.round(pet.completion_percent)))
                  : calculateLightweightPetCompletion(pet);
              const isSharedPet = pet.access_role === 'manager' || pet.access_role === 'viewer';
              const sharedRoleLabel = pet.access_role === 'manager' ? 'Manager' : pet.access_role === 'viewer' ? 'Viewer' : null;
              const completionToneClass =
                completion >= 80
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : completion >= 50
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700';

              return (
                <li
                  key={pet.id}
                  className={`rounded-2xl border bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-4 shadow-[0_14px_26px_rgba(147,101,63,0.12)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(147,101,63,0.18)] ${selectedPetId === pet.id ? 'border-brand-500/60 ring-2 ring-brand-500/20' : 'border-[#ead3bf]'}`}
                >
                  <div className="relative mb-3">
                    {photoUrls[pet.id] ? (
                      <Image
                        src={photoUrls[pet.id]}
                        alt={`${pet.name} photo`}
                        width={720}
                        height={360}
                        unoptimized
                        className="h-36 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed border-neutral-200/70 bg-neutral-50 text-3xl">
                        🐾
                      </div>
                    )}
                    <div className={`absolute right-2 top-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${completionToneClass}`}>
                      {completion}% complete
                    </div>
                  </div>
                  <div className="text-base font-semibold text-neutral-950">{pet.name}</div>
                  {isSharedPet ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-blue-700">
                        Shared
                      </span>
                      {sharedRoleLabel ? (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                            pet.access_role === 'manager'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-violet-200 bg-violet-50 text-violet-700'
                          }`}
                        >
                          {sharedRoleLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {isSharedPet ? (
                    <p className="mt-1 text-xs text-neutral-600">
                      Shared by {pet.owner_name?.trim() ? pet.owner_name : 'another owner'}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-neutral-600">
                    {pet.breed ? <span>Breed: {pet.breed}</span> : null}
                    {pet.age !== null ? <span>Age: {pet.age}</span> : null}
                    {pet.weight !== null ? <span>Weight: {pet.weight} kg</span> : null}
                    {pet.has_disability ? <span className="font-medium text-amber-700">Disability declared</span> : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectPet(pet.id)}
                      className="rounded-full border border-[#e1bf9e] bg-[#fff4e8] px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
                    >
                      View Passport
                    </button>
                    {pet.access_role === 'owner' ? (
                      <button
                        type="button"
                        onClick={() => onSharePet(pet.id)}
                        className="rounded-full border border-blue-200/80 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
                      >
                        Share
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDeletePet(pet.id, pet.name)}
                      disabled={isPending || pet.access_role !== 'owner'}
                      className="rounded-full border border-red-200/80 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
