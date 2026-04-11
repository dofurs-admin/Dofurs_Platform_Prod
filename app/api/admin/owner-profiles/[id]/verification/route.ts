import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { updateVerificationStatus } from '@/lib/owner-profile/service';
import { adminVerificationUpdateSchema } from '@/lib/owner-profile/validation';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 40,
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, role } = await getApiAuthContext();
  const adminSupabase = getSupabaseAdminClient();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const rate = await isRateLimited(adminSupabase, getRateLimitKey('admin-owner-verification:patch', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = adminVerificationUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided.' }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const profile = await updateVerificationStatus(adminSupabase, id, parsed.data);
    await logOwnerProfileAudit(adminSupabase, id, 'owner_profile.verification_updated_by_admin', {
      fields: Object.keys(parsed.data),
      actorId: user.id,
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update verification status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
