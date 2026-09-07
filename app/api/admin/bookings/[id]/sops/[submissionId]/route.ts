import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logAdminAction } from '@/lib/admin/audit';
import { getISTTimestamp } from '@/lib/utils/date';

type RouteContext = { params: Promise<{ id: string; submissionId: string }> };

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'waive']),
  note: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user } = auth.context;
  const { id, submissionId } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0 || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json({ error: 'Invalid booking or SOP id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const adminSupabase = getSupabaseAdminClient();

    const { data: submission, error } = await adminSupabase
      .from('booking_sop_submissions')
      .select('id, booking_id, status, title_snapshot')
      .eq('id', submissionId)
      .eq('booking_id', bookingId)
      .maybeSingle<{
        id: string;
        booking_id: number;
        status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'waived';
        title_snapshot: string;
      }>();

    if (error) {
      throw error;
    }

    if (!submission) {
      return NextResponse.json({ error: 'SOP submission not found for this booking' }, { status: 404 });
    }

    const timestamp = getISTTimestamp();
    const updatePayload: Record<string, unknown> = {};

    if (parsed.data.action === 'approve') {
      if (submission.status !== 'submitted') {
        return NextResponse.json({ error: 'Only submitted SOPs can be approved.' }, { status: 409 });
      }
      updatePayload.status = 'approved';
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = timestamp;
      updatePayload.review_note = parsed.data.note?.trim() || null;
    } else if (parsed.data.action === 'reject') {
      if (submission.status !== 'submitted' && submission.status !== 'approved') {
        return NextResponse.json({ error: 'Only submitted or approved SOPs can be rejected.' }, { status: 409 });
      }
      if (!parsed.data.note?.trim()) {
        return NextResponse.json({ error: 'A rejection note is required so the provider can fix it.' }, { status: 400 });
      }
      updatePayload.status = 'rejected';
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = timestamp;
      updatePayload.review_note = parsed.data.note.trim();
    } else {
      if (submission.status === 'waived') {
        return NextResponse.json({ error: 'This SOP is already waived.' }, { status: 409 });
      }
      if (!parsed.data.reason?.trim()) {
        return NextResponse.json({ error: 'A waive reason is required for the audit trail.' }, { status: 400 });
      }
      updatePayload.status = 'waived';
      updatePayload.waived_by = user.id;
      updatePayload.waived_at = timestamp;
      updatePayload.waive_reason = parsed.data.reason.trim();
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from('booking_sop_submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .select(
        'id, booking_id, provider_id, sop_id, title_snapshot, instructions_snapshot, requires_photo_snapshot, min_photo_count_snapshot, max_photo_count_snapshot, mandatory_snapshot, sort_order_snapshot, sop_version, status, submitted_at, reviewed_by, reviewed_at, review_note, waived_by, waived_at, waive_reason, created_at, updated_at',
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    void logAdminAction({
      adminUserId: user.id,
      action: `booking.sop_${parsed.data.action}`,
      entityType: 'booking_sop_submission',
      entityId: submissionId,
      oldValue: { status: submission.status },
      newValue: { status: updated.status },
      metadata: {
        bookingId,
        sopTitle: submission.title_snapshot,
        note: parsed.data.note ?? null,
        reason: parsed.data.reason ?? null,
        source: 'api/admin/bookings/[id]/sops/[submissionId]',
        at: timestamp,
      },
      request,
    });

    return NextResponse.json({ submission: updated });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update SOP submission');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
