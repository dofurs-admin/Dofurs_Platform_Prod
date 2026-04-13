import type { SupabaseClient } from '@supabase/supabase-js';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import type { BookingActorRole } from './state-transition-guard';
import { reverseDiscountRedemptionForBooking } from './discounts';
import { getISTTimestamp } from '@/lib/utils/date';
import {
  resolveAvailableSlots,
  resolveDayAvailability,
  resolveAvailableSlotsMultiDay,
} from './engines/slotEngine';
import { assertBookingStateTransition } from './state-transition-guard';
import { reserveCreditForBooking, consumeOrRestoreCreditForBookingTransition } from '@/lib/subscriptions/creditTracking';
import { createServiceInvoice } from '@/lib/payments/invoiceService';
import type {
  BookingRecord,
  BookingStatus,
  CreateBookingInput,
  GetAvailableSlotsInput,
  OverrideBookingInput,
  ProviderBookingsQuery,
} from './types';

const BOOKING_SELECT =
  'id, user_id, pet_id, provider_id, provider_service_id, service_type, booking_date, start_time, end_time, booking_mode, location_address, latitude, longitude, booking_status, cancellation_reason, cancellation_by, price_at_booking, admin_price_reference, provider_notes, internal_notes, payment_mode, platform_fee, provider_payout_status, wallet_credits_applied_inr, created_at, updated_at';

const BOOKING_SELECT_SCHEMA_FALLBACK =
  'id, user_id, pet_id, provider_id, provider_service_id, service_type, booking_date, start_time, end_time, booking_mode, location_address, latitude, longitude, booking_status, price_at_booking, admin_price_reference, provider_notes, payment_mode, wallet_credits_applied_inr, created_at, updated_at';

const BOOKING_SELECT_MINIMAL =
  'id, user_id, pet_id, provider_id, provider_service_id, service_type, booking_date, start_time, end_time, booking_mode, location_address, latitude, longitude, booking_status, status, price_at_booking, provider_notes, payment_mode, created_at, updated_at';

type BookingTransitionActorContext = {
  actorId?: string;
  actorRole?: BookingActorRole;
  source?: string;
};

type ApplyBookingStatusTransitionInput = BookingTransitionActorContext & {
  expectedUserId?: string;
  expectedProviderId?: number;
  nextStatus: BookingStatus;
  cancellationBy?: 'user' | 'provider' | 'admin';
  cancellationReason?: string | null;
  providerNotes?: string | null;
};

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
}

function isMissingColumnError(error: unknown) {
  const code = getErrorCode(error);
  if (code === '42703' || code === 'PGRST204') {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('column') && (message.includes('does not exist') || message.includes('could not find'))
  );
}

function isMissingRelationError(error: unknown) {
  const code = getErrorCode(error);
  if (code === '42P01') {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes('relation') && message.includes('does not exist');
}

function isLegacyServicesBridgeSkippableError(error: unknown) {
  const code = getErrorCode(error);
  return isMissingColumnError(error) || isMissingRelationError(error) || code === '42501';
}

function isServiceIdNotNullConstraintError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    (code === '23502' && message.includes('service_id')) ||
    message.includes('null value in column "service_id"') ||
    message.includes("null value in column 'service_id'")
  );
}

function isPetOwnershipError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('pet does not belong to this user');
}

function isSlotUnavailableError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('slot_unavailable') || message.includes('selected time slot is no longer available');
}

async function hasSharedPetAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  petId: number,
) {
  const { data: activeOrAcceptedShare, error: activeOrAcceptedShareError } = await supabase
    .from('pet_shares')
    .select('id')
    .eq('pet_id', petId)
    .eq('shared_with_user_id', userId)
    .is('revoked_at', null)
    .in('status', ['active', 'accepted'])
    .limit(1)
    .maybeSingle();

  if (activeOrAcceptedShareError) {
    const code = getErrorCode(activeOrAcceptedShareError);
    // Older schemas/environments may not have pet_shares table yet.
    if (code === '42P01' || code === '42501') {
      return false;
    }
    throw activeOrAcceptedShareError;
  }

  if (activeOrAcceptedShare) {
    return true;
  }

  const { data: acceptedShare, error: acceptedShareError } = await supabase
    .from('pet_shares')
    .select('id')
    .eq('pet_id', petId)
    .eq('shared_with_user_id', userId)
    .is('revoked_at', null)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (acceptedShareError) {
    const code = getErrorCode(acceptedShareError);
    if (code === '42P01' || code === '42501') {
      return false;
    }
    throw acceptedShareError;
  }

  return Boolean(acceptedShare);
}

