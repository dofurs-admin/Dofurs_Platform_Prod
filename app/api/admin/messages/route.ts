import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { sendMessageWithNotification } from '@/lib/notifications/service';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const messageSchema = z.object({
  recipientId: z.string().uuid(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(2000),
  bookingId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user, role } = auth.context;

  const payload = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  // Verify recipient exists
  const admin = getSupabaseAdminClient();
  const { data: recipient } = await admin
    .from('users')
    .select('id')
    .eq('id', parsed.data.recipientId)
    .maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  }

  try {
    const result = await sendMessageWithNotification(admin, {
      senderId: user.id,
      senderRole: role as 'admin' | 'staff',
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
