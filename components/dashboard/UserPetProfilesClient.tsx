'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastProvider';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import { MAX_PET_AGE_YEARS, isPetDateOfBirthWithinBounds } from '@/lib/utils/date';
import { calculatePetCompletionFromSections } from '@/lib/utils/pet-completion';
import PetHeroHeader from './PetHeroHeader';

import type {
  Pet,
  PetShareRecord,
  PassportDraft,
  FullPetProfile,
  PetCreateForm,
  VaccinationDraft,
  MedicalDraft,
  ReminderGroup,
  ReminderPreferences,
} from './user/types';
import { STEPS, CAPITALIZE_PET_FIELDS, STEP_DESCRIPTIONS } from './user/constants';
import {
  emptyDraft,
  mapProfileToDraft,
  normalizeDisplayImageUrl,
  normalizeStorageObjectPath,
  normalizePetGenderValue,
  capitalizeFirstLetter,
  preferNonEmpty,
  stepIndexFromFieldPath,
} from './user/utils';

import PetListSection from './user/PetListSection';
import CreatePetModal from './user/CreatePetModal';
import SharePetModal from './user/SharePetModal';
import PassportSnapshot from './user/PassportSnapshot';
import PassportEditorModal from './user/PassportEditorModal';

// Suppress unused-vars warning for STEP_DESCRIPTIONS — used in PassportEditorModal via prop
void STEP_DESCRIPTIONS;