async function createBookingViaCompatInsert(
  supabase: SupabaseClient,
  userId: string,
  input: CreateBookingInput,
  providerService: {
    id: string;
    service_type: string;
    service_duration_minutes: number | null;
    base_price: number;
  },
  legacyService: { id: number },
  paymentMode: string,
) {
  const compatBooking = await createBookingCompatWithLegacyServiceId(
    supabase,
    userId,
    input,
    providerService,
    legacyService.id,
    paymentMode,
  );

  if (input.useSubscriptionCredit) {
    if (!compatBooking.service_type) {
      throw new Error('Booking service type is required for subscription credit usage.');
    }

    const creditAmount = Number(compatBooking.price_at_booking ?? 0);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      throw new Error('Booking price is required for subscription credit usage.');
    }

    try {
      await reserveCreditForBooking(supabase, compatBooking.id, userId, compatBooking.service_type, creditAmount);
    } catch (creditError) {
      await supabase.from('bookings').delete().eq('id', compatBooking.id);
      throw creditError;
    }
  }

  return compatBooking;
}

function timeToMinutes(timeValue: string) {
  const [hours, minutes] = timeValue.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function addMinutesToTimeString(timeValue: string, minutesToAdd: number) {
  const totalMinutes = timeToMinutes(timeValue);
  if (totalMinutes == null) {
    return null;
  }

  const normalized = ((totalMinutes + minutesToAdd) % 1440 + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

async function fetchBookingByIdWithFallbacks(supabase: SupabaseClient, bookingId: number) {
  let bookingResult = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', bookingId)
    .single<BookingRecord>();

  if (bookingResult.error && isMissingColumnError(bookingResult.error)) {
    bookingResult = await supabase
      .from('bookings')
      .select(BOOKING_SELECT_SCHEMA_FALLBACK)
      .eq('id', bookingId)
      .single<BookingRecord>();
  }

  if (bookingResult.error && isMissingColumnError(bookingResult.error)) {
    bookingResult = await supabase
      .from('bookings')
      .select(BOOKING_SELECT_MINIMAL)
      .eq('id', bookingId)
      .single<BookingRecord>();
  }

  if (bookingResult.error || !bookingResult.data) {
    throw bookingResult.error ?? new Error('Booking created but could not be retrieved');
  }

  return bookingResult.data;
}

async function createBookingCompatWithLegacyServiceId(
  supabase: SupabaseClient,
  userId: string,
  input: CreateBookingInput,
  providerService: {
    id: string;
    service_type: string;
    service_duration_minutes: number | null;
    base_price: number;
  },
  legacyServiceId: number,
  paymentMode: string,
) {
  const durationMinutes = Math.max(1, providerService.service_duration_minutes ?? 30);
  const endTime = input.endTime?.trim() || addMinutesToTimeString(input.startTime, durationMinutes);

  if (!endTime) {
    throw new Error('Invalid booking time.');
  }

  const { data: dayBookings, error: dayBookingsError } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, booking_status, status')
    .eq('provider_id', input.providerId)
    .eq('booking_date', input.bookingDate)
    .limit(500);

  if (dayBookingsError && !isMissingColumnError(dayBookingsError)) {
    throw dayBookingsError;
  }

  const requestedStart = timeToMinutes(input.startTime);
  const requestedEnd = timeToMinutes(endTime);
  if (requestedStart == null || requestedEnd == null) {
    throw new Error('Invalid booking time.');
  }

  if (!input.allowPastBooking) {
    const hasOverlap = (dayBookings ?? []).some((booking) => {
      const status = (booking.booking_status ?? booking.status ?? '').toString();
      if (status === 'cancelled' || status === 'no_show') {
        return false;
      }

      const existingStart = timeToMinutes(String(booking.start_time ?? ''));
      const existingEnd = timeToMinutes(String(booking.end_time ?? ''));
      if (existingStart == null || existingEnd == null) {
        return false;
      }

      return requestedStart < existingEnd && requestedEnd > existingStart;
    });

    if (hasOverlap) {
      throw new Error('Selected time slot is no longer available.');
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pet_id: input.petId,
      provider_id: input.providerId,
      provider_service_id: providerService.id,
      service_id: legacyServiceId,
      service_type: providerService.service_type,
      booking_date: input.bookingDate,
      start_time: input.startTime,
      end_time: endTime,
      booking_mode: input.bookingMode,
      location_address: input.locationAddress ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      booking_status: 'pending',
      status: 'pending',
      price_at_booking: providerService.base_price,
      admin_price_reference: providerService.base_price,
      amount: providerService.base_price,
      final_price: providerService.base_price,
      provider_notes: input.providerNotes ?? null,
      payment_mode: paymentMode,
      discount_code: input.discountCode?.trim() ? input.discountCode.trim().toUpperCase() : null,
      discount_amount: 0,
    })
    .select('id')
    .single<{ id: number }>();

  if (insertError || !inserted) {
    throw insertError ?? new Error('Booking creation failed');
  }

  return fetchBookingByIdWithFallbacks(supabase, inserted.id);
}

async function getCurrentBookingStatus(supabase: SupabaseClient, bookingId: number) {
  const full = await supabase
    .from('bookings')
    .select('id, booking_status, status')
    .eq('id', bookingId)
    .single<{ id: number; booking_status: BookingStatus | null; status: BookingStatus | null }>();

  if (!full.error && full.data) {
    const currentStatus = full.data.booking_status ?? full.data.status;
    if (!currentStatus) {
      throw new Error('BOOKING_STATUS_MISSING');
    }
    return currentStatus;
  }

  if (!isMissingColumnError(full.error)) {
    throw full.error ?? new Error('Booking not found');
  }

  const bookingStatusOnly = await supabase
    .from('bookings')
    .select('id, booking_status')
    .eq('id', bookingId)
    .single<{ id: number; booking_status: BookingStatus | null }>();

  if (!bookingStatusOnly.error && bookingStatusOnly.data?.booking_status) {
    return bookingStatusOnly.data.booking_status;
  }

  const statusOnly = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single<{ id: number; status: BookingStatus | null }>();

  if (!statusOnly.error && statusOnly.data?.status) {
    return statusOnly.data.status;
  }

  throw bookingStatusOnly.error ?? statusOnly.error ?? full.error ?? new Error('Booking not found');
}

async function logBookingTransitionAuditEvent(
  supabase: SupabaseClient,
  bookingId: number,
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
  context?: BookingTransitionActorContext & { cancellationBy?: 'user' | 'provider' | 'admin'; cancellationReason?: string | null },
) {
  const eventPayload = {
    booking_id: bookingId,
    actor_id: context?.actorId ?? null,
    actor_role: context?.actorRole ?? null,
    from_status: currentStatus,
    to_status: nextStatus,
    cancellation_by: context?.cancellationBy ?? null,
    reason: context?.cancellationReason ?? null,
    source: context?.source ?? 'booking_service',
    metadata: {
      event_type: 'booking_status_transition',
      from_status: currentStatus,
      to_status: nextStatus,
      actor_role: context?.actorRole ?? null,
      cancellation_by: context?.cancellationBy ?? null,
      source: context?.source ?? 'booking_service',
    },
  };

  const { error: transitionError } = await supabase.from('booking_status_transition_events').insert(eventPayload);

  if (!transitionError) {
    return;
  }

  if (transitionError.code !== '42P01') {
    if (transitionError.code === '42501') {
      return;
    }

    throw transitionError;
  }

  const { error: legacyError } = await supabase.from('booking_adjustment_events').insert({
    booking_id: bookingId,
    actor_id: context?.actorId ?? null,
    adjustment_amount: null,
    adjustment_type: 'status_transition',
    reason: context?.cancellationReason ?? null,
    metadata: {
      event_type: 'booking_status_transition',
      from_status: currentStatus,
      to_status: nextStatus,
      actor_role: context?.actorRole ?? null,
      cancellation_by: context?.cancellationBy ?? null,
      source: context?.source ?? 'booking_service',
    },
  });

  if (!legacyError) {
    return;
  }

  if (legacyError.code === '42P01' || legacyError.code === '42501') {
    return;
  }

  throw legacyError;
}

async function runPostTransitionHooks(
  supabase: SupabaseClient,
  bookingId: number,
  currentStatus: BookingStatus,
  input: ApplyBookingStatusTransitionInput,
  bookingData: BookingRecord,
) {
  try {
    await logBookingTransitionAuditEvent(supabase, bookingId, currentStatus, input.nextStatus, {
      actorId: input.actorId,
      actorRole: input.actorRole,
      source: input.source,
      cancellationBy: input.nextStatus === 'cancelled' ? input.cancellationBy : undefined,
      cancellationReason: input.nextStatus === 'cancelled' ? input.cancellationReason : undefined,
    });
  } catch (auditError) {
    console.error('Booking transition audit hook failed', { bookingId, nextStatus: input.nextStatus, error: auditError });
  }

  if (input.nextStatus === 'cancelled') {
    try {
      await reverseDiscountRedemptionForBooking(
        bookingId,
        input.cancellationReason ?? `${input.cancellationBy ?? 'admin'}_cancelled_booking`,
      );
    } catch (discountError) {
      console.error('Discount reversal hook failed', { bookingId, nextStatus: input.nextStatus, error: discountError });
    }

    // Auto-refund Razorpay payment on provider-initiated cancellation
    if (input.cancellationBy === 'provider' && bookingData.payment_mode === 'platform') {
      try {
        const { data: paymentTx } = await supabase
          .from('payment_transactions')
          .select('id, gateway_payment_id, status')
          .eq('booking_id', bookingId)
          .eq('status', 'captured')
          .maybeSingle();

        if (paymentTx?.gateway_payment_id) {
          const { getRazorpayInstance } = await import('@/lib/payments/razorpay');
          const rz = getRazorpayInstance();
          await rz.payments.refund(paymentTx.gateway_payment_id, {
            speed: 'normal',
          });
          await supabase
            .from('payment_transactions')
            .update({ status: 'refunded', metadata: { refund_reason: 'provider_cancelled', refunded_at: getISTTimestamp() } })
            .eq('id', paymentTx.id);
        }
      } catch (refundError) {
        // CRITICAL: Refund failed but booking is already cancelled.
        // Log prominently so admin can manually process refund.
        console.error('CRITICAL: Auto-refund on provider cancellation failed — requires manual admin refund', {
          bookingId,
          error: refundError instanceof Error ? refundError.message : refundError,
          timestamp: getISTTimestamp(),
        });
        // Store refund failure metadata on booking for admin visibility
        try {
          await supabase
            .from('bookings')
            .update({
              admin_notes: `REFUND_FAILED: Auto-refund failed at ${getISTTimestamp()}. Requires manual processing.`,
            })
            .eq('id', bookingId);
        } catch { /* best effort */ }
      }
    }

    // Send cancellation notification
    try {
      const { notifyBookingStatusChanged } = await import('@/lib/notifications/service');
      await notifyBookingStatusChanged(
        supabase,
        bookingData,
        currentStatus,
        'cancelled',
        (input.cancellationBy ?? 'admin') as 'user' | 'provider' | 'admin' | 'staff',
      );
    } catch { /* notification failure is non-fatal */ }
  }

  if (input.nextStatus === 'completed' || input.nextStatus === 'cancelled') {
    try {
      await consumeOrRestoreCreditForBookingTransition(supabase, bookingId, input.nextStatus);
    } catch (creditError) {
      console.error('Credit transition hook failed', { bookingId, nextStatus: input.nextStatus, error: creditError });
    }
  }

  if (input.nextStatus === 'completed') {
    try {
      const { data: invoiceExisting } = await supabase
        .from('billing_invoices')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1)
        .maybeSingle();

      if (!invoiceExisting) {
        const amountInr = Number(bookingData.price_at_booking ?? 0);
        if (amountInr > 0) {
          await createServiceInvoice(supabase, {
            userId: bookingData.user_id,
            bookingId,
            description: `${bookingData.service_type ?? 'Service'} booking`,
            amountInr,
            walletCreditsAppliedInr: Number(bookingData.wallet_credits_applied_inr ?? 0),
            status: bookingData.payment_mode === 'direct_to_provider' ? 'issued' : 'paid',
          });
        }
      }
    } catch (invoiceError) {
      console.error('Service invoice generation hook failed', { bookingId, error: invoiceError });
    }
  }

  // Send notifications for key state transitions
  if (input.nextStatus === 'confirmed') {
    try {
      const { notifyBookingStatusChanged } = await import('@/lib/notifications/service');
      await notifyBookingStatusChanged(supabase, bookingData, currentStatus, 'confirmed', (input.actorRole ?? 'admin') as 'user' | 'provider' | 'admin' | 'staff');
    } catch { /* notification failure is non-fatal */ }
  }

  if (input.nextStatus === 'completed') {
    try {
      const { notifyBookingStatusChanged } = await import('@/lib/notifications/service');
      await notifyBookingStatusChanged(supabase, bookingData, currentStatus, 'completed', (input.actorRole ?? 'admin') as 'user' | 'provider' | 'admin' | 'staff');
    } catch { /* notification failure is non-fatal */ }
  }
}

async function applyBookingStatusTransition(
  supabase: SupabaseClient,
  bookingId: number,
  input: ApplyBookingStatusTransitionInput,
) {
  async function fetchExisting(selectColumns: string) {
    let query = supabase.from('bookings').select(selectColumns).eq('id', bookingId);

    if (input.expectedUserId) {
      query = query.eq('user_id', input.expectedUserId);
    }

    if (input.expectedProviderId) {
      query = query.eq('provider_id', input.expectedProviderId);
    }

    return query.single<{
      id: number;
      user_id: string;
      provider_id: number;
      booking_status?: BookingStatus | null;
      status?: BookingStatus | null;
    }>();
  }

  let existingResult = await fetchExisting('id, user_id, provider_id, booking_status, status');

  if (existingResult.error && isMissingColumnError(existingResult.error)) {
    existingResult = await fetchExisting('id, user_id, provider_id, booking_status');
  }

  if (existingResult.error && isMissingColumnError(existingResult.error)) {
    existingResult = await fetchExisting('id, user_id, provider_id, status');
  }

  if (existingResult.error || !existingResult.data) {
    throw existingResult.error ?? new Error('Booking not found');
  }

  const existing = existingResult.data;
  const currentStatus = existing.booking_status ?? existing.status;
  if (!currentStatus) {
    throw new Error('BOOKING_STATUS_MISSING');
  }

  assertBookingStateTransition(currentStatus, input.nextStatus);

  const updatePayload: {
    booking_status?: BookingStatus;
    status?: BookingStatus;
    cancellation_by?: 'user' | 'provider' | 'admin' | null;
    cancellation_reason?: string | null;
    provider_notes?: string | null;
  } = {
    booking_status: input.nextStatus,
    status: input.nextStatus,
  };

  if (input.nextStatus === 'cancelled') {
    updatePayload.cancellation_by = input.cancellationBy ?? null;
    updatePayload.cancellation_reason = input.cancellationReason ?? null;
  }

  if (input.providerNotes !== undefined) {
    updatePayload.provider_notes = input.providerNotes;
  }

  async function runUpdate(payload: typeof updatePayload, selectColumns: string) {
    let updateQuery = supabase.from('bookings').update(payload).eq('id', bookingId);

    if (input.expectedUserId) {
      updateQuery = updateQuery.eq('user_id', input.expectedUserId);
    }

    if (input.expectedProviderId) {
      updateQuery = updateQuery.eq('provider_id', input.expectedProviderId);
    }

    return updateQuery.select(selectColumns).single<BookingRecord>();
  }

  const updatePayloadCandidates: Array<typeof updatePayload> = [];

  const pushCandidate = (candidate: typeof updatePayload) => {
    const signature = JSON.stringify(candidate, Object.keys(candidate).sort());
    if (!updatePayloadCandidates.some((item) => JSON.stringify(item, Object.keys(item).sort()) === signature)) {
      updatePayloadCandidates.push(candidate);
    }
  };

  pushCandidate({ ...updatePayload });
  const withoutCancellation = { ...updatePayload };
  delete withoutCancellation.cancellation_by;
  delete withoutCancellation.cancellation_reason;
  pushCandidate(withoutCancellation);

  const withoutLegacyStatus = { ...updatePayload };
  delete withoutLegacyStatus.status;
  pushCandidate(withoutLegacyStatus);

  const withoutBookingStatus = { ...updatePayload };
  delete withoutBookingStatus.booking_status;
  pushCandidate(withoutBookingStatus);

  const withoutLegacyStatusAndCancellation = { ...withoutLegacyStatus };
  delete withoutLegacyStatusAndCancellation.cancellation_by;
  delete withoutLegacyStatusAndCancellation.cancellation_reason;
  pushCandidate(withoutLegacyStatusAndCancellation);

  const withoutBookingStatusAndCancellation = { ...withoutBookingStatus };
  delete withoutBookingStatusAndCancellation.cancellation_by;
  delete withoutBookingStatusAndCancellation.cancellation_reason;
  pushCandidate(withoutBookingStatusAndCancellation);

  let data: BookingRecord | null = null;
  let error: unknown = null;

  for (const candidate of updatePayloadCandidates) {
    const primary = await runUpdate(candidate, BOOKING_SELECT);

    if (!primary.error && primary.data) {
      data = primary.data;
      error = null;
      break;
    }

    if (!isMissingColumnError(primary.error)) {
      error = primary.error;
      break;
    }

    const fallbackSchema = await runUpdate(candidate, BOOKING_SELECT_SCHEMA_FALLBACK);
    if (!fallbackSchema.error && fallbackSchema.data) {
      data = fallbackSchema.data;
      error = null;
      break;
    }

    if (!isMissingColumnError(fallbackSchema.error)) {
      error = fallbackSchema.error;
      break;
    }

    const wildcard = await runUpdate(candidate, '*');
    if (!wildcard.error && wildcard.data) {
      data = wildcard.data;
      error = null;
      break;
    }

    error = wildcard.error;

    if (!isMissingColumnError(wildcard.error)) {
      break;
    }
  }

  if (error && getErrorCode(error) === '42703') {
    const fallback = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select(BOOKING_SELECT_SCHEMA_FALLBACK)
      .single<BookingRecord>();

    if (fallback.error) {
      throw fallback.error;
    }

    await runPostTransitionHooks(supabase, bookingId, currentStatus, input, fallback.data);
    return fallback.data;
  }

  if (error && isMissingColumnError(error)) {
    throw new Error('BOOKING_SCHEMA_OUTDATED');
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Booking status update returned no data');
  }

  await runPostTransitionHooks(supabase, bookingId, currentStatus, input, data);
  return data;
}

export async function createBooking(
  supabase: SupabaseClient,
  userId: string,
  input: CreateBookingInput,
  userClient?: SupabaseClient,
) {
  return createBookingWithLegacyServiceFallback(supabase, userId, input, userClient);
}

async function createBookingWithLegacyServiceFallback(
  supabase: SupabaseClient,
  userId: string,
  input: CreateBookingInput,
  userClient?: SupabaseClient,
) {
  const providerServiceId = await resolveProviderServiceIdForLegacyCreate(supabase, input);

  const { data: providerService, error: providerServiceError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type, service_duration_minutes, base_price, is_active')
    .eq('id', providerServiceId)
    .eq('provider_id', input.providerId)
    .eq('is_active', true)
    .maybeSingle<{
      id: string;
      provider_id: number;
      service_type: string;
      service_duration_minutes: number | null;
      base_price: number;
      is_active: boolean;
    }>();

  if (providerServiceError || !providerService) {
    throw providerServiceError ?? new Error('Service not found or is inactive.');
  }

  let legacyService: { id: number; price: number; duration_minutes: number; buffer_minutes: number } | null = null;
  let createdLegacyService = false;

  const legacyLookup = await supabase
    .from('services')
    .select('id, price, duration_minutes, buffer_minutes')
    .eq('provider_id', input.providerId)
    .ilike('name', providerService.service_type)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: number; price: number; duration_minutes: number; buffer_minutes: number }>();

  if (legacyLookup.error) {
    if (!isLegacyServicesBridgeSkippableError(legacyLookup.error)) {
      throw legacyLookup.error;
    }
  } else {
    legacyService = legacyLookup.data ?? null;
  }

  if (!legacyService && !legacyLookup.error) {
    const legacyInsert = await supabase
      .from('services')
      .insert({
        provider_id: input.providerId,
        name: providerService.service_type,
        duration_minutes: providerService.service_duration_minutes ?? 30,
        buffer_minutes: 0,
        price: providerService.base_price,
      })
      .select('id, price, duration_minutes, buffer_minutes')
      .single<{ id: number; price: number; duration_minutes: number; buffer_minutes: number }>();

    if (legacyInsert.error || !legacyInsert.data) {
      if (!isLegacyServicesBridgeSkippableError(legacyInsert.error)) {
        throw legacyInsert.error ?? new Error('Unable to create legacy service mapping for booking.');
      }
    } else {
      legacyService = legacyInsert.data;
      createdLegacyService = true;
    }
  }

  // Use the atomic RPC for booking creation — provides advisory locking and slot
  // verification to prevent double-bookings (P0 fix).
  const paymentMode = input.paymentMode ?? (input.useSubscriptionCredit ? 'platform' : 'direct_to_provider');
  const addOnsJsonb = input.addOns && input.addOns.length > 0 ? JSON.stringify(input.addOns) : null;

  if (input.allowPastBooking && legacyService) {
    return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
  }

  // Use the user's authenticated client for the RPC call when available.
  // The DB function checks auth.uid() which requires a user JWT — the admin
  // (service-role) client has no JWT context, making auth.uid() null.
  const rpcClient = userClient ?? supabase;

  const { data: rpcResult, error: rpcError } = await rpcClient.rpc('create_booking_atomic', {
    p_user_id: userId,
    p_pet_id: input.petId,
    p_provider_id: input.providerId,
    p_provider_service_id: providerServiceId,
    p_booking_type: 'service',
    p_package_id: null,
    p_booking_date: input.bookingDate,
    p_start_time: input.startTime,
    p_booking_mode: input.bookingMode,
    p_location_address: input.locationAddress ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_provider_notes: input.providerNotes ?? null,
    p_payment_mode: paymentMode,
    p_discount_code: input.discountCode ?? null,
    p_add_ons: addOnsJsonb,
  });

  if (rpcError) {
    if (legacyService && isServiceIdNotNullConstraintError(rpcError)) {
      return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
    }

    if (legacyService && isPetOwnershipError(rpcError)) {
      const sharedPetAccess = await hasSharedPetAccessForUser(supabase, userId, input.petId);
      if (sharedPetAccess) {
        return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
      }
    }

    if (legacyService && isSlotUnavailableError(rpcError)) {
      return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
    }

    // Clean up orphaned legacy service record if we auto-created it during this call
    if (createdLegacyService && legacyService) {
      await supabase.from('services').delete().eq('id', legacyService.id);
    }
    throw rpcError;
  }

  const rpcRow = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!rpcRow?.success) {
    if (legacyService && isServiceIdNotNullConstraintError({ message: rpcRow?.error_message ?? '' })) {
      return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
    }

    if (legacyService && isPetOwnershipError({ message: rpcRow?.error_message ?? '' })) {
      const sharedPetAccess = await hasSharedPetAccessForUser(supabase, userId, input.petId);
      if (sharedPetAccess) {
        return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
      }
    }

    if (legacyService && isSlotUnavailableError({ message: rpcRow?.error_message ?? '' })) {
      return createBookingViaCompatInsert(supabase, userId, input, providerService, legacyService, paymentMode);
    }

    if (createdLegacyService && legacyService) {
      await supabase.from('services').delete().eq('id', legacyService.id);
    }
    throw new Error(rpcRow?.error_message ?? 'Booking creation failed');
  }

  const booking = await fetchBookingByIdWithFallbacks(supabase, rpcRow.booking_id);

  if (input.useSubscriptionCredit) {
    if (!booking.service_type) {
      throw new Error('Booking service type is required for subscription credit usage.');
    }

    const creditAmount = Number(booking.price_at_booking ?? 0);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      throw new Error('Booking price is required for subscription credit usage.');
    }

    try {
      await reserveCreditForBooking(supabase, booking.id, userId, booking.service_type, creditAmount);
    } catch (creditError) {
      await supabase.from('bookings').delete().eq('id', booking.id);
      throw creditError;
    }
  }

  return booking;
}

