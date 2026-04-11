import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

const querySchema = z.object({
  query: z.string().trim().min(2).max(120),
});

type SearchUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

export async function GET(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const adminClient = getSupabaseAdminClient();
  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:search-user', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  let effectiveRole = role;

  if (!effectiveRole) {
    const { data: roleProbe } = await adminClient.from('users').select('roles(name)').eq('id', user.id).maybeSingle();
    const probedRole = (Array.isArray(roleProbe?.roles) ? roleProbe?.roles[0] : roleProbe?.roles)?.name;
    effectiveRole = (probedRole as 'admin' | 'staff' | 'provider' | 'user' | null | undefined) ?? null;
  }

  if (effectiveRole !== 'admin' && effectiveRole !== 'staff' && effectiveRole !== 'provider') {
    return forbidden();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    query: url.searchParams.get('query') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
  }

  const queryLike = `%${parsed.data.query}%`;

  const publicUsersResult = await adminClient
    .from('users')
    .select('id, name, email, phone, roles(name)')
    .or(`name.ilike.${queryLike},email.ilike.${queryLike},phone.ilike.${queryLike}`)
    .limit(250);

  if (publicUsersResult.error) {
    const mapped = toFriendlyApiError(publicUsersResult.error, 'Failed to search users');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const users = (publicUsersResult.data ?? [])
    .map((row) => {
    const roleName = (Array.isArray(row.roles) ? row.roles[0] : row.roles)?.name ?? null;
      return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: roleName,
      } as SearchUser;
    })
    .filter((row) => row.role !== 'admin' && row.role !== 'staff' && row.role !== 'provider')
    .sort((left, right) => {
      const leftLabel = (left.name ?? left.email ?? left.id).toLowerCase();
      const rightLabel = (right.name ?? right.email ?? right.id).toLowerCase();
      return leftLabel.localeCompare(rightLabel);
    })
    .slice(0, 25)
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
    }));

  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}