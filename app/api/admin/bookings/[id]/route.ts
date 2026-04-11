import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

type ApiSupabaseClient = Awaited<ReturnType<typeof requireApiRole>> extends { context: infer T }
  ? T extends { supabase: infer S }
    ? S
    : never
  : never;

type BookingTransitionEvent = {
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

async function loadBookingTransitionEvents(
  supabase: ApiSupabaseClient,
  bookingId: number,
): Promise<BookingTransitionEvent[]> {
  const currentSchema = await supabase
    .from('booking_status_transition_events')
    .select('from_status, to_status, actor_id, created_at, source, metadata')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (!currentSchema.error) {
    return (currentSchema.data ?? []).map((row) => ({
      old_status: row.from_status ?? null,
      new_status: row.to_status,
      changed_by: row.actor_id ?? null,
      changed_at: row.created_at,
      source: row.source ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    }));
  }

  if (currentSchema.error.code === '42703') {
    const legacySchema = await supabase
      .from('booking_status_transition_events')
      .select('old_status, new_status, changed_by, changed_at, source, metadata')
      .eq('booking_id', bookingId)
      .order('changed_at', { ascending: false });

    if (!legacySchema.error) {
      return (legacySchema.data ?? []) as BookingTransitionEvent[];
    }

    if (legacySchema.error.code === '42P01') {
      return [];
    }

    throw legacySchema.error;
  }

  if (currentSchema.error.code === '42P01') {
    return [];
  }

  throw currentSchema.error;
}

async function loadBookingDetailRow(supabase: ApiSupabaseClient, bookingId: number) {
  const modernSchema = await supabase
    .from('bookings')
    .select(`
      id, user_id, provider_id, booking_start, booking_date, start_time, end_time,
      status, booking_status, booking_mode, service_type,
      location_address, internal_notes,
      amount, discount_amount, final_price, price_at_booking, wallet_credits_applied_inr,
      discount_code, created_at,
      users(name, email, phone, address),
      providers(name, email, phone_number),
      pets(id, name, breed, age, gender, size_category)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (!modernSchema.error) {
    return modernSchema.data;
  }

  if (modernSchema.error.code === '42703') {
    const legacySchema = await supabase
      .from('bookings')
      .select(`
        id, user_id, provider_id, booking_start, booking_date, start_time, end_time,
        status, booking_status, booking_mode, service_type,
        address, pincode, notes,
        subtotal_inr, discount_inr, total_inr, final_price, price_at_booking,
        wallet_credits_applied_inr, discount_code, created_at,
        users(name, email, phone, address),
        providers(name, email, phone),
        pets(id, name, breed, age, gender, size_category)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (!legacySchema.error) {
      return legacySchema.data;
    }

    throw legacySchema.error;
  }

  throw modernSchema.error;
}

function normalizeBookingForAdminModal(booking: Record<string, unknown>) {
  const providers = (booking.providers as Record<string, unknown> | null) ?? null;

  return {
    ...booking,
    address: (booking.address as string | null | undefined) ?? (booking.location_address as string | null | undefined) ?? null,
    pincode: (booking.pincode as string | null | undefined) ?? null,
    notes: (booking.notes as string | null | undefined) ?? (booking.internal_notes as string | null | undefined) ?? null,
    subtotal_inr: (booking.subtotal_inr as number | null | undefined) ?? (booking.price_at_booking as number | null | undefined) ?? null,
    discount_inr: (booking.discount_inr as number | null | undefined) ?? (booking.discount_amount as number | null | undefined) ?? null,
    total_inr:
      (booking.total_inr as number | null | undefined) ??
      (booking.final_price as number | null | undefined) ??
      (booking.amount as number | null | undefined) ??
      null,
    wallet_credits_applied_inr: (booking.wallet_credits_applied_inr as number | null | undefined) ?? null,
    providers: providers
      ? {
          ...providers,
          phone_number: (providers.phone_number as string | null | undefined) ?? (providers.phone as string | null | undefined) ?? null,
        }
      : null,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  let booking: Record<string, unknown> | null = null;

  try {
    booking = (await loadBookingDetailRow(supabase, bookingId)) as Record<string, unknown> | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load booking details';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  let transitionEvents: BookingTransitionEvent[] = [];

  try {
    transitionEvents = await loadBookingTransitionEvents(supabase, bookingId);
  } catch (transitionError) {
    console.error('Failed to load booking transition events', { bookingId, error: transitionError });
  }

  // Fetch linked invoice if any
  const { data: invoices } = await supabase
    .from('billing_invoices')
    .select('id, invoice_number, status, total_inr, wallet_credits_applied_inr, issued_at, paid_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    booking: {
      ...normalizeBookingForAdminModal(booking as Record<string, unknown>),
      booking_status_transition_events: transitionEvents,
    },
    invoices: invoices ?? [],
  });
}
