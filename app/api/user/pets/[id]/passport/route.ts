import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import {
  addMedicalRecord,
  addVaccination,
  deleteMedicalRecord,
  deleteVaccination,
  getFullPetProfile,
  logPassportAuditEvent,
  updateMedicalRecord,
  updatePet,
  updateVaccination,
  upsertEmergencyInfo,
  upsertFeedingInfo,
  upsertGroomingInfo,
} from '@/lib/pets/service';
import { AGGRESSION_LEVELS, PET_GENDERS } from '@/lib/pets/types';
import { normalizeOptionalString, validateEmergencyPhones, validateVaccinationPatch } from '@/lib/pets/passport-validation';
import { getPetAccessForUser } from '@/lib/pets/share-access';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { MAX_PET_AGE_YEARS, isPetDateOfBirthWithinBounds } from '@/lib/utils/date';

const vaccinationUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  _delete: z.literal(false).optional(),
  vaccineName: z.string().min(1).max(150),
  brandName: z.string().max(150).nullable().optional(),
  batchNumber: z.string().max(120).nullable().optional(),
  doseNumber: z.number().int().positive().nullable().optional(),
  administeredDate: z.string().date(),
  nextDueDate: z.string().date().nullable().optional(),
  veterinarianName: z.string().max(150).nullable().optional(),
  clinicName: z.string().max(150).nullable().optional(),
  certificateUrl: z.string().max(500).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
});

const vaccinationDeleteSchema = z.object({
  id: z.string().uuid(),
  _delete: z.literal(true),
});

const medicalUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  _delete: z.literal(false).optional(),
  conditionName: z.string().min(1).max(150),
  diagnosisDate: z.string().date().nullable().optional(),
  ongoing: z.boolean().optional(),
  medications: z.string().max(500).nullable().optional(),
  specialCareInstructions: z.string().max(800).nullable().optional(),
  vetName: z.string().max(150).nullable().optional(),
  documentUrl: z.string().max(500).nullable().optional(),
});

const medicalDeleteSchema = z.object({
  id: z.string().uuid(),
  _delete: z.literal(true),
});

