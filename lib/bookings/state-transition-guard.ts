import type { BookingStatus } from './types';
import { createStateGuard } from '@/lib/utils/stateGuard';

export const BOOKING_STATE_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: ['cancelled'],
};

const bookingStateGuard = createStateGuard(BOOKING_STATE_TRANSITIONS, { allowSameState: false });

export type BookingActorRole = 'user' | 'provider' | 'admin' | 'staff';

export const ROLE_ALLOWED_BOOKING_STATUSES: Record<BookingActorRole, BookingStatus[]> = {
  user: ['cancelled'],
  provider: ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
  admin: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
  staff: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
};

export function canTransitionBookingState(current: BookingStatus, next: BookingStatus) {
  return bookingStateGuard.canTransition(current, next);
}

export function assertBookingStateTransition(current: BookingStatus, next: BookingStatus) {
  if (current === next) {
    throw new Error(`BOOKING_STATUS_NOOP:${current}`);
  }

  bookingStateGuard.assertTransition(current, next, 'INVALID_BOOKING_TRANSITION');
}

export function assertRoleCanSetBookingStatus(role: BookingActorRole, next: BookingStatus) {
  if (!ROLE_ALLOWED_BOOKING_STATUSES[role].includes(next)) {
    throw new Error(`ROLE_TRANSITION_FORBIDDEN:${role}->${next}`);
  }
}

export function assertRoleCanCreateBookingForUser(role: BookingActorRole, actorUserId: string, targetUserId: string) {
  if (actorUserId === targetUserId) {
    return;
  }

  if (role !== 'admin' && role !== 'staff' && role !== 'provider') {
    throw new Error(`ROLE_CREATE_FORBIDDEN:${role}`);
  }
}
