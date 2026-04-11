type LightweightPetInput = {
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
  date_of_birth?: string | null;
  aggression_level?: string | null;
  social_with_dogs?: string | null;
  social_with_cats?: string | null;
  social_with_children?: string | null;
  is_bite_history?: boolean;
  house_trained?: boolean;
  leash_trained?: boolean;
  crate_trained?: boolean;
  separation_anxiety?: boolean;
  has_disability?: boolean;
  disability_details?: string | null;
  vaccinations_count?: number;
  medical_records_count?: number;
  has_feeding_info?: boolean;
  has_grooming_info?: boolean;
  has_emergency_info?: boolean;
};

export type PetCompletionSections = {
  basic: boolean;
  behavior: boolean;
  vaccinations: boolean;
  medical: boolean;
  feeding: boolean;
  grooming: boolean;
  emergency: boolean;
};

const TOTAL_SECTIONS = 7;

function hasText(value: string | null | undefined) {
  return (value?.trim().length ?? 0) > 0;
}

export function calculatePetCompletionFromSections(sections: PetCompletionSections) {
  const completedCount = Object.values(sections).filter(Boolean).length;
  return Math.round((completedCount / TOTAL_SECTIONS) * 100);
}

export function derivePetCompletionSections(input: LightweightPetInput): PetCompletionSections {
  const basicIdentitySignals = [
    hasText(input.breed),
    input.age !== null,
    input.weight !== null,
    hasText(input.gender),
    hasText(input.allergies),
    hasText(input.photo_url),
    hasText(input.date_of_birth),
  ].filter(Boolean).length;

  const basic = hasText(input.name) && basicIdentitySignals > 0;

  const behavior =
    hasText(input.aggression_level) ||
    hasText(input.social_with_dogs) ||
    hasText(input.social_with_cats) ||
    hasText(input.social_with_children) ||
    input.is_bite_history === true ||
    input.house_trained === true ||
    input.leash_trained === true ||
    input.crate_trained === true ||
    input.separation_anxiety === true ||
    input.has_disability === true ||
    hasText(input.disability_details);

  return {
    basic,
    behavior,
    vaccinations: (input.vaccinations_count ?? 0) > 0,
    medical: (input.medical_records_count ?? 0) > 0,
    feeding: input.has_feeding_info === true,
    grooming: input.has_grooming_info === true,
    emergency: input.has_emergency_info === true,
  };
}

export function calculateLightweightPetCompletion(pet: LightweightPetInput) {
  return calculatePetCompletionFromSections(derivePetCompletionSections(pet));
}