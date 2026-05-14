import { describe, expect, it } from 'vitest';
import { isValidPetAgeValue, parsePetAgeInput, sanitizePetAgeInput } from './age';

describe('pet age helpers', () => {
  it('sanitizes decimal age input without stripping the decimal point', () => {
    expect(sanitizePetAgeInput('0.5')).toBe('0.5');
    expect(sanitizePetAgeInput('12.34')).toBe('12.34');
    expect(sanitizePetAgeInput('123.456')).toBe('12.45');
    expect(sanitizePetAgeInput('1..25 years')).toBe('1.25');
  });

  it('parses optional pet age input as decimal years', () => {
    expect(parsePetAgeInput('')).toBeNull();
    expect(parsePetAgeInput('0.5')).toBe(0.5);
    expect(parsePetAgeInput('.5')).toBe(0.5);
    expect(parsePetAgeInput('6')).toBe(6);
  });

  it('validates age range and precision', () => {
    expect(isValidPetAgeValue(0.5)).toBe(true);
    expect(isValidPetAgeValue(99)).toBe(true);
    expect(isValidPetAgeValue(99.01)).toBe(false);
    expect(isValidPetAgeValue(1.234)).toBe(false);
    expect(isValidPetAgeValue(Number.NaN)).toBe(false);
  });
});
