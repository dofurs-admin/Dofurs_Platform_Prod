import type { SupabaseClient } from '@supabase/supabase-js';

export const ACTIVE_BOOKING_ADDON_STATUSES = new Set(['selected', 'confirmed', 'fulfilled']);

type BookingAddonRowWithMaterializedTotal = {
  booking_id: number;
  id: string;
  name_snapshot: string;
  quantity: number;
  total_price_inr: number | null;
  total_price_snapshot: number | null;
  status: string;
};

type BookingAddonRowWithSnapshotTotal = {
  booking_id: number;
  id: string;
  name_snapshot: string;
  quantity: number;
  total_price_snapshot: number | null;
  status: string;
};

export type BookingAddonSummaryRow = {
  booking_id: number;
  id: string;
  name_snapshot: string;
  quantity: number;
  total_price_inr: number;
  total_price_snapshot: number | null;
  status: string;
};

const ADDON_SELECT_WITH_MATERIALIZED_TOTAL =
  'booking_id, id, name_snapshot, quantity, total_price_inr, total_price_snapshot, status';
const ADDON_SELECT_WITH_SNAPSHOT_TOTAL =
  'booking_id, id, name_snapshot, quantity, total_price_snapshot, status';

function getErrorCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function isMissingColumnError(error: unknown) {
  const code = getErrorCode(error);
  return code === '42703' || code === 'PGRST204';
}

function normalizeBookingAddonRow(
  row: BookingAddonRowWithMaterializedTotal | BookingAddonRowWithSnapshotTotal,
): BookingAddonSummaryRow {
  return {
    ...row,
    total_price_inr: Math.max(
      0,
      Number(
        ('total_price_inr' in row ? row.total_price_inr : null) ??
          row.total_price_snapshot ??
          0,
      ),
    ),
    total_price_snapshot: row.total_price_snapshot ?? null,
  };
}

export async function loadBookingAddonRowsByBookingIds(
  supabase: SupabaseClient,
  bookingIds: number[],
): Promise<BookingAddonSummaryRow[]> {
  if (bookingIds.length === 0) {
    return [];
  }

  const bookingIdSet = Array.from(new Set(bookingIds.filter((id) => Number.isFinite(id))));
  if (bookingIdSet.length === 0) {
    return [];
  }

  const primaryResult = await supabase
    .from('booking_addon_items')
    .select(ADDON_SELECT_WITH_MATERIALIZED_TOTAL)
    .in('booking_id', bookingIdSet)
    .order('created_at', { ascending: true })
    .returns<BookingAddonRowWithMaterializedTotal[]>();

  let addonError = primaryResult.error;
  let rows: Array<BookingAddonRowWithMaterializedTotal | BookingAddonRowWithSnapshotTotal> =
    primaryResult.data ?? [];

  if (addonError && isMissingColumnError(addonError)) {
    const fallbackResult = await supabase
      .from('booking_addon_items')
      .select(ADDON_SELECT_WITH_SNAPSHOT_TOTAL)
      .in('booking_id', bookingIdSet)
      .order('created_at', { ascending: true })
      .returns<BookingAddonRowWithSnapshotTotal[]>();

    addonError = fallbackResult.error;
    rows = fallbackResult.data ?? [];
  }

  if (addonError) {
    throw addonError;
  }

  return rows.map(normalizeBookingAddonRow);
}

export function groupBookingAddonRowsByBookingId(rows: BookingAddonSummaryRow[]) {
  const rowsByBookingId = new Map<number, BookingAddonSummaryRow[]>();

  for (const row of rows) {
    const current = rowsByBookingId.get(row.booking_id) ?? [];
    current.push(row);
    rowsByBookingId.set(row.booking_id, current);
  }

  return rowsByBookingId;
}
