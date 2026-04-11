type VaccinationPatchLike =
  | {
      _delete?: false;
      vaccineName: string;
      administeredDate: string;
      nextDueDate?: string | null;
    }
  | {
      _delete: true;
      id?: string;
    };

type EmergencyInfoPatchLike = {
  emergencyContactPhone?: string | null;
  preferredVetPhone?: string | null;
};

export function normalizeOptionalString(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function validateVaccinationPatch(vaccinations: VaccinationPatchLike[]) {
  const dedupe = new Set<string>();

  for (const vaccination of vaccinations) {
    if (vaccination._delete) {
      continue;
    }

    if (vaccination.nextDueDate && vaccination.nextDueDate < vaccination.administeredDate) {
      return 'Vaccination next due date cannot be before administered date.';
    }

    const vaccineName = vaccination.vaccineName.trim().toLowerCase();
    const dedupeKey = `${vaccineName}|${vaccination.administeredDate}`;
    if (dedupe.has(dedupeKey)) {
      return 'Duplicate vaccination entry detected for the same date.';
    }
    dedupe.add(dedupeKey);
  }

  return null;
}

export function validateEmergencyPhones(info: EmergencyInfoPatchLike) {
  const phonePattern = /^[0-9+()\-\s]{7,20}$/;
  const emergencyPhone = normalizeOptionalString(info.emergencyContactPhone);
  const preferredVetPhone = normalizeOptionalString(info.preferredVetPhone);

  if (emergencyPhone && !phonePattern.test(emergencyPhone)) {
    return 'Invalid emergency contact phone format.';
  }

  if (preferredVetPhone && !phonePattern.test(preferredVetPhone)) {
    return 'Invalid preferred vet phone format.';
  }

  return null;
}
