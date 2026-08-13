import { ApiError } from '../api/errors';
import type { AppRole } from '../types/auth';

export function normalizeAppRole(value: unknown): AppRole | null {
  if (value === 'user' || value === 'provider' || value === 'admin' || value === 'staff') {
    return value;
  }

  return null;
}

export function isCustomerAppRole(role: AppRole | null): role is 'user' {
  return role === 'user';
}

export function isProviderAppRole(role: AppRole | null): role is 'provider' {
  return role === 'provider';
}

export function resolveProviderAppRoute(role: AppRole | null) {
  if (role === 'provider') {
    return '/(tabs)/home';
  }

  if (role === 'user') {
    return '/(auth)/apply';
  }

  return '/(auth)/sign-in';
}

export function requiresProfileSetupFromError(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false;
  }

  if (typeof error.details !== 'object' || error.details === null) {
    return false;
  }

  if (!('requiresProfileSetup' in error.details)) {
    return false;
  }

  return Boolean((error.details as { requiresProfileSetup?: unknown }).requiresProfileSetup);
}