export default function UserPetProfilesClient({
  initialPets,
  initialSelectedPetId,
  embedded = false,
}: {
  initialPets: Pet[];
  initialSelectedPetId?: number | null;
  embedded?: boolean;
}) {
  const passportSectionRef = useRef<HTMLDivElement | null>(null);
  const [pets, setPets] = useState(initialPets);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [expandedVaccinations, setExpandedVaccinations] = useState<Record<number, boolean>>({});
  const [expandedMedicalRecords, setExpandedMedicalRecords] = useState<Record<number, boolean>>({});
  const [selectedPetId, setSelectedPetId] = useState<number | null>(() => {
    if (typeof initialSelectedPetId === 'number' && initialPets.some((pet) => pet.id === initialSelectedPetId)) {
      return initialSelectedPetId;
    }
    return initialPets[0]?.id ?? null;
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PassportDraft>(emptyDraft());
  const [newPet, setNewPet] = useState<PetCreateForm>({ name: '', breed: '', age: '', gender: '' });
  const [newPetPhotoFile, setNewPetPhotoFile] = useState<File | null>(null);
  const [isCreatePetModalOpen, setIsCreatePetModalOpen] = useState(false);
  const [isEditPassportModalOpen, setIsEditPassportModalOpen] = useState(false);
  const [passportPhotoFile, setPassportPhotoFile] = useState<File | null>(null);
  const [passportPhotoPreviewUrl, setPassportPhotoPreviewUrl] = useState<string | null>(null);
  const [passportPhotoObjectUrl, setPassportPhotoObjectUrl] = useState<string | null>(null);
  const [removePassportPhoto, setRemovePassportPhoto] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalPetId, setShareModalPetId] = useState<number | null>(null);
  const [petShares, setPetShares] = useState<PetShareRecord[]>([]);
  const [shareInviteEmail, setShareInviteEmail] = useState('');
  const [shareInviteRole, setShareInviteRole] = useState<'manager' | 'viewer'>('viewer');
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isMutatingShares, setIsMutatingShares] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [reminders, setReminders] = useState<ReminderGroup[]>([]);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences>({
    daysAhead: 7,
    inAppEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
  });
  const [deletedVaccinationIds, setDeletedVaccinationIds] = useState<string[]>([]);
  const [deletedMedicalRecordIds, setDeletedMedicalRecordIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'draft-saved' | 'error'>('idle');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [highlightStepIndex, setHighlightStepIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) ?? null, [pets, selectedPetId]);
  const selectedPetAccessRole = selectedPet?.access_role ?? 'owner';
  const canEditSelectedPet = selectedPetAccessRole === 'owner' || selectedPetAccessRole === 'manager';
  const canShareSelectedPet = selectedPetAccessRole === 'owner';
  const selectedPetFallback = useMemo(
    () => ({
      name: selectedPet?.name ?? '',
      breed: selectedPet?.breed ?? '',
      age: selectedPet?.age !== null && selectedPet?.age !== undefined ? String(selectedPet.age) : '',
      gender: normalizePetGenderValue(selectedPet?.gender),
    }),
    [selectedPet?.name, selectedPet?.breed, selectedPet?.age, selectedPet?.gender],
  );

  const draftStorageKey = selectedPetId ? `pet-passport-draft-${selectedPetId}` : null;
  const hasExistingPassportPhoto =
    Boolean(selectedPetId && photoUrls[selectedPetId]) || Boolean(draft.pet.photoUrl.trim().length > 0);
  const effectivePassportPhotoPreviewUrl =
    passportPhotoPreviewUrl ?? (selectedPetId ? (photoUrls[selectedPetId] ?? normalizeDisplayImageUrl(draft.pet.photoUrl)) : null);

  // ── Completion ──────────────────────────────────��───────────────────────────

  const stepCompletion = useMemo(() => {
    const age = draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null;
    const weight = draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null;
    const basicComplete =
      draft.pet.name.trim().length > 0 &&
      (age === null || (Number.isFinite(age) && age >= 0 && age <= MAX_PET_AGE_YEARS)) &&
      isPetDateOfBirthWithinBounds(draft.pet.dateOfBirth) &&
      (weight === null || (Number.isFinite(weight) && weight > 0 && weight <= 300));

    const biteCount = draft.pet.biteIncidentsCount.trim() ? Number.parseInt(draft.pet.biteIncidentsCount, 10) : 0;
    const behaviorTouched =
      draft.pet.aggressionLevel.trim().length > 0 ||
      draft.pet.socialWithDogs.trim().length > 0 ||
      draft.pet.socialWithCats.trim().length > 0 ||
      draft.pet.socialWithChildren.trim().length > 0 ||
      draft.pet.isBiteHistory ||
      draft.pet.houseTrained ||
      draft.pet.leashTrained ||
      draft.pet.crateTrained ||
      draft.pet.separationAnxiety ||
      draft.pet.hasDisability ||
      draft.pet.disabilityDetails.trim().length > 0;
    const behaviorComplete = behaviorTouched && Number.isFinite(biteCount) && biteCount >= 0;

    const vaccinationsTouched = draft.vaccinations.length > 0;
    const vaccinationsComplete =
      vaccinationsTouched &&
      draft.vaccinations.every((row) => {
        if (!row.vaccineName.trim() || !row.administeredDate) {
          return false;
        }
        if (row.nextDueDate && row.nextDueDate < row.administeredDate) {
          return false;
        }
        return true;
      });

    const medicalTouched = draft.medicalRecords.length > 0;
    const medicalComplete = medicalTouched && draft.medicalRecords.every((row) => row.conditionName.trim().length > 0);

    const feedingComplete =
      draft.feedingInfo.foodType.trim().length > 0 ||
      draft.feedingInfo.brandName.trim().length > 0 ||
      draft.feedingInfo.feedingSchedule.trim().length > 0 ||
      draft.feedingInfo.foodAllergies.trim().length > 0 ||
      draft.feedingInfo.specialDietNotes.trim().length > 0 ||
      draft.feedingInfo.treatsAllowed !== true;

    const groomingComplete =
      draft.groomingInfo.coatType.trim().length > 0 ||
      draft.groomingInfo.groomingFrequency.trim().length > 0 ||
      draft.groomingInfo.lastGroomingDate.trim().length > 0 ||
      draft.groomingInfo.nailTrimFrequency.trim().length > 0 ||
      draft.groomingInfo.mattingProne;

    const phonePattern = /^[0-9+()\-\s]{7,20}$/;
    const emergencyPhone = draft.emergencyInfo.emergencyContactPhone.trim();
    const preferredPhone = draft.emergencyInfo.preferredVetPhone.trim();
    const emergencyTouched =
      draft.emergencyInfo.emergencyContactName.trim().length > 0 ||
      emergencyPhone.length > 0 ||
      draft.emergencyInfo.preferredVetClinic.trim().length > 0 ||
      preferredPhone.length > 0;
    const emergencyComplete =
      emergencyTouched &&
      (!emergencyPhone || phonePattern.test(emergencyPhone)) &&
      (!preferredPhone || phonePattern.test(preferredPhone));

    return [basicComplete, behaviorComplete, vaccinationsComplete, medicalComplete, feedingComplete, groomingComplete, emergencyComplete];
  }, [draft]);

  const completionPercent = useMemo(() => {
    return calculatePetCompletionFromSections({
      basic: stepCompletion[0] ?? false,
      behavior: stepCompletion[1] ?? false,
      vaccinations: stepCompletion[2] ?? false,
      medical: stepCompletion[3] ?? false,
      feeding: stepCompletion[4] ?? false,
      grooming: stepCompletion[5] ?? false,
      emergency: stepCompletion[6] ?? false,
    });
  }, [stepCompletion]);

  const missingSteps = useMemo(() => {
    return STEPS.map((label, index) => ({ label, index })).filter((item) => !stepCompletion[item.index]);
  }, [stepCompletion]);

  // ── Effects ──────────────────────────────────────────────���──────────────────

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (passportPhotoObjectUrl) {
        URL.revokeObjectURL(passportPhotoObjectUrl);
      }
    };
  }, [passportPhotoObjectUrl]);

  useEffect(() => {
    if (!isEditPassportModalOpen) {
      setPassportPhotoFile(null);
      setPassportPhotoPreviewUrl(null);
      setRemovePassportPhoto(false);
      setPassportPhotoObjectUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
    }
  }, [isEditPassportModalOpen]);

  useEffect(() => {
    setPassportPhotoFile(null);
    setPassportPhotoPreviewUrl(null);
    setRemovePassportPhoto(false);
    setPassportPhotoObjectUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, [selectedPetId]);

  useEffect(() => {
    let active = true;

    async function hydratePhotoUrls() {
      const entries = await Promise.all(
        pets.map(async (pet): Promise<[number, string]> => {
          if (!pet.photo_url) {
            return [pet.id, ''];
          }

          const isStorageReference = /\/storage\/v1\/object\//.test(pet.photo_url);
          const isDirectlyUsableStorageUrl = /\/storage\/v1\/object\/(public|sign)\//.test(pet.photo_url) || pet.photo_url.includes('token=');
          const directUrl = normalizeDisplayImageUrl(pet.photo_url);

          if (isDirectlyUsableStorageUrl) {
            return [pet.id, directUrl];
          }

          if (directUrl && !isStorageReference) {
            return [pet.id, directUrl];
          }

          try {
            const response = await fetch('/api/storage/signed-read-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bucket: 'pet-photos',
                path: normalizeStorageObjectPath(pet.photo_url),
                expiresIn: 3600,
              }),
            });

            if (!response.ok) {
              return [pet.id, directUrl];
            }

            const payload = (await response.json().catch(() => null)) as { signedUrl?: string } | null;
            const signedUrl = normalizeDisplayImageUrl(payload?.signedUrl);
            return [pet.id, signedUrl || directUrl];
          } catch (err) { console.error(err);
            return [pet.id, directUrl];
          }
        }),
      );

      if (!active) {
        return;
      }

      const next: Record<number, string> = {};
      entries.forEach(([id, url]) => {
        if (url) {
          next[id] = url;
        }
      });
      setPhotoUrls(next);
    }

    hydratePhotoUrls();

    return () => {
      active = false;
    };
  }, [pets]);

  useEffect(() => {
    if (!selectedPetId) {
      setDraft(emptyDraft());
      return;
    }

    let active = true;

    async function loadProfile() {
      setIsLoadingProfile(true);

      try {
        const response = await fetch(`/api/user/pets/${selectedPetId}/passport`);
        if (!response.ok) {
          if (active) {
            showToastRef.current('Unable to load pet passport.', 'error');
          }
          return;
        }

        const payload = (await response.json().catch(() => null)) as { profile?: FullPetProfile } | null;

        if (!active || !payload?.profile) {
          return;
        }

        const profileDraft = mapProfileToDraft(payload.profile);
        const baseDraft = {
          ...profileDraft,
          pet: {
            ...profileDraft.pet,
            name: preferNonEmpty(profileDraft.pet.name, selectedPetFallback.name),
            breed: preferNonEmpty(profileDraft.pet.breed, selectedPetFallback.breed),
            age: preferNonEmpty(profileDraft.pet.age, selectedPetFallback.age),
            gender: preferNonEmpty(profileDraft.pet.gender, selectedPetFallback.gender),
          },
        };
        setDraft(baseDraft);

        setPets((current) =>
          current.map((pet) =>
            pet.id === selectedPetId
              ? {
                  ...pet,
                  name: payload.profile!.pet.name,
                  breed: payload.profile!.pet.breed,
                  age: payload.profile!.pet.age,
                  weight: payload.profile!.pet.weight,
                  gender: normalizePetGenderValue(payload.profile!.pet.gender) || null,
                  allergies: payload.profile!.pet.allergies,
                  photo_url: payload.profile!.pet.photo_url,
                  date_of_birth: payload.profile!.pet.date_of_birth,
                  aggression_level: payload.profile!.pet.aggression_level,
                  has_disability: payload.profile!.pet.has_disability,
                  disability_details: payload.profile!.pet.disability_details,
                }
              : pet,
          ),
        );

        setDeletedVaccinationIds([]);
        setDeletedMedicalRecordIds([]);
        setSavedSnapshot(
          JSON.stringify({
            draft: baseDraft,
            deletedVaccinationIds: [],
            deletedMedicalRecordIds: [],
          }),
        );
        setHasUnsavedChanges(false);
        setFieldErrors({});
        setSaveStatus('idle');
      } catch (err) { console.error(err);
        if (active) {
          showToastRef.current('Unable to load pet passport.', 'error');
        }
      } finally {
        if (active) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [selectedPetId, selectedPetFallback]);

  useEffect(() => {
    let active = true;

    async function loadReminderPreferences() {
      const response = await fetch('/api/user/pets/reminder-preferences');
      if (!response.ok || !active) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as { preferences?: ReminderPreferences } | null;
      if (payload?.preferences && active) {
        setReminderPreferences(payload.preferences);
      }
    }

    async function loadReminders() {
      const response = await fetch('/api/user/pets/upcoming-vaccinations');
      if (!response.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as {
        reminders?: ReminderGroup[];
        daysAhead?: number;
        channels?: Omit<ReminderPreferences, 'daysAhead'>;
      } | null;
      if (payload?.reminders && active) {
        setReminders(payload.reminders);
      }

      if (payload?.daysAhead && payload?.channels && active) {
        setReminderPreferences({
          daysAhead: payload.daysAhead,
          inAppEnabled: payload.channels.inAppEnabled,
          emailEnabled: payload.channels.emailEnabled,
          whatsappEnabled: payload.channels.whatsappEnabled,
        });
      }
    }

    loadReminderPreferences();
    loadReminders();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftStorageKey || !selectedPetId) {
      return;
    }

    const handle = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setLastDraftSavedAt(new Date().toISOString());
      setSaveStatus('draft-saved');
    }, 900);

    return () => {
      window.clearTimeout(handle);
    };
  }, [draft, draftStorageKey, selectedPetId]);

  useEffect(() => {
    if (!selectedPetId || !savedSnapshot) {
      return;
    }

    const currentSnapshot = JSON.stringify({
      draft,
      deletedVaccinationIds,
      deletedMedicalRecordIds,
    });

    setHasUnsavedChanges(currentSnapshot !== savedSnapshot);
  }, [draft, deletedVaccinationIds, deletedMedicalRecordIds, savedSnapshot, selectedPetId]);

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (highlightStepIndex === null || highlightStepIndex !== stepIndex) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightStepIndex(null);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightStepIndex, stepIndex]);

  // ── Keyboard nav ────────────────────��───────────────────────────────────────

  function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  const persistDraftLocally = useCallback(
    (showSuccessToast = false) => {
      if (!draftStorageKey) {
        return;
      }
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setLastDraftSavedAt(new Date().toISOString());
      setSaveStatus('draft-saved');
      if (showSuccessToast) {
        showToast('Draft saved locally.', 'success');
      }
    },
    [draftStorageKey, draft, showToast],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selectedPetId || isTypingTarget(event.target) || !event.altKey) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        persistDraftLocally(false);
        const nextStep = Math.min(STEPS.length - 1, stepIndex + 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        persistDraftLocally(false);
        const nextStep = Math.max(0, stepIndex - 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [selectedPetId, stepIndex, persistDraftLocally]);

  // ── Helpers ───────────────────���─────────────────────────────────────────────

  function getFieldError(path: string) {
    return fieldErrors[path] ?? null;
  }

  function saveDraftLocally() {
    persistDraftLocally(true);
  }

  function jumpToStepWithHighlight(targetStepIndex: number) {
    setStepIndex(targetStepIndex);
    setHighlightStepIndex(targetStepIndex);
  }

  function jumpToFirstError() {
    const firstErrorPath = Object.keys(fieldErrors)[0];
    if (!firstErrorPath) {
      return;
    }

    jumpToStepWithHighlight(stepIndexFromFieldPath(firstErrorPath));
  }

  function canLeaveCurrentContext() {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm('You have unsaved changes. Continue and discard unsaved progress?');
  }

  function selectPetWithGuard(nextPetId: number) {
    if (selectedPetId === nextPetId) {
      setTimeout(() => passportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return;
    }

    if (!canLeaveCurrentContext()) {
      return;
    }

    setSelectedPetId(nextPetId);
    setIsEditPassportModalOpen(false);
    setStepIndex(0);
    setHighlightStepIndex(0);
    setTimeout(() => passportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  // ── Validation ─────────────────────────────���────────────────────────��────────

  function validateCurrentStep() {
    const nextErrors: Record<string, string> = {};

    if (stepIndex === 0 && !draft.pet.name.trim()) {
      nextErrors['pet.name'] = 'Pet name is required.';
    }

    if (stepIndex === 0) {
      const age = draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null;
      const weight = draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null;

      if (age !== null && (!Number.isFinite(age) || age < 0 || age > MAX_PET_AGE_YEARS)) {
        nextErrors['pet.age'] = `Age must be between 0 and ${MAX_PET_AGE_YEARS}.`;
      }

      if (!isPetDateOfBirthWithinBounds(draft.pet.dateOfBirth)) {
        nextErrors['pet.dateOfBirth'] = `Date of birth cannot be more than ${MAX_PET_AGE_YEARS} years ago.`;
      }

      if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 300)) {
        nextErrors['pet.weight'] = 'Weight must be between 0.1 and 300 kg.';
      }
    }

    if (stepIndex === 1) {
      const biteCount = draft.pet.biteIncidentsCount.trim() ? Number.parseInt(draft.pet.biteIncidentsCount, 10) : 0;
      if (!Number.isFinite(biteCount) || biteCount < 0) {
        nextErrors['pet.biteIncidentsCount'] = 'Bite incidents must be 0 or greater.';
      }
    }

    if (stepIndex === 2) {
      const seenVaccinations = new Set<string>();
      for (const [index, row] of draft.vaccinations.entries()) {
        if (!row.vaccineName.trim()) {
          nextErrors[`vaccinations.${index}.vaccineName`] = 'Vaccine name is required.';
        }
        if (!row.administeredDate) {
          nextErrors[`vaccinations.${index}.administeredDate`] = 'Administered date is required.';
        }

        if (row.nextDueDate && row.nextDueDate < row.administeredDate) {
          nextErrors[`vaccinations.${index}.nextDueDate`] = 'Next due date cannot be before administered date.';
        }

        if (row.vaccineName.trim() && row.administeredDate) {
          const dedupeKey = `${row.vaccineName.trim().toLowerCase()}|${row.administeredDate}`;
          if (seenVaccinations.has(dedupeKey)) {
            nextErrors[`vaccinations.${index}.vaccineName`] = 'Duplicate vaccine entry for this date.';
          }
          seenVaccinations.add(dedupeKey);
        }
      }
    }

    if (stepIndex === 3) {
      for (const [index, row] of draft.medicalRecords.entries()) {
        if (!row.conditionName.trim()) {
          nextErrors[`medicalRecords.${index}.conditionName`] = 'Condition name is required.';
        }
      }
    }

    if (stepIndex === 6) {
      const phonePattern = /^[0-9+()\-\s]{7,20}$/;
      const emergencyPhone = draft.emergencyInfo.emergencyContactPhone.trim();
      const preferredVetPhone = draft.emergencyInfo.preferredVetPhone.trim();

      if (emergencyPhone && !phonePattern.test(emergencyPhone)) {
        nextErrors['emergencyInfo.emergencyContactPhone'] = 'Invalid emergency contact phone format.';
      }

      if (preferredVetPhone && !phonePattern.test(preferredVetPhone)) {
        nextErrors['emergencyInfo.preferredVetPhone'] = 'Invalid preferred vet phone format.';
      }
    }

    setFieldErrors(nextErrors);

    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      showToast(firstError, 'error');
      return false;
    }

    return true;
  }

  // ── API payload builder ───────────────────────────���───────────────────────���──

  function buildStepPayload() {
    const basePayload = { stepIndex };

    if (stepIndex === 0) {
      const normalizedPhotoUrl = removePassportPhoto ? null : draft.pet.photoUrl.trim() || undefined;

      return {
        ...basePayload,
        pet: {
          name: draft.pet.name.trim(),
          breed: draft.pet.breed.trim() || null,
          age: draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null,
          weight: draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null,
          gender: normalizePetGenderValue(draft.pet.gender) || null,
          allergies: draft.pet.allergies.trim() || null,
          photoUrl: normalizedPhotoUrl,
          dateOfBirth: draft.pet.dateOfBirth || null,
          microchipNumber: draft.pet.microchipNumber.trim() || null,
          neuteredSpayed: draft.pet.neuteredSpayed,
          color: draft.pet.color.trim() || null,
          sizeCategory: draft.pet.sizeCategory.trim() || null,
          energyLevel: draft.pet.energyLevel.trim() || null,
        },
      };
    }

    if (stepIndex === 1) {
      return {
        ...basePayload,
        pet: {
          aggressionLevel: draft.pet.aggressionLevel || null,
          isBiteHistory: draft.pet.isBiteHistory,
          biteIncidentsCount: draft.pet.biteIncidentsCount.trim() ? Number.parseInt(draft.pet.biteIncidentsCount, 10) : 0,
          houseTrained: draft.pet.houseTrained,
          leashTrained: draft.pet.leashTrained,
          crateTrained: draft.pet.crateTrained,
          socialWithDogs: draft.pet.socialWithDogs.trim() || null,
          socialWithCats: draft.pet.socialWithCats.trim() || null,
          socialWithChildren: draft.pet.socialWithChildren.trim() || null,
          separationAnxiety: draft.pet.separationAnxiety,
          hasDisability: draft.pet.hasDisability,
          disabilityDetails: draft.pet.disabilityDetails.trim() || null,
        },
      };
    }

    if (stepIndex === 2) {
      return {
        ...basePayload,
        vaccinations: [
          ...draft.vaccinations.map((item) => ({
            id: item.id,
            vaccineName: item.vaccineName.trim(),
            brandName: item.brandName.trim() || null,
            batchNumber: item.batchNumber.trim() || null,
            doseNumber: item.doseNumber.trim() ? Number.parseInt(item.doseNumber, 10) : null,
            administeredDate: item.administeredDate,
            nextDueDate: item.nextDueDate || null,
            veterinarianName: item.veterinarianName.trim() || null,
            clinicName: item.clinicName.trim() || null,
            certificateUrl: item.certificateUrl.trim() || null,
            reminderEnabled: item.reminderEnabled,
            _delete: false,
          })),
          ...deletedVaccinationIds.map((id) => ({ id, _delete: true })),
        ],
      };
    }

    if (stepIndex === 3) {
      return {
        ...basePayload,
        medicalRecords: [
          ...draft.medicalRecords.map((item) => ({
            id: item.id,
            conditionName: item.conditionName.trim(),
            diagnosisDate: item.diagnosisDate || null,
            ongoing: item.ongoing,
            medications: item.medications.trim() || null,
            specialCareInstructions: item.specialCareInstructions.trim() || null,
            vetName: item.vetName.trim() || null,
            documentUrl: item.documentUrl.trim() || null,
            _delete: false,
          })),
          ...deletedMedicalRecordIds.map((id) => ({ id, _delete: true })),
        ],
      };
    }

    if (stepIndex === 4) {
      return {
        ...basePayload,
        feedingInfo: {
          foodType: draft.feedingInfo.foodType.trim() || null,
          brandName: draft.feedingInfo.brandName.trim() || null,
          feedingSchedule: draft.feedingInfo.feedingSchedule.trim() || null,
          foodAllergies: draft.feedingInfo.foodAllergies.trim() || null,
          specialDietNotes: draft.feedingInfo.specialDietNotes.trim() || null,
          treatsAllowed: draft.feedingInfo.treatsAllowed,
        },
      };
    }

    if (stepIndex === 5) {
      return {
        ...basePayload,
        groomingInfo: {
          coatType: draft.groomingInfo.coatType.trim() || null,
          mattingProne: draft.groomingInfo.mattingProne,
          groomingFrequency: draft.groomingInfo.groomingFrequency.trim() || null,
          lastGroomingDate: draft.groomingInfo.lastGroomingDate || null,
          nailTrimFrequency: draft.groomingInfo.nailTrimFrequency.trim() || null,
        },
      };
    }

    return {
      ...basePayload,
      emergencyInfo: {
        emergencyContactName: draft.emergencyInfo.emergencyContactName.trim() || null,
        emergencyContactPhone: draft.emergencyInfo.emergencyContactPhone.trim() || null,
        preferredVetClinic: draft.emergencyInfo.preferredVetClinic.trim() || null,
        preferredVetPhone: draft.emergencyInfo.preferredVetPhone.trim() || null,
      },
    };
  }

  async function attachUploadedPetPhotoToPayload(payload: ReturnType<typeof buildStepPayload>) {
    if (stepIndex !== 0 || !passportPhotoFile || !selectedPetId) {
      return payload;
    }

    try {
      const uploaded = await uploadCompressedImage(passportPhotoFile, 'pet-photos');
      const nextPayload = payload as ReturnType<typeof buildStepPayload> & { pet?: Record<string, unknown> };
      nextPayload.pet = {
        ...(nextPayload.pet ?? {}),
        photoUrl: uploaded.path,
      };

      setDraft((current) => ({
        ...current,
        pet: {
          ...current.pet,
          photoUrl: uploaded.path,
        },
      }));
      setPhotoUrls((current) => ({
        ...current,
        [selectedPetId]: normalizeDisplayImageUrl(uploaded.signedUrl),
      }));
      setPassportPhotoFile(null);
      setRemovePassportPhoto(false);
      setPassportPhotoPreviewUrl(uploaded.signedUrl);
      setPassportPhotoObjectUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });

      return nextPayload;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Pet photo upload failed.', 'error');
      return null;
    }
  }

  // ── Save helpers (shared between Save Step and Next/Complete) ────────────────

  function applyOptimisticPetUpdate() {
    if (stepIndex !== 0 || !selectedPetId) {
      return;
    }
    setPets((current) =>
      current.map((pet) =>
        pet.id === selectedPetId
          ? {
              ...pet,
              name: draft.pet.name.trim() || pet.name,
              breed: draft.pet.breed.trim() || null,
              age: draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null,
              weight: draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null,
              gender: normalizePetGenderValue(draft.pet.gender) || null,
              allergies: draft.pet.allergies.trim() || null,
              has_disability: draft.pet.hasDisability,
              disability_details: draft.pet.disabilityDetails.trim() || null,
            }
          : pet,
      ),
    );
  }

  function applyServerProfileResponse(body: { profile?: FullPetProfile } | null) {
    if (!body?.profile) {
      return;
    }
    const normalizedDraft = mapProfileToDraft(body.profile);
    setDraft(normalizedDraft);
    setPets((current) =>
      current.map((pet) =>
        pet.id === selectedPetId
          ? {
              ...pet,
              name: body.profile!.pet.name,
              breed: body.profile!.pet.breed,
              age: body.profile!.pet.age,
              weight: body.profile!.pet.weight,
              gender: normalizePetGenderValue(body.profile!.pet.gender) || null,
              allergies: body.profile!.pet.allergies,
              photo_url: body.profile!.pet.photo_url,
              has_disability: body.profile!.pet.has_disability,
              disability_details: body.profile!.pet.disability_details,
            }
          : pet,
      ),
    );
    setSavedSnapshot(
      JSON.stringify({
        draft: normalizedDraft,
        deletedVaccinationIds: [],
        deletedMedicalRecordIds: [],
      }),
    );
  }

  function clearAfterSave() {
    if (draftStorageKey) {
      window.localStorage.removeItem(draftStorageKey);
    }
    setFieldErrors({});
    setDeletedVaccinationIds([]);
    setDeletedMedicalRecordIds([]);
    setHasUnsavedChanges(false);
    setSaveStatus('saved');
  }

  // ── Save step (without navigation) ──────────────────────────────────────────

  function saveCurrentStepOnly() {
    if (!selectedPetId) {
      showToast('Create or select a pet first.', 'error');
      return;
    }

    if (!canEditSelectedPet) {
      showToast('This pet is shared as view-only for your account.', 'error');
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    const payload = buildStepPayload();
    const previousPets = pets;

    startTransition(async () => {
      setSaveStatus('saving');
      const payloadWithPhoto = await attachUploadedPetPhotoToPayload(payload);
      if (!payloadWithPhoto) {
        setSaveStatus('error');
        return;
      }
      applyOptimisticPetUpdate();

      const response = await fetch(`/api/user/pets/${selectedPetId}/passport`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithPhoto),
      });

      if (!response.ok) {
        setSaveStatus('error');
        if (stepIndex === 0) {
          setPets(previousPets);
        }
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(body?.error ?? 'Unable to save this step.', 'error');
        return;
      }

      const body = (await response.json().catch(() => null)) as { profile?: FullPetProfile } | null;
      applyServerProfileResponse(body);
      clearAfterSave();
      showToast('Step saved.', 'success');
    });
  }

  // ── Next / Complete ──────────────────────────────────────────────────────────

  function handleNextOrComplete() {
    const isLastStep = stepIndex === STEPS.length - 1;

    if (!selectedPetId) {
      showToast('Create or select a pet first.', 'error');
      return;
    }

    if (!canEditSelectedPet) {
      showToast('This pet is shared as view-only for your account.', 'error');
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    const payload = buildStepPayload();
    const previousPets = pets;

    startTransition(async () => {
      setSaveStatus('saving');
      const payloadWithPhoto = await attachUploadedPetPhotoToPayload(payload);
      if (!payloadWithPhoto) {
        setSaveStatus('error');
        return;
      }
      applyOptimisticPetUpdate();

      const response = await fetch(`/api/user/pets/${selectedPetId}/passport`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithPhoto),
      });

      if (!response.ok) {
        setSaveStatus('error');
        if (stepIndex === 0) {
          setPets(previousPets);
        }
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(body?.error ?? 'Unable to save this step.', 'error');
        return;
      }

      const body = (await response.json().catch(() => null)) as { profile?: FullPetProfile } | null;
      applyServerProfileResponse(body);
      clearAfterSave();

      if (isLastStep) {
        showToast('Pet passport completed successfully.', 'success');
        setIsEditPassportModalOpen(false);
        setStepIndex(0);
        setHighlightStepIndex(0);
      } else {
        showToast('Step saved.', 'success');
        const nextStep = Math.min(STEPS.length - 1, stepIndex + 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
      }
    });
  }

  // ── Pet CRUD ────────────────────────���───────────────────────────���────────────

  async function createPetProfile() {
    const name = newPet.name.trim();
    if (!name) {
      showToast('Pet name is required.', 'error');
      return;
    }

    const parsedAge = newPet.age.trim() ? Number.parseInt(newPet.age, 10) : null;
    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > MAX_PET_AGE_YEARS)) {
      showToast(`Pet age must be between 0 and ${MAX_PET_AGE_YEARS}.`, 'error');
      return;
    }

    let photoUrl: string | null = null;
    if (newPetPhotoFile) {
      try {
        const uploaded = await uploadCompressedImage(newPetPhotoFile, 'pet-photos');
        photoUrl = uploaded.path;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Photo upload failed.', 'error');
        return;
      }
    }

    startTransition(async () => {
      const response = await fetch('/api/user/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          breed: newPet.breed.trim() || null,
          age: parsedAge,
          gender: normalizePetGenderValue(newPet.gender) || null,
          photoUrl,
        }),
      });

      if (!response.ok) {
        showToast('Unable to create pet profile.', 'error');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { pet?: Pet } | null;
      if (!payload?.pet) {
        showToast('Unexpected response while creating pet.', 'error');
        return;
      }

      setPets((current) => [payload.pet!, ...current]);
      setSelectedPetId(payload.pet.id);
      setNewPet({ name: '', breed: '', age: '', gender: '' });
      setNewPetPhotoFile(null);
      setIsCreatePetModalOpen(false);
      showToast('Pet profile created.', 'success');
    });
  }

  async function deletePetProfile(petId: number, petName: string) {
    const pet = pets.find((item) => item.id === petId);
    const role = pet?.access_role ?? 'owner';

    if (role !== 'owner') {
      showToast('Only the pet owner can delete this profile.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${petName}'s profile? This action cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/user/pets/${petId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          showToast('Unable to delete pet profile.', 'error');
          return;
        }

        setPets((current) => current.filter((pet) => pet.id !== petId));

        if (selectedPetId === petId) {
          const remainingPets = pets.filter((pet) => pet.id !== petId);
          setSelectedPetId(remainingPets.length > 0 ? remainingPets[0].id : null);
        }

        showToast(`${petName}'s profile deleted successfully.`, 'success');
      } catch (err) { console.error(err);
        showToast('An error occurred while deleting the pet profile.', 'error');
      }
    });
  }

  // ── Pet shares ───────────────────────────────────────────────────────────────

  async function loadPetShares(petId: number) {
    setIsLoadingShares(true);

    try {
      const response = await fetch(`/api/user/pets/${petId}/shares`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as { shares?: PetShareRecord[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to load pet sharing settings.');
      }

      setPetShares(payload?.shares ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load pet sharing settings.', 'error');
      setPetShares([]);
    } finally {
      setIsLoadingShares(false);
    }
  }

  async function openShareModal(petId: number) {
    const pet = pets.find((item) => item.id === petId);
    const role = pet?.access_role ?? 'owner';

    if (role !== 'owner') {
      showToast('Only the pet owner can manage sharing.', 'error');
      return;
    }

    setShareModalPetId(petId);
    setShareInviteEmail('');
    setShareInviteRole('viewer');
    setIsShareModalOpen(true);
    await loadPetShares(petId);
  }

  async function invitePetShare() {
    if (!shareModalPetId) {
      return;
    }

    const email = shareInviteEmail.trim().toLowerCase();
    if (!email) {
      showToast('Enter an email address to share this pet.', 'error');
      return;
    }

    setIsMutatingShares(true);

    try {
      const response = await fetch(`/api/user/pets/${shareModalPetId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: shareInviteRole }),
      });

      const payload = (await response.json().catch(() => null)) as { shares?: PetShareRecord[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to share pet.');
      }

      setPetShares(payload?.shares ?? []);
      setShareInviteEmail('');
      setShareInviteRole('viewer');
      showToast('Pet sharing updated successfully.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to share pet.', 'error');
    } finally {
      setIsMutatingShares(false);
    }
  }

  async function updatePetShareRole(shareId: string, role: 'manager' | 'viewer') {
    if (!shareModalPetId) {
      return;
    }

    setIsMutatingShares(true);

    try {
      const response = await fetch(`/api/user/pets/${shareModalPetId}/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const payload = (await response.json().catch(() => null)) as { shares?: PetShareRecord[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to update share role.');
      }

      setPetShares(payload?.shares ?? []);
      showToast('Share role updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update share role.', 'error');
    } finally {
      setIsMutatingShares(false);
    }
  }

  async function revokePetShare(shareId: string) {
    if (!shareModalPetId) {
      return;
    }

    setIsMutatingShares(true);

    try {
      const response = await fetch(`/api/user/pets/${shareModalPetId}/shares/${shareId}`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as { shares?: PetShareRecord[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to revoke pet share.');
      }

      setPetShares(payload?.shares ?? []);
      showToast('Share access revoked.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to revoke pet share.', 'error');
    } finally {
      setIsMutatingShares(false);
    }
  }

  // ── Draft field updaters ─────────────────────────────────────────────────────

  function updatePetField<K extends keyof PassportDraft['pet']>(key: K, value: PassportDraft['pet'][K]) {
    let normalizedValue = value;

    if (key === 'age' && typeof value === 'string') {
      normalizedValue = value.replace(/\D/g, '').slice(0, 2) as PassportDraft['pet'][K];
    }

    if (typeof normalizedValue === 'string' && CAPITALIZE_PET_FIELDS.includes(key)) {
      normalizedValue = capitalizeFirstLetter(normalizedValue) as PassportDraft['pet'][K];
    }

    setDraft((current) => ({
      ...current,
      pet: { ...current.pet, [key]: normalizedValue },
    }));

    // Clear the field-specific error when the user edits that field
    const errorKey = `pet.${key}`;
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  }

  function updateNewPetField<K extends keyof PetCreateForm>(key: K, value: PetCreateForm[K], capitalize = false) {
    let normalizedValue = value;

    if (key === 'age' && typeof value === 'string') {
      normalizedValue = value.replace(/\D/g, '').slice(0, 2) as PetCreateForm[K];
    }

    if (capitalize && typeof normalizedValue === 'string') {
      normalizedValue = capitalizeFirstLetter(normalizedValue) as PetCreateForm[K];
    }

    setNewPet((current) => ({ ...current, [key]: normalizedValue }));
  }

  function updateVaccinationField<K extends keyof VaccinationDraft>(
    index: number,
    key: K,
    value: VaccinationDraft[K],
    capitalize = false,
  ) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as VaccinationDraft[K]) : value;

    setDraft((current) => ({
      ...current,
      vaccinations: current.vaccinations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: normalizedValue } : item,
      ),
    }));

    // Clear the field-specific error when the user edits that field
    const errorKey = `vaccinations.${index}.${key}`;
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  }

  function updateMedicalField<K extends keyof MedicalDraft>(
    index: number,
    key: K,
    value: MedicalDraft[K],
    capitalize = false,
  ) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as MedicalDraft[K]) : value;

    setDraft((current) => ({
      ...current,
      medicalRecords: current.medicalRecords.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: normalizedValue } : item,
      ),
    }));

    // Clear the field-specific error when the user edits that field
    const errorKey = `medicalRecords.${index}.${key}`;
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  }

  function updateFeedingField<K extends keyof PassportDraft['feedingInfo']>(
    key: K,
    value: PassportDraft['feedingInfo'][K],
    capitalize = false,
  ) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PassportDraft['feedingInfo'][K]) : value;

    setDraft((current) => ({
      ...current,
      feedingInfo: { ...current.feedingInfo, [key]: normalizedValue },
    }));
  }

  function updateGroomingField<K extends keyof PassportDraft['groomingInfo']>(
    key: K,
    value: PassportDraft['groomingInfo'][K],
    capitalize = false,
  ) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PassportDraft['groomingInfo'][K]) : value;

    setDraft((current) => ({
      ...current,
      groomingInfo: { ...current.groomingInfo, [key]: normalizedValue },
    }));
  }

  function updateEmergencyField<K extends keyof PassportDraft['emergencyInfo']>(
    key: K,
    value: PassportDraft['emergencyInfo'][K],
    capitalize = false,
  ) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PassportDraft['emergencyInfo'][K]) : value;

    setDraft((current) => ({
      ...current,
      emergencyInfo: { ...current.emergencyInfo, [key]: normalizedValue },
    }));

    // Clear the field-specific error when the user edits that field
    const errorKey = `emergencyInfo.${key}`;
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  }

  function removeVaccinationRow(index: number) {
    setDraft((current) => {
      const target = current.vaccinations[index];
      if (target?.id) {
        setDeletedVaccinationIds((prev) => (prev.includes(target.id!) ? prev : [...prev, target.id!]));
      }

      return {
        ...current,
        vaccinations: current.vaccinations.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  function removeMedicalRow(index: number) {
    setDraft((current) => {
      const target = current.medicalRecords[index];
      if (target?.id) {
        setDeletedMedicalRecordIds((prev) => (prev.includes(target.id!) ? prev : [...prev, target.id!]));
      }

      return {
        ...current,
        medicalRecords: current.medicalRecords.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  // ── Reminder preferences ───────────��─────────────────────────────────────────

  async function saveReminderPreferences() {
    const response = await fetch('/api/user/pets/reminder-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminderPreferences),
    });

    if (!response.ok) {
      showToast('Unable to save reminder preferences.', 'error');
      return;
    }

    const remindersResponse = await fetch(`/api/user/pets/upcoming-vaccinations?daysAhead=${reminderPreferences.daysAhead}`);
    if (remindersResponse.ok) {
      const payload = (await remindersResponse.json().catch(() => null)) as { reminders?: ReminderGroup[] } | null;
      if (payload?.reminders) {
        setReminders(payload.reminders);
      }
    }

    showToast('Reminder preferences saved.', 'success');
  }

  // Suppress unused variable warnings for state that is fetched but not yet rendered
  void reminders;
  void reminderPreferences;
  void saveReminderPreferences;

  // ── Render ───────────────────────────��─────────────────────────��─────────────

  return (
    <div className={embedded ? 'space-y-8 pb-8' : 'space-y-12 pb-32'}>
      {!embedded ? (
        <section className="rounded-2xl border border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-6 shadow-[0_16px_30px_rgba(147,101,63,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-page-title text-neutral-950">Pet Passport</h1>
              <p className="text-body leading-relaxed text-neutral-600">
                Guided profile setup for medical, behavior, care, and emergency details.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-full border border-[#e1bf9e] bg-[#fff4e8] px-4 py-2 text-sm font-semibold text-neutral-800 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      ) : null}

      <PetListSection
        pets={pets}
        selectedPetId={selectedPetId}
        photoUrls={photoUrls}
        completionPercent={completionPercent}
        isPending={isPending}
        onCreatePetClick={() => setIsCreatePetModalOpen(true)}
        onSelectPet={selectPetWithGuard}
        onSharePet={(petId) => void openShareModal(petId)}
        onDeletePet={deletePetProfile}
      />

      <CreatePetModal
        isOpen={isCreatePetModalOpen}
        onClose={() => setIsCreatePetModalOpen(false)}
        newPet={newPet}
        newPetPhotoFile={newPetPhotoFile}
        isPending={isPending}
        onNewPetFieldChange={updateNewPetField}
        onPhotoFileChange={setNewPetPhotoFile}
        onBreedChange={(value) => setNewPet((current) => ({ ...current, breed: value }))}
        onCreatePet={() => void createPetProfile()}
      />

      <SharePetModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareInviteEmail={shareInviteEmail}
        shareInviteRole={shareInviteRole}
        petShares={petShares}
        isLoadingShares={isLoadingShares}
        isMutatingShares={isMutatingShares}
        onShareInviteEmailChange={setShareInviteEmail}
        onShareInviteRoleChange={setShareInviteRole}
        onInvite={() => void invitePetShare()}
        onUpdateRole={(shareId, role) => void updatePetShareRole(shareId, role)}
        onRevoke={(shareId) => void revokePetShare(shareId)}
      />

      {selectedPet ? (
        <div ref={passportSectionRef}>
          <PetHeroHeader
            petName={selectedPet.name}
            breed={selectedPet.breed}
            age={selectedPet.age}
            photoUrl={photoUrls[selectedPet.id]}
            completionPercent={completionPercent}
            lastSavedAt={lastDraftSavedAt}
          />

          <PassportSnapshot
            stepCompletion={stepCompletion}
            missingSteps={missingSteps}
            canEditSelectedPet={canEditSelectedPet}
            canShareSelectedPet={canShareSelectedPet}
            selectedPetId={selectedPet.id}
            onSaveDraft={saveDraftLocally}
            onSharePet={() => void openShareModal(selectedPet.id)}
            onEditPassport={() => setIsEditPassportModalOpen(true)}
            onJumpToStep={(index) => {
              jumpToStepWithHighlight(index);
              setIsEditPassportModalOpen(true);
            }}
            onShowToastNoEdit={() => showToast('This pet is shared as view-only for your account.', 'error')}
          />

          <PassportEditorModal
            isOpen={isEditPassportModalOpen}
            onClose={() => setIsEditPassportModalOpen(false)}
            stepIndex={stepIndex}
            highlightStepIndex={highlightStepIndex}
            stepCompletion={stepCompletion}
            draft={draft}
            expandedVaccinations={expandedVaccinations}
            expandedMedicalRecords={expandedMedicalRecords}
            fieldErrors={fieldErrors}
            saveStatus={saveStatus}
            lastDraftSavedAt={lastDraftSavedAt}
            isPending={isPending}
            isLoadingProfile={isLoadingProfile}
            selectedPetId={selectedPetId}
            canEditSelectedPet={canEditSelectedPet}
            onStepClick={jumpToStepWithHighlight}
            onPreviousStep={() => {
              persistDraftLocally(false);
              jumpToStepWithHighlight(Math.max(0, stepIndex - 1));
            }}
            onNextOrComplete={handleNextOrComplete}
            onSaveDraft={saveDraftLocally}
            onSaveStep={saveCurrentStepOnly}
            onJumpToFirstError={jumpToFirstError}
            petPhotoPreviewUrl={effectivePassportPhotoPreviewUrl}
            selectedPhotoFileName={passportPhotoFile?.name ?? null}
            canRemovePhoto={!removePassportPhoto && hasExistingPassportPhoto}
            onPetPhotoFileChange={(file) => {
              setPassportPhotoFile(file);
              setPassportPhotoObjectUrl((current) => {
                if (current) {
                  URL.revokeObjectURL(current);
                }
                return null;
              });

              if (!file) {
                setPassportPhotoPreviewUrl(null);
                return;
              }

              setRemovePassportPhoto(false);
              const objectUrl = URL.createObjectURL(file);
              setPassportPhotoObjectUrl(objectUrl);
              setPassportPhotoPreviewUrl(objectUrl);
            }}
            onRemovePhoto={() => {
              if (!window.confirm(`Remove ${selectedPet?.name ?? 'this pet'}'s profile photo?`)) {
                return;
              }

              setPassportPhotoFile(null);
              setRemovePassportPhoto(true);
              setDraft((current) => ({
                ...current,
                pet: {
                  ...current.pet,
                  photoUrl: '',
                },
              }));
              if (selectedPetId) {
                setPhotoUrls((current) => {
                  const next = { ...current };
                  delete next[selectedPetId];
                  return next;
                });
              }
              setPassportPhotoPreviewUrl(null);
              setPassportPhotoObjectUrl((current) => {
                if (current) {
                  URL.revokeObjectURL(current);
                }
                return null;
              });
            }}
            onPetFieldChange={updatePetField}
            onToggleVaccinationExpand={(index) =>
              setExpandedVaccinations((current) => ({ ...current, [index]: !current[index] }))
            }
            onAddVaccination={() => {
              setDraft((current) => ({
                ...current,
                vaccinations: [
                  ...current.vaccinations,
                  {
                    vaccineName: '',
                    brandName: '',
                    batchNumber: '',
                    doseNumber: '',
                    administeredDate: '',
                    nextDueDate: '',
                    veterinarianName: '',
                    clinicName: '',
                    certificateUrl: '',
                    reminderEnabled: true,
                  },
                ],
              }));
              // Auto-expand the newly added vaccination
              setExpandedVaccinations((current) => ({ ...current, [draft.vaccinations.length]: true }));
            }}
            onRemoveVaccination={removeVaccinationRow}
            onDuplicateVaccination={(index) =>
              setDraft((current) => ({
                ...current,
                vaccinations: [...current.vaccinations, { ...current.vaccinations[index]!, id: undefined }],
              }))
            }
            onVaccinationFieldChange={updateVaccinationField}
            onVaccinationCertificateUrlChange={(index, value) =>
              setDraft((current) => ({
                ...current,
                vaccinations: current.vaccinations.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, certificateUrl: value } : item,
                ),
              }))
            }
            onToggleMedicalExpand={(index) =>
              setExpandedMedicalRecords((current) => ({ ...current, [index]: !current[index] }))
            }
            onAddMedicalRecord={() => {
              setDraft((current) => ({
                ...current,
                medicalRecords: [
                  ...current.medicalRecords,
                  {
                    conditionName: '',
                    diagnosisDate: '',
                    ongoing: false,
                    medications: '',
                    specialCareInstructions: '',
                    vetName: '',
                    documentUrl: '',
                  },
                ],
              }));
              // Auto-expand the newly added medical record
              setExpandedMedicalRecords((current) => ({ ...current, [draft.medicalRecords.length]: true }));
            }}
            onRemoveMedicalRecord={removeMedicalRow}
            onMedicalFieldChange={updateMedicalField}
            onMedicalDocumentUrlChange={(index, value) =>
              setDraft((current) => ({
                ...current,
                medicalRecords: current.medicalRecords.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, documentUrl: value } : item,
                ),
              }))
            }
            onFeedingFieldChange={updateFeedingField}
            onTreatsAllowedChange={(value) =>
              setDraft((current) => ({
                ...current,
                feedingInfo: { ...current.feedingInfo, treatsAllowed: value },
              }))
            }
            onGroomingFieldChange={updateGroomingField}
            onLastGroomingDateChange={(value) =>
              setDraft((current) => ({
                ...current,
                groomingInfo: { ...current.groomingInfo, lastGroomingDate: value },
              }))
            }
            onMattingProneChange={(value) =>
              setDraft((current) => ({
                ...current,
                groomingInfo: { ...current.groomingInfo, mattingProne: value },
              }))
            }
            onEmergencyFieldChange={updateEmergencyField}
            onEmergencyPhoneChange={(key, value) =>
              setDraft((current) => ({
                ...current,
                emergencyInfo: { ...current.emergencyInfo, [key]: value },
              }))
            }
            onEmergencyPhoneBlur={(key, value) =>
              setDraft((current) => ({
                ...current,
                emergencyInfo: { ...current.emergencyInfo, [key]: value },
              }))
            }
            getFieldError={getFieldError}
          />
        </div>
      ) : null}
    </div>
  );
}
