/**
 * Column registry for the admin bookings CSV export.
 *
 * The export picker in AdminBookingsView renders these groups/columns and the
 * export itself is built from the same registry, so the table and the CSV stay
 * in sync.
 *
 * Deliberately excluded from export: `internal_notes` and `provider_notes`
 * (internal/sensitive operational data). Please keep it that way unless there
 * is an explicit compliance reason to change it.
 */

import { buildIncludedServicesLabel } from '@/lib/bookings/included-services';

export type BookingExportBooking = {
  id: number;
  user_id?: string | null;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  booking_status?: string | null;
  booking_mode?: string | null;
  service_type?: string | null;
  included_services?: ReadonlyArray<string | null | undefined> | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
  admin_price_reference?: number | null;
  price_at_booking?: number | null;
  payment_mode?: string | null;
  cash_collected?: boolean;
  collected_amount_inr?: number | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
  city?: string | null;
  pet_names?: string | null;
  pet_breed?: string | null;
  discount_code?: string | null;
  discount_amount?: number | null;
  wallet_credits_applied_inr?: number | null;
  amount?: number | null;
  final_price?: number | null;
  created_at?: string | null;
  cancellation_reason?: string | null;
};

export function formatAmountForExport(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return Number(value).toFixed(2);
}

export function formatPaymentModeForExport(value: string | null | undefined): string {
  if (!value) {
    return 'unknown';
  }

  return value.replace(/_/g, ' ');
}

export function resolvePaymentStatusForExport(
  booking: Pick<BookingExportBooking, 'payment_mode' | 'cash_collected'>,
): string {
  const mode = booking.payment_mode ?? null;
  const isCashCollectionMode = mode === 'direct_to_provider' || mode === 'mixed' || mode === 'cash';

  if (isCashCollectionMode) {
    return booking.cash_collected ? 'cash_collected' : 'cash_pending';
  }

  if (!mode) {
    return 'unknown';
  }

  return 'non_cash';
}

export function resolveBookingServiceLabel(
  booking: Pick<BookingExportBooking, 'included_services' | 'service_type'>,
): string {
  return buildIncludedServicesLabel(
    (booking.included_services ?? []).filter((value): value is string => typeof value === 'string'),
    booking.service_type,
  );
}

function isCashCollectionMode(booking: Pick<BookingExportBooking, 'payment_mode'>) {
  const mode = booking.payment_mode ?? null;
  return mode === 'direct_to_provider' || mode === 'mixed' || mode === 'cash';
}

function formatCoordinateForExport(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return String(Number(value));
}

function formatTimestampForExport(value: string | null | undefined): string {
  return value ?? '';
}

export type BookingExportColumnKey =
  | 'booking_id'
  | 'status'
  | 'service'
  | 'mode'
  | 'date'
  | 'start_time'
  | 'end_time'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_email'
  | 'customer_id'
  | 'provider_name'
  | 'provider_id'
  | 'price_at_booking'
  | 'admin_price_reference'
  | 'payment_mode'
  | 'cash_collected'
  | 'collected_amount'
  | 'payment_status'
  | 'amount'
  | 'discount_code'
  | 'discount_amount'
  | 'wallet_credits'
  | 'final_price'
  | 'location_address'
  | 'city'
  | 'pincode'
  | 'latitude'
  | 'longitude'
  | 'pet_names'
  | 'pet_breed'
  | 'created_at'
  | 'cancellation_reason';

export type BookingExportGroupId =
  | 'booking'
  | 'schedule'
  | 'customer'
  | 'provider'
  | 'payment'
  | 'location'
  | 'pet'
  | 'extras';

export type BookingExportColumn = {
  key: BookingExportColumnKey;
  label: string;
  group: BookingExportGroupId;
  getValue: (booking: BookingExportBooking) => string | number | null | undefined;
};

