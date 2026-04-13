import type { SupabaseClient } from '@supabase/supabase-js';
import { isServiceTypeMatch } from '@/lib/subscriptions/serviceTypeMatching';
import { getISTTimestamp } from '@/lib/utils/date';

function nowIso() {
  return getISTTimestamp();
}

function buildEndsAtIso(from: Date, durationDays: number) {
  return new Date(from.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

function isActiveAndCurrent(subscription: { status: string; starts_at: string | null; ends_at: string | null }) {
  const nowMs = Date.now();
  const startsAtMs = subscription.starts_at ? Date.parse(subscription.starts_at) : Number.NaN;
  const endsAtMs = subscription.ends_at ? Date.parse(subscription.ends_at) : Number.NaN;

  return (
    subscription.status === 'active'
    && Number.isFinite(startsAtMs)
    && Number.isFinite(endsAtMs)
    && startsAtMs <= nowMs
    && endsAtMs >= nowMs
  );
}

async function ensureSubscriptionCredits(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  subscriptionId: string,
) {
  const { data: planServices, error: servicesError } = await supabase
    .from('subscription_plan_services')
    .select('service_type, credit_count')
    .eq('plan_id', planId);

  if (servicesError) {
    throw servicesError;
  }

  if ((planServices ?? []).length === 0) {
    return;
  }

  const { data: existingCredits, error: existingCreditsError } = await supabase
    .from('user_service_credits')
    .select('id, service_type')
    .eq('user_subscription_id', subscriptionId);

  if (existingCreditsError) {
    throw existingCreditsError;
  }

  const existingServiceTypes = new Set((existingCredits ?? []).map((row) => row.service_type));

  const missingCredits = (planServices ?? [])
    .filter((service) => !existingServiceTypes.has(service.service_type))
    .map((service) => ({
      user_subscription_id: subscriptionId,
      user_id: userId,
      service_type: service.service_type,
      total_credits: service.credit_count,
      available_credits: service.credit_count,
      consumed_credits: 0,
    }));

  if (missingCredits.length > 0) {
    const { error: creditError } = await supabase.from('user_service_credits').insert(missingCredits);
    if (creditError) {
      throw creditError;
    }
  }
}

export async function getActiveSubscriptionForService(
  supabase: SupabaseClient,
  userId: string,
  serviceType: string,
) {
  const now = nowIso();
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(
      'id, user_id, plan_id, status, starts_at, ends_at, user_service_credits!inner(id, service_type, total_credits, available_credits, consumed_credits)',
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at', { ascending: false });

  if (error) throw error;

  const subscriptions = Array.isArray(data) ? data : [];

  return (
    subscriptions.find((subscription) => {
      const credits = Array.isArray(subscription.user_service_credits)
        ? subscription.user_service_credits
        : [];

      return credits.some((credit) => isServiceTypeMatch(credit.service_type, serviceType));
    })
    ?? null
  );
}

export async function createOrActivateSubscriptionFromPayment(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  paymentTransactionId: string,
) {
  const now = new Date();

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id, duration_days, is_active')
    .eq('id', planId)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    throw planError ?? new Error('Subscription plan not found.');
  }

  const { data: existingSubscription, error: existingSubscriptionError } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, plan_id, status, starts_at, ends_at')
    .eq('payment_transaction_id', paymentTransactionId)
    .maybeSingle();

  if (existingSubscriptionError) {
    throw existingSubscriptionError;
  }

  if (existingSubscription) {
    if (existingSubscription.user_id !== userId || existingSubscription.plan_id !== planId) {
      throw new Error('Subscription payment already linked to another user or plan.');
    }

    if (isActiveAndCurrent(existingSubscription)) {
      await ensureSubscriptionCredits(supabase, userId, planId, existingSubscription.id);
      return existingSubscription;
    }

    const startsAtIso = now.toISOString();
    const endsAtIso = buildEndsAtIso(now, Number(plan.duration_days));

    const { data: reactivated, error: reactivatedError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        activated_at: startsAtIso,
        cancelled_at: null,
        metadata: {
          activation_source: 'payment_reactivation',
        },
      })
      .eq('id', existingSubscription.id)
      .select('id, user_id, plan_id, status, starts_at, ends_at')
      .single();

    if (reactivatedError || !reactivated) {
      throw reactivatedError ?? new Error('Unable to reactivate subscription.');
    }

    await ensureSubscriptionCredits(supabase, userId, planId, reactivated.id);
    return reactivated;
  }

  const startsAt = now;
  const startsAtIso = startsAt.toISOString();
  const endsAtIso = buildEndsAtIso(startsAt, Number(plan.duration_days));

  const { data: subscription, error: subError } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'active',
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      activated_at: startsAtIso,
      payment_transaction_id: paymentTransactionId,
      metadata: {
        activation_source: 'payment_webhook',
      },
    })
    .select('id, user_id, plan_id, status, starts_at, ends_at')
    .single();

  if (subError || !subscription) {
    throw subError ?? new Error('Unable to activate subscription.');
  }

  await ensureSubscriptionCredits(supabase, userId, planId, subscription.id);

  return subscription;
}
