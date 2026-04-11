import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { authSignupSchema } from '@/lib/flows/validation';
import { isRateLimited } from '@/lib/api/rate-limit';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 5,
};

function getRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const candidate = forwarded.split(',')[0]?.trim();
  return candidate || 'unknown';
}

async function isBackedByAuthUser(admin: ReturnType<typeof getSupabaseAdminClient>, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    // Supabase returns 404-style errors when an auth user does not exist for this ID.
    const message = error.message.toLowerCase();
    if (message.includes('not found') || message.includes('no user')) {
      return false;
    }

    throw error;
  }

  return Boolean(data.user);
}

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();

  const ip = getRequestIp(request);
  const rate = await isRateLimited(admin, `auth:pre-signup:${ip}`, RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = authSignupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid sign-up payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const normalizedPhone = parsed.data.phone.trim();

  const [emailInProfilesResult, phoneInProfilesResult] = await Promise.all([
    admin.from('users').select('id').ilike('email', normalizedEmail).limit(1).maybeSingle(),
    admin.from('users').select('id').eq('phone', normalizedPhone).limit(1).maybeSingle(),
  ]);

  if (emailInProfilesResult.error || phoneInProfilesResult.error) {
    console.error('pre-signup validation failed', {
      emailError: emailInProfilesResult.error?.message,
      phoneError: phoneInProfilesResult.error?.message,
    });
    return NextResponse.json({ error: 'Unable to validate sign-up details right now.' }, { status: 500 });
  }

  const candidateUserIds = [emailInProfilesResult.data?.id, phoneInProfilesResult.data?.id].filter(
    (value): value is string => Boolean(value),
  );

  if (candidateUserIds.length > 0) {
    try {
      const existenceChecks = await Promise.all(candidateUserIds.map((userId) => isBackedByAuthUser(admin, userId)));
      const hasRealExistingAccount = existenceChecks.some(Boolean);

      if (hasRealExistingAccount) {
        return NextResponse.json(
          { error: 'An account with these details already exists. Please log in instead.' },
          { status: 409 },
        );
      }
    } catch (authLookupError) {
      console.error('pre-signup auth existence lookup failed', {
        message: authLookupError instanceof Error ? authLookupError.message : String(authLookupError),
      });
      return NextResponse.json({ error: 'Unable to validate sign-up details right now.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
