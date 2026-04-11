import type { SupabaseClient } from '@supabase/supabase-js';
import type { AggressionLevel } from '@/lib/pets/types';
import { calculatePetCompletionFromSections, derivePetCompletionSections } from '@/lib/utils/pet-completion';

export const PET_SHARE_ROLES = ['manager', 'viewer'] as const;
export type PetShareRole = (typeof PET_SHARE_ROLES)[number];
export type PetAccessRole = 'owner' | PetShareRole;

type PetRow = {
  id: number;
  user_id: string;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
  created_at: string;
  date_of_birth: string | null;
  microchip_number: string | null;
  neutered_spayed: boolean;
  color: string | null;
  size_category: string | null;
  energy_level: string | null;
  aggression_level: AggressionLevel | null;
  is_bite_history: boolean;
  bite_incidents_count: number;
  house_trained: boolean;
  leash_trained: boolean;
  crate_trained: boolean;
  social_with_dogs: string | null;
  social_with_cats: string | null;
  social_with_children: string | null;
  separation_anxiety: boolean;
  has_disability: boolean;
  disability_details: string | null;
  updated_at: string;
};

export type AccessiblePet = PetRow & {
  access_role: PetAccessRole;
  owner_user_id: string;
  owner_name: string | null;
  completion_percent?: number;
};

