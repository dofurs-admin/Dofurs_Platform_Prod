import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createPet } from '@/lib/pets/service';
import { AGGRESSION_LEVELS, PET_GENDERS } from '@/lib/pets/types';
import { notifyPetAdded } from '@/lib/notifications/service';
import { MAX_PET_AGE_YEARS } from '@/lib/utils/date';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
};

const noHtmlChars = (value: string) => !/<|>|&lt;|&gt;|javascript:/i.test(value);

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

const quickPetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine(noHtmlChars, { message: 'Pet name must not contain HTML or script characters' }),
  breed: z.string().trim().max(120).nullable().optional(),
  age: z.number().int().min(0).max(MAX_PET_AGE_YEARS).nullable().optional(),
  gender: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(PET_GENDERS).nullable().optional(),
    ),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { supabase, user, role } = auth.context;
  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:user-pets:create', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = quickPetSchema.safeParse(payload);

  if (!parsedBody.success) {
    const flattened = parsedBody.error.flatten();
    const firstFieldError = Object.values(flattened.fieldErrors).flat().find((message) => Boolean(message));
    return NextResponse.json({ error: firstFieldError ?? 'Invalid pet payload', details: flattened }, { status: 400 });
  }

  const targetUserId = parsedQuery.data.userId ?? user.id;

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = targetUserId === user.id ? supabase : getSupabaseAdminClient();

  try {
    const pet = await createPet(client, targetUserId, {
      name: parsedBody.data.name,
      breed: parsedBody.data.breed?.trim() || null,
      age: parsedBody.data.age ?? null,
      weight: null,
      gender: parsedBody.data.gender ?? null,
      allergies: null,
      photo_url: null,
      date_of_birth: null,
      microchip_number: null,
      neutered_spayed: false,
      color: null,
      size_category: null,
      energy_level: null,
      aggression_level: null as (typeof AGGRESSION_LEVELS)[number] | null,
      is_bite_history: false,
      bite_incidents_count: 0,
      house_trained: false,
      leash_trained: false,
      crate_trained: false,
      social_with_dogs: null,
      social_with_cats: null,
      social_with_children: null,
      separation_anxiety: false,
      has_disability: false,
      disability_details: null,
    });

    const adminClient = getSupabaseAdminClient();
    notifyPetAdded(adminClient, { id: pet.id, name: pet.name, user_id: targetUserId })
      .catch((error) => console.error('Notification hook failed (booking quick pet)', error));

    return NextResponse.json({ success: true, pet });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create pet.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}