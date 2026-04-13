import type { SupabaseClient } from '@supabase/supabase-js';
import { getISTTimestamp } from '@/lib/utils/date';
import type {
  CreateMessageInput,
  CreateNotificationInput,
  MessageRow,
  NotificationRow,
} from './types';

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// Max notifications returned per page (hard ceiling to prevent heavy reads)
const MAX_PAGE_SIZE = 50;

// Dedup window — skip insert if an identical (user, type, data) row exists within this interval
const DEDUP_WINDOW_MINUTES = 5;

export async function createNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput,
): Promise<NotificationRow | null> {
  // Lightweight deduplication: skip if an identical notification was created recently
  const deduplicationData = input.data ?? {};
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .eq('type', input.type)
    .containedBy('data', deduplicationData)
    .contains('data', deduplicationData)
    .gte('created_at', new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60_000).toISOString());

  if (count && count > 0) return null; // duplicate — skip silently

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: deduplicationData,
    })
    .select('id, user_id, type, title, body, data, read_at, created_at')
    .single<NotificationRow>();

  if (error) throw error;
  return data;
}

export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
): Promise<{ notifications: NotificationRow[]; unreadCount: number }> {
  const limit = Math.min(options.limit ?? 30, MAX_PAGE_SIZE);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from('notifications')
    .select('id, user_id, type, title, body, data, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query.returns<NotificationRow[]>();
  if (error) throw error;

  // Get unread count
  const { count, error: countError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (countError) throw countError;

  return {
    notifications: data ?? [],
    unreadCount: count ?? 0,
  };
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: number,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: getISTTimestamp() })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: getISTTimestamp() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function createMessage(
  supabase: SupabaseClient,
  input: CreateMessageInput,
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: input.senderId,
      sender_role: input.senderRole,
      recipient_id: input.recipientId,
      subject: input.subject ?? null,
      body: input.body,
      booking_id: input.bookingId ?? null,
    })
    .select('id, sender_id, sender_role, recipient_id, subject, body, booking_id, read_at, created_at')
    .single<MessageRow>();

  if (error) throw error;
  return data;
}

export async function sendMessageWithNotification(
  supabase: SupabaseClient,
  input: CreateMessageInput,
): Promise<{ message: MessageRow; notification: NotificationRow | null }> {
  const message = await createMessage(supabase, input);

  const roleLabel = input.senderRole === 'provider' ? 'Service Provider' : 'Dofurs Team';

  const notification = await createNotification(supabase, {
    userId: input.recipientId,
    type: 'message_received',
    title: `New message from ${roleLabel}`,
    body: input.subject || input.body.slice(0, 120),
    data: {
      message_id: message.id,
      sender_role: input.senderRole,
      booking_id: input.bookingId ?? null,
    },
  });

  return { message, notification };
}

export async function listMessages(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<MessageRow[]> {
  const limit = options.limit ?? 30;
  const offset = options.offset ?? 0;

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, sender_role, recipient_id, subject, body, booking_id, read_at, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<MessageRow[]>();

  if (error) throw error;
  return data ?? [];
}

export async function markMessageRead(
  supabase: SupabaseClient,
  userId: string,
  messageId: number,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: getISTTimestamp() })
    .eq('id', messageId)
    .eq('recipient_id', userId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Notification trigger helpers (called from API routes)
// ---------------------------------------------------------------------------

export async function notifyBookingCreated(
  supabase: SupabaseClient,
  booking: {
    id: number;
    user_id: string;
    provider_id: number;
    service_type: string | null;
    booking_date: string;
  },
): Promise<void> {
  const serviceLabel = booking.service_type
    ? booking.service_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Service';

  // Notify the user
  await createNotification(supabase, {
    userId: booking.user_id,
    type: 'booking_created',
    title: 'Booking Request Submitted',
    body: `Your ${serviceLabel} booking for ${booking.booking_date} has been submitted and is pending confirmation.`,
    data: { booking_id: booking.id, service_type: booking.service_type },
  });

  // Notify the provider (look up user_id from provider)
  const { data: provider } = await supabase
    .from('providers')
    .select('user_id')
    .eq('id', booking.provider_id)
    .single<{ user_id: string }>();

  if (provider) {
    await createNotification(supabase, {
      userId: provider.user_id,
      type: 'booking_created',
      title: 'New Booking Request',
      body: `You have a new ${serviceLabel} booking request for ${booking.booking_date}. Please review and confirm.`,
      data: { booking_id: booking.id, service_type: booking.service_type },
    });
  }
}

export async function notifyBookingStatusChanged(
  supabase: SupabaseClient,
  booking: {
    id: number;
    user_id: string;
    provider_id: number;
    service_type: string | null;
    booking_date?: string;
  },
  previousStatus: string,
  newStatus: string,
  changedBy: 'user' | 'provider' | 'admin' | 'staff',
): Promise<void> {
  const serviceLabel = booking.service_type
    ? booking.service_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Booking';

  const statusMessages: Record<string, { userTitle: string; userBody: string; providerTitle?: string; providerBody?: string }> = {
    confirmed: {
      userTitle: 'Booking Confirmed!',
      userBody: `Your ${serviceLabel} booking has been confirmed by the service provider.`,
      providerTitle: 'Booking Confirmed',
      providerBody: `You confirmed the ${serviceLabel} booking.`,
    },
    completed: {
      userTitle: 'Session Completed',
      userBody: `Your ${serviceLabel} session has been completed. We hope your pet had a great time!`,
      providerTitle: 'Session Completed',
      providerBody: `${serviceLabel} session marked as completed.`,
    },
    cancelled: {
      userTitle: 'Booking Cancelled',
      userBody: changedBy === 'user'
        ? `Your ${serviceLabel} booking has been cancelled.`
        : `Your ${serviceLabel} booking has been cancelled by the ${changedBy === 'provider' ? 'service provider' : 'admin'}.`,
      providerTitle: 'Booking Cancelled',
      providerBody: changedBy === 'provider'
        ? `You cancelled the ${serviceLabel} booking.`
        : `The ${serviceLabel} booking was cancelled by the ${changedBy}.`,
    },
    no_show: {
      userTitle: 'Missed Appointment',
      userBody: `You were marked as a no-show for your ${serviceLabel} booking.`,
    },
  };

  const msg = statusMessages[newStatus];
  if (!msg) return;

  // Notify the user
  await createNotification(supabase, {
    userId: booking.user_id,
    type: 'booking_status_changed',
    title: msg.userTitle,
    body: msg.userBody,
    data: {
      booking_id: booking.id,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: changedBy,
    },
  });

  // Notify the provider (unless they made the change themselves)
  if (msg.providerTitle && changedBy !== 'provider') {
    const { data: provider } = await supabase
      .from('providers')
      .select('user_id')
      .eq('id', booking.provider_id)
      .single<{ user_id: string }>();

    if (provider) {
      await createNotification(supabase, {
        userId: provider.user_id,
        type: 'booking_status_changed',
        title: msg.providerTitle,
        body: msg.providerBody!,
        data: {
          booking_id: booking.id,
          previous_status: previousStatus,
          new_status: newStatus,
          changed_by: changedBy,
        },
      });
    }
  }
}

export async function notifyPetAdded(
  supabase: SupabaseClient,
  pet: { id: number; name: string; user_id: string },
): Promise<void> {
  await createNotification(supabase, {
    userId: pet.user_id,
    type: 'pet_added',
    title: 'New Pet Profile Added',
    body: `${pet.name}'s profile has been added to your account. You can now book services for ${pet.name}.`,
    data: { pet_id: pet.id, pet_name: pet.name },
  });
}
