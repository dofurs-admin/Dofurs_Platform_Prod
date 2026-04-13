import { NextResponse } from 'next/server';
import { createBooking, updateBookingStatus } from '@/lib/bookings/service';
import { forbidden, requireApiRole } from '@/lib/auth/api-auth';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { toFriendlyApiError } from '@/lib/api/errors';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';
import { isSlotConflictMessage, logSecurityEvent } from '@/lib/monitoring/security-log';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { notifyBookingCreated } from '@/lib/notifications/service';
import { deductCredits } from '@/lib/credits/wallet';
import { haversineDistanceKm } from '@/lib/utils/geo-distance';
import { reserveCreditForBooking } from '@/lib/subscriptions/creditTracking';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
};

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { supabase, user, role } = auth.context;

  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:create', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid booking payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const targetUserId = parsed.data.bookingUserId ?? user.id;

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch (err) { console.error(err);
    return forbidden();
  }

  const admin = getSupabaseAdminClient();

  if (parsed.data.useSubscriptionCredit) {
    const { data: providerServiceRow, error: providerServiceError } = await admin
      .from('provider_services')
      .select('service_type')
      .eq('id', parsed.data.providerServiceId)
      .eq('provider_id', parsed.data.providerId)
      .maybeSingle<{ service_type: string | null }>();

    if (providerServiceError) {
      return NextResponse.json({ error: 'Unable to verify subscription credit eligibility for this service.' }, { status: 500 });
    }

    const normalizedServiceType = (providerServiceRow?.service_type ?? '').toLowerCase();
    if (normalizedServiceType.includes('birthday') || normalizedServiceType.includes('boarding')) {
      return NextResponse.json(
        { error: 'Subscription credits can be used for regular services only. Birthday and boarding bookings are not eligible.' },
        { status: 400 },
      );
    }
  }

  // Check pet ownership: owned directly OR shared with the user (active share)
  const { data: petOwnership, error: petOwnershipError } = await admin
    .from('pets')
    .select('id')
    .eq('id', parsed.data.petId)
    .eq('user_id', targetUserId)
    .maybeSingle<{ id: number }>();

  let hasPetAccess = !petOwnershipError && Boolean(petOwnership);

  if (!hasPetAccess) {
    const { data: sharedAccess, error: sharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', parsed.data.petId)
      .eq('shared_with_user_id', targetUserId)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{ id: string; role: string | null; status: string; accepted_at: string | null; revoked_at: string | null }>();

    if (!sharedAccessError && sharedAccess) {
      hasPetAccess = (
        (sharedAccess.status === 'active'
        || sharedAccess.status === 'accepted'
        || Boolean(sharedAccess.accepted_at))
        && sharedAccess.role === 'manager'
      );
    }
  }

  if (!hasPetAccess && targetUserId === user.id && user.email) {
    const { data: emailSharedAccess, error: emailSharedAccessError } = await admin
      .from('pet_shares')
      .select('id, role, status, accepted_at, revoked_at')
      .eq('pet_id', parsed.data.petId)
      .ilike('invited_email', user.email)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{ id: string; role: string | null; status: string; accepted_at: string | null; revoked_at: string | null }>();

    if (!emailSharedAccessError && emailSharedAccess) {
      hasPetAccess = (
        (emailSharedAccess.status === 'active'
        || emailSharedAccess.status === 'accepted'
        || Boolean(emailSharedAccess.accepted_at))
        && emailSharedAccess.role === 'manager'
      );

      if (hasPetAccess) {
        await admin
          .from('pet_shares')
          .update({
            shared_with_user_id: targetUserId,
            status: 'active',
            accepted_at: emailSharedAccess.accepted_at ?? new Date().toISOString(),
            revoked_at: null,
          })
          .eq('id', emailSharedAccess.id);
      }
    }
  }

  if (!hasPetAccess) {
    return NextResponse.json({ error: 'Pet does not belong to this user.' }, { status: 403 });
  }

  if (role === 'provider') {
    // Providers can book on behalf of customer accounts only.
    if (parsed.data.bookingUserId && parsed.data.bookingUserId !== user.id) {
      const { data: targetUser, error: targetUserError } = await admin
        .from('users')
        .select('id, roles(name)')
        .eq('id', parsed.data.bookingUserId)
        .maybeSingle<{ id: string; roles: { name: string } | Array<{ name: string }> | null }>();

      if (targetUserError || !targetUser) {
        return NextResponse.json({ error: 'Selected customer could not be verified.' }, { status: 404 });
      }

      const targetRole = (Array.isArray(targetUser.roles) ? targetUser.roles[0] : targetUser.roles)?.name ?? null;
      if (targetRole === 'admin' || targetRole === 'staff' || targetRole === 'provider') {
        return forbidden();
      }
    }
  }

  // --- Serviceability validation (skip for admin/staff — they can override) ---
  if (role === 'user' || role === 'provider') {
    const providerServiceId = parsed.data.providerServiceId;

    // 1. Pincode coverage check
    const { data: coverageRows, error: coverageError } = await admin
      .from('provider_service_pincodes')
      .select('pincode, is_enabled')
      .eq('provider_service_id', providerServiceId);

    if (coverageError && coverageError.code !== '42P01') {
      return NextResponse.json({ error: 'Unable to verify service coverage. Please try again.' }, { status: 500 });
    }

    const enabledPincodes = (coverageRows ?? [])
      .filter((row: { pincode: string; is_enabled: boolean }) => row.is_enabled)
      .map((row: { pincode: string }) => row.pincode);

    // Only enforce pincode check if the service has configured pincodes
    if (enabledPincodes.length > 0) {
      // Resolve the user's pincode: explicit field > extract from locationAddress
      let userPincode = parsed.data.pincode?.trim() ?? '';

      if (!/^[1-9]\d{5}$/.test(userPincode) && parsed.data.locationAddress) {
        const match = parsed.data.locationAddress.match(/\b([1-9]\d{5})\b/);
        userPincode = match?.[1] ?? '';
      }

      if (/^[1-9]\d{5}$/.test(userPincode)) {
        if (!enabledPincodes.includes(userPincode)) {
          return NextResponse.json(
            { error: 'This service is not available in your area. Please choose a different pincode or service.' },
            { status: 400 },
          );
        }
      }
    }

    // 2. Provider radius check (home_visit only)
    if (
      parsed.data.bookingMode === 'home_visit' &&
      parsed.data.latitude != null &&
      parsed.data.longitude != null
    ) {
      const { data: providerLocation } = await admin
        .from('providers')
        .select('lat, lng, service_radius_km')
        .eq('id', parsed.data.providerId)
        .maybeSingle<{ lat: number | null; lng: number | null; service_radius_km: number | null }>();

      if (
        providerLocation &&
        providerLocation.lat != null &&
        providerLocation.lng != null &&
        providerLocation.service_radius_km != null &&
        providerLocation.service_radius_km > 0
      ) {
        const distance = haversineDistanceKm(
          providerLocation.lat,
          providerLocation.lng,
          parsed.data.latitude,
          parsed.data.longitude,
        );

        if (distance > providerLocation.service_radius_km) {
          return NextResponse.json(
            { error: 'No provider available in your area. The selected provider does not serve your location.' },
            { status: 400 },
          );
        }
      }
    }
  }

  try {
    // Security: Never trust client-provided finalPrice or discountAmount
    // All pricing calculated server-side in DB RPC
    const bookingInput = {
      petId: parsed.data.petId,
      providerId: parsed.data.providerId,
      providerServiceId: parsed.data.providerServiceId,
      bookingDate: parsed.data.bookingDate,
      startTime: parsed.data.startTime,
      bookingMode: parsed.data.bookingMode,
      locationAddress: parsed.data.locationAddress,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      providerNotes: parsed.data.providerNotes,
      bookingType: 'service' as const,
      discountCode: parsed.data.discountCode,
      // Client pricing removed - calculated server-side only
      addOns: parsed.data.addOns,
      useSubscriptionCredit: parsed.data.useSubscriptionCredit,
      paymentMode: parsed.data.paymentMode,
    };

    // Pass the user's authenticated client as 4th arg so the DB RPC function
    // `create_booking_atomic` can read auth.uid() from the JWT. The admin
    // client is still used for table queries that need RLS bypass.
    const booking = await createBooking(admin, targetUserId, bookingInput, supabase);
    let creditReservation: {
      reserved: boolean;
      linkId: string;
      linkStatus: string;
      serviceType: string;
      availableCredits: number;
      consumedCredits: number;
      totalCredits: number;
    } | null = null;

    if (parsed.data.useSubscriptionCredit) {
      if (!booking.service_type) {
        await updateBookingStatus(admin, booking.id, 'cancelled', {
          cancellationBy: 'admin',
          cancellationReason: 'Subscription credit booking missing service type',
          actorRole: 'admin',
          source: 'bookings/create/subscription-credit-service-type-missing',
        });
        return NextResponse.json(
          { error: 'Could not reserve subscription credit for this booking. Please try again.' },
          { status: 400 },
        );
      }

      const { data: existingCreditLink, error: existingCreditLinkError } = await admin
        .from('booking_subscription_credit_links')
        .select('id, user_subscription_id, service_type, status')
        .eq('booking_id', booking.id)
        .maybeSingle<{ id: string; user_subscription_id: string; service_type: string; status: string }>();

      if (existingCreditLinkError) {
        console.error('[bookings/create] failed to verify subscription credit link:', existingCreditLinkError);
        await updateBookingStatus(admin, booking.id, 'cancelled', {
          cancellationBy: 'admin',
          cancellationReason: 'Subscription credit verification failed',
          actorRole: 'admin',
          source: 'bookings/create/subscription-credit-link-verify-failed',
        });
        return NextResponse.json(
          { error: 'Could not verify subscription credit reservation. Please try again.' },
          { status: 400 },
        );
      }

      let effectiveCreditLink = existingCreditLink;

      if (!existingCreditLink) {
        try {
          const creditAmount = Number(booking.price_at_booking ?? 0);
          if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
            throw new Error('Booking price is required for subscription credit usage.');
          }
          const reservedLink = await reserveCreditForBooking(admin, booking.id, targetUserId, booking.service_type, creditAmount);
          effectiveCreditLink = {
            id: reservedLink.id,
            user_subscription_id: reservedLink.user_subscription_id,
            service_type: reservedLink.service_type,
            status: reservedLink.status,
          };
        } catch (reserveError) {
          console.error('[bookings/create] fallback subscription credit reservation failed:', reserveError);
          await updateBookingStatus(admin, booking.id, 'cancelled', {
            cancellationBy: 'admin',
            cancellationReason: 'Subscription credit reservation failed',
            actorRole: 'admin',
            source: 'bookings/create/subscription-credit-reserve-failed',
          });
          return NextResponse.json(
            { error: 'No available subscription credits for this service. Booking was not created.' },
            { status: 400 },
          );
        }
      }

      if (!effectiveCreditLink) {
        await updateBookingStatus(admin, booking.id, 'cancelled', {
          cancellationBy: 'admin',
          cancellationReason: 'Subscription credit link missing after reservation',
          actorRole: 'admin',
          source: 'bookings/create/subscription-credit-link-missing',
        });
        return NextResponse.json(
          { error: 'Could not confirm subscription credit reservation. Please try again.' },
          { status: 400 },
        );
      }

      const { data: creditRow, error: creditRowError } = await admin
        .from('user_service_credits')
        .select('available_credits, consumed_credits, total_credits')
        .eq('user_subscription_id', effectiveCreditLink.user_subscription_id)
        .eq('service_type', effectiveCreditLink.service_type)
        .single<{ available_credits: number; consumed_credits: number; total_credits: number }>();

      if (creditRowError || !creditRow) {
        console.error('[bookings/create] failed to read subscription credit row after reservation:', creditRowError);
        await updateBookingStatus(admin, booking.id, 'cancelled', {
          cancellationBy: 'admin',
          cancellationReason: 'Subscription credit row read failed after reservation',
          actorRole: 'admin',
          source: 'bookings/create/subscription-credit-row-read-failed',
        });
        return NextResponse.json(
          { error: 'Could not verify subscription credit balance update. Please try again.' },
          { status: 400 },
        );
      }

      creditReservation = {
        reserved: effectiveCreditLink.status === 'reserved' || effectiveCreditLink.status === 'consumed',
        linkId: effectiveCreditLink.id,
        linkStatus: effectiveCreditLink.status,
        serviceType: effectiveCreditLink.service_type,
        availableCredits: Number(creditRow.available_credits ?? 0),
        consumedCredits: Number(creditRow.consumed_credits ?? 0),
        totalCredits: Number(creditRow.total_credits ?? 0),
      };
    }

    // Deduct wallet credits if requested — cap at actual booking price to prevent overdrain
    const bookingPrice = Number(booking.price_at_booking ?? 0);
    const walletCreditsRequested = Math.min(
      parsed.data.walletCreditsAppliedInr ?? 0,
      bookingPrice,
    );
    if (walletCreditsRequested > 0) {
      try {
        await deductCredits(targetUserId, walletCreditsRequested, booking.id);
        // Persist the applied amount on the booking row
        await admin
          .from('bookings')
          .update({ wallet_credits_applied_inr: walletCreditsRequested })
          .eq('id', booking.id);
      } catch (creditErr) {
        // If credit deduction fails, cancel the booking via state machine so hooks fire properly
        console.error('[bookings/create] credit deduction failed, rolling back booking:', creditErr);
        try {
          await updateBookingStatus(admin, booking.id, 'cancelled', {
            cancellationBy: 'admin',
            cancellationReason: 'Credit deduction failed — automatic rollback',
            actorRole: 'admin',
            source: 'bookings/create/credit-rollback',
          });
        } catch (rollbackErr) {
          console.error('[bookings/create] rollback via state machine failed, forcing direct cancel:', rollbackErr);
          await admin
            .from('bookings')
            .update({ booking_status: 'cancelled', cancellation_reason: 'Credit deduction failed' })
            .eq('id', booking.id);
        }
        return NextResponse.json(
          { error: 'Could not apply Dofurs Credits. Please try again or choose another payment method.' },
          { status: 400 },
        );
      }
    }

    // Fire-and-forget notification — do not block the response
    notifyBookingCreated(admin, {
      id: booking.id,
      user_id: targetUserId,
      provider_id: parsed.data.providerId,
      service_type: booking.service_type ?? parsed.data.providerServiceId?.toString() ?? null,
      booking_date: booking.booking_date ?? parsed.data.bookingDate,
    }).catch((err) => console.error('Notification hook failed (booking_created)', err));

    return NextResponse.json({ success: true, booking, creditReservation });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Booking failed');

    const rawMessage =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
          ? ((error as { message: string }).message ?? '').trim()
          : '';
    const message = rawMessage || mapped.message;
    if (mapped.status === 409 || isSlotConflictMessage(message)) {
      logSecurityEvent('warn', 'booking.slot_conflict', {
        route: 'api/bookings/create',
        actorId: user.id,
        actorRole: role,
        targetId: parsed.data.providerId,
        message,
        metadata: {
          bookingDate: parsed.data.bookingDate,
          startTime: parsed.data.startTime,
          bookingMode: parsed.data.bookingMode,
        },
      });
    }

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/bookings/create',
      actorId: user.id,
      actorRole: role,
      targetId: parsed.data.providerId,
      message,
      metadata: {
        status: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
