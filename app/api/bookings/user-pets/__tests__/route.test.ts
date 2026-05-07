import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  requireApiRole: vi.fn(),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitKey: vi.fn((prefix: string, userId: string) => `${prefix}:${userId}`),
  isRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/pets/service', () => ({
  createPet: vi.fn(),
}));

vi.mock('@/lib/notifications/service', () => ({
  notifyPetAdded: vi.fn().mockResolvedValue(undefined),
}));

import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createPet } from '@/lib/pets/service';
import { POST } from '@/app/api/bookings/user-pets/route';

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

describe('POST /api/bookings/user-pets', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('lets admin create a pet for a target customer', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext('admin') as never);
    const adminClient = { id: 'admin-client' };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminClient as never);
    vi.mocked(createPet).mockResolvedValue({
      id: 42,
      user_id: '33333333-3333-4333-8333-333333333333',
      name: 'Milo',
      breed: 'Indie',
    } as never);

    const request = new Request('http://localhost/api/bookings/user-pets?userId=33333333-3333-4333-8333-333333333333', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Milo', breed: 'Indie' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(createPet).toHaveBeenCalledWith(
      adminClient,
      '33333333-3333-4333-8333-333333333333',
      expect.objectContaining({ name: 'Milo', breed: 'Indie' }),
    );
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.pet.id).toBe(42);
  });

  it('prevents a regular user from creating a pet for another customer', async () => {
    vi.mocked(requireApiRole).mockResolvedValue(makeAuthContext('user') as never);

    const request = new Request('http://localhost/api/bookings/user-pets?userId=33333333-3333-4333-8333-333333333333', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Milo' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(createPet).not.toHaveBeenCalled();
  });
});