const BOOKING_EXPORT_COLUMNS: ReadonlyArray<BookingExportColumn> = [
  {
    key: 'booking_id',
    label: 'ID',
    group: 'booking',
    getValue: (booking) => booking.id,
  },
  {
    key: 'status',
    label: 'Status',
    group: 'booking',
    getValue: (booking) => booking.booking_status ?? booking.status,
  },
  {
    key: 'service',
    label: 'Service',
    group: 'booking',
    getValue: (booking) => resolveBookingServiceLabel(booking),
  },
  {
    key: 'mode',
    label: 'Mode',
    group: 'booking',
    getValue: (booking) => booking.booking_mode ?? '',
  },
  {
    key: 'date',
    label: 'Date',
    group: 'schedule',
    getValue: (booking) => booking.booking_date ?? booking.booking_start,
  },
  {
    key: 'start_time',
    label: 'Start time',
    group: 'schedule',
    getValue: (booking) => booking.start_time ?? '',
  },
  {
    key: 'end_time',
    label: 'End time',
    group: 'schedule',
    getValue: (booking) => booking.end_time ?? '',
  },
  {
    key: 'customer_name',
    label: 'Customer',
    group: 'customer',
    getValue: (booking) => booking.customer_name ?? booking.user_id ?? '',
  },
  {
    key: 'customer_phone',
    label: 'Phone',
    group: 'customer',
    getValue: (booking) => booking.customer_phone ?? '',
  },
  {
    key: 'customer_email',
    label: 'Email',
    group: 'customer',
    getValue: (booking) => booking.customer_email ?? '',
  },
  {
    key: 'customer_id',
    label: 'Customer ID',
    group: 'customer',
    getValue: (booking) => booking.user_id ?? '',
  },
  {
    key: 'provider_name',
    label: 'Provider',
    group: 'provider',
    getValue: (booking) => booking.provider_name ?? booking.provider_id,
  },
  {
    key: 'provider_id',
    label: 'Provider ID',
    group: 'provider',
    getValue: (booking) => booking.provider_id,
  },
  {
    key: 'price_at_booking',
    label: 'Price at booking (INR)',
    group: 'payment',
    getValue: (booking) => formatAmountForExport(booking.price_at_booking),
  },
  {
    key: 'admin_price_reference',
    label: 'Admin price reference (INR)',
    group: 'payment',
    getValue: (booking) => formatAmountForExport(booking.admin_price_reference),
  },
  {
    key: 'payment_mode',
    label: 'Payment mode',
    group: 'payment',
    getValue: (booking) => formatPaymentModeForExport(booking.payment_mode),
  },
  {
    key: 'cash_collected',
    label: 'Cash collected',
    group: 'payment',
    getValue: (booking) => (isCashCollectionMode(booking) ? (booking.cash_collected ? 'yes' : 'no') : 'n/a'),
  },
  {
    key: 'collected_amount',
    label: 'Collected Amount (INR)',
    group: 'payment',
    getValue: (booking) => (isCashCollectionMode(booking) ? formatAmountForExport(booking.collected_amount_inr) : ''),
  },
  {
    key: 'payment_status',
    label: 'Payment status',
    group: 'payment',
    getValue: (booking) => resolvePaymentStatusForExport(booking),
  },
  {
    key: 'amount',
    label: 'Amount (INR)',
    group: 'payment',
    getValue: (booking) => formatAmountForExport(booking.amount),
  },
  {
    key: 'discount_code',
    label: 'Discount code',
    group: 'payment',
    getValue: (booking) => booking.discount_code ?? '',
  },
  {
    key: 'discount_amount',
    label: 'Discount amount (INR)',
    group: 'payment',
    getValue: (booking) => formatAmountForExport(booking.discount_amount),
  },
  {
    key: 'wallet_credits',
    label: 'Wallet credits (INR)',
    group: 'payment',
    getValue: (booking) => formatAmountForExport(booking.wallet_credits_applied_inr),
  },
  {
    key: 'final_price',
    label: 'Final price (INR)',
    group: 'payment',
    getValue: (booking) => formatAmountForExport(booking.final_price),
  },
  {
    key: 'location_address',
    label: 'Address',
    group: 'location',
    getValue: (booking) => booking.location_address ?? '',
  },
  {
    key: 'city',
    label: 'City',
    group: 'location',
    getValue: (booking) => booking.city ?? '',
  },
  {
    key: 'pincode',
    label: 'Pincode',
    group: 'location',
    getValue: (booking) => booking.pincode ?? '',
  },
  {
    key: 'latitude',
    label: 'Latitude',
    group: 'location',
    getValue: (booking) => formatCoordinateForExport(booking.latitude),
  },
  {
    key: 'longitude',
    label: 'Longitude',
    group: 'location',
    getValue: (booking) => formatCoordinateForExport(booking.longitude),
  },
  {
    key: 'pet_names',
    label: 'Pet name(s)',
    group: 'pet',
    getValue: (booking) => booking.pet_names ?? '',
  },
  {
    key: 'pet_breed',
    label: 'Pet breed',
    group: 'pet',
    getValue: (booking) => booking.pet_breed ?? '',
  },
  {
    key: 'created_at',
    label: 'Created at',
    group: 'extras',
    getValue: (booking) => formatTimestampForExport(booking.created_at),
  },
  {
    key: 'cancellation_reason',
    label: 'Cancellation reason',
    group: 'extras',
    getValue: (booking) => booking.cancellation_reason ?? '',
  },
];

