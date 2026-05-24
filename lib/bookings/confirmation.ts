import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACTIVE_BOOKING_ADDON_STATUSES,
  loadBookingAddonRowsByBookingIds,
  type BookingAddonSummaryRow,
} from '@/lib/bookings/addon-items';
import {
  buildIncludedServicesLabel,
  extractBundledPetIdsFromNotes,
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';

type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

type BookingConfirmationBookingRow = {
  id: number;
  user_id: string;
  pet_id: number | null;
  provider_id: number | null;
  provider_service_id: string | null;
  service_type: string | null;
  booking_start: string;
  booking_end: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  booking_status: string | null;
  booking_mode: string | null;
  location_address: string | null;
  provider_notes: string | null;
  internal_notes: string | null;
  amount: number | null;
  admin_price_reference: number | null;
  price_at_booking: number | null;
  discount_amount: number | null;
  discount_code: string | null;
  final_price: number | null;
  payment_mode: string | null;
  wallet_credits_applied_inr: number | null;
  created_at: string;
};

type ProviderRow = {
  id: number;
  name: string | null;
  type: string | null;
};

type PetRow = {
  id: number;
  name: string | null;
  breed: string | null;
  age: number | null;
  gender: string | null;
  size_category: string | null;
  photo_url: string | null;
};

type ProviderServiceRow = {
  id: string;
  service_type: string | null;
  base_price: number | null;
  service_duration_minutes: number | null;
};

type PaymentTransactionRow = {
  booking_id: number | null;
  amount_inr: number | null;
  status: string | null;
  provider: string | null;
  transaction_type: string | null;
  metadata: unknown;
};

type PaymentCollectionRow = {
  booking_id: number;
  amount_inr: number | null;
  status: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  total_inr: number | null;
  issued_at: string | null;
  paid_at: string | null;
};

export type BookingConfirmationData = {
  booking: {
    id: number;
    createdAt: string;
    rawStatus: string;
    displayStatus: BookingStatus;
    statusLabel: string;
    serviceLabel: string;
    includedServices: string[];
    bookingMode: string | null;
    paymentMode: string | null;
  };
  schedule: {
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    bookingStart: string;
    bookingEnd: string | null;
    estimatedDurationMinutes: number | null;
  };
  provider: {
    id: number | null;
    name: string;
    type: string | null;
  };
  pets: Array<{
    id: number;
    name: string;
    breed: string | null;
    age: number | null;
    gender: string | null;
    sizeCategory: string | null;
    photoUrl: string | null;
  }>;
  visit: {
    address: string | null;
    pincode: string | null;
    customerNotes: string | null;
  };
  addOns: Array<{
    id: string;
    name: string;
    quantity: number;
    totalPriceInr: number;
  }>;
  payment: {
    serviceSubtotalInr: number;
    addonSubtotalInr: number;
    grossSubtotalInr: number;
    discountAmountInr: number;
    walletCreditsInr: number;
    finalPriceBeforeWalletInr: number;
    netPayableInr: number;
    paidOrCollectedInr: number;
    pendingPayableInr: number;
    conversionValueInr: number;
    discountCode: string | null;
    label: string;
  };
  invoice: {
    id: string;
    number: string | null;
    status: string | null;
    totalInr: number | null;
    issuedAt: string | null;
    paidAt: string | null;
  } | null;
  actions: {
    canManageAddOns: boolean;
    canReschedule: boolean;
    canCancel: boolean;
    canPayPendingOnline: boolean;
  };
  conversion: {
    eligible: boolean;
    transactionId: string;
    valueInr: number;
    currency: 'INR';
  };
};

function toFiniteCurrency(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeStatus(value: string | null | undefined): BookingStatus {
  if (value === 'confirmed' || value === 'completed' || value === 'cancelled' || value === 'no_show') {
    return value;
  }

  if (value === 'in_progress') {
    return 'in_progress';
  }

  return 'pending';
}

export function toCustomerDisplayStatus(status: string | null | undefined): BookingStatus {
  const normalized = normalizeStatus(status);
  return normalized === 'pending' ? 'confirmed' : normalized;
}

export function getBookingConfirmationStatusLabel(status: BookingStatus) {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'in_progress') return 'In progress';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'no_show') return 'No show';
  return 'Confirmed';
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

  const candidate = toPositiveInteger((value as { petId?: unknown; pet_id?: unknown }).petId ??
    (value as { petId?: unknown; pet_id?: unknown }).pet_id);

  return candidate == null ? [] : [candidate];
}

