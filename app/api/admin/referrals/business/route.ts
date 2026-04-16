import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  buildBusinessReferralSignupLink,
  getBusinessReferralCampaignStats,
  getBusinessReferralCampaignSnapshot,
  upsertBusinessReferralCampaign,
} from '@/lib/referrals/business-campaign';

const businessReferralCampaignUpsertSchema = z.object({
  referral_code: z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9]+$/),
  is_active: z.boolean(),
  reward_inr: z.number().int().positive().max(10000),
  notes: z.string().max(500).optional().nullable(),
});

async function ensureCampaignReferralCode(admin: ReturnType<typeof getSupabaseAdminClient>, userId: string, referralCode: string) {
  const { data: existingCode, error: lookupError } = await admin
    .from('referral_codes')
    .select('user_id')
    .eq('code', referralCode)
    .maybeSingle<{ user_id: string }>();

  if (lookupError) {
    throw lookupError;
  }

  if (existingCode && existingCode.user_id !== userId) {
    throw new Error('Referral code is already assigned to another account. Please choose a different code.');
  }

  const { error: upsertError } = await admin
    .from('referral_codes')
    .upsert(
      {
        user_id: userId,
        code: referralCode,
      },
      { onConflict: 'user_id' },
    );

  if (upsertError) {
    throw upsertError;
  }
}

export async function GET() {
  const { role, user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  try {
    const admin = getSupabaseAdminClient();
    const snapshot = await getBusinessReferralCampaignSnapshot(admin);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load business referral campaign';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { role, user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = businessReferralCampaignUpsertSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const referralCode = parsed.data.referral_code.trim().toUpperCase();

  try {
    const admin = getSupabaseAdminClient();
    await ensureCampaignReferralCode(admin, user.id, referralCode);

    const campaign = await upsertBusinessReferralCampaign(admin, user.id, {
      referral_code: referralCode,
      is_active: parsed.data.is_active,
      referee_reward_inr: parsed.data.reward_inr,
      referrer_reward_inr: parsed.data.reward_inr,
      notes: parsed.data.notes,
    });

    const stats = await getBusinessReferralCampaignStats(admin, campaign);
    const signup_link = buildBusinessReferralSignupLink(campaign.referral_code);

    void logAdminAction({
      adminUserId: user.id,
      action: 'business_referral_campaign.updated',
      entityType: 'business_referral_campaign',
      entityId: campaign.key,
      newValue: {
        referral_code: campaign.referral_code,
        is_active: campaign.is_active,
        reward_inr: campaign.referee_reward_inr,
      },
      request,
    });

    return NextResponse.json({ campaign, stats, signup_link });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update business referral campaign';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
