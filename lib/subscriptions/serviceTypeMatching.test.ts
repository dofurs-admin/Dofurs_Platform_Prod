import { describe, expect, it } from 'vitest';
import { isServiceTypeMatch } from './serviceTypeMatching';

describe('isServiceTypeMatch', () => {
  it('matches exact values case-insensitively', () => {
    expect(isServiceTypeMatch('grooming', 'GROOMING')).toBe(true);
  });

  it('matches grooming-family aliases', () => {
    expect(isServiceTypeMatch('grooming', 'dog_grooming')).toBe(true);
    expect(isServiceTypeMatch('grooming_session', 'cat-grooming')).toBe(true);
  });

  it('does not match unrelated services', () => {
    expect(isServiceTypeMatch('grooming', 'vet_consultation')).toBe(false);
  });
});