function extractProviderServiceIdsFromPayloadNode(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractProviderServiceIdsFromPayloadNode(entry));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const candidate = (value as { providerServiceId?: unknown; provider_service_id?: unknown }).providerServiceId ??
    (value as { providerServiceId?: unknown; provider_service_id?: unknown }).provider_service_id;

  return typeof candidate === 'string' && candidate.trim() ? [candidate.trim()] : [];
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

function extractProviderServiceIdsFromPaymentMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const value = metadata as Record<string, unknown>;
  return [
    ...extractProviderServiceIdsFromPayloadNode(value.booking_payload),
    ...extractProviderServiceIdsFromPayloadNode(value.booking_bundle_payload),
    ...extractProviderServiceIdsFromPayloadNode(value.booking_payloads),
  ];
}

function resolveServiceLabelFromProviderServiceId(
  providerServiceId: string,
  serviceNameByProviderServiceId: ReadonlyMap<string, string>,
) {
  const resolvedName = serviceNameByProviderServiceId.get(providerServiceId)?.trim() ?? '';
  return resolvedName || `Service package (${providerServiceId.slice(0, 8)})`;
}

function resolvePincodeFromAddress(address: string | null) {
  const match = address?.match(/\b([1-9]\d{5})\b/);
  return match?.[1] ?? null;
}

function resolveProviderNotesForCustomer(value: string | null) {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return null;
  }

  if (/bundled services \(\d+\)/i.test(normalized)) {
    return null;
  }

  if (/^\d+\.\s*Pet\s+\d+\s*\|/im.test(normalized)) {
    return null;
  }

  return normalized;
}

function buildAddOnLines(addonRows: BookingAddonSummaryRow[]) {
  return addonRows
    .filter((item) => ACTIVE_BOOKING_ADDON_STATUSES.has(item.status))
    .map((item) => ({
      id: item.id,
      name: item.name_snapshot,
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      totalPriceInr: toFiniteCurrency(item.total_price_inr ?? item.total_price_snapshot ?? 0),
    }));
}

function resolvePendingPayable(
  booking: BookingConfirmationBookingRow,
  netPayableInr: number,
  capturedOnlineInr: number,
  collections: PaymentCollectionRow[],
) {
  const explicitCollection = collections.find((row) => row.booking_id === booking.id);
  if (explicitCollection) {
    if (explicitCollection.status === 'paid') {
      return 0;
    }

    const explicitAmount = toFiniteCurrency(explicitCollection.amount_inr);
    if (explicitAmount > 0) {
      return explicitAmount;
    }
  }

  const paymentMode = String(booking.payment_mode ?? '').trim().toLowerCase();
  const isCashCollectionMode = paymentMode === 'direct_to_provider' || paymentMode === 'mixed' || paymentMode === 'cash';

  if (!isCashCollectionMode) {
    return 0;
  }

  return Math.max(0, netPayableInr - capturedOnlineInr);
}

function resolvePaymentSummary(
  booking: BookingConfirmationBookingRow,
  addonRows: BookingAddonSummaryRow[],
  paymentRows: PaymentTransactionRow[],
  collections: PaymentCollectionRow[],
) {
  const addOnLines = buildAddOnLines(addonRows);
  const addonSubtotalInr = addOnLines.reduce((sum, item) => sum + item.totalPriceInr, 0);
  const serviceCandidates = [
    booking.admin_price_reference,
    booking.price_at_booking,
    booking.amount,
    booking.final_price,
  ].map(toFiniteCurrency);
  const serviceSubtotalInr = serviceCandidates.find((value) => value > 0) ?? 0;
  const grossSubtotalInr = Math.max(0, serviceSubtotalInr + addonSubtotalInr);
  const discountAmountInr = toFiniteCurrency(booking.discount_amount);
  const walletCreditsInr = toFiniteCurrency(booking.wallet_credits_applied_inr);
  const fallbackFinalBeforeWalletInr = Math.max(0, grossSubtotalInr - discountAmountInr);
  const finalPriceBeforeWalletInr = Math.max(
    0,
    toFiniteCurrency(booking.final_price ?? booking.amount ?? fallbackFinalBeforeWalletInr),
  );
  const netPayableInr = Math.max(0, finalPriceBeforeWalletInr - walletCreditsInr);
  const capturedOnlineInr = paymentRows
    .filter((row) => row.status === 'captured')
    .reduce((sum, row) => sum + toFiniteCurrency(row.amount_inr), 0);
  const pendingPayableInr = resolvePendingPayable(booking, netPayableInr, capturedOnlineInr, collections);
  const paymentMode = String(booking.payment_mode ?? '').trim().toLowerCase();
  const paidByCredits = paymentMode === 'subscription_credit';
  const paidOrCollectedInr = paidByCredits ? netPayableInr : Math.max(0, netPayableInr - pendingPayableInr);

  let label = 'Payment details saved';
  if (pendingPayableInr > 0) {
    label = paymentMode === 'direct_to_provider' || paymentMode === 'cash'
      ? 'Pay after service'
      : 'Part payment pending';
  } else if (paidByCredits) {
    label = 'Paid with subscription credits';
  } else if (capturedOnlineInr > 0 || paymentMode === 'platform') {
    label = 'Paid online';
  }

  return {
    addOnLines,
    summary: {
      serviceSubtotalInr,
      addonSubtotalInr,
      grossSubtotalInr,
      discountAmountInr,
      walletCreditsInr,
      finalPriceBeforeWalletInr,
      netPayableInr,
      paidOrCollectedInr,
      pendingPayableInr,
      conversionValueInr: netPayableInr,
      discountCode: booking.discount_code?.trim() || null,
      label,
    },
  };
}