async function resolveProviderServiceIdForLegacyCreate(supabase: SupabaseClient, input: CreateBookingInput) {
  if (input.providerServiceId) {
    return input.providerServiceId;
  }

  throw new Error('Service not found or is inactive.');
}

export async function getMyBookings(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('user_id', userId)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return (data ?? []) as BookingRecord[];
}

export async function cancelBooking(
  supabase: SupabaseClient,
  userId: string,
  bookingId: number,
  cancellationReason?: string,
  context?: BookingTransitionActorContext,
) {
  return applyBookingStatusTransition(supabase, bookingId, {
    expectedUserId: userId,
    nextStatus: 'cancelled',
    cancellationBy: 'user',
    cancellationReason,
    actorId: context?.actorId ?? userId,
    actorRole: context?.actorRole ?? 'user',
    source: context?.source ?? 'cancelBooking',
  });
}

export async function getAvailableSlots(supabase: SupabaseClient, input: GetAvailableSlotsInput) {
  return resolveAvailableSlots(supabase, input);
}

export async function getDayAvailability(
  supabase: SupabaseClient,
  providerId: number,
  bookingDate: string,
  serviceDurationMinutes?: number,
) {
  return resolveDayAvailability(supabase, providerId, bookingDate, serviceDurationMinutes);
}

