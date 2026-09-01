import { describe, expect, it } from 'vitest';
import {
  BOOKING_EXPORT_COLUMN_GROUPS,
  BOOKING_EXPORT_COLUMN_KEYS,
  BOOKING_EXPORT_PRESETS,
  DEFAULT_BOOKING_EXPORT_COLUMN_KEYS,
  buildBookingExportRows,
  getBookingExportPresetColumnKeys,
  loadPersistedBookingExportColumnKeys,
  normalizeBookingExportColumnKeys,
  resolveBookingExportColumns,
  toggleBookingExportColumn,
  toggleBookingExportGroup,
} from './bookingsExport';
import type { BookingExportBooking, BookingExportPresetKey } from './bookingsExport';

function makeBooking(overrides?: Partial<BookingExportBooking>): BookingExportBooking {
  return {
    id: 101,
    user_id: 'user-1',
    provider_id: 7,
    booking_start: '2026-04-10T10:00:00Z',
    booking_date: '2026-04-10',
    start_time: '10:00',
    end_time: '11:00',
    status: 'pending',
    booking_status: 'confirmed',
    booking_mode: 'home_visit',
    service_type: 'grooming',
    included_services: ['grooming'],
    customer_name: 'Alice',
    customer_email: 'alice@example.com',
    customer_phone: '+919876543210',
    provider_name: 'Bob Groomer',
    admin_price_reference: 1500,
    price_at_booking: 1299,
    payment_mode: 'direct_to_provider',
    cash_collected: true,
    collected_amount_inr: 1299,
    location_address: '12 Koramangala 5th Block, Bengaluru',
    latitude: 12.9352,
    longitude: 77.6245,
    pincode: '560095',
    city: 'Bengaluru',
    pet_names: 'Simba',
    pet_breed: 'Labrador',
    discount_code: 'WELCOME10',
    discount_amount: 129.9,
    wallet_credits_applied_inr: 50,
    amount: 1299,
    final_price: 1119.1,
    created_at: '2026-04-01T10:00:00.000Z',
    cancellation_reason: null,
    ...overrides,
  };
}

describe('booking export column registry', () => {
  it('has unique column keys and groups that cover every column exactly once', () => {
    expect(new Set(BOOKING_EXPORT_COLUMN_KEYS).size).toBe(BOOKING_EXPORT_COLUMN_KEYS.length);

    const groupColumnKeys = BOOKING_EXPORT_COLUMN_GROUPS.flatMap((group) =>
      group.columns.map((column) => column.key),
    );

    expect([...groupColumnKeys].sort()).toEqual([...BOOKING_EXPORT_COLUMN_KEYS].sort());
  });

  it('never exposes internal or provider notes as export columns', () => {
    const columnKeyStrings = BOOKING_EXPORT_COLUMN_KEYS.map((key) => String(key));
    const columnLabels = BOOKING_EXPORT_COLUMN_GROUPS.flatMap((group) =>
      group.columns.map((column) => column.label.toLowerCase()),
    );

    expect(columnKeyStrings).not.toContain('internal_notes');
    expect(columnKeyStrings).not.toContain('provider_notes');
    expect(columnLabels.some((label) => label.includes('note'))).toBe(false);
  });

  it('uses the corrected collected amount label', () => {
    const collectedAmountColumn = BOOKING_EXPORT_COLUMN_KEYS.includes('collected_amount');
    expect(collectedAmountColumn).toBe(true);

    const label = resolveBookingExportColumns(['collected_amount'])[0]?.label;
    expect(label).toBe('Collected Amount (INR)');
  });
});

