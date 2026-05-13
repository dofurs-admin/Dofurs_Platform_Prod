import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getProviderBookings } from '@/lib/bookings/service';
import {
  ensureProviderCompletionTasks,
  getCompletionTaskMapForBookings,
} from '@/lib/bookings/completion-tasks';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  groupBookingAddonRowsByBookingId,
  loadBookingAddonRowsByBookingIds,
} from '@/lib/bookings/addon-items';
import {
  extractBundledPetIdsFromNotes,
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';

const querySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

type CustomerFeedbackRow = {
  booking_id: number;
  rating: number;
  notes: string | null;
  created_by_user_id: string;
  created_by_role: 'provider' | 'admin' | 'staff';
  created_at: string;
};

function normalizeStoragePathCandidate(
  value: string | null | undefined,
  bucket: 'user-photos' | 'pet-photos',
) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const stripBucketPrefix = (input: string) =>
    input.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '');

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/storage/v1/object/')) {
    return stripBucketPrefix(trimmed);
  }

  try {
    const parsed = new URL(trimmed, trimmed.startsWith('http') ? undefined : 'http://localhost');
    const segments = parsed.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex(
      (segment, index) =>
        segment === 'storage' &&
        segments[index + 1] === 'v1' &&
        segments[index + 2] === 'object',
    );

    if (markerIndex === -1) {
      return null;
    }

    const objectSegments = segments.slice(markerIndex + 3);
    const first = objectSegments[0];
    if (!first) {
      return null;
    }

    const modeOffsets: Record<string, number> = {
      sign: 1,
      public: 1,
      authenticated: 1,
      render: 2,
    };

    const offset = modeOffsets[first] ?? 0;
    const bucketCandidate = objectSegments[offset];
    const pathParts = objectSegments.slice(offset + 1);

    if (bucketCandidate !== bucket || pathParts.length === 0) {
      return null;
    }

    return decodeURIComponent(pathParts.join('/'));
  } catch {
    return stripBucketPrefix(trimmed);
  }
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

  const candidate = Number((value as { petId?: unknown }).petId);
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return [];
  }

  return [candidate];
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

