import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  ensureBookingSopSubmissions,
  getBookingSopPhotosForSubmissions,
  getBookingSopSubmissionsForBookings,
  isBookingSopEnforcementWaived,
} from '@/lib/bookings/sop-assignments';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(['provider']);

  if (auth.response) {
    return auth.response;
  }

  const { user, supabase } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 });
    }

    const adminSupabase = getSupabaseAdminClient();
    const { data: booking, error: bookingError } = await adminSupabase
      .from('bookings')
      .select('id, provider_id')
      .eq('id', bookingId)
      .maybeSingle<{ id: number; provider_id: number }>();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.provider_id !== providerId) {
      return NextResponse.json({ error: 'You do not have access to this booking' }, { status: 403 });
    }

    await ensureBookingSopSubmissions(adminSupabase, [bookingId]);

    const [submissionMap, sopWaived] = await Promise.all([
      getBookingSopSubmissionsForBookings(adminSupabase, [bookingId]),
      isBookingSopEnforcementWaived(adminSupabase, bookingId),
    ]);

    const submissions = submissionMap.get(bookingId) ?? [];
    const photosBySubmission = await getBookingSopPhotosForSubmissions(
      adminSupabase,
      submissions.map((submission) => submission.id),
    );

    const photoPathSet = new Set<string>();
    for (const photos of photosBySubmission.values()) {
      for (const photo of photos) {
        photoPathSet.add(photo.storage_path);
      }
    }

    const signedUrlByPath = new Map<string, string>();
    await Promise.all(
      Array.from(photoPathSet).map(async (path) => {
        const { data } = await adminSupabase.storage.from('sop-photos').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          signedUrlByPath.set(path, data.signedUrl);
        }
      }),
    );

    return NextResponse.json({
      bookingId,
      sop_completion_waived: sopWaived,
      submissions: submissions.map((submission) => ({
        ...submission,
        photos: (photosBySubmission.get(submission.id) ?? []).map((photo) => ({
          id: photo.id,
          storage_path: photo.storage_path,
          signed_url: signedUrlByPath.get(photo.storage_path) ?? null,
          created_at: photo.created_at,
        })),
      })),
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load booking SOP checklist');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
