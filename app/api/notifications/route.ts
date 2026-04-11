import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { listNotifications, markAllNotificationsRead } from '@/lib/notifications/service';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET(request: Request) {
  const { user } = await getApiAuthContext();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 50);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

  try {
    const admin = getSupabaseAdminClient();
    const result = await listNotifications(admin, user.id, { limit, offset, unreadOnly });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load notifications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user } = await getApiAuthContext();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);

  if (body?.action === 'mark_all_read') {
    try {
      const admin = getSupabaseAdminClient();
      await markAllNotificationsRead(admin, user.id);
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark notifications read';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