export async function getAvailableSlotsMultiDay(
  supabase: SupabaseClient,
  input: {
    providerId: number;
    fromDate: string;
    toDate: string;
    serviceDurationMinutes?: number;
  },
) {
  return resolveAvailableSlotsMultiDay(supabase, input);
}

export async function getProviderBookings(supabase: SupabaseClient, providerUserId: string, query: ProviderBookingsQuery = {}) {
  const providerId = await getProviderIdByUserId(supabase, providerUserId);

  if (!providerId) {
    return [] as BookingRecord[];
  }

  let request = supabase.from('bookings').select(BOOKING_SELECT).eq('provider_id', providerId);

  if (query.status) {
    request = request.eq('booking_status', query.status);
  }

  if (query.fromDate) {
    request = request.gte('booking_date', query.fromDate);
  }

  if (query.toDate) {
    request = request.lte('booking_date', query.toDate);
  }

  request = request.order('booking_date', { ascending: true }).order('start_time', { ascending: true });

  if (query.limit && query.limit > 0) {
    request = request.limit(query.limit);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return (data ?? []) as BookingRecord[];
}

async function providerUpdateBookingStatus(
  supabase: SupabaseClient,
  providerUserId: string,
  bookingId: number,
  nextStatus: BookingStatus,
  providerNotes?: string,
) {
  const providerId = await getProviderIdByUserId(supabase, providerUserId);

  if (!providerId) {
    throw new Error('Provider profile is not linked to this account.');
  }

  return applyBookingStatusTransition(supabase, bookingId, {
    expectedProviderId: providerId,
    nextStatus,
    cancellationBy: nextStatus === 'cancelled' ? 'provider' : undefined,
    providerNotes: providerNotes ?? null,
    actorId: providerUserId,
    actorRole: 'provider',
    source: 'providerUpdateBookingStatus',
  });
}

export async function confirmBooking(supabase: SupabaseClient, providerUserId: string, bookingId: number, providerNotes?: string) {
  return providerUpdateBookingStatus(supabase, providerUserId, bookingId, 'confirmed', providerNotes);
}

export async function completeBooking(supabase: SupabaseClient, providerUserId: string, bookingId: number, providerNotes?: string) {
  return providerUpdateBookingStatus(supabase, providerUserId, bookingId, 'completed', providerNotes);
}

export async function markNoShow(supabase: SupabaseClient, providerUserId: string, bookingId: number, providerNotes?: string) {
  return providerUpdateBookingStatus(supabase, providerUserId, bookingId, 'no_show', providerNotes);
}

export async function cancelBookingAsProvider(
  supabase: SupabaseClient,
  providerUserId: string,
  bookingId: number,
  cancellationReason?: string,
  providerNotes?: string,
) {
  const providerId = await getProviderIdByUserId(supabase, providerUserId);

  if (!providerId) {
    throw new Error('Provider profile is not linked to this account.');
  }

  return applyBookingStatusTransition(supabase, bookingId, {
    expectedProviderId: providerId,
    nextStatus: 'cancelled',
    cancellationBy: 'provider',
    cancellationReason,
    providerNotes: providerNotes ?? null,
    actorId: providerUserId,
    actorRole: 'provider',
    source: 'cancelBookingAsProvider',
  });
}

export async function updateBookingStatus(
  supabase: SupabaseClient,
  bookingId: number,
  nextStatus: BookingStatus,
  options?: {
    cancellationBy?: 'user' | 'provider' | 'admin';
    cancellationReason?: string | null;
    actorId?: string;
    actorRole?: BookingActorRole;
    source?: string;
  },
) {
  return applyBookingStatusTransition(supabase, bookingId, {
    nextStatus,
    cancellationBy: nextStatus === 'cancelled' ? options?.cancellationBy ?? 'admin' : undefined,
    cancellationReason: nextStatus === 'cancelled' ? options?.cancellationReason ?? null : undefined,
    actorId: options?.actorId,
    actorRole: options?.actorRole,
    source: options?.source ?? 'updateBookingStatus',
  });
}

export async function overrideBooking(supabase: SupabaseClient, bookingId: number, patch: OverrideBookingInput) {
  if (patch.bookingStatus) {
    await applyBookingStatusTransition(supabase, bookingId, {
      nextStatus: patch.bookingStatus,
      cancellationBy: patch.bookingStatus === 'cancelled' ? patch.cancellationBy ?? 'admin' : undefined,
      cancellationReason: patch.bookingStatus === 'cancelled' ? patch.cancellationReason ?? null : undefined,
      providerNotes: patch.providerNotes,
      source: 'overrideBooking',
    });
  }

  // Do not re-set booking_status/status here — applyBookingStatusTransition already handled those
  // with proper guards and side-effects. Including them in the raw update would bypass the guards.
  const updatePayload: Record<string, unknown> = {
    booking_date: patch.bookingDate,
    start_time: patch.startTime,
    end_time: patch.endTime,
    booking_mode: patch.bookingMode,
    location_address: patch.locationAddress,
    latitude: patch.latitude,
    longitude: patch.longitude,
    provider_notes: patch.providerNotes,
    internal_notes: patch.internalNotes,
    cancellation_reason: patch.cancellationReason,
    cancellation_by: patch.cancellationBy,
    price_at_booking: patch.priceAtBooking,
    admin_price_reference: patch.adminPriceReference,
  };

  const { data, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', bookingId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function manualAssignProvider(
  supabase: SupabaseClient,
  bookingId: number,
  providerId: number,
  providerServiceId: string,
) {
  const currentStatus = await getCurrentBookingStatus(supabase, bookingId);
  assertBookingStateTransition(currentStatus, 'pending');

  const { data: providerService, error: providerServiceError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type')
    .eq('id', providerServiceId)
    .eq('provider_id', providerId)
    .single<{ id: string; provider_id: number; service_type: string }>();

  if (providerServiceError || !providerService) {
    throw providerServiceError ?? new Error('Provider service not found');
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({
      provider_id: providerId,
      provider_service_id: providerService.id,
      service_type: providerService.service_type,
      booking_status: 'pending',
      status: 'pending',
      cancellation_reason: null,
      cancellation_by: null,
    })
    .eq('id', bookingId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function processAdminCancellationAdjustment(
  supabase: SupabaseClient,
  actorId: string,
  bookingId: number,
  input?: {
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const booking = await updateBookingStatus(supabase, bookingId, 'cancelled', {
    cancellationBy: 'admin',
    cancellationReason: input?.reason ?? 'Cancelled by admin',
    actorId,
    actorRole: 'admin',
    source: 'processAdminCancellationAdjustment',
  });

  await reverseDiscountRedemptionForBooking(bookingId, input?.reason ?? 'cancelled_by_admin');

  const { error: adjustmentLogError } = await supabase.from('booking_adjustment_events').insert({
    booking_id: bookingId,
    actor_id: actorId,
    adjustment_amount: null,
    adjustment_type: 'cancellation_adjustment',
    reason: input?.reason ?? null,
    metadata: {
      payment_collection_mode: 'direct_to_provider',
      adjustment_type: 'cancellation_with_discount_reversal',
      ...(input?.metadata ?? {}),
    },
  });

  if (adjustmentLogError && adjustmentLogError.code !== '42P01') {
    throw adjustmentLogError;
  }

  return booking;
}