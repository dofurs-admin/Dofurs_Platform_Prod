import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';

const blockSchema = z.object({
  providerId: z.number().int().positive(),
  blockStart: z.string().datetime({ offset: true }),
  blockEnd: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const { supabase, role } = await getApiAuthContext();

  if (!role) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = blockSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (new Date(parsed.data.blockEnd) <= new Date(parsed.data.blockStart)) {
    return NextResponse.json({ error: 'blockEnd must be after blockStart' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('provider_blocks')
    .insert({
      provider_id: parsed.data.providerId,
      block_start: parsed.data.blockStart,
      block_end: parsed.data.blockEnd,
      note: parsed.data.note ?? null,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, block: data });
}
