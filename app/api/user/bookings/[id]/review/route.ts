import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { customerProviderReviewSchema } from '@/lib/feedback/validation';

type RouteContext = { params: Promise<{ id: string }> };

type BookingReviewRow = {
  id: string;
  provider_id: number;
  booking_id: number | null;
  user_id: string | null;
  rating: number;
  review_text: string | null;
  provider_response: string | null;
  created_at: string;
};

type BookingStatusRow = {
  id: number;
  user_id: string;
  provider_id: number;
  booking_status: string | null;
  status: string | null;
};

function isCompletedStatus(value: string | null | undefined) {
  return value === 'completed';
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(['user']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, provider_id, booking_status, status')
    .eq('id', bookingId)
    .maybeSingle<BookingStatusRow>();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking || booking.user_id !== user.id) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { data: review, error: reviewError } = await supabase
    .from('provider_reviews')
    .select('id, provider_id, booking_id, user_id, rating, review_text, provider_response, created_at')
    .eq('booking_id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle<BookingReviewRow>();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  const effectiveStatus = booking.booking_status ?? booking.status;

  return NextResponse.json({
    canReview: isCompletedStatus(effectiveStatus),
    review: review ?? null,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(['user']);
  if (auth.response) return auth.response;

  const { supabase, user } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = customerProviderReviewSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, provider_id, booking_status, status')
    .eq('id', bookingId)
    .maybeSingle<BookingStatusRow>();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking || booking.user_id !== user.id) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const effectiveStatus = booking.booking_status ?? booking.status;
  if (!isCompletedStatus(effectiveStatus)) {
    return NextResponse.json({ error: 'Review can be submitted only after service completion.' }, { status: 400 });
  }

  const existingReview = await supabase
    .from('provider_reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle<{ id: string }>();

  if (existingReview.error) {
    return NextResponse.json({ error: existingReview.error.message }, { status: 500 });
  }

  if (existingReview.data) {
    return NextResponse.json(
      { error: 'You have already submitted a review for this booking.' },
      { status: 409 },
    );
  }

  const { data: review, error: insertError } = await supabase
    .from('provider_reviews')
    .insert({
      provider_id: booking.provider_id,
      booking_id: bookingId,
      user_id: user.id,
      rating: parsed.data.rating,
      review_text: parsed.data.reviewText?.trim() || null,
    })
    .select('id, provider_id, booking_id, user_id, rating, review_text, provider_response, created_at')
    .single<BookingReviewRow>();

  if (insertError || !review) {
    return NextResponse.json({ error: insertError?.message ?? 'Unable to submit review' }, { status: 500 });
  }

  return NextResponse.json({ success: true, review });
}
