import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { markMessageRead } from '@/lib/notifications/service';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getApiAuthContext();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const messageId = Number(id);

  if (!Number.isFinite(messageId) || messageId <= 0) {
    return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    await markMessageRead(admin, user.id, messageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark message read';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
