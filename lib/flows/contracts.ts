export const FLOW_NAMES = [
  'pet_onboarding',
  'owner_onboarding',
  'provider_onboarding',
  'service_discovery',
  'booking',
  'reschedule_cancel',
  'review',
  'admin_moderation',
  'provider_dashboard',
] as const;

export type FlowName = (typeof FLOW_NAMES)[number];

export type FlowState = 'idle' | 'collecting' | 'validating' | 'ready' | 'submitting' | 'success' | 'error';

export const DEFAULT_FLOW_TRANSITIONS: Record<FlowState, FlowState[]> = {
  idle: ['collecting', 'error'],
  collecting: ['validating', 'error'],
  validating: ['collecting', 'ready', 'error'],
  ready: ['submitting', 'collecting', 'error'],
  submitting: ['success', 'error'],
  success: ['idle', 'collecting'],
  error: ['collecting', 'validating', 'idle'],
};

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const ROLE_BOOKING_TARGET_STATUSES: Record<'user' | 'provider' | 'admin' | 'staff', BookingStatus[]> = {
  user: ['cancelled'],
  provider: ['confirmed', 'completed', 'cancelled', 'no_show'],
  admin: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
  staff: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
};
