export const AGGRESSION_LEVELS = [
  'friendly',
  'docile',
  'mild_aggression',
  'aggressive',
  'sometimes_nervous',
  'nervous_but_manageable',
  'not_sure',
  'other',
] as const;

export type AggressionLevel = (typeof AGGRESSION_LEVELS)[number];

export const PET_GENDERS = ['male', 'female'] as const;
export type PetGender = (typeof PET_GENDERS)[number];

export type Pet = {
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

export type PetVaccination = {
  id: string;
  pet_id: number;
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
  created_at: string;
};

export type PetMedicalRecord = {
  id: string;
  pet_id: number;
  condition_name: string;
  diagnosis_date: string | null;
  ongoing: boolean;
  medications: string | null;
  special_care_instructions: string | null;
  vet_name: string | null;
  document_url: string | null;
  created_at: string;
};

export type PetFeedingInfo = {
  id: string;
  pet_id: number;
  food_type: string | null;
  brand_name: string | null;
  feeding_schedule: string | null;
  food_allergies: string | null;
  special_diet_notes: string | null;
  treats_allowed: boolean;
  created_at: string;
};

export type PetGroomingInfo = {
  id: string;
  pet_id: number;
  coat_type: string | null;
  matting_prone: boolean;
  grooming_frequency: string | null;
  last_grooming_date: string | null;
  nail_trim_frequency: string | null;
  created_at: string;
};

export type PetEmergencyInfo = {
  id: string;
  pet_id: number;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_vet_clinic: string | null;
  preferred_vet_phone: string | null;
  created_at: string;
};

export type FullPetProfile = {
  pet: Pet;
  vaccinations: PetVaccination[];
  medicalRecords: PetMedicalRecord[];
  feedingInfo: PetFeedingInfo | null;
  groomingInfo: PetGroomingInfo | null;
  emergencyInfo: PetEmergencyInfo | null;
};

export type CreatePetInput = {
  name: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
  gender?: string | null;
  allergies?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  microchip_number?: string | null;
  neutered_spayed?: boolean;
  color?: string | null;
  size_category?: string | null;
  energy_level?: string | null;
  aggression_level?: AggressionLevel | null;
  is_bite_history?: boolean;
  bite_incidents_count?: number;
  house_trained?: boolean;
  leash_trained?: boolean;
  crate_trained?: boolean;
  social_with_dogs?: string | null;
  social_with_cats?: string | null;
  social_with_children?: string | null;
  separation_anxiety?: boolean;
  has_disability?: boolean;
  disability_details?: string | null;
};

export type UpdatePetInput = Partial<CreatePetInput>;

export type AddVaccinationInput = {
  pet_id: number;
  vaccine_name: string;
  brand_name?: string | null;
  batch_number?: string | null;
  dose_number?: number | null;
  administered_date: string;
  next_due_date?: string | null;
  veterinarian_name?: string | null;
  clinic_name?: string | null;
  certificate_url?: string | null;
  reminder_enabled?: boolean;
};

export type UpdateVaccinationInput = Partial<Omit<AddVaccinationInput, 'pet_id'>>;

export type AddMedicalRecordInput = {
  pet_id: number;
  condition_name: string;
  diagnosis_date?: string | null;
  ongoing?: boolean;
  medications?: string | null;
  special_care_instructions?: string | null;
  vet_name?: string | null;
  document_url?: string | null;
};

export type UpdateMedicalRecordInput = Partial<Omit<AddMedicalRecordInput, 'pet_id'>>;

export type UpsertFeedingInfoInput = {
  pet_id: number;
  food_type?: string | null;
  brand_name?: string | null;
  feeding_schedule?: string | null;
  food_allergies?: string | null;
  special_diet_notes?: string | null;
  treats_allowed?: boolean;
};

export type UpsertGroomingInfoInput = {
  pet_id: number;
  coat_type?: string | null;
  matting_prone?: boolean;
  grooming_frequency?: string | null;
  last_grooming_date?: string | null;
  nail_trim_frequency?: string | null;
};

export type UpsertEmergencyInfoInput = {
  pet_id: number;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  preferred_vet_clinic?: string | null;
  preferred_vet_phone?: string | null;
};

export type UpcomingVaccinationItem = {
  vaccinationId: string;
  vaccineName: string;
  nextDueDate: string;
  reminderEnabled: boolean;
  clinicName: string | null;
  veterinarianName: string | null;
};

export type UpcomingVaccinationGroup = {
  petId: number;
  petName: string;
  vaccinations: UpcomingVaccinationItem[];
};

export type PetReminderPreferences = {
  id: string;
  user_id: string;
  days_ahead: number;
  in_app_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type UpsertReminderPreferencesInput = {
  days_ahead?: number;
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  whatsapp_enabled?: boolean;
};

export type PassportAuditEventInput = {
  pet_id: number;
  action: string;
  step_index?: number | null;
  metadata?: Record<string, unknown>;
};
