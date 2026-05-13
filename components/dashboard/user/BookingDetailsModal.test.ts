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
  it('prefers backend included_services when provided', () => {
    const booking = makeBooking({
      service_type: 'Summer Bonanza (Offer Package)',
      provider_notes: null,
      internal_notes: null,
      included_services: [
        'Summer Bonanza (Offer Package)',
        'Doorstep Pet Grooming (Basic Package)',
      ],
    });

    expect(extractBookedServices(booking)).toEqual([
      'Summer Bonanza (Offer Package)',
      'Doorstep Pet Grooming (Basic Package)',
    ]);
  });

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

  it('preserves repeated service lines for bundled quantity bookings', () => {
    const booking = makeBooking({
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Doorstep Pet Grooming (Basic Package)',
        '2. Pet 81 | Doorstep Pet Grooming (Basic Package)',
      ].join('\n'),
    });

    expect(extractBookedServices(booking)).toEqual([
      'Doorstep Pet Grooming (Basic Package)',
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
  it('builds a complete pricing summary with add-ons, discount, wallet credits, and pending payable', () => {
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
          total_price_inr: 300,
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

  it('ignores cancelled add-ons and preserves bundled service labels', () => {
    const booking = makeBooking({
      admin_price_reference: 2098,
      amount: 1998,
      final_price: 1998,
    });

    const summary = buildBookingPricingSummary(
      booking,
      ['Summer Bonanza (Offer Package)', 'Doorstep Pet Grooming (Basic Package)'],
      [
        {
          id: 'addon-2',
          name_snapshot: 'Teeth Cleaning',
          quantity: 1,
          total_price_inr: 250,
          status: 'cancelled',
        },
      ],
    );

    expect(summary.isBundledServices).toBe(true);
    expect(summary.serviceLabel).toBe('Bundled services (2)');
    expect(summary.serviceSubtotalInr).toBe(2098);
    expect(summary.addonSubtotalInr).toBe(0);
    expect(summary.serviceLines).toEqual([
      { name: 'Summer Bonanza (Offer Package)', priceInr: 1199, isEstimated: false },
      { name: 'Doorstep Pet Grooming (Basic Package)', priceInr: 899, isEstimated: false },
    ]);
  });

  it('allocates service line prices when package rates are not directly available', () => {
    const booking = makeBooking({
      admin_price_reference: 1500,
      amount: 1500,
      final_price: 1500,
    });

    const summary = buildBookingPricingSummary(
      booking,
      ['Custom Grooming Plan', 'Seasonal Care Plan'],
      [],
    );

    expect(summary.serviceLines).toEqual([
      { name: 'Custom Grooming Plan', priceInr: 750, isEstimated: true },
      { name: 'Seasonal Care Plan', priceInr: 750, isEstimated: true },
    ]);
  });
});
