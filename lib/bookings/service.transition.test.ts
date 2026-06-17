import { describe, expect, it, vi } from 'vitest';
import { updateBookingStatus } from './service';
import type { BookingStatus } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

function createSupabaseForCurrentStatus(
  status: BookingStatus,
  options?: {
    updatedStatus?: BookingStatus;
  },
) {
  const query: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  query.select.mockImplementation(() => query);
  query.update.mockImplementation(() => query);
  query.insert.mockResolvedValue({ error: null });
  query.eq.mockImplementation(() => query);
  query.single.mockResolvedValueOnce({
    data: { id: 1, user_id: 'user-1', provider_id: 101, booking_status: status, status },
    error: null,
  });

  if (options?.updatedStatus) {
    query.single.mockResolvedValueOnce({
      data: {
        id: 1,
        user_id: 'user-1',
        provider_id: 101,
        booking_status: options.updatedStatus,
        status: options.updatedStatus,
      },
      error: null,
    });
  }

  const supabase = {
    from: vi.fn().mockImplementation(() => query),
  };

  return { supabase: supabase as unknown as SupabaseClient, query };
}

describe('updateBookingStatus transition enforcement', () => {
  it('rejects no-op transitions at service layer', async () => {
    const { supabase } = createSupabaseForCurrentStatus('pending');

    await expect(updateBookingStatus(supabase, 1, 'pending')).rejects.toThrow('BOOKING_STATUS_NOOP');
  });

  it('rejects illegal transitions at service layer', async () => {
    const { supabase } = createSupabaseForCurrentStatus('completed');

    await expect(updateBookingStatus(supabase, 1, 'confirmed')).rejects.toThrow('INVALID_BOOKING_TRANSITION');
  });

  it('allows admin/staff override transitions across terminal statuses', async () => {
    const { supabase } = createSupabaseForCurrentStatus('completed', { updatedStatus: 'confirmed' });

    await expect(
      updateBookingStatus(supabase, 1, 'confirmed', {
        actorRole: 'admin',
        actorId: 'admin-1',
      }),
    ).resolves.toMatchObject({
      booking_status: 'confirmed',
      status: 'confirmed',
    });
  });
});
