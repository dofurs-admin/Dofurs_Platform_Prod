'use client';

import Modal from '@/components/ui/Modal';
import UserPetProfilesClient from '../UserPetProfilesClient';
import type { Pet } from './types';

type PetExperienceSummary = {
  totalPets: number;
  avgCompletion: number;
  upcomingReminderGroups: number;
};

type Props = {
  isOpen: boolean;
  pets: Pet[];
  petManagerSelectedPetId: number | null;
  petExperienceSummary: PetExperienceSummary;
  onClose: () => void;
};

export default function PetManagerModal({
  isOpen,
  pets,
  petManagerSelectedPetId,
  petExperienceSummary,
  onClose,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Pet Profiles"
      description="Create, review, and edit complete pet passport details from one place."
      size="xl"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff6ed_100%)] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Profiles</p>
          <p className="mt-1 text-base font-bold text-neutral-900">{petExperienceSummary.totalPets}</p>
        </div>
        <div className="rounded-xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff6ed_100%)] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Avg Completion</p>
          <p className="mt-1 text-base font-bold text-neutral-900">{petExperienceSummary.avgCompletion}%</p>
        </div>
        <div className="rounded-xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff6ed_100%)] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Active Reminders</p>
          <p className="mt-1 text-base font-bold text-neutral-900">{petExperienceSummary.upcomingReminderGroups}</p>
        </div>
      </div>

      <UserPetProfilesClient
        key={`pet-manager-${petManagerSelectedPetId ?? 'new'}`}
        initialPets={pets}
        initialSelectedPetId={petManagerSelectedPetId}
        embedded
      />
    </Modal>
  );
}
