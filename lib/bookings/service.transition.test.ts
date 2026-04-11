import { describe, expect, it, vi } from 'vitest';
import { updateBookingStatus } from './service';
import type { BookingStatus } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

function createSupabaseForCurrentStatus(status: BookingStatus) {
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  query.select.mockImplementation(() => query);
  query.eq.mockImplementation(() => query);
  query.single.mockResolvedValue({
    data: { id: 1, user_id: 'user-1', provider_id: 101, booking_status: status },
    error: null,
  });

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
});
