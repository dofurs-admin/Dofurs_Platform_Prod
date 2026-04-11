import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getActiveSubscriptionForService } from '@/lib/subscriptions/subscriptionService';
import { isServiceTypeMatch } from '@/lib/subscriptions/serviceTypeMatching';

export async function GET(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const { searchParams } = new URL(request.url);
  const serviceType = searchParams.get('serviceType')?.trim() ?? '';

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

  const active = await getActiveSubscriptionForService(supabase, user.id, serviceType);

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
