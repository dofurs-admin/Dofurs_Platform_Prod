import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

type UserSearchRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  photo_url: string | null;
  created_at: string;
  roles: { name: string } | Array<{ name: string }> | null;
};

type PetSearchRow = {
  id: string;
  user_id: string;
  name: string;
  breed: string | null;
  age: number | null;
  gender: string | null;
  color: string | null;
  size_category: string | null;
  energy_level: string | null;
  created_at: string;
};

type ProviderLinkRow = {
  user_id: string;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: searchParams.get('q') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const search = parsed.data.q ?? '';
  const limit = parsed.data.limit ?? 20;

  if (!search) {
    return NextResponse.json({ users: [] });
  }

  let usersQuery = supabase
    .from('users')
    .select('id, name, email, phone, address, age, gender, photo_url, created_at, roles(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  usersQuery = usersQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

  const { data: usersData, error: usersError } = await usersQuery.returns<UserSearchRow[]>();

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const users = usersData ?? [];
  const userIds = users.map((user) => user.id);

  const { data: petsData, error: petsError } = userIds.length
    ? await supabase
        .from('pets')
        .select('id, user_id, name, breed, age, gender, color, size_category, energy_level, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .returns<PetSearchRow[]>()
    : { data: [], error: null };

  if (petsError) {
    return NextResponse.json({ error: petsError.message }, { status: 500 });
  }

  const { data: providerLinksData, error: providerLinksError } = userIds.length
    ? await supabase.from('providers').select('user_id').in('user_id', userIds).returns<ProviderLinkRow[]>()
    : { data: [], error: null };

  if (providerLinksError) {
    return NextResponse.json({ error: providerLinksError.message }, { status: 500 });
  }

  const providerUserIds = new Set((providerLinksData ?? []).map((row) => row.user_id));

  const petsByUser = new Map<string, PetSearchRow[]>();
  for (const pet of petsData ?? []) {
    const current = petsByUser.get(pet.user_id) ?? [];
    current.push(pet);
    petsByUser.set(pet.user_id, current);
  }

  return NextResponse.json({
    users: users.map((user) => {
      const roleName = (Array.isArray(user.roles) ? user.roles[0] : user.roles)?.name ?? null;
      const normalizedRole = roleName?.toLowerCase() ?? null;
      const profileType =
        normalizedRole === 'admin'
          ? 'admin'
          : normalizedRole === 'staff'
          ? 'staff'
          : normalizedRole === 'provider' || providerUserIds.has(user.id)
          ? 'provider'
          : 'customer';

      return {
        ...user,
        role: roleName,
        profile_type: profileType,
        pets: profileType === 'customer' ? (petsByUser.get(user.id) ?? []) : [],
      };
    }),
  });
}
