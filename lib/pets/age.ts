import { MAX_PET_AGE_YEARS } from '@/lib/utils/date';

export const PET_AGE_DECIMAL_PLACES = 2;
export const PET_AGE_INPUT_MAX_LENGTH = 5;
export const PET_AGE_INPUT_PATTERN = '[0-9]*\\.?[0-9]{0,2}';
export const PET_AGE_VALIDATION_MESSAGE = `Pet age must be between 0 and ${MAX_PET_AGE_YEARS}, with up to ${PET_AGE_DECIMAL_PLACES} decimal places.`;

const PET_AGE_PRECISION_FACTOR = 10 ** PET_AGE_DECIMAL_PLACES;
const PET_AGE_PARSE_PATTERN = /^(?:\d{1,2}(?:\.\d{0,2})?|\.\d{1,2})$/;

export function sanitizePetAgeInput(value: string): string {
  const sanitized = value.replace(/[^\d.]/g, '');
  const decimalIndex = sanitized.indexOf('.');

  if (decimalIndex === -1) {
    return sanitized.slice(0, 2);
  }

  const integerPart = sanitized.slice(0, decimalIndex).slice(0, 2);
  const decimalPart = sanitized.slice(decimalIndex + 1).replace(/\./g, '').slice(0, PET_AGE_DECIMAL_PLACES);
  return `${integerPart}.${decimalPart}`;
}

export function parsePetAgeInput(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!PET_AGE_PARSE_PATTERN.test(trimmed)) {
    return Number.NaN;
  }

  const normalized = trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function hasValidPetAgePrecision(age: number): boolean {
  const scaled = age * PET_AGE_PRECISION_FACTOR;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

export function isValidPetAgeValue(age: number): boolean {
  return Number.isFinite(age) && age >= 0 && age <= MAX_PET_AGE_YEARS && hasValidPetAgePrecision(age);
}
