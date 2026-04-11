import { PET_GENDERS } from '@/lib/pets/types';
import type { PassportDraft } from './types';

export const STEPS = [
  'Basic Info',
  'Behavior & Aggression',
  'Vaccination History',
  'Medical Records',
  'Feeding Info',
  'Grooming Info',
  'Emergency Info',
] as const;

export const STEP_DESCRIPTIONS = [
  'Capture your pet\u2019s core identity and profile details.',
  'Document temperament and social compatibility preferences.',
  'Track immunization history and due dates clearly.',
  'Maintain conditions, treatments, and care notes.',
  'Define food preferences, schedule, and restrictions.',
  'Record coat care and routine grooming needs.',
  'Store emergency contacts and preferred vet details.',
] as const;

export const AGGRESSION_OPTIONS = [
  'friendly',
  'docile',
  'mild_aggression',
  'aggressive',
  'sometimes_nervous',
  'nervous_but_manageable',
  'not_sure',
  'other',
];

export const ENERGY_LEVEL_OPTIONS = ['very_low', 'low', 'moderate', 'high', 'very_high'];
export const SIZE_CATEGORY_OPTIONS = ['toy', 'small', 'medium', 'large', 'giant'];
export const PET_GENDER_OPTIONS = PET_GENDERS;
export const SOCIAL_COMPATIBILITY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'dont_know', label: "Don't know" },
] as const;

export const CAPITALIZE_PET_FIELDS: ReadonlyArray<keyof PassportDraft['pet']> = [
  'name',
  'breed',
  'allergies',
  'microchipNumber',
  'color',
];
