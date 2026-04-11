import { describe, expect, it } from 'vitest';
import {
  adminReputationUpdateSchema,
  adminVerificationUpdateSchema,
  basicProfileUpdateSchema,
  householdProfileUpdateSchema,
  userAddressSchema,
  userEmergencyContactSchema,
  userPreferencesSchema,
} from './validation';

describe('owner profile validation schemas', () => {
  it('validates basic profile payload', () => {
    const parsed = basicProfileUpdateSchema.safeParse({
      full_name: 'Jane Doe',
      phone_number: '+919900001111',
      gender: 'female',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid phone in emergency contact', () => {
    const parsed = userEmergencyContactSchema.safeParse({
      contact_name: 'Mother',
      phone_number: '12345',
    });

    expect(parsed.success).toBe(false);
  });

  it('validates address with geo coordinates', () => {
    const parsed = userAddressSchema.safeParse({
      address_line_1: 'MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
      latitude: 12.9,
      longitude: 77.6,
    });

    expect(parsed.success).toBe(true);
  });

  it('validates household fields and preferences', () => {
    expect(
      householdProfileUpdateSchema.safeParse({
        total_pets: 2,
        first_pet_owner: false,
        years_of_pet_experience: 5,
      }).success,
    ).toBe(true);

    expect(
      userPreferencesSchema.safeParse({
        communication_preference: 'whatsapp',
      }).success,
    ).toBe(true);
  });

  it('validates admin trust payloads', () => {
    expect(
      adminVerificationUpdateSchema.safeParse({
        kyc_status: 'verified',
        is_phone_verified: true,
      }).success,
    ).toBe(true);

    expect(
      adminReputationUpdateSchema.safeParse({
        cancellation_rate: 0.12,
        account_status: 'flagged',
        risk_score: 31,
      }).success,
    ).toBe(true);
  });
});
