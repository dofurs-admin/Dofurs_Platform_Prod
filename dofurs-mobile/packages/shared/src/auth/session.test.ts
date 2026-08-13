import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import {
  isCustomerAppRole,
  isProviderAppRole,
  normalizeAppRole,
  requiresProfileSetupFromError,
  resolveProviderAppRoute,
} from './role-policy';

describe('mobile auth role policies', () => {
  it('normalizes known roles only', () => {
    expect(normalizeAppRole('user')).toBe('user');
    expect(normalizeAppRole('provider')).toBe('provider');
    expect(normalizeAppRole('admin')).toBe('admin');
    expect(normalizeAppRole('staff')).toBe('staff');

    expect(normalizeAppRole('owner')).toBeNull();
    expect(normalizeAppRole('')).toBeNull();
    expect(normalizeAppRole(null)).toBeNull();
  });

  it('enforces customer app role policy', () => {
    expect(isCustomerAppRole('user')).toBe(true);
    expect(isCustomerAppRole('provider')).toBe(false);
    expect(isCustomerAppRole('admin')).toBe(false);
    expect(isCustomerAppRole('staff')).toBe(false);
    expect(isCustomerAppRole(null)).toBe(false);
  });

  it('enforces provider app role policy', () => {
    expect(isProviderAppRole('provider')).toBe(true);
    expect(isProviderAppRole('user')).toBe(false);
    expect(isProviderAppRole('admin')).toBe(false);
    expect(isProviderAppRole('staff')).toBe(false);
    expect(isProviderAppRole(null)).toBe(false);
  });

  it('routes provider app roles safely', () => {
    expect(resolveProviderAppRoute('provider')).toBe('/(tabs)/home');
    expect(resolveProviderAppRoute('user')).toBe('/(auth)/apply');
    expect(resolveProviderAppRoute('admin')).toBe('/(auth)/sign-in');
    expect(resolveProviderAppRoute('staff')).toBe('/(auth)/sign-in');
    expect(resolveProviderAppRoute(null)).toBe('/(auth)/sign-in');
  });

  it('detects profile-setup signal from bootstrap conflicts only', () => {
    const requiresSetup = new ApiError('conflict', 409, '/api/auth/bootstrap-profile', {
      requiresProfileSetup: true,
    });
    expect(requiresProfileSetupFromError(requiresSetup)).toBe(true);

    const noSetup = new ApiError('conflict', 409, '/api/auth/bootstrap-profile', {
      requiresProfileSetup: false,
    });
    expect(requiresProfileSetupFromError(noSetup)).toBe(false);

    const wrongStatus = new ApiError('bad request', 400, '/api/auth/bootstrap-profile', {
      requiresProfileSetup: true,
    });
    expect(requiresProfileSetupFromError(wrongStatus)).toBe(false);

    expect(requiresProfileSetupFromError(new Error('boom'))).toBe(false);
  });
});
