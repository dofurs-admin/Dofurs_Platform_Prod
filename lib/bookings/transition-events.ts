import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingStatus } from './types';

export type BookingStatusTransitionEvent = {
  id: string;
  booking_id: number;
  actor_id: string | null;
  actor_role: string | null;
  from_status: BookingStatus;
  to_status: BookingStatus;
  cancellation_by: 'user' | 'provider' | 'admin' | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  source: string | null;
  created_at: string;
};

export type QueryBookingTransitionEventsInput = {
  bookingId?: number;
  bookingIds?: number[];
  fromStatus?: BookingStatus;
  toStatus?: BookingStatus;
  actorId?: string;
  actorRole?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export async function queryBookingTransitionEvents(
  supabase: SupabaseClient,
  input: QueryBookingTransitionEventsInput,
) {
  let query = supabase
    .from('booking_status_transition_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (input.bookingId) {
    query = query.eq('booking_id', input.bookingId);
  }

  if (input.bookingIds && input.bookingIds.length > 0) {
    query = query.in('booking_id', input.bookingIds);
  }

  if (input.fromStatus) {
    query = query.eq('from_status', input.fromStatus);
  }

  if (input.toStatus) {
    query = query.eq('to_status', input.toStatus);
  }

  if (input.actorId) {
    query = query.eq('actor_id', input.actorId);
  }

  if (input.actorRole) {
    query = query.eq('actor_role', input.actorRole);
  }

  if (input.fromDate) {
    query = query.gte('created_at', input.fromDate);
  }

  if (input.toDate) {
    query = query.lte('created_at', input.toDate);
  }

  if (input.limit && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as BookingStatusTransitionEvent[];
}
