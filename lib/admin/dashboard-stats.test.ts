import { describe, expect, it } from 'vitest';
import { normalizeAdminDashboardBusinessStats } from './dashboard-stats';

describe('normalizeAdminDashboardBusinessStats', () => {
  it('normalizes the dashboard stats RPC payload', () => {
    expect(normalizeAdminDashboardBusinessStats({
      bookingCount: 42,
      bookingRiskSummary: {
        pending: 5,
        inProgress: 12,
        completed: 20,
        noShow: 2,
        cancelled: 8,
      },
      providerCount: 9,
      serviceCount: 14,
      customerCount: 31,
      activeDiscountCount: 3,
    })).toEqual({
      bookingCount: 42,
      bookingRiskSummary: {
        pending: 5,
        inProgress: 12,
        completed: 20,
        noShow: 2,
        cancelled: 8,
      },
      providerCount: 9,
      serviceCount: 14,
      customerCount: 31,
      activeDiscountCount: 3,
    });
  });

  it('normalizes a snake case aggregate row', () => {
    expect(normalizeAdminDashboardBusinessStats({
      booking_count: '10',
      pending_bookings: '2',
      confirmed_bookings: '3',
      completed_bookings: '4',
      no_show_bookings: '1',
      cancelled_bookings: '0',
      provider_count: '6',
      service_count: '7',
      customer_count: '8',
      active_discount_count: '9',
    })).toEqual({
      bookingCount: 10,
      bookingRiskSummary: {
        pending: 2,
        inProgress: 5,
        completed: 4,
        noShow: 1,
        cancelled: 0,
      },
      providerCount: 6,
      serviceCount: 7,
      customerCount: 8,
      activeDiscountCount: 9,
    });
  });

  it('ignores invalid response shapes', () => {
    expect(normalizeAdminDashboardBusinessStats(null)).toBeNull();
    expect(normalizeAdminDashboardBusinessStats({ providerCount: 4 })).toBeNull();
  });
});
