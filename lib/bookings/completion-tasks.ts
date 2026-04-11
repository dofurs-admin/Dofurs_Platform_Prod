import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingCompletionTaskStatus = 'pending' | 'completed';

export type BookingCompletionTask = {
  id: string;
  booking_id: number;
  provider_id: number;
  due_at: string;
  task_status: BookingCompletionTaskStatus;
  prompted_at: string | null;
  completed_at: string | null;
  feedback_text: string | null;
};

function getBookingEndDateTime(bookingDate: string, endTime: string) {
  const normalizedTime = endTime.length === 5 ? `${endTime}:00` : endTime;
  const value = `${bookingDate}T${normalizedTime}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function ensureProviderCompletionTasks(supabase: SupabaseClient, providerId: number) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: candidateBookings, error: candidateError } = await supabase
    .from('bookings')
    .select('id, provider_id, booking_date, end_time, booking_status, status')
    .eq('provider_id', providerId)
    .or(`booking_status.eq.confirmed,status.eq.confirmed`)
    .lte('booking_date', today)
    .returns<
      Array<{
        id: number;
        provider_id: number;
        booking_date: string;
        end_time: string;
        booking_status: string | null;
        status: string | null;
      }>
    >();

  if (candidateError) {
    throw candidateError;
  }

  const dueBookings = (candidateBookings ?? []).filter((booking) => {
    const effectiveStatus = booking.booking_status ?? booking.status;

    if (effectiveStatus !== 'confirmed') {
      return false;
    }

    const endDateTime = getBookingEndDateTime(booking.booking_date, booking.end_time);

    if (!endDateTime) {
      return false;
    }

    return endDateTime <= now;
  });

  if (dueBookings.length === 0) {
    return;
  }

  const bookingIds = dueBookings.map((booking) => booking.id);

  const { data: existingTasks, error: taskError } = await supabase
    .from('provider_booking_completion_tasks')
    .select('booking_id')
    .in('booking_id', bookingIds)
    .returns<Array<{ booking_id: number }>>();

  if (taskError) {
    throw taskError;
  }

  const existingBookingIdSet = new Set((existingTasks ?? []).map((item) => item.booking_id));

  const inserts = dueBookings
    .filter((booking) => !existingBookingIdSet.has(booking.id))
    .map((booking) => {
      const endDateTime = getBookingEndDateTime(booking.booking_date, booking.end_time);
      const dueAt = endDateTime ? endDateTime.toISOString() : now.toISOString();

      return {
        booking_id: booking.id,
        provider_id: booking.provider_id,
        due_at: dueAt,
        task_status: 'pending' as const,
        prompted_at: now.toISOString(),
      };
    });

  if (inserts.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('provider_booking_completion_tasks').insert(inserts);

  if (insertError) {
    throw insertError;
  }
}

export async function getCompletionTaskMapForBookings(supabase: SupabaseClient, bookingIds: number[]) {
  if (bookingIds.length === 0) {
    return new Map<number, BookingCompletionTask>();
  }

  const { data, error } = await supabase
    .from('provider_booking_completion_tasks')
    .select('id, booking_id, provider_id, due_at, task_status, prompted_at, completed_at, feedback_text')
    .in('booking_id', bookingIds)
    .returns<BookingCompletionTask[]>();

  if (error) {
    throw error;
  }

  const map = new Map<number, BookingCompletionTask>();

  for (const row of data ?? []) {
    map.set(row.booking_id, row);
  }

  return map;
}

export async function completeProviderBookingCompletionTask(
  supabase: SupabaseClient,
  input: { bookingId: number; providerId: number; feedbackText: string },
) {
  const feedbackText = input.feedbackText.trim();

  const payload = {
    booking_id: input.bookingId,
    provider_id: input.providerId,
    task_status: 'completed' as const,
    completed_at: new Date().toISOString(),
    feedback_text: feedbackText,
    prompted_at: new Date().toISOString(),
    due_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('provider_booking_completion_tasks')
    .upsert(payload, { onConflict: 'booking_id' })
    .select('id, booking_id, provider_id, due_at, task_status, prompted_at, completed_at, feedback_text')
    .single<BookingCompletionTask>();

  if (error) {
    throw error;
  }

  return data;
}
