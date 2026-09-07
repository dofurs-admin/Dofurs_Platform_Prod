import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logAdminAction } from '@/lib/admin/audit';
import { getISTTimestamp } from '@/lib/utils/date';

type RouteContext = { params: Promise<{ id: string }> };

const waiveSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

/**
 * Booking-level SOP waiver: stamps the waiver on the booking and waives every
 * pending/rejected submission so the provider no longer needs to fulfil them.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = waiveSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const adminSupabase = getSupabaseAdminClient();
    const timestamp = getISTTimestamp();

    const { data: booking, error: bookingError } = await adminSupabase
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .maybeSingle<{ id: number }>();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const { error: waiverError } = await adminSupabase
      .from('bookings')
      .update({
        sop_completion_waived: true,
        sop_waiver_reason: parsed.data.reason,
        sop_waived_by: user.id,
        sop_waived_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (waiverError) {
      throw waiverError;
    }

    const { data: waivedSubmissions, error: waiveRowsError } = await adminSupabase
      .from('booking_sop_submissions')
      .update({
        status: 'waived',
        waived_by: user.id,
        waived_at: timestamp,
        waive_reason: parsed.data.reason,
      })
      .eq('booking_id', bookingId)
      .in('status', ['pending', 'rejected'])
      .select('id, title_snapshot');

    if (waiveRowsError) {
      throw waiveRowsError;
    }

    void logAdminAction({
      adminUserId: user.id,
      action: 'booking.sop_waive_all',
      entityType: 'booking',
      entityId: String(bookingId),
      newValue: { sop_completion_waived: true },
      metadata: {
        reason: parsed.data.reason,
        waivedCount: waivedSubmissions?.length ?? 0,
        waivedTitles: (waivedSubmissions ?? []).map((row) => row.title_snapshot),
        source: 'api/admin/bookings/[id]/sops/waive',
        at: timestamp,
      },
      request,
    });

    return NextResponse.json({
      sop_completion_waived: true,
      waived_count: waivedSubmissions?.length ?? 0,
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to waive SOP requirements');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
