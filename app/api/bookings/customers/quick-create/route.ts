import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createCustomerProfileForBooking, CustomerIntakeError, toFriendlyCreateUserError } from '@/lib/bookings/customer-intake';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
};

const quickCreateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().min(10).max(20),
  noEmailInvite: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { supabase, user } = auth.context;
  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:customers:quick-create', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = quickCreateCustomerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid customer payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();

  try {
    const result = await createCustomerProfileForBooking(adminClient, {
      actorUserId: user.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      noEmailInvite: parsed.data.noEmailInvite ?? true,
      duplicateMode: 'return-existing',
      auditSource: 'booking_orchestrator',
      request,
    });

    return NextResponse.json({
      success: true,
      user: result.user,
      isNewUser: result.isNewUser,
      inviteSent: result.inviteSent,
    });
  } catch (error) {
    if (error instanceof CustomerIntakeError) {
      return NextResponse.json({ error: error.message, existingUser: error.existingUser ?? null }, { status: error.status });
    }

    const mapped = toFriendlyCreateUserError(error instanceof Error ? error.message : 'Customer creation failed');
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}