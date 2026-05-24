import { normalizeServiceFamily } from '@/lib/service-catalog/service-policy';

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function toServiceFamily(value: string) {
  return normalizeServiceFamily(value);
}

export function isServiceTypeMatch(left: string, right: string) {
  const leftNormalized = normalizeToken(left);
  const rightNormalized = normalizeToken(right);

  if (!leftNormalized || !rightNormalized) {
    return false;
  }

  const leftFamily = toServiceFamily(leftNormalized);
  const rightFamily = toServiceFamily(rightNormalized);

  if (leftFamily !== 'grooming' || rightFamily !== 'grooming') {
    return false;
  }

  return leftNormalized === rightNormalized || leftFamily === rightFamily;
}
