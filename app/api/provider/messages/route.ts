import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { sendMessageWithNotification } from '@/lib/notifications/service';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { isRateLimited } from '@/lib/api/rate-limit';

const messageSchema = z.object({
  recipientId: z.string().uuid(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(2000),
  bookingId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(['provider']);
  if (auth.response) return auth.response;

  const { user, supabase } = auth.context;

  // Rate limit per user — prevent message spam
  const rate = isRateLimited(`msg:${user.id}`, { windowMs: 3_600_000, maxRequests: 50 });
  if (rate.limited) {
    return NextResponse.json({ error: 'Message rate limit reached. Please try again later.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify provider has a booking relationship with this user
  const providerId = await getProviderIdByUserId(supabase, user.id);
  if (!providerId) {
    return NextResponse.json({ error: 'Provider record not found' }, { status: 403 });
  }

  const { data: hasRelationship } = await admin
    .from('bookings')
    .select('id')
    .eq('provider_id', providerId)
    .eq('user_id', parsed.data.recipientId)
    .limit(1)
    .maybeSingle();

  if (!hasRelationship) {
    return NextResponse.json({ error: 'You can only message pet parents who have booked with you' }, { status: 403 });
  }

  // If bookingId provided, verify it belongs to this provider
  if (parsed.data.bookingId) {
    const { data: booking } = await admin
      .from('bookings')
      .select('id')
      .eq('id', parsed.data.bookingId)
      .eq('provider_id', providerId)
      .eq('user_id', parsed.data.recipientId)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or not associated with this provider and recipient' }, { status: 404 });
    }
  }

  try {
    const result = await sendMessageWithNotification(admin, {
      senderId: user.id,
      senderRole: 'provider',
      recipientId: parsed.data.recipientId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      bookingId: parsed.data.bookingId,
    });

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