describe('booking export presets', () => {
  it('defines presets that only reference valid column keys', () => {
    const validKeys = new Set(BOOKING_EXPORT_COLUMN_KEYS);

    for (const preset of BOOKING_EXPORT_PRESETS) {
      expect(preset.columnKeys.length).toBeGreaterThan(0);

      for (const key of preset.columnKeys) {
        expect(validKeys.has(key)).toBe(true);
      }
    }
  });

  it('resolves the all preset to every column and falls back to standard for unknown keys', () => {
    expect(getBookingExportPresetColumnKeys('all')).toEqual([...BOOKING_EXPORT_COLUMN_KEYS]);
    expect(getBookingExportPresetColumnKeys('not-a-preset' as BookingExportPresetKey)).toEqual([
      ...DEFAULT_BOOKING_EXPORT_COLUMN_KEYS,
    ]);
  });

  it('resolves the default selection in registry order', () => {
    const columns = resolveBookingExportColumns(DEFAULT_BOOKING_EXPORT_COLUMN_KEYS);

    expect(columns.map((column) => column.key)).toEqual([...DEFAULT_BOOKING_EXPORT_COLUMN_KEYS]);
    expect(columns.map((column) => column.label)).toEqual([
      'ID',
      'Status',
      'Service',
      'Mode',
      'Date',
      'Start time',
      'End time',
      'Customer',
      'Phone',
      'Provider',
      'Price at booking (INR)',
      'Admin price reference (INR)',
      'Payment mode',
      'Cash collected',
      'Collected Amount (INR)',
      'Payment status',
    ]);
  });
});

describe('buildBookingExportRows', () => {
  it('builds headers and row values from the selected columns (registry order)', () => {
    const columns = resolveBookingExportColumns([
      'final_price',
      'customer_name',
      'cash_collected',
      'booking_id',
      'status',
      'collected_amount',
    ]);

    const { headers, rows } = buildBookingExportRows([makeBooking()], columns);

    expect(headers).toEqual([
      'ID',
      'Status',
      'Customer',
      'Cash collected',
      'Collected Amount (INR)',
      'Final price (INR)',
    ]);
    expect(rows).toEqual([[101, 'confirmed', 'Alice', 'yes', '1299.00', '1119.10']]);
  });

  it('marks cash columns as n/a and blank for non-cash payment modes', () => {
    const booking = makeBooking({
      payment_mode: 'platform',
      cash_collected: false,
      collected_amount_inr: null,
    });
    const columns = resolveBookingExportColumns(['payment_mode', 'cash_collected', 'collected_amount', 'payment_status']);

    const { rows } = buildBookingExportRows([booking], columns);

    expect(rows[0]).toEqual(['platform', 'n/a', '', 'non_cash']);
  });

  it('renders empty values for bookings without hydrated fields', () => {
    const booking = makeBooking({
      location_address: undefined,
      pincode: null,
      pet_names: undefined,
      final_price: null,
      created_at: undefined,
    });
    const columns = resolveBookingExportColumns(['location_address', 'pincode', 'pet_names', 'final_price', 'created_at']);

    const { rows } = buildBookingExportRows([booking], columns);

    expect(rows[0]).toEqual(['', '', '', '', '']);
  });

  it('resolves the service label from included services', () => {
    const booking = makeBooking({ included_services: ['Bath', 'Haircut'] });
    const columns = resolveBookingExportColumns(['service']);

    const { rows } = buildBookingExportRows([booking], columns);

    expect(rows[0]).toEqual(['Bundled services (2)']);
  });

  it('prefers booking status over legacy status', () => {
    const booking = makeBooking({ status: 'pending', booking_status: 'completed' });
    const columns = resolveBookingExportColumns(['status']);

    const { rows } = buildBookingExportRows([booking], columns);

    expect(rows[0]).toEqual(['completed']);
  });
});

describe('booking export column selection', () => {
  it('toggles individual columns on and off', () => {
    expect(toggleBookingExportColumn(['status'], 'pincode')).toEqual(['status', 'pincode']);
    expect(toggleBookingExportColumn(['status', 'pincode'], 'status')).toEqual(['pincode']);
  });

  it('toggles whole groups on and off', () => {
    const withLocation = toggleBookingExportGroup([], 'location');

    expect(withLocation).toEqual(['location_address', 'city', 'pincode', 'latitude', 'longitude']);
    expect(toggleBookingExportGroup(withLocation, 'location')).toEqual([]);
  });

  it('drops unknown and duplicate keys when normalizing persisted selections', () => {
    expect(normalizeBookingExportColumnKeys(['status', 'status', 'not-a-column', 'pincode'])).toEqual([
      'status',
      'pincode',
    ]);
    expect(normalizeBookingExportColumnKeys('garbage')).toEqual([]);
    expect(normalizeBookingExportColumnKeys(null)).toEqual([]);
  });

  it('returns null for persisted keys when localStorage is unavailable', () => {
    expect(loadPersistedBookingExportColumnKeys()).toBeNull();
  });
});