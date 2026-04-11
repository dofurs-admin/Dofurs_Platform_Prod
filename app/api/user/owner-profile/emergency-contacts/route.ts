import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { logOwnerProfileAudit } from '@/lib/owner-profile/audit';
import { addEmergencyContact, getEmergencyContacts } from '@/lib/owner-profile/service';
import { userEmergencyContactSchema } from '@/lib/owner-profile/validation';

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

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-emergency:get', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  try {
    const contacts = await getEmergencyContacts(supabase, user.id);
    return NextResponse.json({ contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load emergency contacts';
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

  const rate = await isRateLimited(supabase, getRateLimitKey('owner-emergency:post', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = userEmergencyContactSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contact = await addEmergencyContact(supabase, user.id, parsed.data);
    await logOwnerProfileAudit(supabase, user.id, 'owner_profile.emergency_contact_added', {
      contactId: contact.id,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add emergency contact';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
