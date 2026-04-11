import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { AGGRESSION_LEVELS, PET_GENDERS } from '@/lib/pets/types';
import { createPet } from '@/lib/pets/service';
import { claimPendingPetShares, listAccessiblePetsForUser } from '@/lib/pets/share-access';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { calculateLightweightPetCompletion } from '@/lib/utils/pet-completion';
import { notifyPetAdded } from '@/lib/notifications/service';
import { MAX_PET_AGE_YEARS, isPetDateOfBirthWithinBounds } from '@/lib/utils/date';

const noHtmlChars = (val: string) => !/<|>|&lt;|&gt;|javascript:/i.test(val);

const petSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .refine(noHtmlChars, { message: 'Pet name must not contain HTML or script characters' }),
  breed: z.string().max(120).nullable().optional(),
  age: z.number().int().min(0).max(MAX_PET_AGE_YEARS).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  gender: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(PET_GENDERS).nullable().optional(),
    ),
  allergies: z.string().max(500).nullable().optional(),
  photoUrl: z.string().min(1).max(500).nullable().optional(),
  dateOfBirth: z
    .string()
    .date()
    .refine((value) => isPetDateOfBirthWithinBounds(value), {
      message: `Date of birth cannot be more than ${MAX_PET_AGE_YEARS} years ago`,
    })
    .nullable()
    .optional(),
  microchipNumber: z.string().max(120).nullable().optional(),
  neuteredSpayed: z.boolean().optional(),
  color: z.string().max(80).nullable().optional(),
  sizeCategory: z.string().max(60).nullable().optional(),
  energyLevel: z.string().max(60).nullable().optional(),
  aggressionLevel: z.enum(AGGRESSION_LEVELS).nullable().optional(),
  isBiteHistory: z.boolean().optional(),
  biteIncidentsCount: z.number().int().min(0).optional(),
  houseTrained: z.boolean().optional(),
  leashTrained: z.boolean().optional(),
  crateTrained: z.boolean().optional(),
  socialWithDogs: z.string().max(200).nullable().optional(),
  socialWithCats: z.string().max(200).nullable().optional(),
  socialWithChildren: z.string().max(200).nullable().optional(),
  separationAnxiety: z.boolean().optional(),
  hasDisability: z.boolean().optional(),
  disabilityDetails: z.string().max(1000).nullable().optional(),
});

function normalizePetPhotoUrlInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/storage/v1/object/')) {
    try {
      const parsed = new URL(trimmed, trimmed.startsWith('http') ? undefined : 'http://localhost');
      const segments = parsed.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex(
        (segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
      );

      if (markerIndex === -1) {
        return null;
      }

      const objectSegments = segments.slice(markerIndex + 3);
      const first = objectSegments[0];
      const modeOffsets: Record<string, number> = {
        sign: 1,
        public: 1,
        authenticated: 1,
        render: 2,
      };
      const offset = modeOffsets[first ?? ''] ?? 0;
      const bucketCandidate = objectSegments[offset];
      const pathParts = objectSegments.slice(offset + 1);

      if (bucketCandidate !== 'pet-photos' || pathParts.length === 0) {
        return null;
      }

      return decodeURIComponent(pathParts.join('/'));
    } catch (err) { console.error(err);
      return null;
    }
  }

  const normalized = trimmed.replace(/^\/+/, '').replace(/^pet-photos\//, '');
  return normalized || null;
}

export async function GET() {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  try {
    const admin = getSupabaseAdminClient();
    await claimPendingPetShares(admin, user.id, user.email);
    const pets = await listAccessiblePetsForUser(admin, user.id);
    return NextResponse.json({
      pets: pets.map((pet) => ({
        ...pet,
        completion_percent:
          typeof pet.completion_percent === 'number'
            ? pet.completion_percent
            : calculateLightweightPetCompletion(pet),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load pets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsed = petSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedPhotoPath = normalizePetPhotoUrlInput(parsed.data.photoUrl ?? null);

  if (parsed.data.photoUrl && !normalizedPhotoPath) {
    return NextResponse.json(
      { error: 'Invalid pet photo URL. Use files uploaded to Supabase pet-photos storage.' },
      { status: 400 },
    );
  }

  try {
    const pet = await createPet(supabase, user.id, {
      name: parsed.data.name,
      breed: parsed.data.breed ?? null,
      age: parsed.data.age ?? null,
      weight: parsed.data.weight ?? null,
      gender: parsed.data.gender ?? null,
      allergies: parsed.data.allergies ?? null,
      photo_url: normalizedPhotoPath,
      date_of_birth: parsed.data.dateOfBirth ?? null,
      microchip_number: parsed.data.microchipNumber ?? null,
      neutered_spayed: parsed.data.neuteredSpayed ?? false,
      color: parsed.data.color ?? null,
      size_category: parsed.data.sizeCategory ?? null,
      energy_level: parsed.data.energyLevel ?? null,
      aggression_level: parsed.data.aggressionLevel ?? null,
      is_bite_history: parsed.data.isBiteHistory ?? false,
      bite_incidents_count: parsed.data.biteIncidentsCount ?? 0,
      house_trained: parsed.data.houseTrained ?? false,
      leash_trained: parsed.data.leashTrained ?? false,
      crate_trained: parsed.data.crateTrained ?? false,
      social_with_dogs: parsed.data.socialWithDogs ?? null,
      social_with_cats: parsed.data.socialWithCats ?? null,
      social_with_children: parsed.data.socialWithChildren ?? null,
      separation_anxiety: parsed.data.separationAnxiety ?? false,
      has_disability: parsed.data.hasDisability ?? false,
      disability_details: parsed.data.disabilityDetails ?? null,
    });

    // Fire-and-forget notification
    const adminClient = getSupabaseAdminClient();
    notifyPetAdded(adminClient, { id: pet.id, name: pet.name, user_id: user.id })
      .catch((err) => console.error('Notification hook failed (pet_added)', err));

    return NextResponse.json({ success: true, pet });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create pet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
