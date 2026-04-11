import { describe, expect, it } from 'vitest';
import { assertBookingStateTransition, canTransitionBookingState } from './state-transition-guard';

describe('booking state transition guard', () => {
  it('allows only the approved transition paths', () => {
    expect(canTransitionBookingState('pending', 'confirmed')).toBe(true);
    expect(canTransitionBookingState('pending', 'cancelled')).toBe(true);
    expect(canTransitionBookingState('confirmed', 'completed')).toBe(true);
    expect(canTransitionBookingState('confirmed', 'cancelled')).toBe(true);
    expect(canTransitionBookingState('confirmed', 'no_show')).toBe(true);

    expect(canTransitionBookingState('pending', 'completed')).toBe(false);
    expect(canTransitionBookingState('completed', 'confirmed')).toBe(false);
    expect(canTransitionBookingState('cancelled', 'pending')).toBe(false);
  });

  it('rejects no-op transitions explicitly', () => {
    expect(() => assertBookingStateTransition('pending', 'pending')).toThrow('BOOKING_STATUS_NOOP');
  });

  it('rejects illegal transitions', () => {
    expect(() => assertBookingStateTransition('pending', 'no_show')).toThrow('INVALID_BOOKING_TRANSITION');
    expect(() => assertBookingStateTransition('completed', 'cancelled')).toThrow('INVALID_BOOKING_TRANSITION');
  });
});
