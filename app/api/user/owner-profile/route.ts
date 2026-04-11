import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { getOwnerProfileAggregate, updateProfile } from '@/lib/owner-profile/service';
import { basicProfileUpdateSchema, householdProfileUpdateSchema } from '@/lib/owner-profile/validation';
import { toFriendlyApiError } from '@/lib/api/errors';

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

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-profile:get', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  try {
    const profile = await getOwnerProfileAggregate(supabase, user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load owner profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: Request) {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-profile:patch', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const basicParsed = basicProfileUpdateSchema.safeParse(payload?.basic ?? {});
  const householdParsed = householdProfileUpdateSchema.safeParse(payload?.household ?? {});

  if (!basicParsed.success || !householdParsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid payload',
        basic: basicParsed.success ? null : basicParsed.error.flatten(),
        household: householdParsed.success ? null : householdParsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = {
    ...basicParsed.data,
    ...householdParsed.data,
  };

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
  }

  try {
    const profile = await updateProfile(supabase, user.id, input);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.updated_by_owner', {
      fields: Object.keys(input),
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update owner profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