export async function GET(request: Request) {
  const auth = await requireApiRole(['provider']);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    fromDate: searchParams.get('fromDate') ?? undefined,
    toDate: searchParams.get('toDate') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (providerId) {
      await ensureProviderCompletionTasks(supabase, providerId);
    }

    const bookings = await getProviderBookings(supabase, user.id, parsed.data);
    const taskMap = await getCompletionTaskMapForBookings(
      supabase,
      bookings.map((booking) => booking.id),
    );

    const bookingsWithTasks = bookings.map((booking) => {
      const task = taskMap.get(booking.id);

      return {
        ...booking,
        completion_task_status: task?.task_status ?? null,
        completion_due_at: task?.due_at ?? null,
        completion_completed_at: task?.completed_at ?? null,
        completion_feedback_text: task?.feedback_text ?? null,
        requires_completion_feedback: booking.booking_status === 'confirmed' && task?.task_status === 'pending',
      };
    });

    const bookingsWithResolvedPetIds = bookingsWithTasks.map((booking) => {
      const resolvedPetIds = Array.from(
        new Set([
          ...extractBundledPetIdsFromNotes(booking.provider_notes),
          ...extractBundledPetIdsFromNotes(booking.internal_notes),
          ...(typeof booking.pet_id === 'number' && Number.isFinite(booking.pet_id)
            ? [booking.pet_id]
            : []),
        ]),
      );

      return {
        ...booking,
        resolved_pet_ids: resolvedPetIds,
      };
    });

    const adminSupabase = getSupabaseAdminClient();
    const requestedBookingIds = bookingsWithResolvedPetIds.map((booking) => booking.id);
    const paymentPetIdsByBookingId = new Map<number, number[]>();

    if (requestedBookingIds.length > 0) {
      const { data: paymentRows, error: paymentRowsError } = await adminSupabase
        .from('payment_transactions')
        .select('booking_id, metadata')
        .in('booking_id', requestedBookingIds)
        .returns<Array<{ booking_id: number | null; metadata: unknown }>>();

      if (paymentRowsError && paymentRowsError.code !== '42P01') {
        console.warn('Unable to load payment metadata for booking pet enrichment', paymentRowsError);
      } else {
        for (const row of paymentRows ?? []) {
          if (!row.booking_id) {
            continue;
          }

          const parsedPetIds = Array.from(new Set(extractPetIdsFromPaymentMetadata(row.metadata)));
          if (parsedPetIds.length === 0) {
            continue;
          }

          const existingPetIds = paymentPetIdsByBookingId.get(row.booking_id) ?? [];
          paymentPetIdsByBookingId.set(
            row.booking_id,
            Array.from(new Set([...existingPetIds, ...parsedPetIds])),
          );
        }
      }
    }

    const bookingsWithMergedPetIds = bookingsWithResolvedPetIds.map((booking) => ({
      ...booking,
      resolved_pet_ids: Array.from(
        new Set([
          ...booking.resolved_pet_ids,
          ...(paymentPetIdsByBookingId.get(booking.id) ?? []),
        ]),
      ),
    }));

    const userIds = Array.from(
      new Set(bookingsWithMergedPetIds.map((booking) => booking.user_id).filter(Boolean)),
    );

    const [profileResult, petResult] = await Promise.all([
      userIds.length > 0
        ? adminSupabase
            .from('profiles')
            .select('id, full_name, profile_photo_url')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? adminSupabase
            .from('pets')
            .select('id, user_id, name, photo_url')
            .in('user_id', userIds)
            .order('id', { ascending: true })
            .returns<Array<{ id: number; user_id: string | null; name: string | null; photo_url: string | null }>>()
        : Promise.resolve({ data: [], error: null }),
    ]);

    const usersResult =
      userIds.length > 0
        ? await adminSupabase.from('users').select('id, name, phone').in('id', userIds)
        : { data: [], error: null };

    if (profileResult.error) {
      console.warn('Unable to load booking owner names for provider dashboard', profileResult.error);
    }
    if (petResult.error) {
      console.warn('Unable to load booking pet names for provider dashboard', petResult.error);
    }
    if (usersResult.error) {
      console.warn('Unable to load booking owner phone numbers for provider dashboard', usersResult.error);
    }

    const ownerNameByUserId = new Map<string, string | null>(
      (profileResult.data ?? []).map((profile) => [profile.id, profile.full_name ?? null]),
    );
    const petNameById = new Map<number, string | null>(
      (petResult.data ?? []).map((pet) => [pet.id, pet.name ?? null]),
    );
    const petPhotoRawById = new Map<number, string | null>(
      (petResult.data ?? []).map((pet) => [pet.id, pet.photo_url ?? null]),
    );
    const ownerPetIdsByUserId = new Map<string, number[]>();

    for (const pet of petResult.data ?? []) {
      if (!pet.user_id) {
        continue;
      }

      const existing = ownerPetIdsByUserId.get(pet.user_id) ?? [];
      existing.push(pet.id);
      ownerPetIdsByUserId.set(pet.user_id, existing);
    }
    const ownerPhoneByUserId = new Map<string, string | null>(
      (usersResult.data ?? []).map((user) => [user.id, user.phone ?? null]),
    );
    const ownerPhotoRawByUserId = new Map<string, string | null>(
      (profileResult.data ?? []).map((profile) => [profile.id, profile.profile_photo_url ?? null]),
    );
    const ownerFallbackNameByUserId = new Map<string, string | null>(
      (usersResult.data ?? []).map((user) => [user.id, user.name ?? null]),
    );

    const petPhotoPathSet = new Set<string>();
    const ownerPhotoPathSet = new Set<string>();

    for (const photoUrl of petPhotoRawById.values()) {
      const normalizedPath = normalizeStoragePathCandidate(photoUrl, 'pet-photos');
      if (normalizedPath) {
        petPhotoPathSet.add(normalizedPath);
      }
    }

    for (const photoUrl of ownerPhotoRawByUserId.values()) {
      const normalizedPath = normalizeStoragePathCandidate(photoUrl, 'user-photos');
      if (normalizedPath) {
        ownerPhotoPathSet.add(normalizedPath);
      }
    }

    const petSignedUrlByPath = new Map<string, string>();
    const ownerSignedUrlByPath = new Map<string, string>();

    await Promise.all(
      Array.from(petPhotoPathSet).map(async (path) => {
        const { data } = await adminSupabase.storage.from('pet-photos').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          petSignedUrlByPath.set(path, data.signedUrl);
        }
      }),
    );

    await Promise.all(
      Array.from(ownerPhotoPathSet).map(async (path) => {
        const { data } = await adminSupabase.storage.from('user-photos').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          ownerSignedUrlByPath.set(path, data.signedUrl);
        }
      }),
    );

    const enrichedBookings = bookingsWithMergedPetIds.map(({ resolved_pet_ids, ...booking }) => {
      const resolvedPetNames = resolved_pet_ids
        .map((petId) => (petNameById.get(petId) ?? '').trim())
        .filter((name) => name.length > 0);
      const uniquePetNames = Array.from(new Set(resolvedPetNames));
      const primaryPetId = resolved_pet_ids[0] ?? booking.pet_id;

      return {
        ...booking,
        owner_full_name:
          ownerNameByUserId.get(booking.user_id) ?? ownerFallbackNameByUserId.get(booking.user_id) ?? null,
        pet_name: uniquePetNames.length > 0 ? uniquePetNames.join(', ') : petNameById.get(booking.pet_id) ?? null,
        pet_names: uniquePetNames,
        pet_ids: resolved_pet_ids,
        pet_photo_url:
          (() => {
            const raw = petPhotoRawById.get(primaryPetId) ?? null;
            const normalized = normalizeStoragePathCandidate(raw, 'pet-photos');
            return normalized ? petSignedUrlByPath.get(normalized) ?? raw : raw;
          })() ?? null,
        owner_phone: ownerPhoneByUserId.get(booking.user_id) ?? null,
        owner_photo_url:
          (() => {
            const raw = ownerPhotoRawByUserId.get(booking.user_id) ?? null;
            const normalized = normalizeStoragePathCandidate(raw, 'user-photos');
            return normalized ? ownerSignedUrlByPath.get(normalized) ?? raw : raw;
          })() ?? null,
      };
    });

    // Enrich with payable collection status for direct_to_provider and mixed bookings
    const cashBookingIds = enrichedBookings
      .filter((b) => b.payment_mode === 'direct_to_provider' || b.payment_mode === 'mixed')
      .map((b) => b.id);

    const payableCollectionMap = new Map<number, { status: string; amount_inr: number }>();

    if (cashBookingIds.length > 0) {
      const { data: collections } = await adminSupabase
        .from('booking_payment_collections')
        .select('booking_id, status, amount_inr')
        .in('booking_id', cashBookingIds)
        .returns<Array<{ booking_id: number; status: string; amount_inr: number | null }>>();

      for (const row of collections ?? []) {
        payableCollectionMap.set(row.booking_id, {
          status: row.status,
          amount_inr: Math.max(0, Number(row.amount_inr ?? 0)),
        });
      }
    }

    const finalBookings = enrichedBookings.map((booking) => ({
      ...booking,
      cash_collected: (() => {
        if (booking.payment_mode !== 'direct_to_provider' && booking.payment_mode !== 'mixed') {
          return undefined;
        }

        const row = payableCollectionMap.get(booking.id);
        if (!row) {
          return false;
        }

        return row.status === 'paid' || row.amount_inr <= 0;
      })(),
      pending_payable_inr: (() => {
        if (booking.payment_mode !== 'direct_to_provider' && booking.payment_mode !== 'mixed') {
          return 0;
        }

        const row = payableCollectionMap.get(booking.id);
        if (!row) {
          return 0;
        }

        return row.status === 'paid' ? 0 : row.amount_inr;
      })(),
    }));

    const bookingIds = finalBookings.map((booking) => booking.id);
    const addonRows = await loadBookingAddonRowsByBookingIds(adminSupabase, bookingIds);
    const addonItemsByBookingId = groupBookingAddonRowsByBookingId(addonRows);

    const referencedProviderServiceIds = new Set<string>();

    for (const booking of finalBookings) {
      const bookingProviderServiceId = booking.provider_service_id?.trim();
      if (bookingProviderServiceId) {
        referencedProviderServiceIds.add(bookingProviderServiceId);
      }

      for (const serviceId of extractProviderServiceIdsFromNotes(booking.provider_notes)) {
        referencedProviderServiceIds.add(serviceId);
      }

      for (const serviceId of extractProviderServiceIdsFromNotes(booking.internal_notes)) {
        referencedProviderServiceIds.add(serviceId);
      }
    }

    const serviceNameByProviderServiceId = new Map<string, string>();
    const serviceBasePriceByProviderServiceId = new Map<string, number>();

    if (referencedProviderServiceIds.size > 0) {
      const { data: providerServiceRows, error: providerServiceError } = await adminSupabase
        .from('provider_services')
        .select('id, service_type, base_price')
        .in('id', Array.from(referencedProviderServiceIds))
        .returns<Array<{ id: string; service_type: string | null; base_price: number | null }>>();

      if (providerServiceError) {
        console.warn(
          'Unable to resolve provider service names for bundled service summaries',
          providerServiceError,
        );
      } else {
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
      }
    }

    const feedbackByBookingId = new Map<number, CustomerFeedbackRow[]>();

    if (bookingIds.length > 0) {
      const { data: feedbackRows, error: feedbackError } = await adminSupabase
        .from('customer_service_feedback')
        .select('booking_id, rating, notes, created_by_user_id, created_by_role, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false })
        .returns<CustomerFeedbackRow[]>();

      if (!feedbackError) {
        for (const row of feedbackRows ?? []) {
          const current = feedbackByBookingId.get(row.booking_id) ?? [];
          current.push(row);
          feedbackByBookingId.set(row.booking_id, current);
        }
      }
    }

    const bookingsWithFeedback = finalBookings.map((booking) => {
      const entries = feedbackByBookingId.get(booking.id) ?? [];
      const providerEntry = entries.find(
        (entry) => entry.created_by_role === 'provider' && entry.created_by_user_id === user.id,
      );
      const includedServices = resolveIncludedServicesForBooking(booking, {
        serviceNameByProviderServiceId,
        serviceBasePriceByProviderServiceId,
      });
      const existingPetIds = Array.from(
        new Set(
          (booking.pet_ids ?? []).filter(
            (petId): petId is number => Number.isFinite(petId) && petId > 0,
          ),
        ),
      );
      const ownerPetIds = Array.from(new Set(ownerPetIdsByUserId.get(booking.user_id) ?? []));
      const shouldExpandPetIdsFromOwner =
        existingPetIds.length === 1 &&
        includedServices.length > existingPetIds.length &&
        ownerPetIds.length === includedServices.length &&
        ownerPetIds.includes(existingPetIds[0]);
      const resolvedPetIds = shouldExpandPetIdsFromOwner
        ? ownerPetIds
        : existingPetIds.length > 0
          ? existingPetIds
          : typeof booking.pet_id === 'number' && Number.isFinite(booking.pet_id)
            ? [booking.pet_id]
            : [];
      const resolvedPetNames = resolvedPetIds
        .map((petId) => (petNameById.get(petId) ?? '').trim())
        .filter((name) => name.length > 0);
      const uniquePetNames = Array.from(new Set(resolvedPetNames));
      const primaryPetId = resolvedPetIds[0] ?? booking.pet_id;

      return {
        ...booking,
        pet_name: uniquePetNames.length > 0 ? uniquePetNames.join(', ') : booking.pet_name ?? null,
        pet_names: uniquePetNames,
        pet_ids: resolvedPetIds,
        pet_photo_url:
          (() => {
            const raw = petPhotoRawById.get(primaryPetId) ?? null;
            const normalized = normalizeStoragePathCandidate(raw, 'pet-photos');
            return normalized ? petSignedUrlByPath.get(normalized) ?? raw : raw;
          })() ?? booking.pet_photo_url ?? null,
        addon_items: addonItemsByBookingId.get(booking.id) ?? [],
        included_services: includedServices,
        has_customer_feedback: entries.length > 0,
        provider_customer_rating: providerEntry?.rating ?? null,
        provider_customer_notes: providerEntry?.notes ?? null,
      };
    });

    return NextResponse.json({ bookings: bookingsWithFeedback });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load provider bookings');

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/provider/bookings',
      actorId: user.id,
      actorRole: role,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        status: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
