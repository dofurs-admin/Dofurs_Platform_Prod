import type { SupabaseClient } from '@supabase/supabase-js';

export const BUSINESS_REFERRAL_CAMPAIGN_KEY = 'welcome_offer';
export const DEFAULT_BUSINESS_REFERRAL_CODE = 'DOFMQS68G';
export const DEFAULT_BUSINESS_REFEREE_REWARD_INR = 500;
export const DEFAULT_BUSINESS_REFERRER_REWARD_INR = 500;

export type BusinessReferralCampaign = {
  key: string;
  referral_code: string;
  is_active: boolean;
  referee_reward_inr: number;
  referrer_reward_inr: number;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessReferralCampaignStats = {
  total_signups: number;
  pending_first_booking: number;
  credited_referrer_rewards: number;
  referee_credits_issued_inr: number;
  referrer_credits_issued_inr: number;
  total_credits_issued_inr: number;
  last_redemption_at: string | null;
};

export type BusinessReferralCampaignSnapshot = {
  campaign: BusinessReferralCampaign;
  stats: BusinessReferralCampaignStats;
  signup_link: string;
};

type BusinessReferralCampaignUpsertInput = {
  referral_code: string;
  is_active: boolean;
  referee_reward_inr: number;
  referrer_reward_inr: number;
  notes?: string | null;
};

export function normalizeReferralCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function buildBusinessReferralSignupLink(referralCode: string): string {
  const code = encodeURIComponent(normalizeReferralCode(referralCode));
  return `/auth/sign-in?mode=signup&ref=${code}`;
}

export async function getBusinessReferralCampaign(
  supabase: SupabaseClient,
): Promise<BusinessReferralCampaign | null> {
  const { data, error } = await supabase
    .from('business_referral_campaigns')
    .select('*')
    .eq('key', BUSINESS_REFERRAL_CAMPAIGN_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as BusinessReferralCampaign | null) ?? null;
}

export async function getActiveBusinessReferralCampaignByCode(
  supabase: SupabaseClient,
  rawCode: string,
): Promise<BusinessReferralCampaign | null> {
  const code = normalizeReferralCode(rawCode);
  const { data, error } = await supabase
    .from('business_referral_campaigns')
    .select('*')
    .eq('key', BUSINESS_REFERRAL_CAMPAIGN_KEY)
    .eq('referral_code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as BusinessReferralCampaign | null) ?? null;
}

export async function upsertBusinessReferralCampaign(
  supabase: SupabaseClient,
  updatedByUserId: string,
  input: BusinessReferralCampaignUpsertInput,
): Promise<BusinessReferralCampaign> {
  const { data, error } = await supabase
    .from('business_referral_campaigns')
    .upsert(
      {
        key: BUSINESS_REFERRAL_CAMPAIGN_KEY,
        referral_code: normalizeReferralCode(input.referral_code),
        is_active: input.is_active,
        referee_reward_inr: input.referee_reward_inr,
        referrer_reward_inr: input.referrer_reward_inr,
        notes: input.notes?.trim() || null,
        updated_by: updatedByUserId,
      },
      { onConflict: 'key' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as BusinessReferralCampaign;
}

export async function getBusinessReferralCampaignStats(
  supabase: SupabaseClient,
  campaign: Pick<BusinessReferralCampaign, 'referral_code' | 'referee_reward_inr' | 'referrer_reward_inr'>,
): Promise<BusinessReferralCampaignStats> {
  const { data, error } = await supabase
    .from('referral_redemptions')
    .select('status, created_at, referee_reward_inr, referrer_reward_inr')
    .eq('referral_code', normalizeReferralCode(campaign.referral_code))
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows =
    (data as Array<{
      status: string;
      created_at: string;
      referee_reward_inr: number | null;
      referrer_reward_inr: number | null;
    }>) ?? [];

  const pendingFirstBooking = rows.filter((row) => row.status === 'pending_first_booking').length;
  const creditedReferrerRewards = rows.filter((row) => row.status === 'credited').length;
  const refereeCreditsIssuedInr = rows.reduce(
    (sum, row) => sum + (row.referee_reward_inr ?? campaign.referee_reward_inr),
    0,
  );
  const referrerCreditsIssuedInr = rows
    .filter((row) => row.status === 'credited')
    .reduce((sum, row) => sum + (row.referrer_reward_inr ?? campaign.referrer_reward_inr), 0);

  return {
    total_signups: rows.length,
    pending_first_booking: pendingFirstBooking,
    credited_referrer_rewards: creditedReferrerRewards,
    referee_credits_issued_inr: refereeCreditsIssuedInr,
    referrer_credits_issued_inr: referrerCreditsIssuedInr,
    total_credits_issued_inr: refereeCreditsIssuedInr + referrerCreditsIssuedInr,
    last_redemption_at: rows[0]?.created_at ?? null,
  };
}

export async function getBusinessReferralCampaignSnapshot(
  supabase: SupabaseClient,
): Promise<BusinessReferralCampaignSnapshot> {
  const now = new Date().toISOString();
  const campaign =
    (await getBusinessReferralCampaign(supabase)) ?? {
      key: BUSINESS_REFERRAL_CAMPAIGN_KEY,
      referral_code: DEFAULT_BUSINESS_REFERRAL_CODE,
      is_active: false,
      referee_reward_inr: DEFAULT_BUSINESS_REFEREE_REWARD_INR,
      referrer_reward_inr: DEFAULT_BUSINESS_REFERRER_REWARD_INR,
      notes: null,
      updated_by: null,
      created_at: now,
      updated_at: now,
    };

  const stats = await getBusinessReferralCampaignStats(supabase, campaign);

  return {
    campaign,
    stats,
    signup_link: buildBusinessReferralSignupLink(campaign.referral_code),
  };
}