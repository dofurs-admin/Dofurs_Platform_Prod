import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
  type IncludedServicesBookingLike,
} from '@/lib/bookings/included-services';
import type { ServiceInvoiceLineItemInput } from '@/lib/payments/invoiceService';

type ProviderServiceRow = {
  id: string;
  service_type: string | null;
  base_price: number | null;
};

function uniqueStrings(values: ReadonlyArray<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0)),
    ),
  );
}

function allocateAmountAcrossItems(totalInr: number, itemCount: number, weights?: ReadonlyArray<number>) {
  const total = Math.max(0, Math.round(Number(totalInr)));
  if (itemCount <= 0 || total <= 0) {
    return [] as number[];
  }

  const normalizedWeights = Array.isArray(weights) && weights.length === itemCount
    ? weights.map((weight) => Math.max(0, Number(weight)))
    : [];
  const weightTotal = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const amounts = new Array<number>(itemCount).fill(0);

  if (weightTotal > 0) {
    let allocated = 0;
    for (let index = 0; index < itemCount; index += 1) {
      const amount = index === itemCount - 1
        ? total - allocated
        : Math.round((total * normalizedWeights[index]) / weightTotal);
      amounts[index] = amount;
      allocated += amount;
    }
    return amounts;
  }

  const baseAmount = Math.floor(total / itemCount);
  let remainder = total - baseAmount * itemCount;

  for (let index = 0; index < itemCount; index += 1) {
    amounts[index] = baseAmount + (remainder > 0 ? 1 : 0);
    remainder -= 1;
  }

  return amounts;
}

export async function buildServiceInvoiceLineItemsForBooking(
  supabase: SupabaseClient,
  booking: IncludedServicesBookingLike,
  subtotalInr: number,
): Promise<ServiceInvoiceLineItemInput[] | undefined> {
  const explicitIncludedServices = Array.isArray(booking.included_services)
    ? booking.included_services
        .map((service) => service?.trim())
        .filter((service): service is string => Boolean(service && service.length > 0))
    : [];

  if (explicitIncludedServices.length > 1) {
    const amounts = allocateAmountAcrossItems(subtotalInr, explicitIncludedServices.length);
    return explicitIncludedServices.map((description, index) => ({
      description,
      quantity: 1,
      unitAmountInr: amounts[index],
      lineTotalInr: amounts[index],
    }));
  }

  const providerServiceIdsFromNotes = extractProviderServiceIdsFromNotes(booking.provider_notes);
  const providerServiceIdsFromInternalNotes = providerServiceIdsFromNotes.length > 0
    ? []
    : extractProviderServiceIdsFromNotes(booking.internal_notes);
  const orderedProviderServiceIds = [
    ...providerServiceIdsFromNotes,
    ...providerServiceIdsFromInternalNotes,
  ];

  if (orderedProviderServiceIds.length <= 1) {
    return undefined;
  }

  const providerServiceIds = uniqueStrings(orderedProviderServiceIds);

  const serviceNameByProviderServiceId = new Map<string, string>();
  const serviceBasePriceByProviderServiceId = new Map<string, number>();

  if (providerServiceIds.length > 0) {
    const { data, error } = await supabase
      .from('provider_services')
      .select('id, service_type, base_price')
      .in('id', providerServiceIds);

    if (error) {
      throw error;
    }

    for (const service of (data ?? []) as ProviderServiceRow[]) {
      if (service.id && service.service_type) {
        serviceNameByProviderServiceId.set(service.id, service.service_type);
      }

      const basePrice = Number(service.base_price ?? NaN);
      if (service.id && Number.isFinite(basePrice) && basePrice > 0) {
        serviceBasePriceByProviderServiceId.set(service.id, basePrice);
      }
    }
  }

  const includedServices = resolveIncludedServicesForBooking(booking, {
    serviceNameByProviderServiceId,
    serviceBasePriceByProviderServiceId,
  }).filter((service) => service.trim().length > 0);

  if (includedServices.length <= 1) {
    return undefined;
  }

  const weights = orderedProviderServiceIds.length === includedServices.length
    ? orderedProviderServiceIds.map((serviceId) => serviceBasePriceByProviderServiceId.get(serviceId) ?? 0)
    : undefined;
  const amounts = allocateAmountAcrossItems(subtotalInr, includedServices.length, weights);

  return includedServices.map((description, index) => ({
    description,
    quantity: 1,
    unitAmountInr: amounts[index],
    lineTotalInr: amounts[index],
  }));
}