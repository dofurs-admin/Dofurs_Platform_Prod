import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getAvailableSlots } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const querySchema = z.object({
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  serviceType: z.string().trim().min(1).max(120).optional(),
  serviceTypes: z.string().trim().max(1000).optional(),
  bookingMode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']).optional(),
  serviceDurationMinutes: z.coerce.number().int().positive().max(1440).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  limitProviders: z.coerce.number().int().min(1).max(120).optional(),
  allowCoverageFallback: z.coerce.boolean().optional(),
  strictCoverage: z.coerce.boolean().optional(),
  debug: z.coerce.boolean().optional(),
  allowPastSlots: z.coerce.boolean().optional(),
});

type ProviderServiceRow = {
  id: string | number | null;
  provider_id: number;
  service_type: string;
  service_mode: string | null;
  service_duration_minutes: number | null;
  base_price: number;
};

type ProviderProfile = {
  id: number;
  name: string;
  provider_type: string | null;
  average_rating: number | null;
  total_bookings: number | null;
  background_verified: boolean;
  is_verified: boolean;
};

type ProviderServiceCoverageRow = {
  provider_service_id: string | number | null;
  pincode: string | null;
  is_enabled: boolean;
};

type NormalizedProviderServiceRow = Omit<ProviderServiceRow, 'id'> & { id: string };

