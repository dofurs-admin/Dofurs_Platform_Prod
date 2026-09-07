import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';
import { getBookingSopPhotosForSubmissions } from '@/lib/bookings/sop-assignments';

type RouteContext = { params: Promise<{ id: string; submissionId: string }> };

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

const payloadSchema = z.object({
  photoPaths: z.array(z.string().trim().min(1).max(512)).max(20).default([]),
});

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(['provider']);

  if (auth.response) {
    return auth.response;
  }

  const { user, supabase } = auth.context;

  const rate = await isRateLimited(supabase, getRateLimitKey('provider:bookings:sop-photos:post', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id, submissionId } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0 || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json({ error: 'Invalid booking or SOP id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const adminSupabase = getSupabaseAdminClient();
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 });
    }

    const { data: submission, error: submissionError } = await adminSupabase
      .from('booking_sop_submissions')
      .select(
        'id, booking_id, provider_id, status, requires_photo_snapshot, min_photo_count_snapshot, max_photo_count_snapshot',
      )
      .eq('id', submissionId)
      .eq('booking_id', bookingId)
      .maybeSingle<{
        id: string;
        booking_id: number;
        provider_id: number;
        status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'waived';
        requires_photo_snapshot: boolean;
        min_photo_count_snapshot: number;
        max_photo_count_snapshot: number;
      }>();

    if (submissionError) {
      throw submissionError;
    }

    if (!submission) {
      return NextResponse.json({ error: 'SOP not found for this booking' }, { status: 404 });
    }

    if (submission.provider_id !== providerId) {
      return NextResponse.json({ error: 'You do not have access to this SOP' }, { status: 403 });
    }

    if (submission.status !== 'pending' && submission.status !== 'rejected') {
      return NextResponse.json(
        { error: 'This SOP was already submitted. Contact operations to redo it.' },
        { status: 409 },
      );
    }

    // Photo paths must live under the provider's own storage prefix.
    const ownerPrefix = `${user.id}/`;
    const uniquePaths = Array.from(new Set(parsed.data.photoPaths));
    const invalidPath = uniquePaths.find((path) => !path.startsWith(ownerPrefix) || path.includes('..'));

    if (invalidPath) {
      return NextResponse.json(
        { error: 'Invalid photo detected. Upload photos again from this booking and retry.' },
        { status: 400 },
      );
    }

    const existingPhotosMap = await getBookingSopPhotosForSubmissions(adminSupabase, [submission.id]);
    const existingPhotoCount = (existingPhotosMap.get(submission.id) ?? []).length;
    const resultingPhotoCount = existingPhotoCount + uniquePaths.length;

    if (resultingPhotoCount > submission.max_photo_count_snapshot) {
      return NextResponse.json(
        {
          error: `This SOP accepts at most ${submission.max_photo_count_snapshot} photo(s). ${existingPhotoCount} already attached.`,
        },
        { status: 400 },
      );
    }

    if (submission.requires_photo_snapshot && resultingPhotoCount < submission.min_photo_count_snapshot) {
      return NextResponse.json(
        {
          error: `This SOP requires at least ${submission.min_photo_count_snapshot} photo(s) before it can be submitted.`,
        },
        { status: 400 },
      );
    }

    if (uniquePaths.length > 0) {
      const { error: photoInsertError } = await adminSupabase.from('booking_sop_photos').insert(
        uniquePaths.map((storagePath) => ({
          submission_id: submission.id,
          storage_path: storagePath,
          uploaded_by: user.id,
        })),
      );

      if (photoInsertError) {
        throw photoInsertError;
      }
    }

    const timestamp = getISTTimestamp();
    const { data: updated, error: updateError } = await adminSupabase
      .from('booking_sop_submissions')
      .update({
        status: 'submitted',
        submitted_at: timestamp,
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
      })
      .eq('id', submission.id)
      .select(
        'id, booking_id, provider_id, sop_id, title_snapshot, instructions_snapshot, requires_photo_snapshot, min_photo_count_snapshot, max_photo_count_snapshot, mandatory_snapshot, sort_order_snapshot, sop_version, status, submitted_at, reviewed_by, reviewed_at, review_note, waived_by, waived_at, waive_reason, created_at, updated_at',
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    const photosMap = await getBookingSopPhotosForSubmissions(adminSupabase, [submission.id]);
    const photoRows = photosMap.get(submission.id) ?? [];

    const signedUrlByPath = new Map<string, string>();
    await Promise.all(
      photoRows.map(async (photo) => {
        const { data } = await adminSupabase.storage.from('sop-photos').createSignedUrl(photo.storage_path, 3600);
        if (data?.signedUrl) {
          signedUrlByPath.set(photo.storage_path, data.signedUrl);
        }
      }),
    );

    return NextResponse.json({
      submission: updated,
      photos: photoRows.map((photo) => ({
        id: photo.id,
        storage_path: photo.storage_path,
        signed_url: signedUrlByPath.get(photo.storage_path) ?? null,
        created_at: photo.created_at,
      })),
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to submit SOP photos');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
