import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { claimPendingPetShares, listAccessiblePetsForUser } from '@/lib/pets/share-access';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

type BookableUser = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string | null;
};

type CatalogDiscount = {
  id: string;
  code: string;
  title: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  max_discount_amount: number | null;
  min_booking_amount: number | null;
  applies_to_service_type: string | null;
  first_booking_only: boolean;
  valid_until: string | null;
};

type CatalogAddress = {
  id: string;
  label: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  is_default: boolean;
};

export async function GET(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const adminClient = getSupabaseAdminClient();
  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:catalog:get', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  let effectiveRole = role;

  if (!effectiveRole) {
    const { data: roleProbe } = await adminClient.from('users').select('roles(name)').eq('id', user.id).maybeSingle();
    const probedRole = (Array.isArray(roleProbe?.roles) ? roleProbe?.roles[0] : roleProbe?.roles)?.name;
    effectiveRole = (probedRole as 'admin' | 'staff' | 'provider' | 'user' | null | undefined) ?? null;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const canBookForUsers = effectiveRole === 'admin' || effectiveRole === 'staff' || effectiveRole === 'provider';

  if (parsed.data.userId && !canBookForUsers && parsed.data.userId !== user.id) {
    return forbidden();
  }

  let providerFilterId: number | null = null;

  if (effectiveRole === 'provider') {
    providerFilterId = await getProviderIdByUserId(supabase, user.id);

    if (!providerFilterId) {
      return NextResponse.json({ error: 'Provider profile not linked to this account.' }, { status: 404 });
    }
  }

  let bookableUsers: BookableUser[] = [];

  if (canBookForUsers) {
    const allUsersResult = await adminClient
      .from('users')
      .select('id, name, email, roles(name)')
      .order('name', { ascending: true })
      .limit(1000);

    if (allUsersResult.error) {
      const mapped = toFriendlyApiError(allUsersResult.error, 'Failed to load booking catalog');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    bookableUsers = (allUsersResult.data ?? [])
      .map((row) => {
        const roleName = (Array.isArray(row.roles) ? row.roles[0] : row.roles)?.name ?? null;
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: roleName,
        } as BookableUser;
      })
      .filter((row) => row.role !== 'admin' && row.role !== 'staff' && row.role !== 'provider')
      .sort((left, right) => {
        const leftLabel = (left.name ?? left.email ?? left.id).toLowerCase();
        const rightLabel = (right.name ?? right.email ?? right.id).toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      });
  }

  let selectedUserId: string | null;

  if (canBookForUsers) {
    const requestedUserId = parsed.data.userId ?? null;
    selectedUserId = requestedUserId && bookableUsers.some((item) => item.id === requestedUserId) ? requestedUserId : null;
  } else {
    selectedUserId = user.id;
  }

  const providersRequest = providerFilterId
    ? supabase.from('providers').select('id, name, provider_type').eq('id', providerFilterId).order('name', { ascending: true })
    : supabase.from('providers').select('id, name, provider_type').order('name', { ascending: true });

  const providerServicesRequest = providerFilterId
    ? supabase
        .from('provider_services')
      .select('id, provider_id, service_type, service_mode, base_price, service_duration_minutes, is_active')
        .eq('provider_id', providerFilterId)
        .eq('is_active', true)
        .order('service_type', { ascending: true })
    : supabase
        .from('provider_services')
      .select('id, provider_id, service_type, service_mode, base_price, service_duration_minutes, is_active')
        .eq('is_active', true)
        .order('service_type', { ascending: true });

  const addressesRequest = selectedUserId
    ? (canBookForUsers && selectedUserId !== user.id ? adminClient : supabase)
        .from('user_addresses')
        .select('id, label, address_line_1, address_line_2, city, state, pincode, country, latitude, longitude, phone, is_default')
        .eq('user_id', selectedUserId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [providersResult, providerServicesResult, addressesResult] = await Promise.all([
    providersRequest,
    providerServicesRequest,
    addressesRequest,
  ]);

  if (providersResult.error || providerServicesResult.error || (addressesResult.error && addressesResult.error.code !== '42P01')) {
    const error = providersResult.error || providerServicesResult.error || addressesResult.error;
    const mapped = toFriendlyApiError(error, 'Failed to load booking catalog');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  let pets: Array<{ id: number; name: string; breed: string | null; photo_url: string | null }> = [];

  if (selectedUserId) {
    if (selectedUserId === user.id) {
      try {
        await claimPendingPetShares(adminClient, user.id, user.email);
      } catch (claimErr) {
        // Non-fatal: shared-pet claiming can fail without blocking the catalog
        console.error('[bookings/catalog] claimPendingPetShares failed:', claimErr);
      }
    }

    try {
      const accessiblePets = await listAccessiblePetsForUser(adminClient, selectedUserId);
      const bookablePets = accessiblePets.filter((pet) => pet.access_role === 'owner' || pet.access_role === 'manager');
      pets = bookablePets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        breed: pet.breed,
        photo_url: pet.photo_url,
      }));
    } catch (petErr) {
      // If shared-pet query fails (e.g. missing table), fall back to owned pets only
      console.error('[bookings/catalog] listAccessiblePetsForUser failed, falling back to owned pets:', petErr);
      const { data: ownedPets } = await adminClient
        .from('pets')
        .select('id, name, breed, photo_url')
        .eq('user_id', selectedUserId)
        .order('created_at', { ascending: false });
      pets = (ownedPets ?? []) as typeof pets;
    }
  }

  const providerServices = providerServicesResult.data ?? [];
  const providerRows = providersResult.data ?? [];

  let resolvedProviders = providerRows;

  if (resolvedProviders.length === 0) {
    const providerIdsFromServices = Array.from(
      new Set(
        providerServices
          .map((item) => item.provider_id)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
      ),
    );

    if (providerIdsFromServices.length > 0) {
      const fallbackProvidersResult = await adminClient
        .from('providers')
        .select('id, name, provider_type')
        .in('id', providerIdsFromServices)
        .order('name', { ascending: true });

      if (fallbackProvidersResult.error) {
        const mapped = toFriendlyApiError(fallbackProvidersResult.error, 'Failed to load booking providers');
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
      }

      resolvedProviders = fallbackProvidersResult.data ?? [];
    }
  }

  const nowIso = new Date().toISOString();
  const { data: discountsData, error: discountsError } = await supabase
    .from('platform_discounts')
    .select(
      'id, code, title, discount_type, discount_value, max_discount_amount, min_booking_amount, applies_to_service_type, first_booking_only, valid_until, is_active, valid_from',
    )
    .eq('is_active', true)
    .lte('valid_from', nowIso)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (discountsError && discountsError.code !== '42P01') {
    const mapped = toFriendlyApiError(discountsError, 'Failed to load discounts');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const mergedServices = [
    ...providerServices.map((item) => ({
      id: item.id,
      provider_id: item.provider_id,
      service_type: item.service_type,
      service_mode: item.service_mode ?? 'home_visit',
      service_duration_minutes: item.service_duration_minutes ?? 30,
      buffer_minutes: 0,
      base_price: item.base_price,
      source: 'provider_services' as const,
    })),
  ];

  return NextResponse.json({
    actorRole: effectiveRole,
    canBookForUsers,
    bookableUsers,
    selectedUserId,
    providers: resolvedProviders,
    services: mergedServices,
    pets,
    addresses: ((addressesResult.data ?? []) as CatalogAddress[]),
    discounts: ((discountsData ?? []) as Array<CatalogDiscount & { is_active: boolean; valid_from: string }>).map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
      max_discount_amount: item.max_discount_amount,
      min_booking_amount: item.min_booking_amount,
      applies_to_service_type: item.applies_to_service_type,
      first_booking_only: item.first_booking_only,
      valid_until: item.valid_until,
    })),
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
