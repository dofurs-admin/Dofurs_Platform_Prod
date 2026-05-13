import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getBookingOutstandingSummary } from '@/lib/payments/bookingPayable';
import { loadBookingAddonRowsByBookingIds } from '@/lib/bookings/addon-items';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  extractBundledPetIdsFromNotes,
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';

type RouteContext = { params: Promise<{ id: string }> };

type ApiSupabaseClient = Awaited<ReturnType<typeof requireApiRole>> extends { context: infer T }
  ? T extends { supabase: infer S }
    ? S
    : never
  : never;

type BookingTransitionEvent = {
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

type BookingAddonItem = {
  id: string;
  booking_id: number;
  name_snapshot: string;
  quantity: number;
  total_price_inr: number;
  total_price_snapshot?: number | null;
  status: string;
  created_at?: string;
};

type ProviderServiceRow = {
  id: string;
  service_type: string | null;
  base_price: number | null;
};

type BookingPetRow = {
  id: number;
  name: string | null;
  breed: string | null;
  age: number | null;
  gender: string | null;
  size_category: string | null;
};

type PaymentMetadataRow = {
  metadata: unknown;
};

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeBookingPetRows(value: unknown): BookingPetRow[] {
  if (!value) {
    return [];
  }

  const rows = Array.isArray(value) ? value : [value];
  const normalized: BookingPetRow[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const pet = row as Record<string, unknown>;
    const id = toPositiveInteger(pet.id);
    if (id == null) {
      continue;
    }

    normalized.push({
      id,
      name: typeof pet.name === 'string' ? pet.name : null,
      breed: typeof pet.breed === 'string' ? pet.breed : null,
      age: typeof pet.age === 'number' && Number.isFinite(pet.age) ? pet.age : null,
      gender: typeof pet.gender === 'string' ? pet.gender : null,
      size_category: typeof pet.size_category === 'string' ? pet.size_category : null,
    });
  }

  return normalized;
}

function extractPetIdsFromPayloadNode(value: unknown): number[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractPetIdsFromPayloadNode(entry));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const candidate = toPositiveInteger((value as { petId?: unknown }).petId);
  return candidate == null ? [] : [candidate];
}

function extractPetIdsFromPaymentMetadata(metadata: unknown): number[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const value = metadata as Record<string, unknown>;

  return [
    ...extractPetIdsFromPayloadNode(value.booking_payload),
    ...extractPetIdsFromPayloadNode(value.booking_bundle_payload),
    ...extractPetIdsFromPayloadNode(value.booking_payloads),
  ];
}

async function loadResolvedPetsForBooking(
  adminSupabase: ReturnType<typeof getSupabaseAdminClient>,
  booking: Record<string, unknown>,
  bookingId: number,
) {
  const providerNotes =
    typeof booking.provider_notes === 'string' ? booking.provider_notes : null;
  const internalNotes =
    typeof booking.internal_notes === 'string'
      ? booking.internal_notes
      : typeof booking.notes === 'string'
        ? booking.notes
        : null;

  const resolvedPetIds = new Set<number>([
    ...extractBundledPetIdsFromNotes(providerNotes),
    ...extractBundledPetIdsFromNotes(internalNotes),
    ...normalizeBookingPetRows(booking.pets).map((pet) => pet.id),
  ]);

  const primaryPetId = toPositiveInteger(booking.pet_id);
  if (primaryPetId != null) {
    resolvedPetIds.add(primaryPetId);
  }

  const { data: paymentRows, error: paymentRowsError } = await adminSupabase
    .from('payment_transactions')
    .select('metadata')
    .eq('booking_id', bookingId)
    .returns<PaymentMetadataRow[]>();

  if (paymentRowsError && paymentRowsError.code !== '42P01') {
    console.warn('Unable to load payment metadata for admin booking pet enrichment', {
      bookingId,
      error: paymentRowsError,
    });
  } else {
    for (const row of paymentRows ?? []) {
      for (const petId of extractPetIdsFromPaymentMetadata(row.metadata)) {
        resolvedPetIds.add(petId);
      }
    }
  }

  const petIds = Array.from(resolvedPetIds);
  if (petIds.length === 0) {
    return normalizeBookingPetRows(booking.pets);
  }

  const { data: petRows, error: petRowsError } = await adminSupabase
    .from('pets')
    .select('id, name, breed, age, gender, size_category')
    .in('id', petIds)
    .returns<BookingPetRow[]>();

  if (petRowsError) {
    console.warn('Unable to resolve pets for admin booking details', {
      bookingId,
      error: petRowsError,
    });
    return normalizeBookingPetRows(booking.pets);
  }

  const petById = new Map<number, BookingPetRow>();
  for (const row of petRows ?? []) {
    petById.set(row.id, row);
  }

  return petIds.map((petId) => petById.get(petId)).filter((row): row is BookingPetRow => Boolean(row));
}