export type BookingExportColumnGroup = {
  id: BookingExportGroupId;
  label: string;
  columns: ReadonlyArray<BookingExportColumn>;
};

export const BOOKING_EXPORT_COLUMN_GROUPS: ReadonlyArray<BookingExportColumnGroup> = [
  { id: 'booking', label: 'Booking', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'booking') },
  { id: 'schedule', label: 'Schedule', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'schedule') },
  { id: 'customer', label: 'Customer', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'customer') },
  { id: 'provider', label: 'Provider', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'provider') },
  { id: 'payment', label: 'Payment', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'payment') },
  { id: 'location', label: 'Location', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'location') },
  { id: 'pet', label: 'Pet', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'pet') },
  { id: 'extras', label: 'Extras', columns: BOOKING_EXPORT_COLUMNS.filter((column) => column.group === 'extras') },
];

export const BOOKING_EXPORT_COLUMN_KEYS: ReadonlyArray<BookingExportColumnKey> =
  BOOKING_EXPORT_COLUMNS.map((column) => column.key);

const VALID_BOOKING_EXPORT_COLUMN_KEYS = new Set<string>(BOOKING_EXPORT_COLUMN_KEYS);

export type BookingExportPresetKey = 'standard' | 'finance' | 'field_ops' | 'all';

export type BookingExportPreset = {
  key: BookingExportPresetKey;
  label: string;
  description: string;
  columnKeys: ReadonlyArray<BookingExportColumnKey>;
};

