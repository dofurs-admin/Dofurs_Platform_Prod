import { getGroomingPackageByServiceType } from './grooming-packages';

export const PUBLIC_BOOKABLE_SERVICE_ERROR = 'Dofurs currently accepts grooming bookings only.';

type ServiceLike = {
  service_type?: string | null;
  category?: {
    name?: string | null;
    slug?: string | null;
  } | null;
  service_categories?: {
    name?: string | null;
    slug?: string | null;
  } | null;
  category_name?: string | null;
  category_slug?: string | null;
  name?: string | null;
  slug?: string | null;
};

type CategoryLike = {
  name?: string | null;
  slug?: string | null;
};

function normalizeServiceText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAnyToken(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

export function normalizeServiceFamily(value: string | null | undefined): string {
  const normalized = normalizeServiceText(value);

  if (!normalized) {
    return '';
  }

  if (getGroomingPackageByServiceType(normalized) || hasAnyToken(normalized, ['groom', 'bath care', 'fur bath', 'fur makeover', 'monthly care', 'complete care'])) {
    return 'grooming';
  }

  if (hasAnyToken(normalized, ['vet', 'veterinary', 'consult', 'vaccination', 'health check'])) return 'vet_consultation';
  if (hasAnyToken(normalized, ['train', 'obedience', 'behaviour', 'behavior'])) return 'training';
  if (hasAnyToken(normalized, ['board', 'overnight', 'stay'])) return 'boarding';
  if (hasAnyToken(normalized, ['sit', 'sitter'])) return 'sitting';
  if (hasAnyToken(normalized, ['walk'])) return 'walking';
  if (hasAnyToken(normalized, ['birthday', 'bday', 'celebration'])) return 'birthday';
  if (hasAnyToken(normalized, ['daycare', 'day care'])) return 'daycare';

  return normalized.replace(/\s+/g, '_');
}

export function isGroomingServiceType(serviceType: string | null | undefined): boolean {
  return normalizeServiceFamily(serviceType) === 'grooming';
}

export function isGroomingCategory(category: CategoryLike | null | undefined): boolean {
  const categoryName = normalizeServiceText(category?.name);
  const categorySlug = normalizeServiceText(category?.slug);
  return categoryName.includes('groom') || categorySlug.includes('groom');
}

export function isPublicBookableService(service: ServiceLike | null | undefined): boolean {
  if (!service) {
    return false;
  }

  if (isGroomingServiceType(service.service_type ?? service.name)) {
    return true;
  }

  if (isGroomingCategory(service.category) || isGroomingCategory(service.service_categories)) {
    return true;
  }

  return isGroomingCategory({ name: service.category_name, slug: service.category_slug ?? service.slug });
}

export function assertPublicBookableService(service: ServiceLike | null | undefined): void {
  if (!isPublicBookableService(service)) {
    throw new Error(PUBLIC_BOOKABLE_SERVICE_ERROR);
  }
}

export function assertPublicBookableServiceType(serviceType: string | null | undefined): void {
  if (!isGroomingServiceType(serviceType)) {
    throw new Error(PUBLIC_BOOKABLE_SERVICE_ERROR);
  }
}

export function filterPublicBookableServices<T extends ServiceLike>(services: T[]): T[] {
  return services.filter((service) => isPublicBookableService(service));
}

export function filterPublicBookableCategories<T extends CategoryLike>(categories: T[]): T[] {
  return categories.filter((category) => isGroomingCategory(category));
}