export type PetShareRecord = {
  id: string;
  pet_id: number;
  owner_user_id: string;
  invited_email: string;
  shared_with_user_id: string | null;
  role: PetShareRole;
  status: 'pending' | 'active' | 'accepted' | 'revoked';
  invited_by_user_id: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PetShareAccess = {
  ownerUserId: string;
  role: PetAccessRole;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasText(value: string | null | undefined) {
  return (value?.trim().length ?? 0) > 0;
}

export async function claimPendingPetShares(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
) {
  const normalizedEmail = normalizeEmail(email ?? '');

  if (!normalizedEmail) {
    return;
  }

  const { error } = await supabase
    .from('pet_shares')
    .update({
      shared_with_user_id: userId,
      status: 'active',
      accepted_at: new Date().toISOString(),
      revoked_at: null,
    })
    .ilike('invited_email', normalizedEmail)
    .eq('status', 'pending');

  if (error) {
    throw error;
  }
}

export async function listAccessiblePetsForUser(supabase: SupabaseClient, userId: string): Promise<AccessiblePet[]> {
  const [ownedPetsResult, sharedRowsResult, ownerNamesResult] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase
      .from('pet_shares')
      .select('pet_id, owner_user_id, role')
      .eq('shared_with_user_id', userId)
      .in('status', ['active', 'accepted']),
    supabase.from('users').select('id, name').eq('id', userId).maybeSingle(),
  ]);

  if (ownedPetsResult.error) {
    throw ownedPetsResult.error;
  }

  if (sharedRowsResult.error) {
    throw sharedRowsResult.error;
  }

  if (ownerNamesResult.error) {
    throw ownerNamesResult.error;
  }

  const ownerNameById = new Map<string, string | null>();
  ownerNameById.set(userId, ownerNamesResult.data?.name ?? null);

  const ownedPets = (ownedPetsResult.data ?? []) as PetRow[];
  const sharedRows = (sharedRowsResult.data ?? []) as Array<{ pet_id: number; owner_user_id: string; role: PetShareRole }>;

  const sharedPetIds = Array.from(new Set(sharedRows.map((row) => row.pet_id).filter((id) => Number.isFinite(id))));

  let sharedPets: PetRow[] = [];

  if (sharedPetIds.length > 0) {
    const sharedPetsResult = await supabase.from('pets').select('*').in('id', sharedPetIds);

    if (sharedPetsResult.error) {
      throw sharedPetsResult.error;
    }

    sharedPets = (sharedPetsResult.data ?? []) as PetRow[];

    const sharedOwnerIds = Array.from(new Set(sharedPets.map((pet) => pet.user_id).filter((id) => id !== userId)));

    if (sharedOwnerIds.length > 0) {
      const ownerRowsResult = await supabase.from('users').select('id, name').in('id', sharedOwnerIds);

      if (ownerRowsResult.error) {
        throw ownerRowsResult.error;
      }

      for (const row of ownerRowsResult.data ?? []) {
        ownerNameById.set(row.id, row.name ?? null);
      }
    }
  }

  const sharedRoleByPetAndOwner = new Map<string, PetShareRole>();
  for (const row of sharedRows) {
    sharedRoleByPetAndOwner.set(`${row.pet_id}:${row.owner_user_id}`, row.role);
  }

  const accessible = new Map<number, AccessiblePet>();

  for (const pet of ownedPets) {
    accessible.set(pet.id, {
      ...pet,
      access_role: 'owner',
      owner_user_id: userId,
      owner_name: ownerNameById.get(userId) ?? null,
    });
  }

  for (const pet of sharedPets) {
    if (pet.user_id === userId) {
      continue;
    }

    const role = sharedRoleByPetAndOwner.get(`${pet.id}:${pet.user_id}`);
    if (!role) {
      continue;
    }

    accessible.set(pet.id, {
      ...pet,
      access_role: role,
      owner_user_id: pet.user_id,
      owner_name: ownerNameById.get(pet.user_id) ?? null,
    });
  }

  const accessiblePets = Array.from(accessible.values());

  if (accessiblePets.length === 0) {
    return accessiblePets;
  }

  const petIds = accessiblePets.map((pet) => pet.id);

  const [vaccinationsResult, medicalResult, feedingResult, groomingResult, emergencyResult] = await Promise.all([
    supabase.from('pet_vaccinations').select('pet_id').in('pet_id', petIds),
    supabase.from('pet_medical_records').select('pet_id').in('pet_id', petIds),
    supabase
      .from('pet_feeding_info')
      .select('pet_id, food_type, brand_name, feeding_schedule, food_allergies, special_diet_notes, treats_allowed')
      .in('pet_id', petIds),
    supabase
      .from('pet_grooming_info')
      .select('pet_id, coat_type, matting_prone, grooming_frequency, last_grooming_date, nail_trim_frequency')
      .in('pet_id', petIds),
    supabase
      .from('pet_emergency_info')
      .select('pet_id, emergency_contact_name, emergency_contact_phone, preferred_vet_clinic, preferred_vet_phone')
      .in('pet_id', petIds),
  ]);

  if (vaccinationsResult.error) {
    throw vaccinationsResult.error;
  }

  if (medicalResult.error) {
    throw medicalResult.error;
  }

  if (feedingResult.error) {
    throw feedingResult.error;
  }

  if (groomingResult.error) {
    throw groomingResult.error;
  }

  if (emergencyResult.error) {
    throw emergencyResult.error;
  }

  const vaccinationCountByPet = new Map<number, number>();
  for (const row of vaccinationsResult.data ?? []) {
    vaccinationCountByPet.set(row.pet_id, (vaccinationCountByPet.get(row.pet_id) ?? 0) + 1);
  }

  const medicalCountByPet = new Map<number, number>();
  for (const row of medicalResult.data ?? []) {
    medicalCountByPet.set(row.pet_id, (medicalCountByPet.get(row.pet_id) ?? 0) + 1);
  }

  const feedingByPet = new Map<number, boolean>();
  for (const row of feedingResult.data ?? []) {
    const hasFeedingInfo =
      hasText(row.food_type) ||
      hasText(row.brand_name) ||
      hasText(row.feeding_schedule) ||
      hasText(row.food_allergies) ||
      hasText(row.special_diet_notes) ||
      row.treats_allowed === false;

    if (hasFeedingInfo) {
      feedingByPet.set(row.pet_id, true);
    }
  }

  const groomingByPet = new Map<number, boolean>();
  for (const row of groomingResult.data ?? []) {
    const hasGroomingInfo =
      hasText(row.coat_type) ||
      row.matting_prone === true ||
      hasText(row.grooming_frequency) ||
      hasText(row.last_grooming_date) ||
      hasText(row.nail_trim_frequency);

    if (hasGroomingInfo) {
      groomingByPet.set(row.pet_id, true);
    }
  }

  const emergencyByPet = new Map<number, boolean>();
  for (const row of emergencyResult.data ?? []) {
    const hasEmergencyInfo =
      hasText(row.emergency_contact_name) ||
      hasText(row.emergency_contact_phone) ||
      hasText(row.preferred_vet_clinic) ||
      hasText(row.preferred_vet_phone);

    if (hasEmergencyInfo) {
      emergencyByPet.set(row.pet_id, true);
    }
  }

  return accessiblePets
    .map((pet) => ({
      ...pet,
      completion_percent: calculatePetCompletionFromSections(
        derivePetCompletionSections({
          name: pet.name,
          breed: pet.breed,
          age: pet.age,
          weight: pet.weight,
          gender: pet.gender,
          allergies: pet.allergies,
          photo_url: pet.photo_url,
          date_of_birth: pet.date_of_birth,
          aggression_level: pet.aggression_level,
          social_with_dogs: pet.social_with_dogs,
          social_with_cats: pet.social_with_cats,
          social_with_children: pet.social_with_children,
          is_bite_history: pet.is_bite_history,
          house_trained: pet.house_trained,
          leash_trained: pet.leash_trained,
          crate_trained: pet.crate_trained,
          separation_anxiety: pet.separation_anxiety,
          has_disability: pet.has_disability,
          disability_details: pet.disability_details,
          vaccinations_count: vaccinationCountByPet.get(pet.id) ?? 0,
          medical_records_count: medicalCountByPet.get(pet.id) ?? 0,
          has_feeding_info: feedingByPet.get(pet.id) === true,
          has_grooming_info: groomingByPet.get(pet.id) === true,
          has_emergency_info: emergencyByPet.get(pet.id) === true,
        }),
      ),
    }))
    .sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
}