async function loadBookingTransitionEvents(
  supabase: ApiSupabaseClient,
  bookingId: number,
): Promise<BookingTransitionEvent[]> {
  const currentSchema = await supabase
    .from('booking_status_transition_events')
    .select('from_status, to_status, actor_id, created_at, source, metadata')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (!currentSchema.error) {
    return (currentSchema.data ?? []).map((row) => ({
      old_status: row.from_status ?? null,
      new_status: row.to_status,
      changed_by: row.actor_id ?? null,
      changed_at: row.created_at,
      source: row.source ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    }));
  }

  if (currentSchema.error.code === '42703') {
    const legacySchema = await supabase
      .from('booking_status_transition_events')
      .select('old_status, new_status, changed_by, changed_at, source, metadata')
      .eq('booking_id', bookingId)
      .order('changed_at', { ascending: false });

    if (!legacySchema.error) {
      return (legacySchema.data ?? []) as BookingTransitionEvent[];
    }

    if (legacySchema.error.code === '42P01') {
      return [];
    }

    throw legacySchema.error;
  }

  if (currentSchema.error.code === '42P01') {
    return [];
  }

  throw currentSchema.error;
}

async function loadBookingDetailRow(supabase: ApiSupabaseClient, bookingId: number) {
  const modernSchema = await supabase
    .from('bookings')
    .select(`
      id, user_id, pet_id, provider_id, booking_start, booking_date, start_time, end_time,
      status, booking_status, booking_mode, service_type,
      provider_service_id, admin_price_reference,
      location_address, internal_notes, provider_notes,
      amount, discount_amount, final_price, price_at_booking, wallet_credits_applied_inr, payment_mode,
      discount_code, created_at,
      users(name, email, phone, address),
      providers(name, email, phone_number),
      pets(id, name, breed, age, gender, size_category)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (!modernSchema.error) {
    return modernSchema.data;
  }

  if (modernSchema.error.code === '42703') {
    const legacySchema = await supabase
      .from('bookings')
      .select(`
        id, user_id, pet_id, provider_id, booking_start, booking_date, start_time, end_time,
        status, booking_status, booking_mode, service_type,
        address, pincode, notes,
        subtotal_inr, discount_inr, total_inr, final_price, price_at_booking, admin_price_reference,
        wallet_credits_applied_inr, discount_code, created_at,
        users(name, email, phone, address),
        providers(name, email, phone),
        pets(id, name, breed, age, gender, size_category)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (!legacySchema.error) {
      return legacySchema.data;
    }

    throw legacySchema.error;
  }

  throw modernSchema.error;
}

function normalizeBookingForAdminModal(booking: Record<string, unknown>) {
  const providers = (booking.providers as Record<string, unknown> | null) ?? null;

  return {
    ...booking,
    pet_id: toPositiveInteger(booking.pet_id),
    address: (booking.address as string | null | undefined) ?? (booking.location_address as string | null | undefined) ?? null,
    pincode: (booking.pincode as string | null | undefined) ?? null,
    notes: (booking.notes as string | null | undefined) ?? (booking.internal_notes as string | null | undefined) ?? null,
    subtotal_inr:
      (booking.subtotal_inr as number | null | undefined) ??
      (booking.admin_price_reference as number | null | undefined) ??
      (booking.price_at_booking as number | null | undefined) ??
      null,
    discount_inr: (booking.discount_inr as number | null | undefined) ?? (booking.discount_amount as number | null | undefined) ?? null,
    total_inr:
      (booking.total_inr as number | null | undefined) ??
      (booking.final_price as number | null | undefined) ??
      (booking.amount as number | null | undefined) ??
      null,
    wallet_credits_applied_inr: (booking.wallet_credits_applied_inr as number | null | undefined) ?? null,
    pets: normalizeBookingPetRows(booking.pets),
    providers: providers
      ? {
          ...providers,
          phone_number: (providers.phone_number as string | null | undefined) ?? (providers.phone as string | null | undefined) ?? null,
        }
      : null,
  };
}

