/**
 * Pet icon helpers for fallback display when no photo is available.
 */

const CAT_KEYWORDS = [
  'cat',
  'kitten',
  'feline',
  'persian',
  'siamese',
  'maine coon',
  'ragdoll',
  'bengal',
  'sphynx',
  'british shorthair',
  'scottish fold',
];

const DOG_KEYWORDS = [
  'dog',
  'puppy',
  'canine',
  'labrador',
  'retriever',
  'german shepherd',
  'golden',
  'beagle',
  'pug',
  'rottweiler',
  'husky',
  'shih tzu',
  'spitz',
  'doberman',
  'dachshund',
  'pomeranian',
  'boxer',
  'bulldog',
];

/**
 * Get a fallback emoji icon based on pet breed.
 * Returns dog icon (🐶) for known dog breeds,
 * cat icon (🐱) for known cat breeds,
 * and generic paw icon (🐾) for unknown types.
 */
export function getPetFallbackIcon(breed: string | null | undefined): string {
  const normalized = (breed ?? '').toLowerCase();

  if (CAT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return '🐱';
  }

  if (DOG_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return '🐶';
  }

  return '🐾';
}