async function safeLoadPaymentCollections(supabase: SupabaseClient, bookingId: number) {
  const { data, error } = await supabase
    .from('booking_payment_collections')
    .select('booking_id, amount_inr, status')
    .eq('booking_id', bookingId)
    .returns<PaymentCollectionRow[]>();

  if (error) {
    return [];
  }

  return data ?? [];
}

async function safeLoadInvoice(supabase: SupabaseClient, bookingId: number) {
  const { data, error } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, status, total_inr, issued_at, paid_at')
    .eq('booking_id', bookingId)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle<InvoiceRow>();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    number: data.invoice_number,
    status: data.status,
    totalInr: data.total_inr,
    issuedAt: data.issued_at,
    paidAt: data.paid_at,
  };
}

async function safeLoadAddonRows(supabase: SupabaseClient, bookingId: number) {
  try {
    return await loadBookingAddonRowsByBookingIds(supabase, [bookingId]);
  } catch {
    return [];
  }
}

export async function loadBookingConfirmationData(
  supabase: SupabaseClient,
  bookingId: number,
  userId: string,
): Promise<BookingConfirmationData | null> {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(
      'id, user_id, pet_id, provider_id, provider_service_id, service_type, booking_start, booking_end, booking_date, start_time, end_time, status, booking_status, booking_mode, location_address, provider_notes, internal_notes, amount, admin_price_reference, price_at_booking, discount_amount, discount_code, final_price, payment_mode, wallet_credits_applied_inr, created_at',
    )
    .eq('id', bookingId)
    .maybeSingle<BookingConfirmationBookingRow>();

  if (bookingError) {
    throw bookingError;
  }

  if (!booking || booking.user_id !== userId) {
    return null;
  }

  const [paymentRowsResult, providerResult, collectionRows, addonRows, invoice] = await Promise.all([
    supabase
      .from('payment_transactions')
      .select('booking_id, amount_inr, status, provider, transaction_type, metadata')
      .eq('booking_id', bookingId)
      .returns<PaymentTransactionRow[]>(),
    booking.provider_id
      ? supabase
          .from('providers')
          .select('id, name, type')
          .eq('id', booking.provider_id)
          .maybeSingle<ProviderRow>()
      : Promise.resolve({ data: null, error: null }),
    safeLoadPaymentCollections(supabase, bookingId),
    safeLoadAddonRows(supabase, bookingId),
    safeLoadInvoice(supabase, bookingId),
  ]);

  if (paymentRowsResult.error) {
    throw paymentRowsResult.error;
  }

  const paymentRows = paymentRowsResult.data ?? [];
  const provider = providerResult.data ?? null;
  const petIds = new Set<number>();
  const primaryPetId = toPositiveInteger(booking.pet_id);
  if (primaryPetId != null) {
    petIds.add(primaryPetId);
  }

  for (const petId of extractBundledPetIdsFromNotes(booking.provider_notes)) {
    petIds.add(petId);
  }

  for (const petId of extractBundledPetIdsFromNotes(booking.internal_notes)) {
    petIds.add(petId);
  }

  for (const row of paymentRows) {
    for (const petId of extractPetIdsFromPaymentMetadata(row.metadata)) {
      petIds.add(petId);
    }
  }

  const providerServiceIds = new Set<string>();
  if (booking.provider_service_id?.trim()) {
    providerServiceIds.add(booking.provider_service_id.trim());
  }

  for (const serviceId of extractProviderServiceIdsFromNotes(booking.provider_notes)) {
    providerServiceIds.add(serviceId);
  }

  for (const serviceId of extractProviderServiceIdsFromNotes(booking.internal_notes)) {
    providerServiceIds.add(serviceId);
  }

  for (const row of paymentRows) {
    for (const serviceId of extractProviderServiceIdsFromPaymentMetadata(row.metadata)) {
      providerServiceIds.add(serviceId);
    }
  }

  const [petRowsResult, providerServiceRowsResult] = await Promise.all([
    petIds.size > 0
      ? supabase
          .from('pets')
          .select('id, name, breed, age, gender, size_category, photo_url')
          .in('id', Array.from(petIds))
          .returns<PetRow[]>()
      : Promise.resolve({ data: [], error: null }),
    providerServiceIds.size > 0
      ? supabase
          .from('provider_services')
          .select('id, service_type, base_price, service_duration_minutes')
          .in('id', Array.from(providerServiceIds))
          .returns<ProviderServiceRow[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (petRowsResult.error) {
    throw petRowsResult.error;
  }

  if (providerServiceRowsResult.error) {
    throw providerServiceRowsResult.error;
  }

  const serviceNameByProviderServiceId = new Map<string, string>();
  const serviceBasePriceByProviderServiceId = new Map<string, number>();
  let estimatedDurationMinutes = 0;

  for (const row of providerServiceRowsResult.data ?? []) {
    const serviceType = row.service_type?.trim();
    if (serviceType) {
      serviceNameByProviderServiceId.set(row.id, serviceType);
    }

    const basePrice = Number(row.base_price ?? NaN);
    if (Number.isFinite(basePrice) && basePrice > 0) {
      serviceBasePriceByProviderServiceId.set(row.id, basePrice);
    }

    const duration = Number(row.service_duration_minutes ?? NaN);
    if (Number.isFinite(duration) && duration > 0) {
      estimatedDurationMinutes += duration;
    }
  }

  const includedFromBooking = resolveIncludedServicesForBooking(booking, {
    serviceNameByProviderServiceId,
    serviceBasePriceByProviderServiceId,
  });
  const includedFromMetadata = paymentRows.flatMap((row) =>
    extractProviderServiceIdsFromPaymentMetadata(row.metadata).map((providerServiceId) =>
      resolveServiceLabelFromProviderServiceId(providerServiceId, serviceNameByProviderServiceId),
    ),
  );
  const includedServices = includedFromMetadata.length > includedFromBooking.length
    ? includedFromMetadata
    : includedFromBooking;
  const serviceLabel = buildIncludedServicesLabel(includedServices, booking.service_type);
  const { addOnLines, summary } = resolvePaymentSummary(booking, addonRows, paymentRows, collectionRows);
  const rawStatus = booking.booking_status ?? booking.status ?? 'pending';
  const displayStatus = toCustomerDisplayStatus(rawStatus);
  const actionableStatus = normalizeStatus(rawStatus);
  const isActiveBooking = actionableStatus === 'pending' || actionableStatus === 'confirmed' || actionableStatus === 'in_progress';
  const isCancelledLike = actionableStatus === 'cancelled' || actionableStatus === 'no_show';

  return {
    booking: {
      id: booking.id,
      createdAt: booking.created_at,
      rawStatus,
      displayStatus,
      statusLabel: getBookingConfirmationStatusLabel(displayStatus),
      serviceLabel,
      includedServices,
      bookingMode: booking.booking_mode,
      paymentMode: booking.payment_mode,
    },
    schedule: {
      date: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      bookingStart: booking.booking_start,
      bookingEnd: booking.booking_end,
      estimatedDurationMinutes: estimatedDurationMinutes > 0 ? estimatedDurationMinutes : null,
    },
    provider: {
      id: booking.provider_id,
      name: provider?.name?.trim() || 'Assigned provider',
      type: provider?.type ?? null,
    },
    pets: (petRowsResult.data ?? []).map((pet) => ({
      id: pet.id,
      name: pet.name?.trim() || `Pet #${pet.id}`,
      breed: pet.breed,
      age: pet.age,
      gender: pet.gender,
      sizeCategory: pet.size_category,
      photoUrl: pet.photo_url,
    })),
    visit: {
      address: booking.location_address,
      pincode: resolvePincodeFromAddress(booking.location_address),
      customerNotes: resolveProviderNotesForCustomer(booking.provider_notes),
    },
    addOns: addOnLines,
    payment: summary,
    invoice,
    actions: {
      canManageAddOns: isActiveBooking,
      canReschedule: isActiveBooking,
      canCancel: isActiveBooking,
      canPayPendingOnline: summary.pendingPayableInr > 0,
    },
    conversion: {
      eligible: !isCancelledLike && summary.conversionValueInr > 0,
      transactionId: `booking_${booking.id}`,
      valueInr: summary.conversionValueInr,
      currency: 'INR',
    },
  };
}