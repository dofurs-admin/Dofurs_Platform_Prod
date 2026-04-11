import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { processAdminCancellationAdjustment } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const payloadSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user } = auth.context;
  const writeSupabase = getSupabaseAdminClient();

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const booking = await processAdminCancellationAdjustment(writeSupabase, user.id, bookingId, {
      reason: parsed.data.reason,
      metadata: parsed.data.metadata,
    });

    logSecurityEvent('info', 'admin.action', {
      route: 'api/admin/bookings/[id]/adjustment',
      actorId: user.id,
      actorRole: role,
      targetId: bookingId,
      metadata: {
        action: 'booking_adjustment',
      },
    });

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to process booking adjustment');

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/admin/bookings/[id]/adjustment',
      actorId: user.id,
      actorRole: role,
      targetId: bookingId,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
