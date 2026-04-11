import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import {
  PET_SHARE_ROLES,
  listPetSharesForOwner,
  upsertPetShareForOwner,
} from '@/lib/pets/share-access';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(PET_SHARE_ROLES).default('viewer'),
});

function parsePetId(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = parsePetId(id);

  if (!petId) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const shares = await listPetSharesForOwner(admin, user.id, petId);
    return NextResponse.json({ shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load pet shares';
    if (message === 'Pet not found') {
      return forbidden();
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = parsePetId(id);

  if (!petId) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid share payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const share = await upsertPetShareForOwner(admin, {
      petId,
      ownerUserId: user.id,
      invitedByUserId: user.id,
      invitedEmail: parsed.data.email,
      role: parsed.data.role,
    });

    const shares = await listPetSharesForOwner(admin, user.id, petId);

    return NextResponse.json({ success: true, share, shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to share pet';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

    if (message === 'Pet not found') {
      return forbidden();
    }

    if (message.includes('own account')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (code === '23505') {
      return NextResponse.json({ error: 'This share already exists or conflicts with another active share.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unable to share pet right now. Please try again.' }, { status: 500 });
  }
}