export async function getPetAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  petId: number,
): Promise<PetShareAccess | null> {
  const petResult = await supabase.from('pets').select('id, user_id').eq('id', petId).maybeSingle<{ id: number; user_id: string }>();

  if (petResult.error) {
    throw petResult.error;
  }

  const pet = petResult.data;
  if (!pet) {
    return null;
  }

  if (pet.user_id === userId) {
    return {
      ownerUserId: pet.user_id,
      role: 'owner',
    };
  }

  const shareResult = await supabase
    .from('pet_shares')
    .select('role')
    .eq('pet_id', petId)
    .eq('owner_user_id', pet.user_id)
    .eq('shared_with_user_id', userId)
    .in('status', ['active', 'accepted'])
    .maybeSingle<{ role: PetShareRole }>();

  if (shareResult.error) {
    throw shareResult.error;
  }

  if (!shareResult.data) {
    return null;
  }

  return {
    ownerUserId: pet.user_id,
    role: shareResult.data.role,
  };
}

export async function listPetSharesForOwner(
  supabase: SupabaseClient,
  ownerUserId: string,
  petId: number,
): Promise<PetShareRecord[]> {
  const petResult = await supabase.from('pets').select('id').eq('id', petId).eq('user_id', ownerUserId).maybeSingle();

  if (petResult.error) {
    throw petResult.error;
  }

  if (!petResult.data) {
    throw new Error('Pet not found');
  }

  const { data, error } = await supabase
    .from('pet_shares')
    .select('*')
    .eq('pet_id', petId)
    .in('status', ['pending', 'active', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PetShareRecord[];
}

export async function upsertPetShareForOwner(
  supabase: SupabaseClient,
  input: {
    petId: number;
    ownerUserId: string;
    invitedByUserId: string;
    invitedEmail: string;
    role: PetShareRole;
  },
): Promise<PetShareRecord> {
  const normalizedEmail = normalizeEmail(input.invitedEmail);

  const petResult = await supabase
    .from('pets')
    .select('id')
    .eq('id', input.petId)
    .eq('user_id', input.ownerUserId)
    .maybeSingle();

  if (petResult.error) {
    throw petResult.error;
  }

  if (!petResult.data) {
    throw new Error('Pet not found');
  }

  const userByEmailResult = await supabase
    .from('users')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle<{ id: string }>();

  if (userByEmailResult.error) {
    throw userByEmailResult.error;
  }

  const matchedUserId = userByEmailResult.data?.id ?? null;

  if (matchedUserId && matchedUserId === input.ownerUserId) {
    throw new Error('You cannot share a pet with your own account.');
  }

  const nextStatus: PetShareRecord['status'] = matchedUserId ? 'active' : 'pending';
  const now = new Date().toISOString();

  const upsertResult = await supabase
    .from('pet_shares')
    .upsert(
      {
        pet_id: input.petId,
        owner_user_id: input.ownerUserId,
        invited_email: normalizedEmail,
        shared_with_user_id: matchedUserId,
        role: input.role,
        status: nextStatus,
        invited_by_user_id: input.invitedByUserId,
        accepted_at: matchedUserId ? now : null,
        revoked_at: null,
      },
      { onConflict: 'pet_id,invited_email' },
    )
    .select('*')
    .single<PetShareRecord>();

  if (upsertResult.error) {
    throw upsertResult.error;
  }

  return upsertResult.data;
}

export async function updatePetShareRoleForOwner(
  supabase: SupabaseClient,
  input: {
    petId: number;
    shareId: string;
    ownerUserId: string;
    role: PetShareRole;
  },
): Promise<PetShareRecord> {
  const { data, error } = await supabase
    .from('pet_shares')
    .update({ role: input.role })
    .eq('id', input.shareId)
    .eq('pet_id', input.petId)
    .eq('owner_user_id', input.ownerUserId)
    .in('status', ['pending', 'active', 'accepted'])
    .select('*')
    .single<PetShareRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function revokePetShareForOwner(
  supabase: SupabaseClient,
  input: {
    petId: number;
    shareId: string;
    ownerUserId: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('pet_shares')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('id', input.shareId)
    .eq('pet_id', input.petId)
    .eq('owner_user_id', input.ownerUserId)
    .in('status', ['pending', 'active', 'accepted']);

  if (error) {
    throw error;
  }
}
