import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { getPreferences, upsertPreferences } from '@/lib/owner-profile/service';
import { userPreferencesSchema } from '@/lib/owner-profile/validation';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

export async function GET() {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-preferences:get', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  try {
    const preferences = await getPreferences(supabase, user.id);
    return NextResponse.json({ preferences });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-preferences:put', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = userPreferencesSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const preferences = await upsertPreferences(supabase, user.id, parsed.data);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.preferences_updated', {
      fields: Object.keys(parsed.data),
    });

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
