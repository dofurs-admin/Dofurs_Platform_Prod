import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getCreditBalance, getCreditHistory } from '@/lib/credits/wallet';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET(request: Request) {
  const { user, supabase, role } = await getApiAuthContext();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get('userId')?.trim() ?? '';
  const canActForUser = role === 'admin' || role === 'staff' || role === 'provider';
  const targetUserId = canActForUser && requestedUserId ? requestedUserId : user.id;
  const readClient = canActForUser && requestedUserId ? getSupabaseAdminClient() : supabase;

  if (canActForUser && requestedUserId && requestedUserId !== user.id) {
    const adminClient = getSupabaseAdminClient();
    const { data: targetUser, error: targetUserError } = await adminClient
      .from('users')
      .select('id, roles(name)')
      .eq('id', requestedUserId)
      .maybeSingle<{ id: string; roles: { name: string } | Array<{ name: string }> | null }>();

    if (targetUserError || !targetUser) {
      return NextResponse.json({ error: 'Selected user could not be verified.' }, { status: 404 });
    }

    const targetRole = (Array.isArray(targetUser.roles) ? targetUser.roles[0] : targetUser.roles)?.name ?? null;
    if (targetRole === 'admin' || targetRole === 'staff' || targetRole === 'provider') {
      return NextResponse.json({ error: 'Only customer accounts are allowed for this flow.' }, { status: 403 });
    }
  }

  try {
    const [balance, history] = await Promise.all([
      getCreditBalance(readClient, targetUserId),
      getCreditHistory(readClient, targetUserId, 20),
    ]);
    return NextResponse.json({ balance, history });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load credit wallet');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
