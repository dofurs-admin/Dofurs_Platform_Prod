import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

const createAddressSchema = z.object({
  label: z.enum(['Home', 'Office', 'Other']).optional(),
  addressLine1: z.string().trim().min(5).max(500),
  addressLine2: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/).optional(),
  country: z.string().trim().max(120).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  phone: z.string().trim().regex(/^\+91\d{10}$/).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { supabase, user, role } = auth.context;

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = createAddressSchema.safeParse(body);

  if (!parsedBody.success) {
    const flattened = parsedBody.error.flatten();
    const firstFieldError = Object.values(flattened.fieldErrors).flat().find((message) => Boolean(message));
    const errorMessage = firstFieldError ?? parsedBody.error.issues[0]?.message ?? 'Invalid address payload';
    return NextResponse.json({ error: errorMessage, details: flattened }, { status: 400 });
  }

  const targetUserId = parsedQuery.data.userId ?? user.id;

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch (err) { console.error(err);
    return forbidden();
  }

  const client = targetUserId === user.id ? supabase : getSupabaseAdminClient();

  const { data, error } = await client
    .from('user_addresses')
    .insert({
      user_id: targetUserId,
      label: parsedBody.data.label ?? 'Other',
      address_line_1: parsedBody.data.addressLine1,
      address_line_2: parsedBody.data.addressLine2?.trim() || null,
      city: parsedBody.data.city?.trim() || '',
      state: parsedBody.data.state?.trim() || '',
      pincode: parsedBody.data.pincode?.trim() || '',
      country: parsedBody.data.country?.trim() || 'India',
      latitude: parsedBody.data.latitude,
      longitude: parsedBody.data.longitude,
      phone: parsedBody.data.phone ?? null,
      is_default: false,
    })
    .select('id, label, address_line_1, address_line_2, city, state, pincode, country, latitude, longitude, phone, is_default')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Unable to save address.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, address: data });
}
