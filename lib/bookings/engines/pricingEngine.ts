import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingBreakdown } from '../types';
import { applyDiscount } from './discountEngine';

export type PriceBreakdown = PricingBreakdown;

type MappingAddonRow = {
  id: string;
  provider_service_id: string;
  addon_template_id: string;
  price_override: number | null;
  is_active: boolean;
  moderation_status: string;
  addon_templates:
    | { id: string; name: string; default_price: number | null; is_active: boolean; moderation_status: string }
    | Array<{ id: string; name: string; default_price: number | null; is_active: boolean; moderation_status: string }>;
};

type LegacyAddonRow = {
  id: string;
  provider_service_id: string;
  name: string;
  price: number | null;
  is_active: boolean;
};

function normalizeErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  return null;
}

function normalizeErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
}

function isSchemaMissingError(error: unknown) {
  const code = normalizeErrorCode(error);
  if (code === '42P01' || code === '42703' || code === 'PGRST204') {
    return true;
  }

  const message = normalizeErrorMessage(error).toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

type ServiceInfo = { serviceType: string; providerId: number | null };

async function loadAddonServiceTypes(
  supabase: SupabaseClient,
  selectedServiceId: string,
  mappingServiceIds: string[],
): Promise<Map<string, ServiceInfo>> {
  const targetServiceIds = Array.from(new Set([selectedServiceId, ...mappingServiceIds]));
  if (targetServiceIds.length <= 1) {
    return new Map<string, ServiceInfo>();
  }

  const { data: serviceTypeRows, error: serviceTypeError } = await supabase
    .from('provider_services')
    .select('id, service_type, provider_id')
    .in('id', targetServiceIds)
    .returns<Array<{ id: string; service_type: string | null; provider_id: number | null }>>();

  if (serviceTypeError) {
    throw new Error('Unable to verify add-on compatibility');
  }

  return new Map(
    (serviceTypeRows ?? []).map((row) => [
      row.id,
      {
        serviceType: (row.service_type ?? '').trim().toLowerCase(),
        providerId: row.provider_id ?? null,
      },
    ]),
  );
}

async function calculateAddOnTotal(
  supabase: SupabaseClient,
  serviceId: string,
  addOns: Array<{ id: string; quantity: number }>,
) {
  const addOnIds = Array.from(new Set(addOns.map((addon) => addon.id)));
  let addOnPrice = 0;
  const breakdown: string[] = [];

  const { data: mappingRows, error: mappingError } = await supabase
    .from('provider_service_addon_mappings')
    .select(
      'id, provider_service_id, addon_template_id, price_override, is_active, moderation_status, addon_templates(id, name, default_price, is_active, moderation_status)',
    )
    .in('id', addOnIds)
    .returns<MappingAddonRow[]>();

  if (mappingError && !isSchemaMissingError(mappingError)) {
    throw new Error('Failed to load add-ons');
  }

  const mappingById = new Map((mappingRows ?? []).map((row) => [row.id, row]));
  const mappingServiceIds = (mappingRows ?? []).map((row) => row.provider_service_id);
  const serviceTypeMap = await loadAddonServiceTypes(supabase, serviceId, mappingServiceIds);
  const selectedServiceType = serviceTypeMap.get(serviceId)?.serviceType ?? '';

  const unresolvedLegacyIds: string[] = [];

  for (const addon of addOns) {
    const mapping = mappingById.get(addon.id);
    if (!mapping) {
      unresolvedLegacyIds.push(addon.id);
      continue;
    }

    const template = Array.isArray(mapping.addon_templates) ? mapping.addon_templates[0] : mapping.addon_templates;
    const mappingServiceInfo = serviceTypeMap.get(mapping.provider_service_id);
    const mappingServiceType = mappingServiceInfo?.serviceType ?? '';
    // Allow catalog-level mappings (provider_id = null) for any provider service — same rule as
    // resolveBookingAddonsForCreate in service.ts. If serviceTypeMap has no entry for the
    // mapping's service (early-return case), null acts as "catalog" and is also allowed.
    const mappingProviderId = mappingServiceInfo?.providerId ?? null;
    const isCompatibleService =
      mapping.provider_service_id === serviceId ||
      mappingProviderId === null ||
      (selectedServiceType.length > 0 && mappingServiceType.length > 0 && selectedServiceType === mappingServiceType);

    if (!isCompatibleService) {
      throw new Error('Add-on not found');
    }

    if (!mapping.is_active || mapping.moderation_status !== 'approved') {
      throw new Error('Add-on not found');
    }

    if (!template || !template.is_active || template.moderation_status !== 'approved') {
      throw new Error('Add-on not found');
    }

    const qty = Math.max(1, addon.quantity || 1);
    const unitPrice = Number(mapping.price_override ?? template.default_price ?? 0);
    const addonCost = unitPrice * qty;
    addOnPrice += addonCost;
    breakdown.push(`${template.name} (x${qty}): ₹${addonCost}`);
  }

  if (unresolvedLegacyIds.length > 0) {
    const { data: legacyRows, error: legacyError } = await supabase
      .from('service_addons')
      .select('id, provider_service_id, name, price, is_active')
      .in('id', unresolvedLegacyIds)
      .returns<LegacyAddonRow[]>();

    if (legacyError) {
      throw new Error('Failed to load add-ons');
    }

    const legacyMap = new Map((legacyRows ?? []).map((row) => [row.id, row]));

    for (const addon of addOns) {
      if (!unresolvedLegacyIds.includes(addon.id)) {
        continue;
      }

      const legacy = legacyMap.get(addon.id);
      if (!legacy || !legacy.is_active || legacy.provider_service_id !== serviceId) {
        throw new Error('Add-on not found');
      }

      const qty = Math.max(1, addon.quantity || 1);
      const addonCost = Number(legacy.price ?? 0) * qty;
      addOnPrice += addonCost;
      breakdown.push(`${legacy.name} (x${qty}): ₹${addonCost}`);
    }
  }

  return { addOnPrice, breakdown };
}

export async function calculateBookingPriceWithSupabase(
  supabase: SupabaseClient,
  params: {
    bookingType: 'service';
    providerId: string | number | bigint;
    serviceId?: string;
    addOns?: Array<{ id: string; quantity: number }>;
  },
): Promise<PricingBreakdown> {
  const breakdown: string[] = [];
  let basePrice = 0;
  let addOnPrice = 0;
  const discountAmount = 0;

  if (params.bookingType === 'service' && params.serviceId) {
    const { data: service, error } = await supabase
      .from('provider_services')
      .select('base_price, service_type')
      .eq('id', params.serviceId)
      .eq('provider_id', params.providerId)
      .single<{ base_price: number | null; service_type: string }>();

    if (error || !service) {
      throw new Error('Service not found');
    }

    basePrice = Number(service.base_price ?? 0);
    breakdown.push(`${service.service_type}: ₹${basePrice}`);

    const addOns = params.addOns ?? [];
    if (addOns.length > 0) {
      const addOnTotals = await calculateAddOnTotal(supabase, params.serviceId, addOns);
      addOnPrice += addOnTotals.addOnPrice;
      breakdown.push(...addOnTotals.breakdown);
    }
  }

  return {
    base_total: basePrice,
    addon_total: addOnPrice,
    discount_amount: discountAmount,
    final_total: applyDiscount(basePrice + addOnPrice, discountAmount),
    breakdown,
  };
}
