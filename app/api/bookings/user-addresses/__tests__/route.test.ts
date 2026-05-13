import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
  forbidden: vi.fn(() => Response.json({ error: 'Forbidden' }, { status: 403 })),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { POST } from '@/app/api/bookings/user-addresses/route';

function makeAuthContext(role: 'user' | 'admin' | 'staff' = 'admin') {
  return {
    response: null,
    context: {
      user: { id: role === 'user' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222' },
      role,
      supabase: { id: 'server-client' },
    },
  };
}

describe('POST /api/bookings/user-addresses', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('bootstraps a missing owner profile before admin saves a customer address', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext('admin') as never);

    const ownerProfileBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };

    const usersBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Alice Smith',
          email: null,
          phone: '+919876543210',
          photo_url: null,
          gender: null,
        },
        error: null,
      }),
    };

    const addressBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'address-id',
          label: 'Other',
          address_line_1: '221B Baker Street',
          address_line_2: null,
          city: '',
          state: '',
          pincode: '',
          country: 'India',
          latitude: 12.9716,
          longitude: 77.5946,
          phone: '+919876543210',
          is_default: false,
        },
        error: null,
      }),
    };

    const from = vi.fn((table: string) => {
      if (table === 'profiles') {
        return ownerProfileBuilder;
      }

      if (table === 'users') {
        return usersBuilder;
      }

      return addressBuilder;
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const request = new Request('http://localhost/api/bookings/user-addresses?userId=33333333-3333-4333-8333-333333333333', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'Other',
        addressLine1: '221B Baker Street',
        latitude: 12.9716,
        longitude: 77.5946,
        phone: '+919876543210',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(ownerProfileBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '33333333-3333-4333-8333-333333333333',
        full_name: 'Alice Smith',
        phone_number: '+919876543210',
      }),
      { onConflict: 'id' },
    );
    expect(addressBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: '33333333-3333-4333-8333-333333333333',
        address_line_1: '221B Baker Street',
        phone: '+919876543210',
      }),
    );

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.address.id).toBe('address-id');
  });
});