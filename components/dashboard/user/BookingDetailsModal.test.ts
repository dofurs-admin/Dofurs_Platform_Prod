import { describe, expect, it } from 'vitest';
import { buildBookingPricingSummary, extractBookedServices } from './BookingDetailsModal';
import type { Booking } from './types';

function makeBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: 212,
    booking_start: '2026-04-24T09:00:00.000Z',
    booking_end: '2026-04-24T11:00:00.000Z',
    booking_date: '2026-04-24',
    start_time: '09:00:00',
    end_time: '11:00:00',
    status: 'confirmed',
    booking_status: 'confirmed',
    booking_mode: 'home_visit',
    service_type: 'Summer Bonanza (Offer Package)',
    amount: 2298,
    payment_mode: 'direct_to_provider',
    ...overrides,
  };
}

describe('extractBookedServices', () => {
  it('extracts all bundled service lines from provider notes', () => {
    const booking = makeBooking({
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Summer Bonanza (Offer Package)',
        '2. Pet 81 | Doorstep Pet Grooming (Basic Package)',
      ].join('\n'),
    });

    expect(extractBookedServices(booking)).toEqual([
      'Summer Bonanza (Offer Package)',
      'Doorstep Pet Grooming (Basic Package)',
    ]);
  });

  it('supports simplified numbered lines without pet prefix', () => {
    const booking = makeBooking({
      provider_notes: [
        'Bundled services (2)',
        '1. Summer Bonanza (Offer Package)',
        '2. Doorstep Pet Grooming (Basic Package)',
      ].join('\n'),
    });

    expect(extractBookedServices(booking)).toEqual([
      'Summer Bonanza (Offer Package)',
      'Doorstep Pet Grooming (Basic Package)',
    ]);
  });
});

describe('buildBookingPricingSummary', () => {
  it('builds a full pricing summary with add-ons, discount, and pending payable', () => {
    const booking = makeBooking({
      admin_price_reference: 2200,
      discount_amount: 200,
      discount_code: 'ADMINF200',
      final_price: 2300,
      wallet_credits_applied_inr: 100,
      pending_payable_inr: 400,
    });

    const summary = buildBookingPricingSummary(
      booking,
      ['Summer Bonanza (Offer Package)'],
      [
        {
          id: 'addon-1',
          name_snapshot: 'Nail Clipping',
          quantity: 2,
          unit_price_snapshot: 150,
          total_price_snapshot: 300,
          status: 'selected',
        },
      ],
    );

    expect(summary.serviceSubtotalInr).toBe(2200);
    expect(summary.addonSubtotalInr).toBe(300);
    expect(summary.grossSubtotalInr).toBe(2500);
    expect(summary.discountAmountInr).toBe(200);
    expect(summary.walletCreditsInr).toBe(100);
    expect(summary.finalPriceBeforeWalletInr).toBe(2300);
    expect(summary.netPayableInr).toBe(2200);
    expect(summary.paidOrCollectedInr).toBe(1800);
    expect(summary.pendingPayableInr).toBe(400);
    expect(summary.discountCode).toBe('ADMINF200');
  });

  it('uses bundled service label and keeps a priced bundle row for multi-service bookings', () => {
    const booking = makeBooking({
      admin_price_reference: 2098,
      amount: 0,
      final_price: 1998,
    });

    const summary = buildBookingPricingSummary(
      booking,
      ['Summer Bonanza (Offer Package)', 'Doorstep Pet Grooming (Basic Package)'],
      [],
    );

    expect(summary.isBundledServices).toBe(true);
    expect(summary.serviceLabel).toBe('Bundled services (2)');
    expect(summary.serviceSubtotalInr).toBe(2098);
    expect(summary.serviceLines).toEqual([
      { name: 'Summer Bonanza (Offer Package)' },
      { name: 'Doorstep Pet Grooming (Basic Package)' },
    ]);
  });
});
