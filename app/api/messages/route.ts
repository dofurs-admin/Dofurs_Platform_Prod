import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { listMessages } from '@/lib/notifications/service';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET(request: Request) {
  const { user } = await getApiAuthContext();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 50);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  try {
    const admin = getSupabaseAdminClient();
    const messages = await listMessages(admin, user.id, { limit, offset });
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
