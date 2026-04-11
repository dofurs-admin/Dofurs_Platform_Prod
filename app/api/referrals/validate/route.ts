import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { isRateLimited } from '@/lib/api/rate-limit';
import { resolveReferralCode } from '@/lib/referrals/service';

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };

export async function POST(request: Request) {
  // Rate-limit by IP (header set by Vercel/Render)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const admin = getSupabaseAdminClient();
  const rate = isRateLimited(`referrals:validate:${ip}`, RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ valid: false, message: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  let code: unknown;
  try {
    const body = await request.json();
    code = body?.code;
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid request body.' }, { status: 400 });
  }

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ valid: false, message: 'No referral code provided.' });
  }

  try {
    const resolved = await resolveReferralCode(admin, code as string);
    if (!resolved) {
      return NextResponse.json({ valid: false, message: 'This referral code is not valid.' });
    }
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false, message: 'Could not validate code right now.' }, { status: 500 });
  }
}
