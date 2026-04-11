import { describe, expect, it } from 'vitest';
import {
  normalizeOptionalString,
  validateEmergencyPhones,
  validateVaccinationPatch,
} from './passport-validation';

describe('normalizeOptionalString', () => {
  it('returns undefined when input is undefined', () => {
    expect(normalizeOptionalString(undefined)).toBeUndefined();
  });

  it('returns null for empty/whitespace strings', () => {
    expect(normalizeOptionalString('')).toBeNull();
    expect(normalizeOptionalString('   ')).toBeNull();
  });

  it('trims non-empty values', () => {
    expect(normalizeOptionalString('  hello  ')).toBe('hello');
  });
});

describe('validateVaccinationPatch', () => {
  it('rejects next due date before administered date', () => {
    const error = validateVaccinationPatch([
      {
        vaccineName: 'Rabies',
        administeredDate: '2026-03-10',
        nextDueDate: '2026-03-09',
      },
    ]);

    expect(error).toBe('Vaccination next due date cannot be before administered date.');
  });

  it('rejects duplicate vaccine/date pairs', () => {
    const error = validateVaccinationPatch([
      {
        vaccineName: 'Rabies',
        administeredDate: '2026-03-10',
      },
      {
        vaccineName: '  rabies ',
        administeredDate: '2026-03-10',
      },
    ]);

    expect(error).toBe('Duplicate vaccination entry detected for the same date.');
  });

  it('ignores deleted items and accepts valid payload', () => {
    const error = validateVaccinationPatch([
      {
        _delete: true,
        id: 'vacc-1',
      },
      {
        vaccineName: 'Distemper',
        administeredDate: '2026-03-10',
        nextDueDate: '2026-10-10',
      },
    ]);

    expect(error).toBeNull();
  });
});

describe('validateEmergencyPhones', () => {
  it('rejects invalid emergency contact phone', () => {
    const error = validateEmergencyPhones({
      emergencyContactPhone: 'abc123',
      preferredVetPhone: null,
    });

    expect(error).toBe('Invalid emergency contact phone format.');
  });

  it('rejects invalid preferred vet phone', () => {
    const error = validateEmergencyPhones({
      emergencyContactPhone: '+1 234 567 8901',
      preferredVetPhone: 'bad-number',
    });

    expect(error).toBe('Invalid preferred vet phone format.');
  });

  it('accepts valid numbers and empty values', () => {
    const error = validateEmergencyPhones({
      emergencyContactPhone: '+1 234 567 8901',
      preferredVetPhone: '(555) 222-1111',
    });

    expect(error).toBeNull();
  });
});
