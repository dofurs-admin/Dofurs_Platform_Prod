import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertBookingSopRequirementsSatisfied,
  ensureBookingSopSubmissions,
  getUnfulfilledMandatorySopSubmissions,
  isBookingSopEnforcementWaived,
  SopRequirementsPendingError,
  summarizeBookingSopState,
  toBookingSopSummaryItem,
  SOP_FULFILLED_STATUSES,
  type BookingSopSubmissionRow,
} from './sop-assignments';

function buildSubmissionRow(overrides: Partial<BookingSopSubmissionRow> = {}): BookingSopSubmissionRow {
  return {
    id: 'submission-1',
    booking_id: 1,
    provider_id: 101,
    sop_id: 'sop-1',
    title_snapshot: 'Groomer in Uniform',
    instructions_snapshot: null,
    requires_photo_snapshot: true,
    min_photo_count_snapshot: 1,
    max_photo_count_snapshot: 2,
    mandatory_snapshot: true,
    sort_order_snapshot: 10,
    sop_version: 1,
    status: 'pending',
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    waived_by: null,
    waived_at: null,
    waive_reason: null,
    created_at: '2026-07-09T10:00:00+05:30',
    updated_at: '2026-07-09T10:00:00+05:30',
    ...overrides,
  };
}

describe('SOP summary helpers', () => {
  it('marks mandatory submissions fulfilled only in submitted/approved/waived states', () => {
    expect(SOP_FULFILLED_STATUSES.includes('submitted')).toBe(true);
    expect(SOP_FULFILLED_STATUSES.includes('approved')).toBe(true);
    expect(SOP_FULFILLED_STATUSES.includes('waived')).toBe(true);
    expect(SOP_FULFILLED_STATUSES.includes('pending')).toBe(false);
    expect(SOP_FULFILLED_STATUSES.includes('rejected')).toBe(false);
  });

  it('summarises booking SOP state with pending mandatory counts', () => {
    const items = [
      toBookingSopSummaryItem(buildSubmissionRow({ id: 'a', status: 'submitted', mandatory_snapshot: true }), 2),
      toBookingSopSummaryItem(buildSubmissionRow({ id: 'b', status: 'pending', mandatory_snapshot: true }), 0),
      toBookingSopSummaryItem(buildSubmissionRow({ id: 'c', status: 'pending', mandatory_snapshot: false }), 0),
    ];

    const summary = summarizeBookingSopState(items);

    expect(summary.total).toBe(3);
    expect(summary.fulfilled).toBe(1);
    expect(summary.pending_mandatory).toBe(1);
    expect(summary.pending_optional).toBe(1);
    expect(summary.all_mandatory_fulfilled).toBe(false);
  });
});

describe('assertBookingSopRequirementsSatisfied', () => {
  function createSupabaseWithRows(rows: Array<{ mandatory: boolean; status: string }>, waived: boolean) {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(
          waived
            ? { data: { sop_completion_waived: true }, error: null }
            : { data: { sop_completion_waived: false }, error: null },
        ),
      ),
      returns: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: rows.map((row, index) => ({
            id: `sop-${index}`,
            title_snapshot: `SOP ${index + 1}`,
            mandatory_snapshot: row.mandatory,
            status: row.status,
          })),
          error: null,
        }),
      ),
    };

    return { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
  }

  it('passes when every mandatory SOP is submitted', async () => {
    const supabase = createSupabaseWithRows(
      [
        { mandatory: true, status: 'submitted' },
        { mandatory: false, status: 'pending' },
      ],
      false,
    );

    await expect(assertBookingSopRequirementsSatisfied(supabase, 1)).resolves.toBeUndefined();
  });

  it('throws SopRequirementsPendingError listing unfulfilled mandatory SOPs', async () => {
    const supabase = createSupabaseWithRows(
      [
        { mandatory: true, status: 'submitted' },
        { mandatory: true, status: 'pending' },
        { mandatory: true, status: 'rejected' },
      ],
      false,
    );

    let caught: unknown = null;
    try {
      await assertBookingSopRequirementsSatisfied(supabase, 1);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SopRequirementsPendingError);
    const sopError = caught as SopRequirementsPendingError;
    expect(sopError.missingSops.map((sop) => sop.title)).toEqual(['SOP 2', 'SOP 3']);
    expect(sopError.message.startsWith('SOP_REQUIREMENTS_PENDING:')).toBe(true);
  });

  it('passes when the booking has an admin waiver even with pending SOPs', async () => {
    const supabase = createSupabaseWithRows([{ mandatory: true, status: 'pending' }], true);

    await expect(assertBookingSopRequirementsSatisfied(supabase, 1)).resolves.toBeUndefined();
  });
});

describe('missing-relation tolerance (pre-migration safety)', () => {
  it('treats missing SOP tables as no requirements', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { sop_completion_waived: false }, error: null }),
      returns: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation "booking_sop_submissions" does not exist' },
      }),
    };
    const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;

    await expect(getUnfulfilledMandatorySopSubmissions(supabase, 1)).resolves.toEqual([]);
  });

  it('treats unreadable waiver flag as not waived', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42703', message: 'column bookings.sop_completion_waived does not exist' },
      }),
    };
    const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;

    await expect(isBookingSopEnforcementWaived(supabase, 1)).resolves.toBe(false);
  });

  it('skips SOP assignment when the tables are missing', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      returns: vi.fn().mockImplementation((promise) => promise),
    };

    // bookings query resolves; provider_sops query 42P01s
    query.returns
      .mockResolvedValueOnce({
        data: [{ id: 1, provider_id: 101, service_type: 'grooming', booking_status: 'confirmed', status: 'confirmed' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '42P01', message: 'relation "provider_sops" does not exist' },
      });

    const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;

    await expect(ensureBookingSopSubmissions(supabase, [1])).resolves.toBeUndefined();
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it('does not assign SOPs to terminal bookings', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      returns: vi.fn().mockImplementation((promise) => promise),
    };

    query.returns.mockResolvedValueOnce({
      data: [{ id: 1, provider_id: 101, service_type: 'grooming', booking_status: 'completed', status: 'completed' }],
      error: null,
    });

    const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;

    await expect(ensureBookingSopSubmissions(supabase, [1])).resolves.toBeUndefined();
    expect(query.eq).not.toHaveBeenCalledWith('status', 'active');
    expect(query.upsert).not.toHaveBeenCalled();
  });
});