async function loadProviderServiceMapsForBooking(
  supabase: ApiSupabaseClient,
  booking: Record<string, unknown>,
) {
  const referencedProviderServiceIds = new Set<string>();

  const bookingProviderServiceId =
    typeof booking.provider_service_id === 'string' ? booking.provider_service_id.trim() : '';
  if (bookingProviderServiceId) {
    referencedProviderServiceIds.add(bookingProviderServiceId);
  }

  const providerNotes =
    typeof booking.provider_notes === 'string' ? booking.provider_notes : null;
  const internalNotes =
    typeof booking.internal_notes === 'string'
      ? booking.internal_notes
      : typeof booking.notes === 'string'
        ? booking.notes
        : null;

  for (const serviceId of extractProviderServiceIdsFromNotes(providerNotes)) {
    referencedProviderServiceIds.add(serviceId);
  }

  for (const serviceId of extractProviderServiceIdsFromNotes(internalNotes)) {
    referencedProviderServiceIds.add(serviceId);
  }

  const serviceNameByProviderServiceId = new Map<string, string>();
  const serviceBasePriceByProviderServiceId = new Map<string, number>();

  if (referencedProviderServiceIds.size === 0) {
    return {
      serviceNameByProviderServiceId,
      serviceBasePriceByProviderServiceId,
    };
  }

  const { data: providerServiceRows, error: providerServiceError } = await supabase
    .from('provider_services')
    .select('id, service_type, base_price')
    .in('id', Array.from(referencedProviderServiceIds))
    .returns<ProviderServiceRow[]>();

  if (providerServiceError) {
    throw providerServiceError;
  }

  for (const row of providerServiceRows ?? []) {
    const serviceType = row.service_type?.trim();
    if (serviceType) {
      serviceNameByProviderServiceId.set(row.id, serviceType);
    }

    const basePrice = Number(row.base_price ?? NaN);
    if (Number.isFinite(basePrice) && basePrice > 0) {
      serviceBasePriceByProviderServiceId.set(row.id, basePrice);
    }
  }

  return {
    serviceNameByProviderServiceId,
    serviceBasePriceByProviderServiceId,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const adminSupabase = getSupabaseAdminClient();
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  let booking: Record<string, unknown> | null = null;
  let pendingPayableInr = 0;

  try {
    booking = (await loadBookingDetailRow(supabase, bookingId)) as Record<string, unknown> | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load booking details';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  try {
    const payableSummary = await getBookingOutstandingSummary(supabase, bookingId);
    pendingPayableInr = payableSummary.outstandingInr;
  } catch (pendingError) {
    console.error('Failed to compute admin pending payable', { bookingId, error: pendingError });
  }

  let transitionEvents: BookingTransitionEvent[] = [];

  try {
    transitionEvents = await loadBookingTransitionEvents(supabase, bookingId);
  } catch (transitionError) {
    console.error('Failed to load booking transition events', { bookingId, error: transitionError });
  }

  // Fetch linked invoice if any
  const { data: invoices } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, status, total_inr, wallet_credits_applied_inr, issued_at, paid_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(5);

  let normalizedAddonItems: BookingAddonItem[] = [];

  try {
    normalizedAddonItems = await loadBookingAddonRowsByBookingIds(adminSupabase, [bookingId]);
  } catch (addonError) {
    const message = addonError instanceof Error ? addonError.message : 'Failed to load booking add-ons';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let includedServices: string[] = [];

  try {
    const { serviceNameByProviderServiceId, serviceBasePriceByProviderServiceId } =
      await loadProviderServiceMapsForBooking(adminSupabase, booking);

    includedServices = resolveIncludedServicesForBooking(
      {
        service_type:
          typeof booking.service_type === 'string' ? booking.service_type : null,
        provider_service_id:
          typeof booking.provider_service_id === 'string'
            ? booking.provider_service_id
            : null,
        provider_notes:
          typeof booking.provider_notes === 'string' ? booking.provider_notes : null,
        internal_notes:
          typeof booking.internal_notes === 'string'
            ? booking.internal_notes
            : typeof booking.notes === 'string'
              ? booking.notes
              : null,
        admin_price_reference: Number(
          booking.admin_price_reference ?? booking.subtotal_inr ?? NaN,
        ),
        price_at_booking: Number(booking.price_at_booking ?? NaN),
      },
      {
        serviceNameByProviderServiceId,
        serviceBasePriceByProviderServiceId,
      },
    );
  } catch (includedServicesError) {
    console.error('Failed to resolve admin included services', {
      bookingId,
      error: includedServicesError,
    });
  }

  let resolvedPets: BookingPetRow[] = [];

  try {
    resolvedPets = await loadResolvedPetsForBooking(adminSupabase, booking, bookingId);
  } catch (petError) {
    console.error('Failed to resolve admin booking pets', {
      bookingId,
      error: petError,
    });
  }

  const normalizedBooking = normalizeBookingForAdminModal(booking as Record<string, unknown>);

  return NextResponse.json({
    booking: {
      ...normalizedBooking,
      pets: resolvedPets.length > 0 ? resolvedPets : normalizedBooking.pets,
      pending_payable_inr: Math.max(0, Number(pendingPayableInr ?? 0)),
      booking_status_transition_events: transitionEvents,
      included_services: includedServices,
    },
    invoices: invoices ?? [],
    addonItems: normalizedAddonItems,
  });
}
