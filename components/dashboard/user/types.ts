// Shared types for UserPetProfilesClient and its subcomponents

export type Pet = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
  completion_percent?: number | null;
  date_of_birth?: string | null;
  aggression_level?:
    | 'friendly'
    | 'docile'
    | 'mild_aggression'
    | 'aggressive'
    | 'sometimes_nervous'
    | 'nervous_but_manageable'
    | 'not_sure'
    | 'other'
    | null;
  has_disability?: boolean;
  disability_details?: string | null;
  access_role?: 'owner' | 'manager' | 'viewer';
  owner_user_id?: string;
  owner_name?: string | null;
};

export type PetShareRecord = {
  id: string;
  pet_id: number;
  invited_email: string;
  shared_with_user_id: string | null;
  role: 'manager' | 'viewer';
  status: 'pending' | 'active' | 'revoked';
  accepted_at: string | null;
  created_at: string;
};

export type VaccinationDraft = {
  id?: string;
  vaccineName: string;
  brandName: string;
  batchNumber: string;
  doseNumber: string;
  administeredDate: string;
  nextDueDate: string;
  veterinarianName: string;
  clinicName: string;
  certificateUrl: string;
  reminderEnabled: boolean;
};

export type MedicalDraft = {
  id?: string;
  conditionName: string;
  diagnosisDate: string;
  ongoing: boolean;
  medications: string;
  specialCareInstructions: string;
  vetName: string;
  documentUrl: string;
};

export type PassportDraft = {
  pet: {
    id?: number;
    name: string;
    breed: string;
    age: string;
    weight: string;
    gender: string;
    allergies: string;
    photoUrl: string;
    dateOfBirth: string;
    microchipNumber: string;
    neuteredSpayed: boolean;
    color: string;
    sizeCategory: string;
    energyLevel: string;
    aggressionLevel: string;
    isBiteHistory: boolean;
    biteIncidentsCount: string;
    houseTrained: boolean;
    leashTrained: boolean;
    crateTrained: boolean;
    socialWithDogs: string;
    socialWithCats: string;
    socialWithChildren: string;
    separationAnxiety: boolean;
    hasDisability: boolean;
    disabilityDetails: string;
  };
  vaccinations: VaccinationDraft[];
  medicalRecords: MedicalDraft[];
  feedingInfo: {
    foodType: string;
    brandName: string;
    feedingSchedule: string;
    foodAllergies: string;
    specialDietNotes: string;
    treatsAllowed: boolean;
  };
  groomingInfo: {
    coatType: string;
    mattingProne: boolean;
    groomingFrequency: string;
    lastGroomingDate: string;
    nailTrimFrequency: string;
  };
  emergencyInfo: {
    emergencyContactName: string;
    emergencyContactPhone: string;
    preferredVetClinic: string;
    preferredVetPhone: string;
  };
};

export type FullPetProfile = {
  pet: Pet & {
    microchip_number: string | null;
    neutered_spayed: boolean;
    color: string | null;
    size_category: string | null;
    energy_level: string | null;
    is_bite_history: boolean;
    bite_incidents_count: number;
    house_trained: boolean;
    leash_trained: boolean;
    crate_trained: boolean;
    social_with_dogs: string | null;
    social_with_cats: string | null;
    social_with_children: string | null;
    separation_anxiety: boolean;
    has_disability?: boolean;
    disability_details?: string | null;
  };
  vaccinations: Array<{
    id: string;
    vaccine_name: string;
    brand_name: string | null;
    batch_number: string | null;
    dose_number: number | null;
    administered_date: string;
    next_due_date: string | null;
    veterinarian_name: string | null;
    clinic_name: string | null;
    certificate_url: string | null;
    reminder_enabled: boolean;
  }>;
  medicalRecords: Array<{
    id: string;
    condition_name: string;
    diagnosis_date: string | null;
    ongoing: boolean;
    medications: string | null;
    special_care_instructions: string | null;
    vet_name: string | null;
    document_url: string | null;
  }>;
  feedingInfo: {
    food_type: string | null;
    brand_name: string | null;
    feeding_schedule: string | null;
    food_allergies: string | null;
    special_diet_notes: string | null;
    treats_allowed: boolean;
  } | null;
  groomingInfo: {
    coat_type: string | null;
    matting_prone: boolean;
    grooming_frequency: string | null;
    last_grooming_date: string | null;
    nail_trim_frequency: string | null;
  } | null;
  emergencyInfo: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    preferred_vet_clinic: string | null;
    preferred_vet_phone: string | null;
  } | null;
};

export type ReminderGroup = {
  petId: number;
  petName: string;
  vaccinations: Array<{
    vaccinationId: string;
    vaccineName: string;
    nextDueDate: string;
    reminderEnabled: boolean;
  }>;
};

export type ReminderPreferences = {
  daysAhead: number;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};

export type PetCreateForm = {
  name: string;
  breed: string;
  age: string;
  gender: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// UserDashboardClient shared types
// ──────────────────────────────────────────────────────────────────────────────

export type UserDashboardView = 'home' | 'bookings' | 'pets' | 'account';

export type Booking = {
  id: number;
  booking_start: string;
  booking_end: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  provider_id?: number;
  pet_id?: number;
  providers?: { name: string }[] | { name: string } | null;
  amount: number;
  payment_mode: string | null;
  wallet_credits_applied_inr?: number | null;
};
