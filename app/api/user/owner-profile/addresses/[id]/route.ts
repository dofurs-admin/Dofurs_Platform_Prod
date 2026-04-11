import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { deleteAddress, updateAddress } from '@/lib/owner-profile/service';
import { userAddressPatchSchema } from '@/lib/owner-profile/validation';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 40,
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-addresses:patch', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;

  const payload = await request.json().catch(() => null);
  const parsed = userAddressPatchSchema.safeParse(payload);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const firstFieldError = Object.values(flattened.fieldErrors).flat().find((message) => Boolean(message));
    const errorMessage = firstFieldError ?? parsed.error.issues[0]?.message ?? 'Invalid payload';
    return NextResponse.json({ error: errorMessage, details: flattened }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided.' }, { status: 400 });
  }

  try {
    const address = await updateAddress(supabase, user.id, id, parsed.data);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.address_updated', {
      addressId: id,
      fields: Object.keys(parsed.data),
    });

    return NextResponse.json({ success: true, address });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update address';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-addresses:delete', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;

  try {
    await deleteAddress(supabase, user.id, id);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.address_deleted', {
      addressId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete address';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
