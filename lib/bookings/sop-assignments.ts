import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingSopSubmissionStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'waived';

/** Submission states that satisfy the completion gate. */
export const SOP_FULFILLED_STATUSES: readonly BookingSopSubmissionStatus[] = ['submitted', 'approved', 'waived'];

/** Bookings in these statuses receive SOP submissions when first viewed. */
const SOP_ASSIGNABLE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'in_progress']);

export type BookingSopSubmissionRow = {
  id: string;
  booking_id: number;
  provider_id: number;
  sop_id: string;
  title_snapshot: string;
  instructions_snapshot: string | null;
  requires_photo_snapshot: boolean;
  min_photo_count_snapshot: number;
  max_photo_count_snapshot: number;
  mandatory_snapshot: boolean;
  sort_order_snapshot: number;
  sop_version: number;
  status: BookingSopSubmissionStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  waived_by: string | null;
  waived_at: string | null;
  waive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingSopPhotoRow = {
  id: string;
  submission_id: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type UnfulfilledSopSummary = {
  id: string;
  title: string;
};

export class SopRequirementsPendingError extends Error {
  readonly missingSops: UnfulfilledSopSummary[];

  constructor(missingSops: UnfulfilledSopSummary[]) {
    super(`SOP_REQUIREMENTS_PENDING:${missingSops.map((sop) => sop.title).join(', ')}`);
    this.name = 'SopRequirementsPendingError';
    this.missingSops = missingSops;
  }
}

/**
 * The SOP tables ship in migration 103. Code may deploy before the migration
 * lands, so SOP reads degrade to "no SOPs" instead of breaking booking flows.
 */
function isSopRelationMissingError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String((error as { message?: unknown }).message ?? '');
  const normalized = message.toLowerCase();

  return (
    code === '42P01' ||
    (normalized.includes('provider_sops') && normalized.includes('exist')) ||
    (normalized.includes('booking_sop_submissions') && normalized.includes('exist'))
  );
}

function normalizeBookingIds(bookingIds: number[]) {
  return Array.from(new Set(bookingIds.filter((id) => Number.isFinite(id) && id > 0)));
}

const SOP_SUBMISSION_SELECT =
  'id, booking_id, provider_id, sop_id, title_snapshot, instructions_snapshot, requires_photo_snapshot, min_photo_count_snapshot, max_photo_count_snapshot, mandatory_snapshot, sort_order_snapshot, sop_version, status, submitted_at, reviewed_by, reviewed_at, review_note, waived_by, waived_at, waive_reason, created_at, updated_at';

/**
 * Lazily assigns active SOPs to bookings that do not have submissions yet.
 * Snapshots the SOP definition at assignment time so later catalog edits never
 * mutate the requirements of in-flight or historical orders.
 */
export async function ensureBookingSopSubmissions(supabase: SupabaseClient, bookingIds: number[]) {
  const ids = normalizeBookingIds(bookingIds);
  if (ids.length === 0) {
    return;
  }

  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id, provider_id, service_type, booking_status, status')
    .in('id', ids)
    .returns<
      Array<{
        id: number;
        provider_id: number;
        service_type: string | null;
        booking_status: string | null;
        status: string | null;
      }>
    >();

  if (bookingError) {
    throw bookingError;
  }

  const assignableBookings = (bookings ?? []).filter((booking) =>
    SOP_ASSIGNABLE_BOOKING_STATUSES.has(booking.booking_status ?? booking.status ?? ''),
  );
  if (assignableBookings.length === 0) {
    return;
  }

  const { data: sops, error: sopError } = await supabase
    .from('provider_sops')
    .select(
      'id, title, instructions, requires_photo, min_photo_count, max_photo_count, mandatory, sort_order, version, service_type',
    )
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .returns<
      Array<{
        id: string;
        title: string;
        instructions: string | null;
        requires_photo: boolean;
        min_photo_count: number;
        max_photo_count: number;
        mandatory: boolean;
        sort_order: number;
        version: number;
        service_type: string | null;
      }>
    >();

  if (sopError) {
    if (isSopRelationMissingError(sopError)) {
      console.warn('[sop-assignments] provider_sops table missing — skipping SOP assignment', sopError.message);
      return;
    }
    throw sopError;
  }

  if (!sops || sops.length === 0) {
    return;
  }

  const assignableBookingIds = assignableBookings.map((booking) => booking.id);

  const { data: existing, error: existingError } = await supabase
    .from('booking_sop_submissions')
    .select('booking_id, sop_id')
    .in('booking_id', assignableBookingIds)
    .returns<Array<{ booking_id: number; sop_id: string }>>();

  if (existingError) {
    if (isSopRelationMissingError(existingError)) {
      console.warn('[sop-assignments] booking_sop_submissions missing — skipping SOP assignment', existingError.message);
      return;
    }
    throw existingError;
  }

  const existingKeys = new Set((existing ?? []).map((row) => `${row.booking_id}:${row.sop_id}`));

  const inserts = assignableBookings.flatMap((booking) =>
    sops
      .filter(
        (sop) =>
          (!sop.service_type || sop.service_type === booking.service_type) &&
          !existingKeys.has(`${booking.id}:${sop.id}`),
      )
      .map((sop) => ({
        booking_id: booking.id,
        provider_id: booking.provider_id,
        sop_id: sop.id,
        title_snapshot: sop.title,
        instructions_snapshot: sop.instructions,
        requires_photo_snapshot: sop.requires_photo,
        min_photo_count_snapshot: sop.min_photo_count,
        max_photo_count_snapshot: sop.max_photo_count,
        mandatory_snapshot: sop.mandatory,
        sort_order_snapshot: sop.sort_order,
        sop_version: sop.version,
        status: 'pending' as const,
      })),
  );

  if (inserts.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from('booking_sop_submissions')
    .upsert(inserts, { onConflict: 'booking_id,sop_id', ignoreDuplicates: true });

  if (insertError) {
    if (isSopRelationMissingError(insertError)) {
      console.warn('[sop-assignments] booking_sop_submissions missing — skipping SOP insert', insertError.message);
      return;
    }
    throw insertError;
  }
}

export async function getBookingSopSubmissionsForBookings(supabase: SupabaseClient, bookingIds: number[]) {
  const map = new Map<number, BookingSopSubmissionRow[]>();
  const ids = normalizeBookingIds(bookingIds);
  if (ids.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('booking_sop_submissions')
    .select(SOP_SUBMISSION_SELECT)
    .in('booking_id', ids)
    .order('sort_order_snapshot', { ascending: true })
    .returns<BookingSopSubmissionRow[]>();

  if (error) {
    if (isSopRelationMissingError(error)) {
      console.warn('[sop-assignments] booking_sop_submissions missing — returning empty checklist', error.message);
      return map;
    }
    throw error;
  }

  for (const row of data ?? []) {
    const list = map.get(row.booking_id) ?? [];
    list.push(row);
    map.set(row.booking_id, list);
  }

  return map;
}

export async function getBookingSopPhotosForSubmissions(supabase: SupabaseClient, submissionIds: string[]) {
  const map = new Map<string, BookingSopPhotoRow[]>();
  const ids = Array.from(new Set(submissionIds.filter((id) => id && id.trim().length > 0)));
  if (ids.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('booking_sop_photos')
    .select('id, submission_id, storage_path, uploaded_by, created_at')
    .in('submission_id', ids)
    .order('created_at', { ascending: true })
    .returns<BookingSopPhotoRow[]>();

  if (error) {
    if (isSopRelationMissingError(error)) {
      console.warn('[sop-assignments] booking_sop_photos missing — returning empty photos', error.message);
      return map;
    }
    throw error;
  }

  for (const row of data ?? []) {
    const list = map.get(row.submission_id) ?? [];
    list.push(row);
    map.set(row.submission_id, list);
  }

  return map;
}

export async function getBookingSopPhotoCountsForSubmissions(supabase: SupabaseClient, submissionIds: string[]) {
  const photosBySubmission = await getBookingSopPhotosForSubmissions(supabase, submissionIds);
  const counts = new Map<string, number>();
  for (const [submissionId, photos] of photosBySubmission) {
    counts.set(submissionId, photos.length);
  }
  return counts;
}

/** Compact per-SOP view used by booking list payloads. */
export type BookingSopSummaryItem = {
  id: string;
  title: string;
  instructions: string | null;
  requires_photo: boolean;
  min_photo_count: number;
  max_photo_count: number;
  mandatory: boolean;
  status: BookingSopSubmissionStatus;
  photo_count: number;
  submitted_at: string | null;
  review_note: string | null;
};

export function toBookingSopSummaryItem(row: BookingSopSubmissionRow, photoCount: number): BookingSopSummaryItem {
  return {
    id: row.id,
    title: row.title_snapshot,
    instructions: row.instructions_snapshot,
    requires_photo: row.requires_photo_snapshot,
    min_photo_count: row.min_photo_count_snapshot,
    max_photo_count: row.max_photo_count_snapshot,
    mandatory: row.mandatory_snapshot,
    status: row.status,
    photo_count: photoCount,
    submitted_at: row.submitted_at,
    review_note: row.review_note,
  };
}

export type BookingSopStateSummary = {
  total: number;
  fulfilled: number;
  pending_mandatory: number;
  pending_optional: number;
  all_mandatory_fulfilled: boolean;
};

export function summarizeBookingSopState(items: BookingSopSummaryItem[]): BookingSopStateSummary {
  const pendingMandatory = items
    .filter((item) => item.mandatory)
    .filter((item) => !SOP_FULFILLED_STATUSES.includes(item.status));
  const pendingOptional = items
    .filter((item) => !item.mandatory)
    .filter((item) => !SOP_FULFILLED_STATUSES.includes(item.status));

  return {
    total: items.length,
    fulfilled: items.length - pendingMandatory.length - pendingOptional.length,
    pending_mandatory: pendingMandatory.length,
    pending_optional: pendingOptional.length,
    all_mandatory_fulfilled: pendingMandatory.length === 0,
  };
}

/** Mandatory submissions still blocking provider completion (ignores booking waiver). */
export async function getUnfulfilledMandatorySopSubmissions(
  supabase: SupabaseClient,
  bookingId: number,
): Promise<UnfulfilledSopSummary[]> {
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('booking_sop_submissions')
    .select('id, title_snapshot, mandatory_snapshot, status')
    .eq('booking_id', bookingId)
    .returns<
      Array<{
        id: string;
        title_snapshot: string;
        mandatory_snapshot: boolean;
        status: BookingSopSubmissionStatus;
      }>
    >();

  if (error) {
    if (isSopRelationMissingError(error)) {
      console.warn('[sop-assignments] booking_sop_submissions missing — treating SOPs as satisfied', error.message);
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .filter((row) => row.mandatory_snapshot && !SOP_FULFILLED_STATUSES.includes(row.status))
    .map((row) => ({ id: row.id, title: row.title_snapshot }));
}

/** Booking-level admin waiver flag. Degrades to false pre-migration. */
export async function isBookingSopEnforcementWaived(supabase: SupabaseClient, bookingId: number) {
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return false;
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('sop_completion_waived')
    .eq('id', bookingId)
    .maybeSingle<{ sop_completion_waived: boolean | null }>();

  if (error) {
    console.warn('[sop-assignments] unable to read SOP waiver flag — treating as not waived', error.message);
    return false;
  }

  return data?.sop_completion_waived === true;
}

/**
 * Provider completion gate. Throws SopRequirementsPendingError when mandatory
 * SOPs are unfulfilled and the booking is not admin-waived. Admin/staff actors
 * never call this — their transitions bypass SOP enforcement by design.
 */
export async function assertBookingSopRequirementsSatisfied(supabase: SupabaseClient, bookingId: number) {
  const [waived, missing] = await Promise.all([
    isBookingSopEnforcementWaived(supabase, bookingId),
    getUnfulfilledMandatorySopSubmissions(supabase, bookingId),
  ]);

  if (waived) {
    return;
  }

  if (missing.length > 0) {
    throw new SopRequirementsPendingError(missing);
  }
}

