import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import {
  PET_SHARE_ROLES,
  listPetSharesForOwner,
  revokePetShareForOwner,
  updatePetShareRoleForOwner,
} from '@/lib/pets/share-access';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const patchSchema = z.object({
  role: z.enum(PET_SHARE_ROLES),
});

function parsePetId(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; shareId: string }> }) {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id, shareId } = await context.params;
  const petId = parsePetId(id);

  if (!petId) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid share update payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const share = await updatePetShareRoleForOwner(admin, {
      petId,
      shareId,
      ownerUserId: user.id,
      role: parsed.data.role,
    });

    const shares = await listPetSharesForOwner(admin, user.id, petId);

    return NextResponse.json({ success: true, share, shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update pet share';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

    if (message === 'Pet not found') {
      return forbidden();
    }

    if (code === '23505') {
      return NextResponse.json({ error: 'This role update conflicts with another active share.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unable to update pet share right now. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; shareId: string }> }) {
  const { user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id, shareId } = await context.params;
  const petId = parsePetId(id);

  if (!petId) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    await revokePetShareForOwner(admin, {
      petId,
      shareId,
      ownerUserId: user.id,
    });

    const shares = await listPetSharesForOwner(admin, user.id, petId);

    return NextResponse.json({ success: true, shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revoke pet share';

    if (message === 'Pet not found') {
      return forbidden();
    }

    return NextResponse.json({ error: 'Unable to revoke pet share right now. Please try again.' }, { status: 500 });
  }
}
