import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { customerServiceFeedbackSchema } from '@/lib/feedback/validation';

type RouteContext = { params: Promise<{ id: string }> };

type BookingStatusRow = {
  id: number;
  user_id: string;
  provider_id: number;
  booking_status: string | null;
  status: string | null;
};

type CustomerFeedbackRow = {
  id: string;
  booking_id: number;
  user_id: string;
  provider_id: number;
  rating: number;
  notes: string | null;
  created_by_user_id: string;
  created_by_role: 'provider' | 'admin' | 'staff';
  created_at: string;
  updated_at: string;
};

function isCompletedStatus(value: string | null | undefined) {
  return value === 'completed';
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const adminSupabase = getSupabaseAdminClient();
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, user_id, provider_id, booking_status, status')
    .eq('id', bookingId)
    .maybeSingle<BookingStatusRow>();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { data: feedback, error: feedbackError } = await adminSupabase
    .from('customer_service_feedback')
    .select('id, booking_id, user_id, provider_id, rating, notes, created_by_user_id, created_by_role, created_at, updated_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .returns<CustomerFeedbackRow[]>();

  if (feedbackError) {
    return NextResponse.json({ error: feedbackError.message }, { status: 500 });
  }

  return NextResponse.json({
    canSubmit: isCompletedStatus(booking.booking_status ?? booking.status),
    feedback: feedback ?? [],
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user, role } = auth.context;
  const adminSupabase = getSupabaseAdminClient();

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = customerServiceFeedbackSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, user_id, provider_id, booking_status, status')
    .eq('id', bookingId)
    .maybeSingle<BookingStatusRow>();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (!isCompletedStatus(booking.booking_status ?? booking.status)) {
    return NextResponse.json(
      { error: 'Customer feedback can be added only after booking completion.' },
      { status: 400 },
    );
  }

  const actorRole: 'admin' | 'staff' = role === 'staff' ? 'staff' : 'admin';

  const { data: feedback, error: feedbackError } = await adminSupabase
    .from('customer_service_feedback')
    .upsert(
      {
        booking_id: bookingId,
        user_id: booking.user_id,
        provider_id: booking.provider_id,
        rating: parsed.data.rating,
        notes: parsed.data.notes?.trim() || null,
        created_by_user_id: user.id,
        created_by_role: actorRole,
      },
      { onConflict: 'booking_id,created_by_user_id,created_by_role' },
    )
    .select('id, booking_id, user_id, provider_id, rating, notes, created_by_user_id, created_by_role, created_at, updated_at')
    .single<CustomerFeedbackRow>();

  if (feedbackError || !feedback) {
    return NextResponse.json({ error: feedbackError?.message ?? 'Unable to save customer feedback' }, { status: 500 });
  }

  return NextResponse.json({ success: true, feedback });
}
