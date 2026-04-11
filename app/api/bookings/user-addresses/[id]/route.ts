import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { supabase, user, role } = auth.context;

  const { id } = await context.params;

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const targetUserId = parsedQuery.data.userId ?? user.id;

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch (err) { console.error(err);
    return forbidden();
  }

  const client = targetUserId === user.id ? supabase : getSupabaseAdminClient();

  const { data: existingAddress, error: existingAddressError } = await client
    .from('user_addresses')
    .select('id')
    .eq('id', id)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (existingAddressError) {
    return NextResponse.json({ error: 'Unable to validate address.' }, { status: 500 });
  }

  if (!existingAddress) {
    return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
  }

  const { error: deleteError } = await client.from('user_addresses').delete().eq('id', id).eq('user_id', targetUserId);

  if (deleteError) {
    return NextResponse.json({ error: 'Unable to delete address.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
