import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { deleteEmergencyContact, updateEmergencyContact } from '@/lib/owner-profile/service';
import { userEmergencyContactPatchSchema } from '@/lib/owner-profile/validation';

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

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-emergency:patch', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;

  const payload = await request.json().catch(() => null);
  const parsed = userEmergencyContactPatchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided.' }, { status: 400 });
  }

  try {
    const contact = await updateEmergencyContact(supabase, user.id, id, parsed.data);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.emergency_contact_updated', {
      contactId: id,
      fields: Object.keys(parsed.data),
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update emergency contact';
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

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-emergency:delete', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;

  try {
    await deleteEmergencyContact(supabase, user.id, id);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.emergency_contact_deleted', {
      contactId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete emergency contact';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
