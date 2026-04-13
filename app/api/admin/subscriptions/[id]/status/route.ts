import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';

const ALLOWED_STATUSES = ['active', 'paused', 'expired', 'cancelled'] as const;
type SubscriptionStatus = (typeof ALLOWED_STATUSES)[number];

// Valid state transitions: terminal states (expired, cancelled) cannot transition
const VALID_TRANSITIONS: Record<string, SubscriptionStatus[]> = {
  pending:   ['active', 'cancelled'],
  active:    ['paused', 'expired', 'cancelled'],
  paused:    ['active', 'cancelled'],
  expired:   [],
  cancelled: [],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const supabase = getSupabaseAdminClient();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === 'string' ? body.status : '';

  if (!ALLOWED_STATUSES.includes(status as SubscriptionStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  // Fetch current subscription to validate transition
  const { data: current, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('id, status, user_id')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 });
  }

  const currentStatus = current.status as string;
  const allowedNext = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowedNext.includes(status as SubscriptionStatus)) {
    return NextResponse.json(
      { error: `Cannot transition subscription from '${currentStatus}' to '${status}'.` },
      { status: 422 },
    );
  }

  const patch: { status: string; ends_at?: string } = { status };
  if (status === 'expired' || status === 'cancelled') {
    patch.ends_at = getISTTimestamp();
  }

  const { data, error } = await supabase
    .from('user_subscriptions')
    .update(patch)
    .eq('id', id)
    .select('id, status, starts_at, ends_at, updated_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Unable to update subscription status.' }, { status: 500 });
  }

  // On cancellation, zero out remaining credits so users cannot continue using them
  if (status === 'cancelled') {
    await supabase
      .from('user_service_credits')
      .update({ available_credits: 0 })
      .eq('user_subscription_id', id);
  }

  void logAdminAction({
    adminUserId: user.id,
    action: 'subscription.status_update',
    entityType: 'subscription',
    entityId: id,
    oldValue: { status: currentStatus },
    newValue: { status },
    request,
  });

  return NextResponse.json({ success: true, subscription: data });
}
