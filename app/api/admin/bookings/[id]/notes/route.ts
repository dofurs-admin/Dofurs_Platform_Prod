import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole, ADMIN_ROLES } from '@/lib/auth/api-auth';

const noteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('booking_admin_notes')
    .select('id, booking_id, admin_user_id, note, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('booking_admin_notes')
    .insert({
      booking_id: bookingId,
      admin_user_id: user.id,
      note: parsed.data.note,
    })
    .select('id, booking_id, admin_user_id, note, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to save note' }, { status: 500 });
  }

  return NextResponse.json({ success: true, note: data });
}