const passportUpdateSchema = z.object({
  stepIndex: z.number().int().min(0).max(6).optional(),
  pet: z
    .object({
      name: z.string().min(1).max(120).optional(),
      breed: z.string().max(120).nullable().optional(),
      age: z.number().int().min(0).max(MAX_PET_AGE_YEARS).nullable().optional(),
      weight: z.number().min(0).nullable().optional(),
      gender: z
        .preprocess(
          (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
          z.enum(PET_GENDERS).nullable().optional(),
        ),
      allergies: z.string().max(500).nullable().optional(),
      photoUrl: z.string().max(500).nullable().optional(),
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
    })
    .optional(),
  vaccinations: z.array(z.union([vaccinationUpsertSchema, vaccinationDeleteSchema])).optional(),
  medicalRecords: z.array(z.union([medicalUpsertSchema, medicalDeleteSchema])).optional(),
  feedingInfo: z
    .object({
      foodType: z.string().max(120).nullable().optional(),
      brandName: z.string().max(150).nullable().optional(),
      feedingSchedule: z.string().max(300).nullable().optional(),
      foodAllergies: z.string().max(300).nullable().optional(),
      specialDietNotes: z.string().max(600).nullable().optional(),
      treatsAllowed: z.boolean().optional(),
    })
    .optional(),
  groomingInfo: z
    .object({
      coatType: z.string().max(100).nullable().optional(),
      mattingProne: z.boolean().optional(),
      groomingFrequency: z.string().max(150).nullable().optional(),
      lastGroomingDate: z.string().date().nullable().optional(),
      nailTrimFrequency: z.string().max(150).nullable().optional(),
    })
    .optional(),
  emergencyInfo: z
    .object({
      emergencyContactName: z.string().max(150).nullable().optional(),
      emergencyContactPhone: z.string().max(40).nullable().optional(),
      preferredVetClinic: z.string().max(150).nullable().optional(),
      preferredVetPhone: z.string().max(40).nullable().optional(),
    })
    .optional(),
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
    } catch {
      return null;
    }
  }

  const normalized = trimmed.replace(/^\/+/, '').replace(/^pet-photos\//, '');
  return normalized || null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = Number(id);

  if (!Number.isFinite(petId) || petId <= 0) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const access = await getPetAccessForUser(admin, user.id, petId);

    if (!access) {
      return forbidden();
    }

    const profile = await getFullPetProfile(admin, access.ownerUserId, petId);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = Number(id);

  if (!Number.isFinite(petId) || petId <= 0) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = passportUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const access = await getPetAccessForUser(admin, user.id, petId);

    if (!access) {
      return forbidden();
    }

    if (access.role === 'viewer') {
      return forbidden();
    }

    const data = parsed.data;

    if (data.vaccinations) {
      const vaccinationError = validateVaccinationPatch(data.vaccinations);
      if (vaccinationError) {
        return NextResponse.json({ error: vaccinationError }, { status: 400 });
      }
    }

    if (data.emergencyInfo) {
      const phoneError = validateEmergencyPhones(data.emergencyInfo);
      if (phoneError) {
        return NextResponse.json({ error: phoneError }, { status: 400 });
      }
    }

    if (data.pet) {
      const hasPhotoUrl = Object.prototype.hasOwnProperty.call(data.pet, 'photoUrl');
      const normalizedPhotoUrl = hasPhotoUrl ? normalizePetPhotoUrlInput(data.pet.photoUrl ?? null) : undefined;

      if (hasPhotoUrl && data.pet.photoUrl && !normalizedPhotoUrl) {
        return NextResponse.json(
          { error: 'Invalid pet photo URL. Use files uploaded to Supabase pet-photos storage.' },
          { status: 400 },
        );
      }

      await updatePet(admin, access.ownerUserId, petId, {
        name: data.pet.name?.trim(),
        breed: normalizeOptionalString(data.pet.breed),
        age: data.pet.age,
        weight: data.pet.weight,
        gender: normalizeOptionalString(data.pet.gender),
        allergies: normalizeOptionalString(data.pet.allergies),
        photo_url: normalizedPhotoUrl,
        date_of_birth: data.pet.dateOfBirth,
        microchip_number: normalizeOptionalString(data.pet.microchipNumber),
        neutered_spayed: data.pet.neuteredSpayed,
        color: normalizeOptionalString(data.pet.color),
        size_category: normalizeOptionalString(data.pet.sizeCategory),
        energy_level: normalizeOptionalString(data.pet.energyLevel),
        aggression_level: data.pet.aggressionLevel,
        is_bite_history: data.pet.isBiteHistory,
        bite_incidents_count: data.pet.biteIncidentsCount,
        house_trained: data.pet.houseTrained,
        leash_trained: data.pet.leashTrained,
        crate_trained: data.pet.crateTrained,
        social_with_dogs: normalizeOptionalString(data.pet.socialWithDogs),
        social_with_cats: normalizeOptionalString(data.pet.socialWithCats),
        social_with_children: normalizeOptionalString(data.pet.socialWithChildren),
        separation_anxiety: data.pet.separationAnxiety,
        has_disability: data.pet.hasDisability,
        disability_details: normalizeOptionalString(data.pet.disabilityDetails),
      });
    }

    if (data.vaccinations) {
      for (const vaccination of data.vaccinations) {
        if (vaccination._delete) {
          if (vaccination.id) {
            await deleteVaccination(admin, access.ownerUserId, vaccination.id);
          }
          continue;
        }

        if (vaccination.id) {
          await updateVaccination(admin, access.ownerUserId, vaccination.id, {
            vaccine_name: vaccination.vaccineName.trim(),
            brand_name: normalizeOptionalString(vaccination.brandName),
            batch_number: normalizeOptionalString(vaccination.batchNumber),
            dose_number: vaccination.doseNumber,
            administered_date: vaccination.administeredDate,
            next_due_date: vaccination.nextDueDate,
            veterinarian_name: normalizeOptionalString(vaccination.veterinarianName),
            clinic_name: normalizeOptionalString(vaccination.clinicName),
            certificate_url: normalizeOptionalString(vaccination.certificateUrl),
            reminder_enabled: vaccination.reminderEnabled,
          });
        } else {
          await addVaccination(admin, access.ownerUserId, {
            pet_id: petId,
            vaccine_name: vaccination.vaccineName.trim(),
            brand_name: normalizeOptionalString(vaccination.brandName),
            batch_number: normalizeOptionalString(vaccination.batchNumber),
            dose_number: vaccination.doseNumber,
            administered_date: vaccination.administeredDate,
            next_due_date: vaccination.nextDueDate,
            veterinarian_name: normalizeOptionalString(vaccination.veterinarianName),
            clinic_name: normalizeOptionalString(vaccination.clinicName),
            certificate_url: normalizeOptionalString(vaccination.certificateUrl),
            reminder_enabled: vaccination.reminderEnabled,
          });
        }
      }
    }

    if (data.medicalRecords) {
      for (const medical of data.medicalRecords) {
        if (medical._delete) {
          if (medical.id) {
            await deleteMedicalRecord(admin, access.ownerUserId, medical.id);
          }
          continue;
        }

        if (medical.id) {
          await updateMedicalRecord(admin, access.ownerUserId, medical.id, {
            condition_name: medical.conditionName.trim(),
            diagnosis_date: medical.diagnosisDate,
            ongoing: medical.ongoing,
            medications: normalizeOptionalString(medical.medications),
            special_care_instructions: normalizeOptionalString(medical.specialCareInstructions),
            vet_name: normalizeOptionalString(medical.vetName),
            document_url: normalizeOptionalString(medical.documentUrl),
          });
          continue;
        }

        await addMedicalRecord(admin, access.ownerUserId, {
          pet_id: petId,
          condition_name: medical.conditionName.trim(),
          diagnosis_date: medical.diagnosisDate,
          ongoing: medical.ongoing,
          medications: normalizeOptionalString(medical.medications),
          special_care_instructions: normalizeOptionalString(medical.specialCareInstructions),
          vet_name: normalizeOptionalString(medical.vetName),
          document_url: normalizeOptionalString(medical.documentUrl),
        });
      }
    }

    if (data.feedingInfo) {
      await upsertFeedingInfo(admin, access.ownerUserId, {
        pet_id: petId,
        food_type: normalizeOptionalString(data.feedingInfo.foodType),
        brand_name: normalizeOptionalString(data.feedingInfo.brandName),
        feeding_schedule: normalizeOptionalString(data.feedingInfo.feedingSchedule),
        food_allergies: normalizeOptionalString(data.feedingInfo.foodAllergies),
        special_diet_notes: normalizeOptionalString(data.feedingInfo.specialDietNotes),
        treats_allowed: data.feedingInfo.treatsAllowed,
      });
    }

    if (data.groomingInfo) {
      await upsertGroomingInfo(admin, access.ownerUserId, {
        pet_id: petId,
        coat_type: normalizeOptionalString(data.groomingInfo.coatType),
        matting_prone: data.groomingInfo.mattingProne,
        grooming_frequency: normalizeOptionalString(data.groomingInfo.groomingFrequency),
        last_grooming_date: data.groomingInfo.lastGroomingDate,
        nail_trim_frequency: normalizeOptionalString(data.groomingInfo.nailTrimFrequency),
      });
    }

    if (data.emergencyInfo) {
      await upsertEmergencyInfo(admin, access.ownerUserId, {
        pet_id: petId,
        emergency_contact_name: normalizeOptionalString(data.emergencyInfo.emergencyContactName),
        emergency_contact_phone: normalizeOptionalString(data.emergencyInfo.emergencyContactPhone),
        preferred_vet_clinic: normalizeOptionalString(data.emergencyInfo.preferredVetClinic),
        preferred_vet_phone: normalizeOptionalString(data.emergencyInfo.preferredVetPhone),
      });
    }

    await logPassportAuditEvent(admin, user.id, {
      pet_id: petId,
      action: 'passport.patch',
      step_index: data.stepIndex ?? null,
      metadata: {
        sectionsUpdated: {
          pet: Boolean(data.pet),
          vaccinations: Boolean(data.vaccinations),
          medicalRecords: Boolean(data.medicalRecords),
          feedingInfo: Boolean(data.feedingInfo),
          groomingInfo: Boolean(data.groomingInfo),
          emergencyInfo: Boolean(data.emergencyInfo),
        },
      },
    });

    const profile = await getFullPetProfile(admin, access.ownerUserId, petId);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update pet passport';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
