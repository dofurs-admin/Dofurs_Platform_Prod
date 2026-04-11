'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PetCard from '../premium/PetCard';
import EmptyState from '../premium/EmptyState';
import type { Pet } from './types';
import { resolvePetAge } from './petUtils';

type Props = {
  pets: Pet[];
  petPhotoUrls: Record<number, string>;
  petCompletionById: Record<number, number>;
  onViewPassport: (petId: number) => void;
  onOpenPetManager: (selectedPetId?: number | null) => void;
};

export default function PetsTab({
  pets,
  petPhotoUrls,
  petCompletionById,
  onViewPassport,
  onOpenPetManager,
}: Props) {
  return (
    <>
      <h2 className="text-page-title mb-6">Pet Profiles</h2>

      {pets.length === 0 ? (
        <EmptyState
          icon="🐾"
          title="No Pets Yet"
          description="Create pet profiles with complete medical, behavioral, and care information."
          ctaLabel="Add Your First Pet"
          ctaOnClick={() => onOpenPetManager(null)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                id={pet.id}
                name={pet.name}
                breed={pet.breed ?? undefined}
                age={resolvePetAge(pet)}
                photo={petPhotoUrls[pet.id]}
                hasDisability={pet.has_disability}
                accessRole={pet.access_role}
                ownerName={pet.owner_name}
                completionPercent={petCompletionById[pet.id]}
                onViewPassport={onViewPassport}
              />
            ))}
          </div>

          {/* Add Pet CTA */}
          <Card className="border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-4 shadow-[0_10px_22px_rgba(147,101,63,0.1)] sm:p-6 sm:shadow-[0_16px_30px_rgba(147,101,63,0.12)]">
            <div className="space-y-3 text-center sm:space-y-4">
              <h3 className="text-card-title">Add Another Pet?</h3>
              <p className="text-body text-neutral-600">
                Create a complete passport with all medical and behavioral information.
              </p>
              <Button variant="premium" size="lg" type="button" onClick={() => onOpenPetManager(null)}>
                Add New Pet
              </Button>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