function normalizeServiceId(value: string | number | null | undefined) {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Accept both bigint-like numeric IDs and UUID/string IDs; only reject malformed placeholders.
    if (!trimmed || /^(null|undefined|nan)$/i.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeServiceType(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePincode(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digitsOnly) ? digitsOnly : null;
}

type Slot = {
  start_time: string;
  end_time: string;
  is_available: boolean;
};

function rankSlots(left: { availableProviderCount: number; startTime: string }, right: { availableProviderCount: number; startTime: string }) {
  if (left.availableProviderCount !== right.availableProviderCount) {
    return right.availableProviderCount - left.availableProviderCount;
  }

  return left.startTime.localeCompare(right.startTime);
}

function matchesBookingMode(serviceMode: string | null | undefined, bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult') {
  const normalized = (serviceMode ?? '').trim().toLowerCase();

  if (bookingMode === 'home_visit') {
    return (
      normalized === '' ||
      normalized === 'home_visit' ||
      normalized === 'home' ||
      normalized === 'doorstep' ||
      normalized === 'both' ||
      normalized === 'hybrid'
    );
  }

  if (bookingMode === 'clinic_visit') {
    return (
      normalized === 'clinic_visit' ||
      normalized === 'clinic' ||
      normalized === 'center' ||
      normalized === 'both' ||
      normalized === 'hybrid'
    );
  }

  return normalized === 'teleconsult' || normalized === 'tele_consult' || normalized === 'tele';
}

export async function GET(request: Request) {
  const { user, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    pincode: url.searchParams.get('pincode') ?? undefined,
    serviceType: url.searchParams.get('serviceType') ?? undefined,
    serviceTypes: url.searchParams.get('serviceTypes') ?? undefined,
    bookingMode: url.searchParams.get('bookingMode') ?? undefined,
    serviceDurationMinutes: url.searchParams.get('serviceDurationMinutes') ?? undefined,
    bookingDate: url.searchParams.get('bookingDate') ?? undefined,
    startTime: url.searchParams.get('startTime') ?? undefined,
    limitProviders: url.searchParams.get('limitProviders') ?? undefined,
    allowCoverageFallback: url.searchParams.get('allowCoverageFallback') ?? undefined,
    strictCoverage: url.searchParams.get('strictCoverage') ?? undefined,
    debug: url.searchParams.get('debug') ?? undefined,
    allowPastSlots: url.searchParams.get('allowPastSlots') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const { serviceType, bookingMode, serviceDurationMinutes, bookingDate, startTime } = parsed.data;
  const pincode = normalizePincode(parsed.data.pincode);

  if (!pincode) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const requestedServiceTypes = Array.from(
    new Set(
      [
        ...(parsed.data.serviceTypes
          ? parsed.data.serviceTypes
              .split(',')
              .map((value) => normalizeServiceType(value))
              .filter((value) => value.length > 0)
          : []),
        ...(serviceType ? [normalizeServiceType(serviceType)] : []),
      ],
    ),
  );
  const limitProviders = parsed.data.limitProviders ?? 60;
  const allowCoverageFallback = parsed.data.allowCoverageFallback ?? false;
  const strictCoverage = parsed.data.strictCoverage ?? false;
  const debugEnabled = parsed.data.debug ?? false;
  const allowPastSlots = parsed.data.allowPastSlots ?? false;

  if (allowPastSlots && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }
  const adminClient = getSupabaseAdminClient();

  const debug = debugEnabled
    ? {
        requested: {
          pincode,
          serviceType: serviceType ?? null,
          serviceTypes: requestedServiceTypes,
          bookingMode: bookingMode ?? null,
          bookingDate: bookingDate ?? null,
          startTime: startTime ?? null,
          serviceDurationMinutes: serviceDurationMinutes ?? null,
          strictCoverage,
          allowCoverageFallback,
          allowPastSlots,
        },
        counts: {
          fetchedProviderServiceRows: 0,
          excludedInvalidProviderServiceRows: 0,
          excludedByBookingMode: 0,
          afterBookingModeFilter: 0,
          excludedByRequestedServiceType: 0,
          afterRequestedServiceFilter: 0,
          excludedByCoverage: 0,
          eligibleProviderServices: 0,
          effectiveProviderServices: 0,
          scopedProviderServices: 0,
          slotOptions: 0,
          providersWithAnySlots: 0,
          providersMatchingSelectedStartTime: 0,
        },
        exclusions: {
          byBookingMode: [] as Array<{ providerServiceId: string; providerId: number; serviceType: string; serviceMode: string | null }>,
          byRequestedServiceType: [] as Array<{ providerServiceId: string; providerId: number; serviceType: string }>,
          byCoverage: [] as Array<{ providerServiceId: string; providerId: number; serviceType: string; configuredPincodes: string[] }>,
          byNoSlotsOnDate: [] as Array<{ providerServiceId: string; providerId: number; serviceType: string }>,
          bySelectedStartTime: [] as Array<{ providerServiceId: string; providerId: number; serviceType: string; selectedStartTime: string }>,
        },
      }
    : null;

  const DEBUG_LIMIT = 80;
  const pushDebug = <T>(target: T[], value: T) => {
    if (target.length < DEBUG_LIMIT) {
      target.push(value);
    }
  };

  const responsePayload = <T extends Record<string, unknown>>(payload: T) => {
    if (!debug) {
      return payload;
    }

    return {
      ...payload,
      debug,
    };
  };

  try {
    const providerServicesQuery = adminClient
      .from('provider_services')
      .select('id, provider_id, service_type, service_mode, service_duration_minutes, base_price')
      .eq('is_active', true)
      .order('service_type', { ascending: true });

    const { data: providerServicesRows, error: providerServicesError } = await providerServicesQuery;

    if (providerServicesError) {
      const mapped = toFriendlyApiError(providerServicesError, 'Failed to load provider services');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    if (debug) {
      debug.counts.fetchedProviderServiceRows = (providerServicesRows ?? []).length;
    }

    let providerServices: NormalizedProviderServiceRow[] = [];

    for (const row of ((providerServicesRows ?? []) as ProviderServiceRow[])) {
        const normalizedId = normalizeServiceId(row.id);
        const normalizedProviderId = Number(row.provider_id);

        if (!normalizedId || !Number.isFinite(normalizedProviderId) || normalizedProviderId <= 0) {
          if (debug) {
            debug.counts.excludedInvalidProviderServiceRows += 1;
          }
          continue;
        }

        const normalizedRow: NormalizedProviderServiceRow = {
          ...row,
          id: normalizedId,
          provider_id: normalizedProviderId,
        };

        if (bookingMode && !matchesBookingMode(normalizedRow.service_mode, bookingMode)) {
          if (debug) {
            debug.counts.excludedByBookingMode += 1;
            pushDebug(debug.exclusions.byBookingMode, {
              providerServiceId: normalizedRow.id,
              providerId: normalizedRow.provider_id,
              serviceType: normalizedRow.service_type,
              serviceMode: normalizedRow.service_mode,
            });
          }
          continue;
        }

        providerServices.push(normalizedRow);
    }

    if (debug) {
      debug.counts.afterBookingModeFilter = providerServices.length;
    }

    if (requestedServiceTypes.length > 0) {
      const filtered: NormalizedProviderServiceRow[] = [];

      for (const row of providerServices) {
        if (requestedServiceTypes.includes(normalizeServiceType(row.service_type))) {
          filtered.push(row);
          continue;
        }

        if (debug) {
          debug.counts.excludedByRequestedServiceType += 1;
          pushDebug(debug.exclusions.byRequestedServiceType, {
            providerServiceId: row.id,
            providerId: row.provider_id,
            serviceType: row.service_type,
          });
        }
      }

      providerServices = filtered;
    }

    if (debug) {
      debug.counts.afterRequestedServiceFilter = providerServices.length;
    }

    if (providerServices.length === 0) {
      return NextResponse.json(responsePayload({
        services: [],
        providers: [],
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: null,
      }));
    }

    const providerIds = Array.from(new Set(providerServices.map((row) => row.provider_id)));
    const providerProfileMap = new Map<number, ProviderProfile>();

    if (providerIds.length > 0) {
      const { data: providerRows, error: providerRowsError } = await adminClient
        .from('providers')
        .select('id, name, provider_type, average_rating, total_bookings, background_verified, is_verified')
        .in('id', providerIds);

      if (providerRowsError) {
        const mapped = toFriendlyApiError(providerRowsError, 'Failed to load provider profiles');
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
      }

      for (const row of (providerRows ?? []) as ProviderProfile[]) {
        providerProfileMap.set(row.id, row);
      }

      const missingProviderIds = providerIds.filter((id) => !providerProfileMap.has(id));

      if (missingProviderIds.length > 0) {
        const { data: fallbackProviderRows, error: fallbackProviderError } = await adminClient
          .from('providers')
          .select('id, name, provider_type, average_rating, total_bookings, background_verified, is_verified')
          .in('id', missingProviderIds);

        if (fallbackProviderError) {
          const mapped = toFriendlyApiError(fallbackProviderError, 'Failed to load provider profiles');
          return NextResponse.json({ error: mapped.message }, { status: mapped.status });
        }

        for (const row of (fallbackProviderRows ?? []) as ProviderProfile[]) {
          providerProfileMap.set(row.id, row);
        }
      }
    }

    const providerServiceIds = providerServices.map((row) => row.id).filter((id) => id.length > 0);

    if (providerServiceIds.length === 0) {
      return NextResponse.json({
        services: [],
        providers: [],
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: null,
      });
    }

    const { data: coverageRows, error: coverageError } = await adminClient
      .from('provider_service_pincodes')
      .select('provider_service_id, pincode, is_enabled')
      .in('provider_service_id', providerServiceIds);

    if (coverageError && coverageError.code !== '42P01') {
      const mapped = toFriendlyApiError(coverageError, 'Failed to load service coverage');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const coverageByService = new Map<string, Set<string>>();

    for (const row of ((coverageRows ?? []) as ProviderServiceCoverageRow[])) {
      if (!row.is_enabled) {
        continue;
      }

      const normalizedServiceId = normalizeServiceId(row.provider_service_id);
      if (!normalizedServiceId) {
        continue;
      }

      const normalizedPincode = normalizePincode(row.pincode);
      if (!normalizedPincode) {
        continue;
      }

      const existing = coverageByService.get(normalizedServiceId) ?? new Set<string>();
      existing.add(normalizedPincode);
      coverageByService.set(normalizedServiceId, existing);
    }

    const eligibleProviderServices: NormalizedProviderServiceRow[] = [];

    for (const row of providerServices) {
      const configuredCoverage = coverageByService.get(row.id);

      // Strict mode is used by customer-facing serviceability checks and requires explicit pincode mapping.
      if (!configuredCoverage || configuredCoverage.size === 0) {
        if (strictCoverage) {
          if (debug) {
            debug.counts.excludedByCoverage += 1;
            pushDebug(debug.exclusions.byCoverage, {
              providerServiceId: row.id,
              providerId: row.provider_id,
              serviceType: row.service_type,
              configuredPincodes: [],
            });
          }
          continue;
        }

        eligibleProviderServices.push(row);
        continue;
      }

      if (configuredCoverage.has(pincode)) {
        eligibleProviderServices.push(row);
        continue;
      }

      if (debug) {
        debug.counts.excludedByCoverage += 1;
        pushDebug(debug.exclusions.byCoverage, {
          providerServiceId: row.id,
          providerId: row.provider_id,
          serviceType: row.service_type,
          configuredPincodes: Array.from(configuredCoverage).slice(0, 10),
        });
      }
    }

    if (debug) {
      debug.counts.eligibleProviderServices = eligibleProviderServices.length;
    }

    const effectiveProviderServices =
      allowCoverageFallback && eligibleProviderServices.length === 0 ? providerServices : eligibleProviderServices;

    if (debug) {
      debug.counts.effectiveProviderServices = effectiveProviderServices.length;
    }

    if (effectiveProviderServices.length === 0) {
      return NextResponse.json(responsePayload({
        services: [],
        providers: [],
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: null,
      }));
    }

    const serviceSummaryMap = new Map<
      string,
      {
        serviceType: string;
        minBasePrice: number;
        maxBasePrice: number;
        providerCount: number;
      }
    >();

    const servicesSeenByType = new Map<string, Set<number>>();

    for (const row of effectiveProviderServices) {
      const type = row.service_type;
      const existing = serviceSummaryMap.get(type);
      const providerSet = servicesSeenByType.get(type) ?? new Set<number>();
      providerSet.add(row.provider_id);
      servicesSeenByType.set(type, providerSet);

      if (!existing) {
        serviceSummaryMap.set(type, {
          serviceType: type,
          minBasePrice: row.base_price,
          maxBasePrice: row.base_price,
          providerCount: 1,
        });
        continue;
      }

      existing.minBasePrice = Math.min(existing.minBasePrice, row.base_price);
      existing.maxBasePrice = Math.max(existing.maxBasePrice, row.base_price);
      existing.providerCount = providerSet.size;
    }

    const serviceSummaries = Array.from(serviceSummaryMap.values()).sort((left, right) =>
      left.serviceType.localeCompare(right.serviceType),
    );

    let scopedProviderServices = requestedServiceTypes.length > 0
      ? effectiveProviderServices.filter((row) => requestedServiceTypes.includes(normalizeServiceType(row.service_type)))
      : effectiveProviderServices;

    if (requestedServiceTypes.length > 1 || serviceDurationMinutes !== undefined) {
      const supportedServiceTypesByProvider = new Map<number, Set<string>>();

      for (const row of scopedProviderServices) {
        const existing = supportedServiceTypesByProvider.get(row.provider_id) ?? new Set<string>();
        existing.add(normalizeServiceType(row.service_type));
        supportedServiceTypesByProvider.set(row.provider_id, existing);
      }

      const eligibleProviderIds = new Set<number>(
        Array.from(supportedServiceTypesByProvider.entries())
          .filter(([, supportedTypes]) => requestedServiceTypes.every((type) => supportedTypes.has(type)))
          .map(([providerId]) => providerId),
      );

      scopedProviderServices = scopedProviderServices.filter((row) => eligibleProviderIds.has(row.provider_id));
    }

    if (debug) {
      debug.counts.scopedProviderServices = scopedProviderServices.length;
    }

    if (!bookingDate || scopedProviderServices.length === 0) {
      const providerCards = scopedProviderServices.map((row) => {
        const providerProfile = providerProfileMap.get(row.provider_id);

        return {
          providerId: row.provider_id,
          providerName: providerProfile?.name ?? `Provider #${row.provider_id}`,
          providerType: providerProfile?.provider_type ?? null,
          providerServiceId: row.id,
          serviceType: row.service_type,
          serviceMode: row.service_mode,
          basePrice: row.base_price,
          serviceDurationMinutes: row.service_duration_minutes ?? 30,
          availableSlotCount: 0,
          availableForSelectedSlot: false,
          availableSlotStartTimes: [] as string[],
          recommended: false,
          averageRating: providerProfile?.average_rating ?? null,
          totalBookings: providerProfile?.total_bookings ?? null,
          backgroundVerified: providerProfile?.background_verified ?? false,
          isVerified: providerProfile?.is_verified ?? false,
        };
      });

      const sortedProviderCards = [...providerCards].sort((left, right) => {
        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        return left.providerName.localeCompare(right.providerName);
      });

      const limitedProviderCards = sortedProviderCards.slice(0, limitProviders);
      const recommendedProvider = limitedProviderCards[0];

      return NextResponse.json(responsePayload({
        services: serviceSummaries,
        providers: limitedProviderCards.map((item) => ({
          ...item,
          recommended: item.providerServiceId === recommendedProvider?.providerServiceId,
        })),
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: recommendedProvider?.providerServiceId ?? null,
      }));
    }

    if (requestedServiceTypes.length > 1) {
      const rowsByProvider = new Map<number, Array<(typeof scopedProviderServices)[number]>>();

      for (const row of scopedProviderServices) {
        const existing = rowsByProvider.get(row.provider_id) ?? [];
        existing.push(row);
        rowsByProvider.set(row.provider_id, existing);
      }

      const slotsByProviderId = new Map<number, Slot[]>();

      await Promise.all(
        Array.from(rowsByProvider.entries()).map(async ([providerId, providerRows]) => {
          const primaryServiceType = serviceType?.trim().toLowerCase() ?? null;
          const representativeRow =
            (primaryServiceType
              ? [...providerRows]
                  .filter((row) => normalizeServiceType(row.service_type) === normalizeServiceType(primaryServiceType))
                  .sort((left, right) => left.base_price - right.base_price)[0]
              : null) ?? [...providerRows].sort((left, right) => left.base_price - right.base_price)[0];

          const providerBundleDuration =
            serviceDurationMinutes ??
            (requestedServiceTypes.length > 1
              ? providerRows.reduce((sum, item) => sum + (item.service_duration_minutes ?? 30), 0)
              : representativeRow?.service_duration_minutes ?? 30);

          const slots = await getAvailableSlots(adminClient, {
            providerId,
            bookingDate,
            serviceDurationMinutes: providerBundleDuration,
            allowPastSlots,
          });

          slotsByProviderId.set(providerId, slots as Slot[]);
        }),
      );

      const slotMap = new Map<
        string,
        {
          startTime: string;
          endTime: string;
          providerIds: Set<number>;
        }
      >();

      for (const [providerId, slots] of slotsByProviderId.entries()) {
        for (const slot of slots) {
          if (!slot.is_available) {
            continue;
          }

          const key = `${slot.start_time}-${slot.end_time}`;
          const existing = slotMap.get(key);

          if (!existing) {
            slotMap.set(key, {
              startTime: slot.start_time,
              endTime: slot.end_time,
              providerIds: new Set<number>([providerId]),
            });
            continue;
          }

          existing.providerIds.add(providerId);
        }
      }

      const slotOptions = Array.from(slotMap.values())
        .map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          availableProviderCount: slot.providerIds.size,
        }))
        .sort(rankSlots);

      if (debug) {
        debug.counts.slotOptions = slotOptions.length;
      }

      const recommendedSlot = slotOptions[0] ?? null;
      const selectedSlotTime = startTime ?? recommendedSlot?.startTime ?? null;

      if (debug) {
        let providersWithAnySlots = 0;
        let providersMatchingSelectedStartTime = 0;

        for (const [providerId, providerRows] of rowsByProvider.entries()) {
          const slots = slotsByProviderId.get(providerId) ?? [];
          const availableSlots = slots.filter((slot) => slot.is_available);

          if (availableSlots.length > 0) {
            providersWithAnySlots += 1;
          } else {
            const representative = [...providerRows].sort((left, right) => left.base_price - right.base_price)[0];
            pushDebug(debug.exclusions.byNoSlotsOnDate, {
              providerServiceId: representative.id,
              providerId,
              serviceType: representative.service_type,
            });
          }

          if (selectedSlotTime && availableSlots.some((slot) => slot.start_time === selectedSlotTime)) {
            providersMatchingSelectedStartTime += 1;
          } else if (selectedSlotTime && availableSlots.length > 0) {
            const representative = [...providerRows].sort((left, right) => left.base_price - right.base_price)[0];
            pushDebug(debug.exclusions.bySelectedStartTime, {
              providerServiceId: representative.id,
              providerId,
              serviceType: representative.service_type,
              selectedStartTime: selectedSlotTime,
            });
          }
        }

        debug.counts.providersWithAnySlots = providersWithAnySlots;
        debug.counts.providersMatchingSelectedStartTime = providersMatchingSelectedStartTime;
      }

      const primaryServiceType = serviceType ? normalizeServiceType(serviceType) : null;

      const providers = Array.from(rowsByProvider.entries())
        .map(([providerId, providerRows]) => {
          const providerProfile = providerProfileMap.get(providerId);
          const slots = slotsByProviderId.get(providerId) ?? [];
          const availableSlotCount = slots.filter((slot) => slot.is_available).length;
          const availableForSelectedSlot = selectedSlotTime
            ? slots.some((slot) => slot.is_available && slot.start_time === selectedSlotTime)
            : false;

          const representativeRow =
            (primaryServiceType
              ? [...providerRows]
                  .filter((row) => normalizeServiceType(row.service_type) === primaryServiceType)
                  .sort((left, right) => left.base_price - right.base_price)[0]
              : null) ?? [...providerRows].sort((left, right) => left.base_price - right.base_price)[0];

          const providerBasePrice =
            requestedServiceTypes.length > 1
              ? providerRows.reduce((sum, row) => sum + row.base_price, 0)
              : representativeRow.base_price;
          const providerDurationMinutes =
            serviceDurationMinutes ??
            (requestedServiceTypes.length > 1
              ? providerRows.reduce((sum, row) => sum + (row.service_duration_minutes ?? 30), 0)
              : representativeRow.service_duration_minutes ?? 30);

          return {
            providerId,
            providerName: providerProfile?.name ?? `Provider #${providerId}`,
            providerType: providerProfile?.provider_type ?? null,
            providerServiceId: representativeRow.id,
            serviceType: representativeRow.service_type,
            serviceMode: representativeRow.service_mode,
            basePrice: providerBasePrice,
            serviceDurationMinutes: providerDurationMinutes,
            availableSlotCount,
            availableForSelectedSlot,
            availableSlotStartTimes: slots
              .filter((slot) => slot.is_available)
              .map((slot) => slot.start_time),
            averageRating: providerProfile?.average_rating ?? null,
            totalBookings: providerProfile?.total_bookings ?? null,
            backgroundVerified: providerProfile?.background_verified ?? false,
            isVerified: providerProfile?.is_verified ?? false,
          };
        })
        .sort((left, right) => {
          if (left.availableForSelectedSlot !== right.availableForSelectedSlot) {
            return left.availableForSelectedSlot ? -1 : 1;
          }

          if (left.availableSlotCount !== right.availableSlotCount) {
            return right.availableSlotCount - left.availableSlotCount;
          }

          if (left.basePrice !== right.basePrice) {
            return left.basePrice - right.basePrice;
          }

          return left.providerName.localeCompare(right.providerName);
        });

      const limitedProviders = providers.slice(0, limitProviders);
      const recommendedProviderServiceId = limitedProviders[0]?.providerServiceId ?? null;

      return NextResponse.json(
        responsePayload({
          services: serviceSummaries,
          providers: limitedProviders.map((item) => ({
            ...item,
            recommended: item.providerServiceId === recommendedProviderServiceId,
          })),
          slotOptions: slotOptions.map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            availableProviderCount: slot.availableProviderCount,
            recommended: slot.startTime === recommendedSlot?.startTime,
          })),
          recommendedSlotStartTime: recommendedSlot?.startTime ?? null,
          recommendedProviderServiceId,
        }),
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        },
      );
    }

    const slotsByProviderServiceId = new Map<string, Slot[]>();

    await Promise.all(
      scopedProviderServices.map(async (row) => {
        const slots = await getAvailableSlots(adminClient, {
          providerId: row.provider_id,
          bookingDate,
          serviceDurationMinutes: serviceDurationMinutes ?? row.service_duration_minutes ?? undefined,
          allowPastSlots,
        });

        slotsByProviderServiceId.set(row.id, slots as Slot[]);
      }),
    );

    const slotMap = new Map<
      string,
      {
        startTime: string;
        endTime: string;
        availableProviderCount: number;
        providerServiceIds: string[];
      }
    >();

    for (const row of scopedProviderServices) {
      const slots = slotsByProviderServiceId.get(row.id) ?? [];

      for (const slot of slots) {
        if (!slot.is_available) {
          continue;
        }

        const key = `${slot.start_time}-${slot.end_time}`;
        const existing = slotMap.get(key);

        if (!existing) {
          slotMap.set(key, {
            startTime: slot.start_time,
            endTime: slot.end_time,
            availableProviderCount: 1,
            providerServiceIds: [row.id],
          });
          continue;
        }

        existing.availableProviderCount += 1;
        existing.providerServiceIds.push(row.id);
      }
    }

    const slotOptions = Array.from(slotMap.values()).sort(rankSlots);
    if (debug) {
      debug.counts.slotOptions = slotOptions.length;
    }
    const recommendedSlot = slotOptions[0] ?? null;

    const selectedSlotTime = startTime ?? recommendedSlot?.startTime ?? null;

    const providers = scopedProviderServices
      .map((row) => {
        const providerProfile = providerProfileMap.get(row.provider_id);
        const slots = slotsByProviderServiceId.get(row.id) ?? [];
        const availableSlotCount = slots.filter((slot) => slot.is_available).length;
        const availableForSelectedSlot = selectedSlotTime
          ? slots.some((slot) => slot.is_available && slot.start_time === selectedSlotTime)
          : false;

        return {
          providerId: row.provider_id,
          providerName: providerProfile?.name ?? `Provider #${row.provider_id}`,
          providerType: providerProfile?.provider_type ?? null,
          providerServiceId: row.id,
          serviceType: row.service_type,
          serviceMode: row.service_mode,
          basePrice: row.base_price,
          serviceDurationMinutes: row.service_duration_minutes ?? 30,
          availableSlotCount,
          availableForSelectedSlot,
          availableSlotStartTimes: slots
            .filter((slot) => slot.is_available)
            .map((slot) => slot.start_time),
          averageRating: providerProfile?.average_rating ?? null,
          totalBookings: providerProfile?.total_bookings ?? null,
          backgroundVerified: providerProfile?.background_verified ?? false,
          isVerified: providerProfile?.is_verified ?? false,
        };
      })
      .sort((left, right) => {
        if (left.availableForSelectedSlot !== right.availableForSelectedSlot) {
          return left.availableForSelectedSlot ? -1 : 1;
        }

        if (left.availableSlotCount !== right.availableSlotCount) {
          return right.availableSlotCount - left.availableSlotCount;
        }

        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        return left.providerName.localeCompare(right.providerName);
      });

    if (debug) {
      const byProviderServiceId = new Map(scopedProviderServices.map((row) => [row.id, row]));
      let providersWithAnySlots = 0;
      let providersMatchingSelectedStartTime = 0;

      for (const [providerServiceId, slots] of slotsByProviderServiceId.entries()) {
        const row = byProviderServiceId.get(providerServiceId);
        if (!row) {
          continue;
        }

        const availableSlots = slots.filter((slot) => slot.is_available);
        if (availableSlots.length > 0) {
          providersWithAnySlots += 1;
        } else {
          pushDebug(debug.exclusions.byNoSlotsOnDate, {
            providerServiceId,
            providerId: row.provider_id,
            serviceType: row.service_type,
          });
        }

        if (selectedSlotTime && availableSlots.some((slot) => slot.start_time === selectedSlotTime)) {
          providersMatchingSelectedStartTime += 1;
        } else if (selectedSlotTime && availableSlots.length > 0) {
          pushDebug(debug.exclusions.bySelectedStartTime, {
            providerServiceId,
            providerId: row.provider_id,
            serviceType: row.service_type,
            selectedStartTime: selectedSlotTime,
          });
        }
      }

      debug.counts.providersWithAnySlots = providersWithAnySlots;
      debug.counts.providersMatchingSelectedStartTime = providersMatchingSelectedStartTime;
    }

    const limitedProviders = providers.slice(0, limitProviders);
    const recommendedProviderServiceId = limitedProviders[0]?.providerServiceId ?? null;

    return NextResponse.json(responsePayload({
      services: serviceSummaries,
      providers: limitedProviders.map((item) => ({
        ...item,
        recommended: item.providerServiceId === recommendedProviderServiceId,
      })),
      slotOptions: slotOptions.map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        availableProviderCount: slot.availableProviderCount,
        recommended: slot.startTime === recommendedSlot?.startTime,
      })),
      recommendedSlotStartTime: recommendedSlot?.startTime ?? null,
      recommendedProviderServiceId,
    }), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const normalized = error.message.toLowerCase();

      if (normalized.includes('invalid input syntax') || normalized.includes('bigint')) {
        return NextResponse.json({ error: 'Unable to load booking availability right now. Please try again.' }, { status: 500 });
      }
    }

    const mapped = toFriendlyApiError(error, 'Failed to load admin booking availability');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
