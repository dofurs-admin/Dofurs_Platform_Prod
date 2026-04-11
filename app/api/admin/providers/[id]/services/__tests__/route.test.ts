import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api-auth', () => ({
  getApiAuthContext: vi.fn(),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  forbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/provider-management/service', () => ({
  getProviderServicesWithPincodes: vi.fn(),
  updateProviderServiceRollout: vi.fn(),
  deleteProviderServiceRolloutEntry: vi.fn(),
  logProviderAdminAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { getApiAuthContext } from '@/lib/auth/api-auth';
import { deleteProviderServiceRolloutEntry, logProviderAdminAuditEvent } from '@/lib/provider-management/service';
import { DELETE } from '@/app/api/admin/providers/[id]/services/route';

describe('DELETE /api/admin/providers/[id]/services', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({ user: null, role: null, supabase: {} } as never);

    const request = new Request('http://localhost/api/admin/providers/10/services', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '10' }) });
    expect(response.status).toBe(401);
  });

  it('returns 403 when role is not admin/staff', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'user-1' },
      role: 'user',
      supabase: {},
    } as never);

    const request = new Request('http://localhost/api/admin/providers/10/services', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '10' }) });
    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid provider id', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'admin-1' },
      role: 'admin',
      supabase: {},
    } as never);

    const request = new Request('http://localhost/api/admin/providers/nope/services', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'nope' }) });
    expect(response.status).toBe(400);
  });

  it('returns 400 when serviceId is missing', async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'admin-1' },
      role: 'admin',
      supabase: {},
    } as never);

    const request = new Request('http://localhost/api/admin/providers/10/services', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '10' }) });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/serviceId is required/i);
  });

  it('deletes one provider service rollout and returns refreshed services', async () => {
    const refreshedServices = [
      {
        id: 'svc-2',
        provider_id: 10,
        service_type: 'grooming',
        base_price: 499,
        surge_price: null,
        commission_percentage: null,
        service_duration_minutes: null,
        is_active: true,
        service_pincodes: ['560001'],
      },
    ];

    vi.mocked(getApiAuthContext).mockResolvedValue({
      user: { id: 'admin-1' },
      role: 'admin',
      supabase: { marker: 'supabase' },
    } as never);

    vi.mocked(deleteProviderServiceRolloutEntry).mockResolvedValue(refreshedServices as never);

    const request = new Request('http://localhost/api/admin/providers/10/services', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: '10' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.services).toEqual(refreshedServices);
    expect(deleteProviderServiceRolloutEntry).toHaveBeenCalledWith({ marker: 'supabase' }, 10, 'svc-1');
    expect(logProviderAdminAuditEvent).toHaveBeenCalledWith(
      { marker: 'supabase' },
      'admin-1',
      10,
      'provider.service_rollout_deleted',
      expect.objectContaining({ serviceId: 'svc-1' }),
    );
  });
});
