import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { isRateLimited } from '@/lib/api/rate-limit';
import { resolveAbandonedLeadOnBooking } from '@/lib/crm/service';

// Public booking-flow progress telemetry (Phase 3 abandoned-booking detection).
// Unauthenticated by design: session keys are client-generated UUIDs and only
// service-role writes happen here. IP rate-limited, strictly validated.
// When the request carries a valid auth cookie, the logged-in user is attached
// to the session so the sweep can convert abandoned flows into hot leads.

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 60,
};

const progressSchema = z.object({
  sessionKey: z.string().trim().regex(/^[0-9a-zA-Z-]{8,64}$/),
  stage: z.enum(['pet-service', 'datetime', 'review', 'booked']),
  service: z.string().trim().max(120).optional(),
  petCount: z.number().int().min(0).max(20).optional(),
  preferredDate: z.string().trim().max(20).optional(),
  area: z.string().trim().max(120).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  contactEmail: z.string().trim().email().max(200).optional(),
  bookingId: z.number().int().positive().optional(),
});

function getRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

/** Best-effort: resolve the logged-in user from the auth cookie, if any. */
async function resolveOptionalUserId(): Promise<string | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  const rate = await isRateLimited(adminClient, `crm:booking-progress:${getRequestIp(request)}`, RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many updates.' }, { status: 429 });
  }

  const data = parsed.data;
  const userId = await resolveOptionalUserId();

  const { error } = await adminClient.from('crm_booking_sessions').upsert(
    {
      session_key: data.sessionKey,
      stage: data.stage,
      service: data.service || null,
      pet_count: data.petCount ?? null,
      preferred_date: data.preferredDate || null,
      area: data.area || null,
      // Only overwrite contact/identity columns when a value is present, so a
      // later step report never wipes contact info captured earlier.
      ...(data.contactName ? { contact_name: data.contactName } : {}),
      ...(data.contactPhone ? { contact_phone: data.contactPhone } : {}),
      ...(data.contactEmail ? { contact_email: data.contactEmail } : {}),
      ...(userId ? { user_id: userId } : {}),
      ...(data.stage === 'booked' ? { status: 'booked' } : {}),
    },
    { onConflict: 'session_key' },
  );

  if (error) {
    // Telemetry must never surface to the customer — log loudly, return 202.
    console.warn('[crm] Failed to record booking progress:', error.message);
    return NextResponse.json({ success: true }, { status: 202 });
  }

  // A completed booking closes the loop on any abandoned-session hot lead that
  // was already created (e.g. the customer paused past the staleness window).
  // Best-effort: failures are logged and never affect the booking flow.
  if (data.stage === 'booked' && data.bookingId) {
    try {
      await resolveAbandonedLeadOnBooking(adminClient, {
        sessionKey: data.sessionKey,
        bookingId: data.bookingId,
      });
    } catch (resolveError) {
      console.warn(
        '[crm] Failed to resolve abandoned-session lead on booking:',
        resolveError instanceof Error ? resolveError.message : resolveError,
      );
    }
  }

  return NextResponse.json({ success: true }, { status: 202 });
}
