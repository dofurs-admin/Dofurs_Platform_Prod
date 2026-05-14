const NUMBERED_BUNDLE_LINE_PATTERN = /^\d+\.\s*(?:Pet\s+\d+\s*\|\s*)?(.+)$/i;
const NUMBERED_BUNDLE_PET_PATTERN = /^\d+\.\s*Pet\s+(\d+)\s*\|/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_PREFIX_UUID_PATTERN =
  /^Service\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

type IncludedServicesOptions = {
  serviceNameByProviderServiceId?: ReadonlyMap<string, string>;
  serviceBasePriceByProviderServiceId?: ReadonlyMap<string, number>;
};

export type IncludedServicesBookingLike = {
  included_services?: Array<string | null | undefined> | null;
  service_type?: string | null;
  provider_notes?: string | null;
  internal_notes?: string | null;
  provider_service_id?: string | null;
  admin_price_reference?: number | null;
  price_at_booking?: number | null;
};

function normalizeIncludedServices(values: Array<string | null | undefined> | null | undefined) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  const normalized: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeServiceLineLabel(
  value: string,
  serviceNameByProviderServiceId?: ReadonlyMap<string, string>,
) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const serviceIdMatch = trimmed.match(SERVICE_PREFIX_UUID_PATTERN);
  const serviceId = serviceIdMatch?.[1] ?? (UUID_PATTERN.test(trimmed) ? trimmed : null);

  if (serviceId) {
    const resolvedName = serviceNameByProviderServiceId?.get(serviceId)?.trim() ?? null;
    if (resolvedName) {
      return resolvedName;
    }

    return `Service package (${serviceId.slice(0, 8)})`;
  }

  const normalized = trimmed.replace(/^Service\s+/i, '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function extractProviderServiceIdsFromNotes(noteValue: string | null | undefined) {
  if (!noteValue) {
    return [] as string[];
  }

  const providerServiceIds: string[] = [];

  for (const line of noteValue.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(NUMBERED_BUNDLE_LINE_PATTERN);
    if (!match?.[1]) {
      continue;
    }

    const firstSegment = match[1].split('|')[0]?.trim() ?? '';
    if (!firstSegment) {
      continue;
    }

    const serviceIdMatch = firstSegment.match(SERVICE_PREFIX_UUID_PATTERN);
    const serviceId = serviceIdMatch?.[1] ?? (UUID_PATTERN.test(firstSegment) ? firstSegment : null);

    if (!serviceId) {
      continue;
    }

    providerServiceIds.push(serviceId);
  }

  return providerServiceIds;
}

export function extractBundledPetIdsFromNotes(noteValue: string | null | undefined) {
  if (!noteValue) {
    return [] as number[];
  }

  const petIds: number[] = [];

  for (const line of noteValue.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(NUMBERED_BUNDLE_PET_PATTERN);
    if (!match?.[1]) {
      continue;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      petIds.push(parsed);
    }
  }

  return petIds;
}

export function extractIncludedServicesFromNotes(
  noteValue: string | null | undefined,
  options?: Pick<IncludedServicesOptions, 'serviceNameByProviderServiceId'>,
) {
  if (!noteValue) {
    return [] as string[];
  }

  const services: string[] = [];

  for (const line of noteValue.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(NUMBERED_BUNDLE_LINE_PATTERN);
    if (!match?.[1]) {
      continue;
    }

    const firstSegment = match[1].split('|')[0]?.trim() ?? '';
    const normalizedService = normalizeServiceLineLabel(
      firstSegment,
      options?.serviceNameByProviderServiceId,
    );

    if (normalizedService) {
      services.push(normalizedService);
    }
  }

  return services;
}

function inferPrimaryServiceQuantity(
  booking: IncludedServicesBookingLike,
  serviceBasePriceByProviderServiceId?: ReadonlyMap<string, number>,
) {
  const providerServiceId = booking.provider_service_id?.trim();
  const serviceBasePrice =
    providerServiceId && serviceBasePriceByProviderServiceId
      ? Number(serviceBasePriceByProviderServiceId.get(providerServiceId) ?? NaN)
      : NaN;

  if (!Number.isFinite(serviceBasePrice) || serviceBasePrice <= 0) {
    return 1;
  }

  const referencePrice = Number(
    booking.admin_price_reference ?? booking.price_at_booking ?? NaN,
  );

  if (!Number.isFinite(referencePrice) || referencePrice <= serviceBasePrice) {
    return 1;
  }

  const ratio = referencePrice / serviceBasePrice;
  const roundedRatio = Math.round(ratio);

  if (roundedRatio < 2 || roundedRatio > 10) {
    return 1;
  }

  return Math.abs(ratio - roundedRatio) <= 0.02 ? roundedRatio : 1;
}

export function resolveIncludedServicesForBooking(
  booking: IncludedServicesBookingLike,
  options?: IncludedServicesOptions,
) {
  const explicitIncludedServices = normalizeIncludedServices(booking.included_services);
  if (explicitIncludedServices.length > 0) {
    return explicitIncludedServices;
  }

  const fromProviderNotes = extractIncludedServicesFromNotes(booking.provider_notes, {
    serviceNameByProviderServiceId: options?.serviceNameByProviderServiceId,
  });

  if (fromProviderNotes.length > 0) {
    return fromProviderNotes;
  }

  const fromInternalNotes = extractIncludedServicesFromNotes(booking.internal_notes, {
    serviceNameByProviderServiceId: options?.serviceNameByProviderServiceId,
  });

  if (fromInternalNotes.length > 0) {
    return fromInternalNotes;
  }

  const primaryService = booking.service_type?.trim();
  if (!primaryService) {
    return [] as string[];
  }

  const inferredQuantity = inferPrimaryServiceQuantity(
    booking,
    options?.serviceBasePriceByProviderServiceId,
  );

  if (inferredQuantity <= 1) {
    return [primaryService];
  }

  return Array.from({ length: inferredQuantity }, () => primaryService);
}

export function buildIncludedServicesLabel(
  includedServices: ReadonlyArray<string>,
  fallbackServiceType?: string | null,
) {
  const normalizedServices = includedServices
    .map((service) => service.trim())
    .filter((service) => service.length > 0);

  if (normalizedServices.length > 1) {
    return `Bundled services (${normalizedServices.length})`;
  }

  if (normalizedServices.length === 1) {
    return normalizedServices[0];
  }

  const fallbackLabel = fallbackServiceType?.trim();
  return fallbackLabel && fallbackLabel.length > 0 ? fallbackLabel : 'Service';
}

export function countServiceUnitsForBooking(
  booking: IncludedServicesBookingLike,
  options?: IncludedServicesOptions,
) {
  return Math.max(1, resolveIncludedServicesForBooking(booking, options).length);
}
