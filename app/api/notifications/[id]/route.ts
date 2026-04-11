import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { markNotificationRead } from '@/lib/notifications/service';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getApiAuthContext();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const notificationId = Number(id);

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    await markNotificationRead(admin, user.id, notificationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification read';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
