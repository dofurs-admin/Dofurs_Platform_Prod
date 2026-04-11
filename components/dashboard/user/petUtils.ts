import { calculateAgeFromDOB } from '@/lib/utils/date';
import type { Pet } from './types';

export function normalizeDisplayImageUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  const normalized = url.trim();
  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return '';
}

export function normalizeStorageObjectPath(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  // Handle full/relative Supabase storage URLs by extracting bucket path.
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/storage/v1/object/')) {
    try {
      const parsed = new URL(trimmed, trimmed.startsWith('http') ? undefined : 'http://localhost');
      const segments = parsed.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex(
        (segment, index) =>
          segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
      );

      if (markerIndex !== -1) {
        const objectSegments = segments.slice(markerIndex + 3);
        const first = objectSegments[0];
        const modeOffsets: Record<string, number> = {
          sign: 1,
          public: 1,
          authenticated: 1,
          render: 2,
        };
        const offset = modeOffsets[first ?? ''] ?? 0;
        const bucketCandidate = objectSegments[offset];
        const pathParts = objectSegments.slice(offset + 1);

        if (bucketCandidate === 'pet-photos' && pathParts.length > 0) {
          return decodeURIComponent(pathParts.join('/'));
        }
      }
    } catch (err) {
      console.error(err);
      // Fall through to simple normalization below.
    }
  }

  const normalized = trimmed.replace(/^\/+/, '');
  if (normalized.startsWith('pet-photos/')) {
    return normalized.slice('pet-photos/'.length);
  }
  return normalized;
}

export function resolvePetAge(pet: Pet): number | undefined {
  if (typeof pet.age === 'number' && Number.isFinite(pet.age)) {
    return pet.age;
  }

  const derivedAge = calculateAgeFromDOB(pet.date_of_birth ?? null);
  return derivedAge ?? undefined;
}
