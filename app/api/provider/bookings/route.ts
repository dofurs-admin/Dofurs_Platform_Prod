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

const querySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

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

    const userIds = Array.from(
      new Set(bookingsWithTasks.map((booking) => booking.user_id).filter(Boolean)),
    );
    const petIds = Array.from(
      new Set(
        bookingsWithTasks
          .map((booking) => booking.pet_id)
          .filter((petId): petId is number => typeof petId === 'number' && Number.isFinite(petId)),
      ),
    );

    const adminSupabase = getSupabaseAdminClient();

    const [profileResult, petResult] = await Promise.all([
      userIds.length > 0
        ? adminSupabase
            .from('profiles')
            .select('id, full_name, profile_photo_url')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      petIds.length > 0
        ? adminSupabase.from('pets').select('id, name, photo_url').in('id', petIds)
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

    const enrichedBookings = bookingsWithTasks.map((booking) => ({
      ...booking,
      owner_full_name:
        ownerNameByUserId.get(booking.user_id) ?? ownerFallbackNameByUserId.get(booking.user_id) ?? null,
      pet_name: petNameById.get(booking.pet_id) ?? null,
      pet_photo_url:
        (() => {
          const raw = petPhotoRawById.get(booking.pet_id) ?? null;
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
    }));

    // Enrich with cash collection status for direct_to_provider bookings
    const cashBookingIds = enrichedBookings
      .filter((b) => b.payment_mode === 'direct_to_provider')
      .map((b) => b.id);

    const cashCollectedSet = new Set<number>();

    if (cashBookingIds.length > 0) {
      const { data: collections } = await adminSupabase
        .from('booking_payment_collections')
        .select('booking_id')
        .in('booking_id', cashBookingIds)
        .eq('status', 'paid');

      for (const row of collections ?? []) {
        cashCollectedSet.add(row.booking_id as number);
      }
    }

    const finalBookings = enrichedBookings.map((booking) => ({
      ...booking,
      cash_collected:
        booking.payment_mode === 'direct_to_provider'
          ? cashCollectedSet.has(booking.id)
          : undefined,
    }));

    return NextResponse.json({ bookings: finalBookings });
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
