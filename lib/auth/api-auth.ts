import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppRole = 'user' | 'provider' | 'admin' | 'staff';

export const ADMIN_ROLES: AppRole[] = ['admin', 'staff'];
export const PROVIDER_ROLES: AppRole[] = ['provider', 'admin', 'staff'];

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

export async function getApiAuthContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      role: null,
    };
  }

  const roleName = await resolveRoleWithProviderPrecedence(supabase, user.id);

  return {
    supabase,
    user,
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

export async function requireApiRole(allowedRoles: readonly AppRole[]) {
  const context = await getApiAuthContext();

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
