import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { addAddress, getUserAddresses } from '@/lib/owner-profile/service';
import { userAddressSchema } from '@/lib/owner-profile/validation';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 40,
};

export async function GET() {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-addresses:get', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  try {
    const addresses = await getUserAddresses(supabase, user.id);
    return NextResponse.json({ addresses });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load addresses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-addresses:post', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = userAddressSchema.safeParse(payload);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const firstFieldError = Object.values(flattened.fieldErrors).flat().find((message) => Boolean(message));
    const errorMessage = firstFieldError ?? parsed.error.issues[0]?.message ?? 'Invalid payload';
    return NextResponse.json({ error: errorMessage, details: flattened }, { status: 400 });
  }

  try {
    const address = await addAddress(supabase, user.id, parsed.data);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.address_added', {
      addressId: address.id,
    });

    return NextResponse.json({ success: true, address });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add address';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