export const BOOKING_EXPORT_PRESETS: ReadonlyArray<BookingExportPreset> = [
  {
    key: 'standard',
    label: 'Standard',
    description: "Today's default columns plus start/end time",
    columnKeys: [
      'booking_id',
      'status',
      'service',
      'mode',
      'date',
      'start_time',
      'end_time',
      'customer_name',
      'customer_phone',
      'provider_name',
      'price_at_booking',
      'admin_price_reference',
      'payment_mode',
      'cash_collected',
      'collected_amount',
      'payment_status',
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'Payment, discount, credits, and collection tracking',
    columnKeys: [
      'booking_id',
      'date',
      'customer_name',
      'customer_phone',
      'status',
      'price_at_booking',
      'admin_price_reference',
      'amount',
      'discount_code',
      'discount_amount',
      'wallet_credits',
      'final_price',
      'payment_mode',
      'cash_collected',
      'collected_amount',
      'payment_status',
    ],
  },
  {
    key: 'field_ops',
    label: 'Field Ops',
    description: 'Schedule, location, pet, and contact details',
    columnKeys: [
      'booking_id',
      'date',
      'start_time',
      'end_time',
      'status',
      'service',
      'mode',
      'customer_name',
      'customer_phone',
      'provider_name',
      'location_address',
      'city',
      'pincode',
      'latitude',
      'longitude',
      'pet_names',
      'pet_breed',
    ],
  },
  {
    key: 'all',
    label: 'All columns',
    description: 'Every exportable column',
    columnKeys: BOOKING_EXPORT_COLUMN_KEYS,
  },
];

export const DEFAULT_BOOKING_EXPORT_COLUMN_KEYS: ReadonlyArray<BookingExportColumnKey> =
  BOOKING_EXPORT_PRESETS[0].columnKeys;

export const BOOKING_EXPORT_STORAGE_KEY = 'admin-bookings-export-columns';

/** Filters unknown/duplicate keys so persisted selections stay forward-compatible. */
export function normalizeBookingExportColumnKeys(raw: unknown): BookingExportColumnKey[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: BookingExportColumnKey[] = [];

  for (const value of raw) {
    if (typeof value === 'string' && VALID_BOOKING_EXPORT_COLUMN_KEYS.has(value)) {
      const key = value as BookingExportColumnKey;
      if (!normalized.includes(key)) {
        normalized.push(key);
      }
    }
  }

  return normalized;
}

/** Returns the persisted column selection, or null when nothing is stored. */
export function loadPersistedBookingExportColumnKeys(): BookingExportColumnKey[] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BOOKING_EXPORT_STORAGE_KEY);
    if (raw == null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeBookingExportColumnKeys(parsed) : null;
  } catch {
    return null;
  }
}

export function persistBookingExportColumnKeys(keys: ReadonlyArray<BookingExportColumnKey>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(BOOKING_EXPORT_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Ignore storage failures (private mode/quota) — the export selection just won't persist.
  }
}

export function getBookingExportPresetColumnKeys(presetKey: BookingExportPresetKey): BookingExportColumnKey[] {
  const preset = BOOKING_EXPORT_PRESETS.find((candidate) => candidate.key === presetKey);
  return preset ? [...preset.columnKeys] : [...DEFAULT_BOOKING_EXPORT_COLUMN_KEYS];
}

/** Resolves selected keys into registry-ordered columns for rendering/export. */
export function resolveBookingExportColumns(selectedKeys: ReadonlyArray<string>): ReadonlyArray<BookingExportColumn> {
  const selected = new Set(selectedKeys);
  return BOOKING_EXPORT_COLUMNS.filter((column) => selected.has(column.key));
}

export function toggleBookingExportColumn(
  selectedKeys: ReadonlyArray<BookingExportColumnKey>,
  columnKey: BookingExportColumnKey,
): BookingExportColumnKey[] {
  return selectedKeys.includes(columnKey)
    ? selectedKeys.filter((key) => key !== columnKey)
    : [...selectedKeys, columnKey];
}

export function toggleBookingExportGroup(
  selectedKeys: ReadonlyArray<BookingExportColumnKey>,
  groupId: BookingExportGroupId,
): BookingExportColumnKey[] {
  const group = BOOKING_EXPORT_COLUMN_GROUPS.find((candidate) => candidate.id === groupId);
  const groupKeys = group?.columns.map((column) => column.key) ?? [];
  const allSelected = groupKeys.length > 0 && groupKeys.every((key) => selectedKeys.includes(key));

  if (allSelected) {
    const removedKeys = new Set(groupKeys);
    return selectedKeys.filter((key) => !removedKeys.has(key));
  }

  return [...selectedKeys, ...groupKeys.filter((key) => !selectedKeys.includes(key))];
}

export function buildBookingExportRows(
  bookings: ReadonlyArray<BookingExportBooking>,
  columns: ReadonlyArray<BookingExportColumn>,
): {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
} {
  return {
    headers: columns.map((column) => column.label),
    rows: bookings.map((booking) => columns.map((column) => column.getValue(booking))),
  };
}