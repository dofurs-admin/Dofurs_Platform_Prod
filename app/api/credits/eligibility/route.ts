import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getActiveSubscriptionForService } from '@/lib/subscriptions/subscriptionService';
import { isServiceTypeMatch } from '@/lib/subscriptions/serviceTypeMatching';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user, role } = auth.context;
  const { searchParams } = new URL(request.url);
  const serviceType = searchParams.get('serviceType')?.trim() ?? '';
  const requestedUserId = searchParams.get('userId')?.trim() ?? '';
  const canActForUser = role === 'admin' || role === 'staff' || role === 'provider';
  const targetUserId = canActForUser && requestedUserId ? requestedUserId : user.id;

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

  if (!serviceType) {
    return NextResponse.json({ error: 'serviceType is required.' }, { status: 400 });
  }

  const normalizedServiceType = serviceType.toLowerCase();
  if (normalizedServiceType.includes('birthday') || normalizedServiceType.includes('boarding')) {
    return NextResponse.json({
      eligible: false,
      subscriptionId: null,
      serviceType,
      matchedCreditServiceType: null,
      availableCredits: 0,
      totalCredits: 0,
      reason: 'Subscription credits are not applicable for birthday or boarding services.',
    });
  }

  const active = await getActiveSubscriptionForService(supabase, targetUserId, serviceType);

  const creditRows = Array.isArray(active?.user_service_credits) ? active.user_service_credits : [];
  const credit = creditRows.find((row) => isServiceTypeMatch(row.service_type, serviceType));

  return NextResponse.json({
    eligible: Boolean(active && credit && credit.available_credits > 0),
    subscriptionId: active?.id ?? null,
    serviceType,
    matchedCreditServiceType: credit?.service_type ?? null,
    availableCredits: credit?.available_credits ?? 0,
    totalCredits: credit?.total_credits ?? 0,
    reason: active ? null : 'No active subscription credit found for this service.',
  });
}
