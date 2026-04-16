import { NextResponse } from 'next/server';
import { buildBusinessReferralSignupLink, getBusinessReferralCampaign } from '@/lib/referrals/business-campaign';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET() {
  try {
    const admin = getSupabaseAdminClient();
    const campaign = await getBusinessReferralCampaign(admin);

    if (!campaign || !campaign.is_active) {
      return NextResponse.json({ signup_link: null, referral_code: null, is_active: false });
    }

    return NextResponse.json({
      signup_link: buildBusinessReferralSignupLink(campaign.referral_code),
      referral_code: campaign.referral_code,
      is_active: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load business signup link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
