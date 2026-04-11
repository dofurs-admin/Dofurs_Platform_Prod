export type NotificationType =
  | 'booking_created'
  | 'booking_status_changed'
  | 'pet_added'
  | 'message_received'
  | 'referral_welcome_credit'
  | 'referral_reward_credited';

export type NotificationRow = {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type MessageRow = {
  id: number;
  sender_id: string;
  sender_role: 'admin' | 'staff' | 'provider';
  recipient_id: string;
  subject: string | null;
  body: string;
  booking_id: number | null;
  read_at: string | null;
  created_at: string;
};

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type CreateMessageInput = {
  senderId: string;
  senderRole: 'admin' | 'staff' | 'provider';
  recipientId: string;
  subject?: string;
  body: string;
  bookingId?: number;
};
