import type { FullPetProfile, PassportDraft } from './types';
import {
  PET_GENDER_OPTIONS,
  SIZE_CATEGORY_OPTIONS,
} from './constants';

export function normalizeDisplayImageUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  const normalized = url.trim();
  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return '';
}

export function normalizeStorageObjectPath(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  // Handle full/relative Supabase storage URLs by extracting bucket path.
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/storage/v1/object/')) {
    try {
      const parsed = new URL(trimmed, trimmed.startsWith('http') ? undefined : 'http://localhost');
      const segments = parsed.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex(
        (segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
      );

      if (markerIndex !== -1) {
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

        if (bucketCandidate === 'pet-photos' && pathParts.length > 0) {
          return decodeURIComponent(pathParts.join('/'));
        }
      }
    } catch (err) { console.error(err);
      // Fall through to simple normalization below.
    }
  }

  const normalized = trimmed.replace(/^\/+/, '');
  if (normalized.startsWith('pet-photos/')) {
    return normalized.slice('pet-photos/'.length);
  }
  return normalized;
}

export function capitalizeFirstLetter(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function toTitleCaseLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => capitalizeFirstLetter(part))
    .join(' ');
}

export function normalizeToken(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value.trim().toLowerCase().replaceAll("'", '').replace(/\s+/g, '_');
}

export function normalizeSizeCategoryValue(value: string | null | undefined): string {
  const token = normalizeToken(value);
  return SIZE_CATEGORY_OPTIONS.includes(token as (typeof SIZE_CATEGORY_OPTIONS)[number]) ? token : '';
}

export function normalizePetGenderValue(value: string | null | undefined): string {
  const token = normalizeToken(value);
  return PET_GENDER_OPTIONS.includes(token as (typeof PET_GENDER_OPTIONS)[number]) ? token : '';
}

export function normalizeSocialCompatibilityValue(value: string | null | undefined): string {
  const token = normalizeToken(value);

  if (token === 'yes' || token === 'no' || token === 'dont_know') {
    return token;
  }

  if (token === 'dontknow' || token === 'unknown' || token === 'not_sure' || token === 'notsure') {
    return 'dont_know';
  }

  return '';
}

export function normalizeGroomingFrequencyValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = value.match(/\d+/)?.[0] ?? '';
  if (!digits) {
    return '';
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

export function normalizePositiveIntegerValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = value.match(/\d+/)?.[0] ?? '';
  if (!digits) {
    return '';
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

export function normalizePhoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const sanitized = trimmed.replace(/[^0-9+]/g, '');
  if (!sanitized) {
    return '';
  }

  const hasPlus = sanitized.startsWith('+');
  const digits = sanitized.replace(/\D/g, '');
  if (!digits) {
    return hasPlus ? '+' : '';
  }

  const chunks = digits.match(/.{1,3}/g) ?? [digits];
  return `${hasPlus ? '+' : ''}${chunks.join(' ')}`;
}

export function preferNonEmpty(current: string, fallback: string): string {
  return current.trim().length > 0 ? current : fallback;
}

export function stepIndexFromFieldPath(path: string): number {
  if (path.startsWith('pet.')) {
    return path === 'pet.biteIncidentsCount' ? 1 : 0;
  }
  if (path.startsWith('vaccinations.')) {
    return 2;
  }
  if (path.startsWith('medicalRecords.')) {
    return 3;
  }
  if (path.startsWith('feedingInfo.')) {
    return 4;
  }
  if (path.startsWith('groomingInfo.')) {
    return 5;
  }
  if (path.startsWith('emergencyInfo.')) {
    return 6;
  }
  return 0;
}

export function emptyDraft(): PassportDraft {
  return {
    pet: {
      name: '',
      breed: '',
      age: '',
      weight: '',
      gender: '',
      allergies: '',
      photoUrl: '',
      dateOfBirth: '',
      microchipNumber: '',
      neuteredSpayed: false,
      color: '',
      sizeCategory: '',
      energyLevel: '',
      aggressionLevel: '',
      isBiteHistory: false,
      biteIncidentsCount: '0',
      houseTrained: false,
      leashTrained: false,
      crateTrained: false,
      socialWithDogs: '',
      socialWithCats: '',
      socialWithChildren: '',
      separationAnxiety: false,
      hasDisability: false,
      disabilityDetails: '',
    },
    vaccinations: [],
    medicalRecords: [],
    feedingInfo: {
      foodType: '',
      brandName: '',
      feedingSchedule: '',
      foodAllergies: '',
      specialDietNotes: '',
      treatsAllowed: true,
    },
    groomingInfo: {
      coatType: '',
      mattingProne: false,
      groomingFrequency: '',
      lastGroomingDate: '',
      nailTrimFrequency: '',
    },
    emergencyInfo: {
      emergencyContactName: '',
      emergencyContactPhone: '',
      preferredVetClinic: '',
      preferredVetPhone: '',
    },
  };
}

export function mapProfileToDraft(profile: FullPetProfile): PassportDraft {
  return {
    pet: {
      id: profile.pet.id,
      name: profile.pet.name,
      breed: profile.pet.breed ?? '',
      age: profile.pet.age !== null ? String(profile.pet.age) : '',
      weight: profile.pet.weight !== null ? String(profile.pet.weight) : '',
      gender: normalizePetGenderValue(profile.pet.gender),
      allergies: profile.pet.allergies ?? '',
      photoUrl: profile.pet.photo_url ?? '',
      dateOfBirth: profile.pet.date_of_birth ?? '',
      microchipNumber: profile.pet.microchip_number ?? '',
      neuteredSpayed: profile.pet.neutered_spayed,
      color: profile.pet.color ?? '',
      sizeCategory: normalizeSizeCategoryValue(profile.pet.size_category),
      energyLevel: profile.pet.energy_level ?? '',
      aggressionLevel: profile.pet.aggression_level ?? '',
      isBiteHistory: profile.pet.is_bite_history,
      biteIncidentsCount: String(profile.pet.bite_incidents_count ?? 0),
      houseTrained: profile.pet.house_trained,
      leashTrained: profile.pet.leash_trained,
      crateTrained: profile.pet.crate_trained,
      socialWithDogs: normalizeSocialCompatibilityValue(profile.pet.social_with_dogs),
      socialWithCats: normalizeSocialCompatibilityValue(profile.pet.social_with_cats),
      socialWithChildren: normalizeSocialCompatibilityValue(profile.pet.social_with_children),
      separationAnxiety: profile.pet.separation_anxiety,
      hasDisability: profile.pet.has_disability ?? false,
      disabilityDetails: profile.pet.disability_details ?? '',
    },
    vaccinations: profile.vaccinations.map((item) => ({
      id: item.id,
      vaccineName: item.vaccine_name,
      brandName: item.brand_name ?? '',
      batchNumber: item.batch_number ?? '',
      doseNumber: item.dose_number !== null ? String(item.dose_number) : '',
      administeredDate: item.administered_date,
      nextDueDate: item.next_due_date ?? '',
      veterinarianName: item.veterinarian_name ?? '',
      clinicName: item.clinic_name ?? '',
      certificateUrl: item.certificate_url ?? '',
      reminderEnabled: item.reminder_enabled,
    })),
    medicalRecords: profile.medicalRecords.map((item) => ({
      id: item.id,
      conditionName: item.condition_name,
      diagnosisDate: item.diagnosis_date ?? '',
      ongoing: item.ongoing,
      medications: item.medications ?? '',
      specialCareInstructions: item.special_care_instructions ?? '',
      vetName: item.vet_name ?? '',
      documentUrl: item.document_url ?? '',
    })),
    feedingInfo: {
      foodType: profile.feedingInfo?.food_type ?? '',
      brandName: profile.feedingInfo?.brand_name ?? '',
      feedingSchedule: profile.feedingInfo?.feeding_schedule ?? '',
      foodAllergies: profile.feedingInfo?.food_allergies ?? '',
      specialDietNotes: profile.feedingInfo?.special_diet_notes ?? '',
      treatsAllowed: profile.feedingInfo?.treats_allowed ?? true,
    },
    groomingInfo: {
      coatType: profile.groomingInfo?.coat_type ?? '',
      mattingProne: profile.groomingInfo?.matting_prone ?? false,
      groomingFrequency: normalizeGroomingFrequencyValue(profile.groomingInfo?.grooming_frequency),
      lastGroomingDate: profile.groomingInfo?.last_grooming_date ?? '',
      nailTrimFrequency: profile.groomingInfo?.nail_trim_frequency ?? '',
    },
    emergencyInfo: {
      emergencyContactName: profile.emergencyInfo?.emergency_contact_name ?? '',
      emergencyContactPhone: profile.emergencyInfo?.emergency_contact_phone ?? '',
      preferredVetClinic: profile.emergencyInfo?.preferred_vet_clinic ?? '',
      preferredVetPhone: profile.emergencyInfo?.preferred_vet_phone ?? '',
    },
  };
}

export function vaccinationStatus(nextDueDate: string): 'overdue' | 'due-soon' | 'up-to-date' {
  if (!nextDueDate) {
    return 'up-to-date';
  }

  const today = new Date();
  const dueDate = new Date(nextDueDate);
  const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) {
    return 'overdue';
  }
  if (diffInDays <= 14) {
    return 'due-soon';
  }
  return 'up-to-date';
}
