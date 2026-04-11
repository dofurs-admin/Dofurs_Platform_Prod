function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function toServiceFamily(value: string) {
  const normalized = normalizeToken(value);

  if (!normalized) {
    return '';
  }

  if (normalized.includes('groom')) return 'grooming';
  if (normalized.includes('vet') || normalized.includes('consult')) return 'vet_consultation';
  if (normalized.includes('train')) return 'training';
  if (normalized.includes('board')) return 'boarding';
  if (normalized.includes('sit')) return 'sitting';
  if (normalized.includes('walk')) return 'walking';
  if (normalized.includes('birthday') || normalized.includes('bday')) return 'birthday';
  if (normalized.includes('daycare') || normalized.includes('day_care')) return 'daycare';

  return normalized;
}

export function isServiceTypeMatch(left: string, right: string) {
  const leftNormalized = normalizeToken(left);
  const rightNormalized = normalizeToken(right);

  if (!leftNormalized || !rightNormalized) {
    return false;
  }

  if (leftNormalized === rightNormalized) {
    return true;
  }

  return toServiceFamily(leftNormalized) === toServiceFamily(rightNormalized);
}
