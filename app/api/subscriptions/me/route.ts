import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

export async function GET() {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;

  // Lazy expiry sweep: flip any overdue active subscriptions to 'expired'
  await supabase
    .from('user_subscriptions')
    .update({ status: 'expired' })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lt('ends_at', new Date().toISOString());

  const { data: subscriptions, error } = await supabase
    .from('user_subscriptions')
    .select('id, plan_id, status, starts_at, ends_at, created_at, subscription_plans(name, code), user_service_credits(service_type, total_credits, available_credits, consumed_credits)')
    .eq('user_id', user.id)
    .order('ends_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load subscriptions. Please try again.' }, { status: 500 });
  }

  const nowMs = Date.now();
  const sorted = (subscriptions ?? []).slice().sort((left, right) => {
    const leftStarts = left.starts_at ? Date.parse(left.starts_at) : Number.NaN;
    const leftEnds = left.ends_at ? Date.parse(left.ends_at) : Number.NaN;
    const leftActive =
      left.status === 'active' &&
      Number.isFinite(leftStarts) &&
      Number.isFinite(leftEnds) &&
      leftStarts <= nowMs &&
      leftEnds >= nowMs;

    const rightStarts = right.starts_at ? Date.parse(right.starts_at) : Number.NaN;
    const rightEnds = right.ends_at ? Date.parse(right.ends_at) : Number.NaN;
    const rightActive =
      right.status === 'active' &&
      Number.isFinite(rightStarts) &&
      Number.isFinite(rightEnds) &&
      rightStarts <= nowMs &&
      rightEnds >= nowMs;

    if (leftActive !== rightActive) {
      return leftActive ? -1 : 1;
    }

    const leftEndsMs = Number.isFinite(leftEnds) ? leftEnds : -1;
    const rightEndsMs = Number.isFinite(rightEnds) ? rightEnds : -1;
    if (leftEndsMs !== rightEndsMs) {
      return rightEndsMs - leftEndsMs;
    }

    const leftCreated = left.created_at ? Date.parse(left.created_at) : -1;
    const rightCreated = right.created_at ? Date.parse(right.created_at) : -1;
    return rightCreated - leftCreated;
  });

  return NextResponse.json({ subscriptions: sorted });
}
