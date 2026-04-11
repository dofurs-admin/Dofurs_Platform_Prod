import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getReferralCode, getReferralStats } from '@/lib/referrals/service';
import { getCreditBalance } from '@/lib/credits/wallet';

function resolveReferralSiteUrl(): string {
  const fallbackUrl = 'https://dofurs.in';
  const configuredUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').trim();

  if (!configuredUrl) {
    return fallbackUrl;
  }

  try {
    const parsedUrl = new URL(configuredUrl);

    // Social crawlers cannot resolve localhost/private hosts from external clients.
    if (
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname === '::1' ||
      parsedUrl.hostname.endsWith('.local') ||
      /^192\.168\./.test(parsedUrl.hostname) ||
      /^10\./.test(parsedUrl.hostname)
    ) {
      return fallbackUrl;
    }

    if (parsedUrl.hostname === 'dofurs.com' || parsedUrl.hostname === 'www.dofurs.com') {
      parsedUrl.hostname = 'dofurs.in';
      parsedUrl.protocol = 'https:';
    }

    return parsedUrl.origin;
  } catch {
    return fallbackUrl;
  }
}

export async function GET() {
  const { user, supabase } = await getApiAuthContext();
  if (!user) return unauthorized();

  try {
    const [codeData, stats, balance] = await Promise.all([
      getReferralCode(supabase, user.id),
      getReferralStats(supabase, user.id),
      getCreditBalance(supabase, user.id),
    ]);

    const siteUrl = resolveReferralSiteUrl();
    const shareUrl = codeData
      ? `${siteUrl}/auth/sign-in?mode=signup&ref=${codeData.code}`
      : null;

    const whatsappText = codeData
      ? `Hey! I use Dofurs for all my pet's care needs in Bangalore. Use my code *${codeData.code}* when you sign up and get ₹500 Dofurs Credits instantly! I also earn ₹500 when you complete your first booking. 🐾\nSign up here: ${siteUrl}/auth/sign-in?mode=signup&ref=${codeData.code}`
      : null;

    return NextResponse.json({
      code: codeData?.code ?? null,
      shareUrl,
      whatsappText,
      stats,
      creditBalance: balance,
      monthlyRemaining: stats.monthlyRemaining,
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load referral data');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
