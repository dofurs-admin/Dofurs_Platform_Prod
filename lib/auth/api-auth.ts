import { NextResponse } from 'next/server';
import { resolveBearerAuthUser } from '@/lib/auth/bearer-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getSupabaseBearerClient } from '@/lib/supabase/bearer-client';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppRole = 'user' | 'provider' | 'admin' | 'staff';

export const ADMIN_ROLES: AppRole[] = ['admin', 'staff'];
export const PROVIDER_ROLES: AppRole[] = ['provider', 'admin', 'staff'];

type ApiAuthContextOptions = {
  authorizationHeader?: string | null;
};

function normalizeRoleName(roleName: unknown): AppRole | null {
  return roleName === 'admin' || roleName === 'staff' || roleName === 'provider' || roleName === 'user'
    ? roleName
    : null;
}

export async function resolveRoleWithProviderPrecedence(
  supabase: SupabaseClient,
  userId: string,
  seedRole: AppRole | null = null,
) {
  let resolvedRole = seedRole;

  if (!resolvedRole) {
    const { data: profile } = await supabase.from('users').select('roles(name)').eq('id', userId).maybeSingle();
    const roleName = normalizeRoleName((Array.isArray(profile?.roles) ? profile?.roles[0] : profile?.roles)?.name);
    resolvedRole = roleName;
  }

  if (resolvedRole === 'admin' || resolvedRole === 'staff' || resolvedRole === 'provider') {
    return resolvedRole;
  }

  const { data: providerRecord } = await supabase
    .from('providers')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (providerRecord) {
    return 'provider' as const;
  }

  return resolvedRole;
}

export async function getApiAuthContext(options: ApiAuthContextOptions = {}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();

  if (cookieUser) {
    const roleName = await resolveRoleWithProviderPrecedence(supabase, cookieUser.id);

    return {
      supabase,
      user: cookieUser,
      role: roleName ?? null,
    };
  }

  const { accessToken, user: bearerUser } = await resolveBearerAuthUser(options.authorizationHeader);

  if (!bearerUser || !accessToken) {
    return {
      supabase,
      user: null,
      role: null,
    };
  }

  const bearerSupabase = getSupabaseBearerClient(accessToken);
  const adminSupabase = getSupabaseAdminClient();
  const roleName = await resolveRoleWithProviderPrecedence(adminSupabase, bearerUser.id);

  return {
    supabase: bearerSupabase,
    user: bearerUser,
    role: roleName ?? null,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export function isRoleAllowed(role: AppRole | null, allowedRoles: readonly AppRole[]) {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}

export async function getCurrentApiRole() {
  const { role } = await getApiAuthContext();
  return role;
}

export async function requireApiRole(allowedRoles: readonly AppRole[], options: ApiAuthContextOptions = {}) {
  const context = await getApiAuthContext(options);

  if (!context.user) {
    return {
      context: null,
      response: unauthorized(),
    } as const;
  }

  if (!isRoleAllowed(context.role, allowedRoles)) {
    return {
      context: null,
      response: forbidden(),
    } as const;
  }

  return {
    context,
    response: null,
  } as const;
}
